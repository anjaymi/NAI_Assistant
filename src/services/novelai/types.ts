// NAI Service — 类型定义
// 所有 NovelAI API 相关接口集中在此

export interface AnlasInfo {
    fixed: number
    purchased: number
    total: number
}

export interface UserInfo {
    anlas: AnlasInfo
}

export interface GenerationParams {
    prompt: string
    negative_prompt: string
    model: string
    width: number
    height: number
    steps: number
    cfg_scale: number
    cfg_rescale: number
    sampler: string
    scheduler: string
    seed: number
    smea: boolean
    smea_dyn: boolean
    variety: boolean
    
    // NAI Specifics
    params_version?: number
    legacy?: boolean
    ucPreset?: number
    qualityToggle?: boolean
    
    // Img2Img & Inpainting
    sourceImage?: string | null
    mask?: string | null
    strength?: number
    noise?: number

    // Vibe Transfer
    vibeImages?: string[]
    vibeInfo?: number[]
    vibeStrength?: number[]
    preEncodedVibes?: (string | null)[]

    // Character Reference (Director Tools)
    charImages?: string[]
    charStrength?: number[] // 0 to 1
    charFidelity?: number[] // 0 to 1
    charReferenceType?: ('character' | 'style' | 'character&style')[]

    // Character Prompts (V4 char_captions)
    characterPrompts?: {
        prompt: string
        negative: string
        enabled: boolean
        position: { x: number; y: number }
    }[]
    characterPositionEnabled?: boolean
}

export type SamplerType = 
    | 'k_euler' | 'k_euler_ancestral' | 'k_dpmpp_2s_ancestral' 
    | 'k_dpmpp_2m' | 'k_dpmpp_sde' | 'ddim_v3'

export type SchedulerType = 
    | 'native' | 'karras' | 'exponential' | 'polyexponential'

/** 生成结果通用返回类型 */
export interface GenerationResult {
    success: boolean
    imageData?: string
    error?: string
    encodedVibes?: string[]
}
