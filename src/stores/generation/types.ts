// Generation Store — 类型定义与常量
// 接口、枚举、配置常量集中管理

import type { ReferenceImage } from '../character-store'

// =====================
// 常量
// =====================

export const AVAILABLE_MODELS = [
    { id: 'nai-diffusion-4-5-curated', name: 'NAI Diffusion V4.5 Curated' },
    { id: 'nai-diffusion-4-5-full', name: 'NAI Diffusion V4.5 Full' },
    { id: 'nai-diffusion-4-curated-preview', name: 'NAI Diffusion V4 Curated' },
    { id: 'nai-diffusion-4-full', name: 'NAI Diffusion V4 Full' },
    { id: 'nai-diffusion-3', name: 'NAI Diffusion V3 (Anime)' },
    { id: 'nai-diffusion-furry-3', name: 'NAI Diffusion Furry V3' },
] as const

export const SAMPLERS = [
    'k_euler', 'k_euler_ancestral', 'k_dpmpp_2s_ancestral',
    'k_dpmpp_2m', 'k_dpmpp_2m_sde', 'k_dpmpp_sde', 'ddim',
] as const

export const SCHEDULERS = ['native', 'karras', 'exponential', 'polyexponential'] as const

// =====================
// 接口
// =====================

export interface CharacterPrompt {
    id: string
    prompt: string
    negative: string
    enabled: boolean
    position: { x: number; y: number }
}

export interface HistoryItem {
    id: string
    url: string // Thumbnail or full URL
    prompt: string
    seed: number
    timestamp: number
    model: string
}

export interface QueueItem {
    id: string
    batchId?: string
    status: 'pending' | 'generating' | 'completed' | 'failed'
    params: {
        prompt: string
        negativePrompt: string
        width: number
        height: number
        steps: number
        cfgScale: number
        seed: number
        model: string
        sampler: string
        scheduler: string
        smea: boolean
        smeaDyn: boolean
        cfgRescale: number
        variety: boolean
        ucPreset: number
        sourceImage: string | null
        mask: string | null
        strength: number
        noise: number
        vibeImages: ReferenceImage[]
        charImages: ReferenceImage[]
        characterPrompts: CharacterPrompt[]
        characterPositionEnabled: boolean
    }
    imageUrl?: string
    error?: string
    createdAt: number
}

export interface GenerationState {
    prompt: string
    negativePrompt: string
    width: number
    height: number
    steps: number
    cfgScale: number
    seed: number
    model: string

    // Advanced
    sampler: string
    scheduler: string
    smea: boolean
    smeaDyn: boolean
    cfgRescale: number
    variety: boolean
    ucPreset: number

    // Img2Img & Inpainting
    sourceImage: string | null
    mask: string | null
    strength: number
    noise: number
    
    // Character Prompts (V4)
    characterPrompts: CharacterPrompt[]
    characterPositionEnabled: boolean

    // Batch & State
    isGenerating: boolean
    previewImage: string | null
    lastUsedSeed: number | null
    
    // Queue
    queue: QueueItem[]
    isQueueRunning: boolean
    useDynamicQueueParams: boolean
    setUseDynamicQueueParams: (val: boolean) => void

    // Cross-component communication for tags
    pendingTagsToAppend: string | null
    setPendingTagsToAppend: (tags: string) => void
    clearPendingTagsToAppend: () => void

    // Actions - Setters
    setPrompt: (prompt: string) => void
    setNegativePrompt: (prompt: string) => void
    setDimensions: (width: number, height: number) => void
    setSteps: (steps: number) => void
    setCfgScale: (scale: number) => void
    setSeed: (seed: number) => void
    setModel: (model: string) => void
    setSampler: (sampler: string) => void
    setScheduler: (scheduler: string) => void
    setSmea: (smea: boolean) => void
    setSmeaDyn: (smeaDyn: boolean) => void
    setCfgRescale: (cfgRescale: number) => void
    setPreviewImage: (url: string | null) => void 
    setVariety: (variety: boolean) => void
    setUcPreset: (preset: number) => void
    
    // Img2Img Actions
    setSourceImage: (img: string | null) => void
    setMask: (mask: string | null) => void
    setStrength: (strength: number) => void
    setNoise: (noise: number) => void

    // Character Prompts (V4)
    addCharacterPrompt: () => void
    updateCharacterPrompt: (id: string, updates: Partial<CharacterPrompt>) => void
    removeCharacterPrompt: (id: string) => void
    setCharacterPositionEnabled: (enabled: boolean) => void

    // Queue Actions
    addToQueue: (count?: number) => void
    removeFromQueue: (id: string) => void
    clearQueue: () => void
    startQueue: () => void
    pauseQueue: () => void
    processQueue: () => Promise<void>

    generate: (overrideParams?: Partial<QueueItem['params']>) => Promise<void>
    saveImage: (imageData: string) => Promise<void>
    
    // Progress for streaming
    generationProgress: number
    setGenerationProgress: (progress: number) => void
}
