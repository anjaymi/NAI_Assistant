interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
}

interface KVNamespace {
    get<T = string>(key: string, options?: { type: "text" | "json" | "arrayBuffer" | "stream" }): Promise<T | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
}

export interface Env {
  AIRDROP_SIGNALS: KVNamespace;
}

interface RelaySignal {
    id: string;
    urls: string[];
    timestamp: number;
    metadata?: Record<string, unknown>;
}

interface TokenMailbox {
    signals: RelaySignal[];
    updatedAt: number;
}

interface SubscriptionResponse {
    tier?: number;
    trainingStepsLeft?: {
        fixedTrainingStepsLeft?: number;
        purchasedTrainingSteps?: number;
    };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

    try {
        if (path === "/api/relay/push" && request.method === "POST") {
            return await handlePush(request, env);
        } else if (path === "/api/relay/pull" && request.method === "GET") {
            return await handlePull(request, env);
        } else if (path === "/api/relay/register_pc" && request.method === "POST") {
            return await handleRegisterPc(request, env);
        } else if (path === "/api/relay/discover_pc" && request.method === "GET") {
            return await handleDiscoverPc(request, env);
        } else if (path === "/api/nai/subscription" && request.method === "POST") {
            return await handleNovelAiSubscriptionProxy(request);
        }

        return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { "Content-Type": "application/json", ...CORS_HEADERS } 
        });
    }
  },
};

const MAILBOX_TTL_SECONDS = 300;
const PC_DISCOVERY_TTL_SECONDS = 60;
const DEFAULT_PULL_LIMIT = 20;
const MAX_PULL_LIMIT = 50;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
        headers.set(key, value);
    }

    return new Response(JSON.stringify(body), {
        ...init,
        headers,
    });
}

function getMailboxKey(token: string): string {
    return `nai_airdrop_mailbox_${token}`;
}

async function readMailbox(env: Env, token: string): Promise<TokenMailbox> {
    const key = getMailboxKey(token);
    const mailbox = await env.AIRDROP_SIGNALS.get<TokenMailbox>(key, { type: "json" });
    if (!mailbox || !Array.isArray(mailbox.signals)) {
        return { signals: [], updatedAt: Date.now() };
    }

    return {
        signals: mailbox.signals,
        updatedAt: typeof mailbox.updatedAt === "number" ? mailbox.updatedAt : Date.now(),
    };
}

async function writeMailbox(env: Env, token: string, mailbox: TokenMailbox): Promise<void> {
    const key = getMailboxKey(token);
    if (mailbox.signals.length === 0) {
        await env.AIRDROP_SIGNALS.delete(key);
        return;
    }

    mailbox.updatedAt = Date.now();
    await env.AIRDROP_SIGNALS.put(key, JSON.stringify(mailbox), { expirationTtl: MAILBOX_TTL_SECONDS });
}

// --- Handlers ---

// Request body: { token: string, urls: string[] }
async function handlePush(request: Request, env: Env): Promise<Response> {
    const body: any = await request.json();
    const token = body.token;
    const urls = body.urls || [];
    const metadata = body.metadata || {};

    if (!token) {
        return jsonResponse({ error: "Missing token" }, { status: 400 });
    }

    // generate_command 类型允许空 urls；普通 airdrop 推送须含图片 URL
    const isGenerateCommand = metadata?.type === 'generate_command';
    if (!isGenerateCommand && (!Array.isArray(urls) || urls.length === 0)) {
        return jsonResponse({ error: "Invalid payload: urls required for airdrop" }, { status: 400 });
    }

    // A signal ID
    const signalId = crypto.randomUUID();
    const signal: RelaySignal = {
        id: signalId,
        urls: urls,
        timestamp: Date.now(),
        metadata: metadata,
    };

    const mailbox = await readMailbox(env, token);
    mailbox.signals.push(signal);
    await writeMailbox(env, token, mailbox);

    return jsonResponse({ success: true, signalId }, { status: 200 });
}

// Query param: ?token=XYZ
async function handlePull(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const requestedLimit = parseInt(url.searchParams.get("limit") || `${DEFAULT_PULL_LIMIT}`, 10);
    const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(requestedLimit, MAX_PULL_LIMIT))
        : DEFAULT_PULL_LIMIT;

    if (!token) {
        return jsonResponse({ error: "Missing token" }, { status: 400 });
    }

    const mailbox = await readMailbox(env, token);
    const signals = mailbox.signals.slice(0, limit);
    mailbox.signals = mailbox.signals.slice(limit);
    await writeMailbox(env, token, mailbox);

    return jsonResponse({ signals }, { status: 200 });
}

// Request body: { token: string, lan_ip: string }
async function handleRegisterPc(request: Request, env: Env): Promise<Response> {
    const body: any = await request.json();
    const token = body.token;
    const lanIp = body.lan_ip;

    if (!token || !lanIp) {
        return jsonResponse({ error: "Invalid payload" }, { status: 400 });
    }

    const key = `nai_airdrop_pc_${token}`;
    // Store LAN IP with 60s expiration to keep the auto discovery fresh
    await env.AIRDROP_SIGNALS.put(key, JSON.stringify({ lanIp, timestamp: Date.now() }), { expirationTtl: PC_DISCOVERY_TTL_SECONDS });

    return jsonResponse({ success: true }, { status: 200 });
}

// Query param: ?token=XYZ
async function handleDiscoverPc(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
        return jsonResponse({ error: "Missing token" }, { status: 400 });
    }

    const key = `nai_airdrop_pc_${token}`;
    const val = await env.AIRDROP_SIGNALS.get(key, { type: "json" });

    if (!val) {
        return jsonResponse({ error: "No active PC found for this token" }, { status: 404 });
    }

    return jsonResponse(val, { status: 200 });
}

async function handleNovelAiSubscriptionProxy(request: Request): Promise<Response> {
    const body: any = await request.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    if (!token) {
        return jsonResponse({ error: 'Missing token' }, { status: 400 });
    }

    const cleanToken = token.toLowerCase().startsWith('bearer ') ? token.slice(7).trim() : token;

    const response = await fetch('https://api.novelai.net/user/subscription', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'NAI_Assistant_Relay/0.12.1',
        },
    });

    if (response.status === 401) {
        return jsonResponse({ valid: false, error: 'Invalid API token' }, { status: 401 });
    }

    if (!response.ok) {
        const errorText = await response.text();
        return jsonResponse(
            { error: `NovelAI upstream error: ${response.status}`, detail: errorText },
            { status: response.status }
        );
    }

    const data = await response.json<SubscriptionResponse>();
    return jsonResponse({
        valid: true,
        tier: data.tier ?? 0,
        trainingStepsLeft: data.trainingStepsLeft ?? null,
    });
}
