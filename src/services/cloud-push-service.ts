import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { useSettingsStore } from '@/stores/settings-store';
import { useSyncFlowStore } from '@/stores/sync-flow-store';

const WORKER_URL = "https://nai-airdrop-relay.liuanjay.workers.dev";

export interface UploadProgressCallback {
    (progress: number): void;
}

/**
 * 将 Blob/File 或 Uint8Array 上传至中立图床 (Catbox.moe)
 * 注意：使用 tauriFetch() 来避免 WebView 中严格的跨域限制引发 Network Error
 * 
 * @param fileBuffer 图片二进制数据 (ArrayBuffer 或 Blob)
 * @param fileName 文件名
 * @param onProgress 进度回调 (0-100)
 * @returns 返回图床 URL
 */
export async function uploadToImageHost(
    fileBuffer: ArrayBuffer | Blob, 
    fileName: string, 
    onProgress?: (percent: number) => void
): Promise<string> {
    return new Promise(async (resolve, reject) => {
        let blob: Blob;
        
        if (fileBuffer instanceof ArrayBuffer) {
            blob = new Blob([fileBuffer], { type: 'image/png' });
        } else {
            blob = fileBuffer;
        }

        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', blob, fileName);

        // 由于 Android WebView 对非同源表单的跨域极度敏锐，这里直接使用 @tauri-apps/plugin-http 的 tauriFetch
        try {
            const response = await tauriFetch('https://catbox.moe/user/api.php', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed with status ${response.status}`);
            }

            const url = await response.text();
            if (url.startsWith('https://')) {
                resolve(url.trim());
            } else {
                reject(new Error(`Invalid response from image host: ${url}`));
            }
        } catch (err) {
            console.error("Catbox upload error:", err);
            reject(new Error("Network error during upload. Please check connection."));
        }
    });
}

/**
 * PING 探测被分配的局域网 IP 是否具有存活的直连信道
 * 调用 Rust 原生命令，完全绕过 WebView 的 Mixed Content 和 Tauri HTTP 插件限制
 */
export async function pingLanHost(ip: string): Promise<boolean | string> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<boolean>('ping_lan', { ip });
        return result;
    } catch (e: any) {
        return e?.toString() || "Unknown error";
    }
}

/**
 * 将 Blob/File 等载体在局域网下绝速直传至原生 Web 服务器。
 * 调用 Rust 原生命令用 reqwest multipart 发送，绕过 WebView 限制。
 * @param ip PC的局域网IPv4
 * @param fileBuffer 文件
 * @param fileName 文件名
 */
export async function uploadToLanHost(
    ip: string,
    fileBuffer: ArrayBuffer | Blob,
    fileName: string
): Promise<boolean> {
    const { invoke } = await import('@tauri-apps/api/core');
    
    let bytes: Uint8Array;
    if (fileBuffer instanceof Blob) {
        const ab = await fileBuffer.arrayBuffer();
        bytes = new Uint8Array(ab);
    } else {
        bytes = new Uint8Array(fileBuffer);
    }

    // Tauri 会将 Array<number> 自动映射到 Rust 的 Vec<u8>
    const result = await invoke<boolean>('upload_to_lan', { 
        ip, 
        fileData: Array.from(bytes), 
        fileName 
    });
    return result;
}

/**
 * 将上传好的一组图片 URL 及元数据以信令形式推送到 Cloudflare Worker 中转服务
 * 以便处于轮询中的 PC 机能即时拉取。
 * 
 * @param token Cloud Sync Token (Auth)
 * @param imageUrls 上传完成的外链集
 * @param metadata 附加生成的 prompt / parameters 属性
 */
export async function sendPushSignalToWorker(
    token: string,
    imageUrls: string[],
    metadata?: any
): Promise<void> {
    if (!token) throw new Error("Cloud Sync Token is required.");

    useSyncFlowStore.getState().showTask({
        id: `push-${Date.now()}`,
        kind: 'airdrop',
        title: 'Cloud Airdrop',
        detail: `正在投递 ${imageUrls.length} 张图片到云端中继`,
        tone: 'info',
        status: 'active',
    });

    const { deviceId } = useSettingsStore.getState();
    const payload = {
        token: token,
        urls: imageUrls,
        metadata: {
            ...metadata,
            senderId: deviceId
        }
    };

    try {
        const res = await tauriFetch(`${WORKER_URL}/api/relay/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Push signal failed: HTTP ${res.status} - ${errText}`);
        }
        useSyncFlowStore.getState().updateTask({
            detail: '云端已确认接收，等待桌面端拉取',
            tone: 'success',
            status: 'success',
        });
    } catch (e) {
        // Fallback to window.fetch if tauri Fetch is unavailable 
        // (e.g. standard browser env unexpectedly)
        console.warn("[Cloud Push] Tauri fetch failed, falling back to window.fetch", e);
        const res = await window.fetch(`${WORKER_URL}/api/relay/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            useSyncFlowStore.getState().updateTask({
                detail: '云端中继投递失败',
                tone: 'error',
                status: 'error',
            });
            throw new Error(`Push signal failed: HTTP ${res.status} - ${errText}`);
        }

        useSyncFlowStore.getState().updateTask({
            detail: '云端已确认接收，等待桌面端拉取',
            tone: 'success',
            status: 'success',
        });
    }
}

/**
 * 将完整的生图参数推送到 Cloudflare Worker 中转服务
 * 用于手机端遥控 PC 端执行生图。
 */
export async function sendGenerateCommandToWorker(
    token: string,
    config: any
): Promise<void> {
    if (!token) throw new Error("Cloud Sync Token is required.");

    useSyncFlowStore.getState().showTask({
        id: `generate-push-${Date.now()}`,
        kind: 'generate',
        title: '远程生图',
        detail: '正在发送远程生图指令到云端中继',
        tone: 'info',
        status: 'active',
    });

    const { deviceId } = useSettingsStore.getState();
    const payload = {
        token: token,
        urls: [],
        metadata: {
            type: 'generate_command',
            config: config,
            senderId: deviceId
        }
    };

    try {
        const res = await tauriFetch(`${WORKER_URL}/api/relay/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Send command failed: HTTP ${res.status} - ${errText}`);
        }
        useSyncFlowStore.getState().updateTask({
            detail: '指令已送达云端，等待桌面端接收',
            tone: 'success',
            status: 'success',
        });
    } catch (e) {
        console.warn("[Cloud Push] Tauri fetch failed, falling back to window.fetch", e);
        const res = await window.fetch(`${WORKER_URL}/api/relay/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            useSyncFlowStore.getState().updateTask({
                detail: '远程生图指令投递失败',
                tone: 'error',
                status: 'error',
            });
            throw new Error(`Send command failed: HTTP ${res.status} - ${errText}`);
        }

        useSyncFlowStore.getState().updateTask({
            detail: '指令已送达云端，等待桌面端接收',
            tone: 'success',
            status: 'success',
        });
    }
}

/**
 * [Auto LAN Discovery] 将当前的局域网 PC IP 登记在 Worker 云侧
 */
export async function registerLanPcIp(token: string, ip: string): Promise<boolean> {
    if (!token || !ip) return false;
    try {
        const res = await tauriFetch(`${WORKER_URL}/api/relay/register_pc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, lan_ip: ip })
        });
        return res.ok;
    } catch (e) {
        console.warn("Heartbeat PC Registration to Cloud Relay failed", e);
        return false;
    }
}

/**
 * [Auto LAN Discovery] 向 Worker 请求拉取其登记的心跳 PC IP
 */
export async function discoverLanPcIp(token: string): Promise<string | null> {
    if (!token) return null;
    try {
        const res = await tauriFetch(`${WORKER_URL}/api/relay/discover_pc?token=${token}`, {
            method: 'GET'
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        return data.lanIp || null;
    } catch (e) {
        return null;
    }
}
