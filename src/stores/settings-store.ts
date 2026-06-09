import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NovelAiProxyMode = 'direct' | 'official' | 'custom'

interface SettingsState {
    // Library Settings
    libraryPath: string
    useAbsoluteLibraryPath: boolean
    
    // Generation Settings
    autoSave: boolean
    savePath: string
    useAbsolutePath: boolean
    autoOpenGallery: boolean


    // Actions
    setLibraryPath: (path: string) => void
    setUseAbsoluteLibraryPath: (useAbsolute: boolean) => void
    setAutoSave: (autoSave: boolean) => void
    setSavePath: (path: string) => void
    setUseAbsolutePath: (useAbsolute: boolean) => void
    setAutoOpenGallery: (enabled: boolean) => void


    // New sync from SANA
    geminiApiKey: string
    setGeminiApiKey: (key: string) => void
    
    imageFormat: 'png' | 'webp'
    setImageFormat: (format: 'png' | 'webp') => void
    qualityTags: string
    setQualityTags: (tags: string) => void

    generationDelay: number
    setGenerationDelay: (delay: number) => void
    randomizeDelay: boolean
    setRandomizeDelay: (enabled: boolean) => void
    batchDelaySize: number
    setBatchDelaySize: (size: number) => void
    batchDelay: number
    setBatchDelay: (delay: number) => void


    streamingEnabled: boolean
    setStreamingEnabled: (enabled: boolean) => void

    // Gallery Settings
    galleryLayout: 'grid' | 'masonry'
    setGalleryLayout: (layout: 'grid' | 'masonry') => void

    // Integration Settings
    remoteTaggerUrl: string
    setRemoteTaggerUrl: (url: string) => void

    novelAiProxyMode: NovelAiProxyMode
    setNovelAiProxyMode: (mode: NovelAiProxyMode) => void
    novelAiProxyUrl: string
    setNovelAiProxyUrl: (url: string) => void
    
    psBridgePort: number
    setPsBridgePort: (port: number) => void
    
    // Tagger Mode: 'online' uses HF API, 'local' uses downloaded tagger-server
    taggerMode: 'online' | 'local'
    setTaggerMode: (mode: 'online' | 'local') => void
    taggerDownloaded: boolean
    setTaggerDownloaded: (downloaded: boolean) => void

    // Cloud Sync Settings (基于 Token 的云端流转)
    cloudSyncToken: string
    setCloudSyncToken: (token: string) => void
    lanPcIp: string
    setLanPcIp: (ip: string) => void
    
    
    // Non-persisted Cloud Sync Runtime State
    pcCloudOnline: boolean
    setPcCloudOnline: (isOnline: boolean) => void

    // Device Identifier to prevent self-echo in cloud sync
    deviceId: string
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            libraryPath: 'NAIS_Library',
            useAbsoluteLibraryPath: false,
            autoSave: true,
            savePath: 'NAIS_Output',
            useAbsolutePath: false,

            setLibraryPath: (path) => set({ libraryPath: path }),
            setUseAbsoluteLibraryPath: (useAbsolute) => set({ useAbsoluteLibraryPath: useAbsolute }),
            setAutoSave: (autoSave) => set({ autoSave }),
            setSavePath: (path) => set({ savePath: path }),
            setUseAbsolutePath: (useAbsolute) => set({ useAbsolutePath: useAbsolute }),
            
            autoOpenGallery: true,
            setAutoOpenGallery: (enabled) => set({ autoOpenGallery: enabled }),

            
            // New sync from SANA
            geminiApiKey: '',
            setGeminiApiKey: (key) => set({ geminiApiKey: key }),
            
            imageFormat: 'png',
            setImageFormat: (format) => set({ imageFormat: format as 'png' | 'webp' }),
            qualityTags: 'best quality, amazing quality, very aesthetic, absurdres',
            setQualityTags: (qualityTags) => set({ qualityTags }),

            generationDelay: 500,
            setGenerationDelay: (delay) => set({ generationDelay: Math.max(0, Math.min(30000, delay)) }), // Increased max to 30s
            randomizeDelay: true,
            setRandomizeDelay: (enabled) => set({ randomizeDelay: enabled }),
            batchDelaySize: 10,
            setBatchDelaySize: (size) => set({ batchDelaySize: Math.max(1, size) }),
            batchDelay: 120, // seconds
            setBatchDelay: (delay) => set({ batchDelay: Math.max(0, delay) }),

            streamingEnabled: true,
            setStreamingEnabled: (enabled) => set({ streamingEnabled: enabled }),

            galleryLayout: 'grid',
            setGalleryLayout: (layout) => set({ galleryLayout: layout }),

            // Integration Settings
            remoteTaggerUrl: 'http://127.0.0.1:8002',
            setRemoteTaggerUrl: (url) => set({ remoteTaggerUrl: url }),

            novelAiProxyMode: 'official',
            setNovelAiProxyMode: (mode) => set({ novelAiProxyMode: mode }),
            novelAiProxyUrl: 'https://nai-airdrop-relay.liuanjay.workers.dev/api/nai/subscription',
            setNovelAiProxyUrl: (url) => set({ novelAiProxyUrl: url }),
            
            psBridgePort: 8080,
            setPsBridgePort: (port) => set({ psBridgePort: port }),
            
            // Default to online mode (no download required)
            taggerMode: 'online',
            setTaggerMode: (mode) => set({ taggerMode: mode }),
            taggerDownloaded: false,
            setTaggerDownloaded: (downloaded) => set({ taggerDownloaded: downloaded }),

            // Cloud Sync
            cloudSyncToken: '',
            setCloudSyncToken: (token) => set({ cloudSyncToken: token }),
            lanPcIp: '',
            setLanPcIp: (ip) => set({ lanPcIp: ip }),

            // Runtime state (initially false)
            pcCloudOnline: false,
            setPcCloudOnline: (isOnline) => set({ pcCloudOnline: isOnline }),

            deviceId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        }),
        {
            name: 'settings-storage',
            migrate: (persistedState: any) => {
                if (!persistedState || typeof persistedState !== 'object') return persistedState

                if (!('novelAiProxyMode' in persistedState)) {
                    const enabled = persistedState.novelAiProxyEnabled
                    persistedState.novelAiProxyMode = enabled ? 'custom' : 'direct'
                }

                delete persistedState.novelAiProxyEnabled
                return persistedState
            },
            partialize: (state) => Object.fromEntries(
                Object.entries(state).filter(([key]) => !['pcCloudOnline'].includes(key))
            ),
        }
    )
)
