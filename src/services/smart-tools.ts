import { invokeWithTimeout } from '@/lib/ipc-timeout';
import { useSettingsStore } from '@/stores/settings-store'

export interface TagResult {
    label: string
    score: number
}

// Custom error for local tagger unavailable
export class LocalTaggerUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LocalTaggerUnavailableError';
    }
}


/**
 * Singleton class to manage Smart Tools (Transformer models)
 */
class SmartToolsService {
    private static instance: SmartToolsService

    private constructor() { }

    public static getInstance(): SmartToolsService {
        if (!SmartToolsService.instance) {
            SmartToolsService.instance = new SmartToolsService()
        }
        return SmartToolsService.instance
    }

    // ===== Cached state for performance =====
    private gradioClient: any = null;
    private localServerReady = false;
    private upscaleImageFn: ((token: string, imageBase64: string, width: number, height: number) => Promise<{ success: boolean; imageData?: string; error?: string }>) | null = null;

    /**
     * Analyze Artist/Style - supports dual modes: online (HF) or local (downloaded)
     */
    public async analyzeStyle(imageUrl: string): Promise<TagResult[]> {
        const { taggerMode, remoteTaggerUrl } = useSettingsStore.getState()

        if (taggerMode === 'online') {
            console.log('SmartTools: Using online WD-Tagger API...');
            return this.analyzeStyleHuggingFace(imageUrl);
        } else {
            try {
                await this.ensureLocalServerReady(remoteTaggerUrl);
                console.log(`SmartTools: Using local tagger at ${remoteTaggerUrl}...`);
                return this.callLocalTagger(imageUrl, remoteTaggerUrl, 0.35);
            } catch (e) {
                console.warn("Local Tagger failed, falling back to online:", e);
                return this.analyzeStyleHuggingFace(imageUrl);
            }
        }
    }

