import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { BaseDirectory, mkdir, exists, writeFile } from '@tauri-apps/plugin-fs';
import { pictureDir, join } from '@tauri-apps/api/path';
import { createGalleryItem, useGalleryStore } from '@/stores/gallery-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useGenerationStore } from '@/stores/generation-store';
import { useSyncFlowStore } from '@/stores/sync-flow-store';
import { toast } from '@/hooks/use-toast';

const RELAY_BASE_URL = 'https://nai-airdrop-relay.liuanjay.workers.dev/api/relay';
let pollingTimeout: number | null = null;
let isPolling = false;
const processedSignalIds = new Set<string>(); // Keep track of processed signals in memory to avoid dupes
let currentPollingToken = '';
let currentBaseIntervalMs = 30000;
let pollBackoffMs = 0;
let currentVisibilityCleanup: (() => void) | null = null;

const CLOUD_PULL_MAX_BACKOFF_MS = 60000;
const DEFAULT_PULL_BATCH_LIMIT = 20;
const DEFAULT_POLL_INTERVAL_MS = 30000;
const MIN_POLL_INTERVAL_MS = 5000;
const ACTIVE_SIGNAL_POLL_INTERVAL_MS = 3000;
const MAX_PROCESSED_SIGNAL_IDS = 512;

function clearPollingTimeout() {
    if (pollingTimeout !== null) {
        window.clearTimeout(pollingTimeout);
        pollingTimeout = null;
    }
}

function resetPollingBackoff() {
    pollBackoffMs = 0;
}

function getNextPollDelay({ hadSignals, hadError }: { hadSignals: boolean; hadError: boolean }) {
    if (hadSignals) {
        pollBackoffMs = 0;
        return ACTIVE_SIGNAL_POLL_INTERVAL_MS;
    }

    if (hadError) {
        pollBackoffMs = pollBackoffMs === 0 ? currentBaseIntervalMs * 2 : Math.min(pollBackoffMs * 2, CLOUD_PULL_MAX_BACKOFF_MS);
        return pollBackoffMs;
    }

    const nextIdleDelay = pollBackoffMs === 0
        ? currentBaseIntervalMs
        : Math.min(Math.max(pollBackoffMs * 2, currentBaseIntervalMs), CLOUD_PULL_MAX_BACKOFF_MS);
    pollBackoffMs = nextIdleDelay;
    return pollBackoffMs;
}

function scheduleNextPoll(poll: () => void, delay: number) {
    clearPollingTimeout();
    pollingTimeout = window.setTimeout(() => {
        if (isPolling) {
            poll();
        }
    }, delay);
}

function attachVisibilityWatcher(onVisible: () => void) {
    if (typeof document === 'undefined') {
        return null;
    }

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && isPolling) {
            resetPollingBackoff();
            onVisible();
        } else if (document.visibilityState !== 'visible') {
            clearPollingTimeout();
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function clearIncomingGalleryItems(ids: string[], delayMs: number) {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
        useGalleryStore.getState().removeIncomingItems(ids);
    }, delayMs);
}

function rememberProcessedSignal(signalId: string) {
    processedSignalIds.add(signalId);

    if (processedSignalIds.size > MAX_PROCESSED_SIGNAL_IDS) {
        const oldestId = Array.from(processedSignalIds).sort((a, b) => a.localeCompare(b))[0];
        processedSignalIds.delete(oldestId);
    }
}

interface PushSignal {
    id: string;
    urls: string[];
    timestamp: number;
    metadata?: any;
}