    /**
     * Ensure local tagger server is running.
     * Uses cached readiness flag to skip health check on subsequent calls.
     */
    private async ensureLocalServerReady(apiUrl: string): Promise<void> {
        // Skip health check if we already confirmed it's running
        if (this.localServerReady) return;

        try {
            const healthCheck = await fetch(`${apiUrl}/health`, {
                signal: AbortSignal.timeout(2000) // 2s timeout, don't hang
            });
            if (healthCheck.ok) {
                this.localServerReady = true;
                return;
            }
        } catch { /* Not running */ }

        // Start the server via Tauri backend
        console.log('SmartTools: Starting local tagger server...');
        const { invoke } = await import('@tauri-apps/api/core');
        await invokeWithTimeout('start_local_tagger', undefined, 60000);

        // Wait for server to be ready (exponential backoff)
        for (let i = 0; i < 20; i++) {
            try {
                const resp = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(1000) });
                if (resp.ok) {
                    this.localServerReady = true;
                    console.log('SmartTools: Local Tagger Server ready!');
                    return;
                }
            } catch { /* retry */ }
            await new Promise(r => setTimeout(r, Math.min(500 * (i + 1), 2000)));
        }

        throw new Error('Tagger server startup timeout');
    }

    /**
     * Online mode: Use HuggingFace SmilingWolf/wd-tagger API.
     * Caches the Gradio client connection for reuse across calls.
     */
    private async analyzeStyleHuggingFace(imageUrl: string): Promise<TagResult[]> {
        // Parallelize: fetch image blob + connect to Gradio at the same time
        const [blob, client] = await Promise.all([
            fetch(imageUrl).then(r => r.blob()),
            this.getGradioClient()
        ]);

        console.log("SmartTools: Calling WD-Tagger predict...");
        const result = await client.predict("/predict", {
            image: blob,
            general_thresh: 0.35,
            general_mcut_enabled: false,
            character_thresh: 0.85,
            character_mcut_enabled: false
        });

        // Parse response
        const dataArray: any[] = Array.isArray(result) ? result
            : (result?.data ?? []);

        // Strategy 1: Tags dict at index 3 (most common for this Space)
        const tagsItem = dataArray?.[3];
        if (tagsItem && typeof tagsItem === 'object') {
            // Newer format: { confidences: [{label, confidence}, ...] }
            if (Array.isArray(tagsItem.confidences) && tagsItem.confidences.length > 0) {
                return tagsItem.confidences
                    .map((c: any) => ({ label: c.label, score: c.confidence }))
                    .sort((a: TagResult, b: TagResult) => b.score - a.score)
                    .slice(0, 50);
            }
            // Older format: { tag: score, ... }
            const entries = Object.entries(tagsItem);
            if (entries.length > 0 && typeof entries[0][1] === 'number') {
                return entries
                    .map(([label, score]) => ({ label, score: score as number }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 50);
            }
        }

        // Strategy 2: Comma-separated string at index 0
        const tagsString = dataArray?.[0];
        if (typeof tagsString === 'string' && tagsString.length > 0) {
            return tagsString.split(',')
                .map(t => t.trim().replace(/\\/g, ''))
                .filter(t => t.length > 0)
                .map((tag, i) => ({ label: tag, score: 1 - i * 0.01 }));
        }

        console.warn("No tags found in WD-Tagger response");
        return [];
    }

    /** Get or create cached Gradio client connection */
    private async getGradioClient(): Promise<any> {
        if (!this.gradioClient) {
            console.log("SmartTools: Connecting to SmilingWolf/wd-tagger...");
            const { Client } = await import('@gradio/client')
            this.gradioClient = await Client.connect("SmilingWolf/wd-tagger");
        }
        return this.gradioClient;
    }

    /**
     * Local mode: Call local tagger server API.
     * Returns TagResult[] directly (no intermediate Record conversion).
     */
    private async callLocalTagger(imageUrl: string, apiUrl: string, threshold: number): Promise<TagResult[]> {
        const res = await fetch(imageUrl);
        const blob = await res.blob();

        const formData = new FormData();
        formData.append('file', blob);
        formData.append('threshold', threshold.toString());

        const response = await fetch(`${apiUrl}/tag`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            // Server might have died, reset readiness cache
            this.localServerReady = false;
            throw new Error(`Tagger Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
            this.localServerReady = false;
            throw new Error(data.error);
        }

        // Parse response directly to TagResult[]
        if (data.tags && Array.isArray(data.tags)) {
            return data.tags
                .map((t: any) => ({ label: t.label, score: t.score }))
                .sort((a: TagResult, b: TagResult) => b.score - a.score);
        }
        // Fallback for legacy dict format: { caption: { tag: score } }
        if (data.caption && typeof data.caption === 'object') {
            return Object.entries(data.caption)
                .map(([label, score]) => ({ label, score: score as number }))
                .sort((a, b) => b.score - a.score);
        }
        return [];
    }

    /**
     * Fallback: Analyze Artist/Style using Kaloscope (Hugging Face Space API)
     */
    private async analyzeStyleRemote(imageUrl: string): Promise<TagResult[]> {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            console.log("SmartTools: Connecting to Kaloscope API (Remote)...");
            const { Client } = await import('@gradio/client')
            const client = await Client.connect("DraconicDragon/Kaloscope-artist-style-classifier");

            const result = await client.predict("/predict", {
                image: blob
            });

            console.log("Kaloscope raw result:", result);

            const dataArray = result.data as any[];
            const rawData = dataArray?.[0];

            if (typeof rawData === 'string') {
                const artists = rawData.split(',').map(a => a.trim()).filter(a => a.length > 0);
                return artists.map((artist, index) => ({
                    label: `artist:${artist}`,
                    score: 1 - (index * 0.05)
                }));
            }

            if (typeof rawData === 'object' && rawData !== null) {
                const entries = Object.entries(rawData as Record<string, number>);
                return entries
                    .map(([label, score]) => ({ label: `artist:${label}`, score }))
                    .sort((a, b) => b.score - a.score);
            }

            return [];
        } catch (e) {
            console.error("Kaloscope API Error:", e);
            throw new Error("Failed to connect to Kaloscope API.");
        }
    }

    /**
     * Remove background from an image using Hugging Face Space
     */
    /**
     * Remove background from an image using backend (Hugging Face Inference)
     */
    public async removeBackground(imageUrl: string): Promise<string> {
        // Strip header if present to get pure base64
        const base64 = imageUrl.replace(/^data:image\/[a-z]+;base64,/, '')
        
        try {
            const { invoke } = await import('@tauri-apps/api/core')
            
            console.log("SmartTools: invoking backend remove_background...");
            const result = await invokeWithTimeout<{ success: boolean; image_data?: string; error?: string }>('remove_background', {
                imageBase64: base64
            })

            if (result.success && result.image_data) {
                return result.image_data
            } else {
                throw new Error(result.error || "Unknown backend error")
            }
        } catch (e: any) {
            console.error("Backend remove_background failed:", e)
            throw new Error(`Background removal failed: ${e.message || e}`)
        }
    }

    /**
     * Process Gradio output (URL, path, or data URL)
     * @deprecated Kept for potential future use
     */
    // @ts-ignore - Method kept for future use
    private async _processGradioOutput(outputData: any): Promise<string> {
        if (typeof outputData === 'string') {
            if (outputData.startsWith('http')) {
                const imgResponse = await fetch(outputData);
                const imgBlob = await imgResponse.blob();
                return await this.blobToDataUrl(imgBlob);
            }
            if (outputData.startsWith('data:')) {
                return outputData;
            }
        } else if (outputData.url) {
            const imgResponse = await fetch(outputData.url);
            const imgBlob = await imgResponse.blob();
            return await this.blobToDataUrl(imgBlob);
        }
        throw new Error("Invalid output format");
    }

    private blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Upscale image using NovelAI's augment-image API (4x)
     */
    public async upscale(token: string, imageBase64: string): Promise<string> {
        const img = new Image()
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = imageBase64
        })

        const width = img.width
        const height = img.height
        // MEMORY: Clear image reference after getting dimensions
        img.src = ''

        if (!this.upscaleImageFn) {
            const module = await import('@/services/novelai-service')
            this.upscaleImageFn = module.upscaleImage
        }

        const result = await this.upscaleImageFn(token, imageBase64, width, height)

        if (!result.success || !result.imageData) {
            throw new Error(result.error || 'Upscale failed')
        }

        return `data:image/png;base64,${result.imageData}`
    }

}

export const smartTools = SmartToolsService.getInstance()