export async function startCloudSyncPuller(token: string, options?: { baseIntervalMs?: number }) {
    const normalizedBaseInterval = Math.max(options?.baseIntervalMs ?? DEFAULT_POLL_INTERVAL_MS, MIN_POLL_INTERVAL_MS);

    if (isPolling && currentPollingToken === token) {
        currentBaseIntervalMs = normalizedBaseInterval;
        return;
    }

    stopCloudSyncPuller();

    isPolling = true;
    currentPollingToken = token;
    currentBaseIntervalMs = normalizedBaseInterval;
    resetPollingBackoff();
    useSyncFlowStore.getState().setRelayState('listening');
    
    const poll = async () => {
        if (!isPolling || currentPollingToken !== token) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

        let hadSignals = false;
        let hadError = false;
        
        try {
            const res = await tauriFetch(`${RELAY_BASE_URL}/pull?token=${encodeURIComponent(token)}&limit=${DEFAULT_PULL_BATCH_LIMIT}`);
            if (res.ok) {
                const data = await res.json() as { error?: string, signals?: PushSignal[] };
                if (data.signals && data.signals.length > 0) {
                    hadSignals = true;
                    for (const signal of data.signals) {
                        // Deduplication check
                        if (!processedSignalIds.has(signal.id)) {
                            rememberProcessedSignal(signal.id);
                            
                            // Ignore signals sent by this exact device to prevent self-echo
                            const myDeviceId = useSettingsStore.getState().deviceId;
                            if (signal.metadata && signal.metadata.senderId === myDeviceId) {
                                console.log("[Cloud Pull] Ignoring self-sent signal:", signal.id);
                                continue;
                            }
                            
                            // Check signal type
                            if (signal.metadata && signal.metadata.type === 'generate_command') {
                                await processGenerateCommand(signal.metadata.config);
                            } else {
                                await processSignal(signal);
                            }
                        }
                    }
                }
            } else {
                hadError = true;
            }
        } catch (error) {
            hadError = true;
            console.error("Cloud pull error:", error);
        } finally {
            if (hadError) {
                useSyncFlowStore.getState().setRelayState('error');
            } else if (hadSignals) {
                useSyncFlowStore.getState().setRelayState('busy');
            } else {
                useSyncFlowStore.getState().setRelayState('listening');
            }
            if (isPolling && currentPollingToken === token) {
                const delay = getNextPollDelay({ hadSignals, hadError });
                scheduleNextPoll(poll, delay);
            }
        }
    };

    currentVisibilityCleanup = attachVisibilityWatcher(() => {
        poll();
    });

    // Initial poll
    poll();
}

export function stopCloudSyncPuller() {
    isPolling = false;
    currentPollingToken = '';
    clearPollingTimeout();
    resetPollingBackoff();
    processedSignalIds.clear();
    if (currentVisibilityCleanup) {
        currentVisibilityCleanup();
        currentVisibilityCleanup = null;
    }
    useSyncFlowStore.getState().setRelayState('offline');
}

async function processSignal(signal: PushSignal) {
    const { urls } = signal;
    if (!urls || urls.length === 0) return;
    const incomingIds = urls.map((_, index) => `${signal.id}-${index}`);

    useGalleryStore.getState().addIncomingItems(
        incomingIds.map((id, index) => ({
            id,
            name: `Cloud Airdrop ${index + 1}`,
            createdAt: Date.now() - index,
            status: 'downloading',
            progressLabel: '等待拉取中',
        }))
    );

    useSyncFlowStore.getState().showTask({
        id: signal.id,
        kind: 'airdrop',
        title: 'Cloud Airdrop',
        detail: `已收到 ${urls.length} 张图片，正在准备下载`,
        tone: 'info',
        status: 'active',
    });

    toast({ title: "接收到 Cloud Airdrop", description: `正在下载 ${urls.length} 张图片...` });

    try {
        const { savePath, useAbsolutePath } = useSettingsStore.getState();
        const outputDir = savePath || 'NAIS_Output';
        
        // Resolve Target Directory matching GalleryStore
        let writeOptions = {};
        let targetDirPath = '';
        let fullResolvedDirPath = ''; // Needed for join

        if (useAbsolutePath) {
            targetDirPath = outputDir;
            fullResolvedDirPath = outputDir;
            if (!(await exists(targetDirPath))) {
                await mkdir(targetDirPath, { recursive: true });
            }
        } else {
            targetDirPath = outputDir;
            writeOptions = { baseDir: BaseDirectory.Picture };
            const picDir = await pictureDir();
            fullResolvedDirPath = await join(picDir, targetDirPath);
            if (!(await exists(targetDirPath, writeOptions))) {
                await mkdir(targetDirPath, { ...writeOptions, recursive: true });
            }
        }

        let downloadedCount = 0;

        const downloadPromises = urls.map(async (url, index) => {
            const incomingId = incomingIds[index];
            useGalleryStore.getState().updateIncomingItem(incomingId, {
                progressLabel: '下载中',
                status: 'downloading',
            });

            // Generate a unique filename based on current timestamp and random string
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const randomStr = Math.random().toString(36).substring(2, 8);
            const ext = url.split('.').pop() || 'png';
            const filename = `airdrop_${timestamp}_${randomStr}.${ext}`;
            useGalleryStore.getState().updateIncomingItem(incomingId, { name: filename });
            let filePath = '';
            
            if (useAbsolutePath) {
                filePath = await join(fullResolvedDirPath, filename);
            } else {
                filePath = await join(targetDirPath, filename); // relative to baseDir
            }
            const galleryItemPath = useAbsolutePath
                ? filePath
                : await join(fullResolvedDirPath, filename)

            const imageRes = await tauriFetch(url);
            if (!imageRes.ok) throw new Error(`HTTP ${imageRes.status}`);
            useGalleryStore.getState().updateIncomingItem(incomingId, {
                progressLabel: '写入图库中',
                status: 'saving',
            });
            const arrayBuf = await imageRes.arrayBuffer();
            await writeFile(filePath, new Uint8Array(arrayBuf), writeOptions);
            useGalleryStore.getState().upsertGalleryItem(createGalleryItem(galleryItemPath, filename));
            useGalleryStore.getState().updateIncomingItem(incomingId, {
                progressLabel: '已入库',
                status: 'success',
            });
            
            return true;
        });

        const results = await Promise.allSettled(downloadPromises);
        
        results.forEach(result => {
             if (result.status === 'fulfilled') {
                 downloadedCount++;
             } else {
                 console.error("Failed to download image from cloud:", result.reason);
             }
         });

        results.forEach((result, index) => {
            if (result.status !== 'fulfilled') {
                useGalleryStore.getState().updateIncomingItem(incomingIds[index], {
                    progressLabel: '下载失败',
                    status: 'error',
                });
            }
        });

        if (downloadedCount > 0) {
            useSyncFlowStore.getState().updateTask({
                detail: `已入库 ${downloadedCount} 张图片`,
                tone: 'success',
                status: 'success',
            });
            toast({ title: "Airdrop 下载完成", description: `成功保存 ${downloadedCount} 张图片到画廊` });
            clearIncomingGalleryItems(incomingIds, 2600);
        } else {
            useSyncFlowStore.getState().updateTask({
                detail: '未成功保存任何图片',
                tone: 'error',
                status: 'error',
            });
            clearIncomingGalleryItems(incomingIds, 4200);
        }

    } catch (err) {
        console.error("Error processing airdrop signal:", err);
        incomingIds.forEach((id) => {
            useGalleryStore.getState().updateIncomingItem(id, {
                progressLabel: '任务失败',
                status: 'error',
            });
        });
        useSyncFlowStore.getState().updateTask({
            detail: '图片下载或写入失败',
            tone: 'error',
            status: 'error',
        });
        toast({ title: "Airdrop 下载失败", description: "无法处理接收到的图片", variant: "destructive" });
        clearIncomingGalleryItems(incomingIds, 4200);
    }
}

async function processGenerateCommand(config: any) {
    if (!config) return;
    
    const count = config.imageCount || 1;
    useSyncFlowStore.getState().showTask({
        id: `generate-${Date.now()}`,
        kind: 'generate',
        title: '远程生图',
        detail: `已接收 ${count} 个远程任务，正在装载参数`,
        tone: 'info',
        status: 'active',
    });
    toast({ title: "📡 收到云端生图指令", description: `参数已应用，正在后台建立包含 ${count} 个任务的生图队列...` });
    
    const genStore = useGenerationStore.getState();
    
    // Apply parameters
    if (config.prompt !== undefined) genStore.setPrompt(config.prompt);
    if (config.negativePrompt !== undefined) genStore.setNegativePrompt(config.negativePrompt);
    if (config.width && config.height) genStore.setDimensions(config.width, config.height);
    if (config.steps !== undefined) genStore.setSteps(config.steps);
    if (config.cfgScale !== undefined) genStore.setCfgScale(config.cfgScale);
    if (config.cfgRescale !== undefined) genStore.setCfgRescale(config.cfgRescale);
    if (config.seed !== undefined) genStore.setSeed(config.seed);
    if (config.model !== undefined) genStore.setModel(config.model);
    if (config.sampler !== undefined) genStore.setSampler(config.sampler);
    if (config.scheduler !== undefined) genStore.setScheduler(config.scheduler);
    if (config.smea !== undefined) genStore.setSmea(config.smea);
    if (config.smeaDyn !== undefined) genStore.setSmeaDyn(config.smeaDyn);
    
    // Additional parameters for img2img / vibe etc can be added here if needed
    if (config.sourceImage !== undefined) genStore.setSourceImage(config.sourceImage);
    if (config.strength !== undefined) genStore.setStrength(config.strength);
    if (config.noise !== undefined) genStore.setNoise(config.noise);
    
    // Trigger generation via queue
    genStore.addToQueue(count);
    genStore.startQueue();
    useSyncFlowStore.getState().updateTask({
        detail: `已加入 ${count} 个生成任务到桌面队列`,
        tone: 'success',
        status: 'success',
    });
}
