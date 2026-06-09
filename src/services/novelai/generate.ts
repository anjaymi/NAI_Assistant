// NAI Service — 核心生成逻辑（非流式）
// generateImage: 组装参数 + 调用 NAI API + 解 ZIP 返回 base64

import JSZip from 'jszip'
import { invoke } from '@tauri-apps/api/core'
import type { GenerationParams, GenerationResult } from './types'

import {
    stripBase64Header,
    removeComments,
    convertMaskToGrayscale,
    processCharacterImage,
    resolveImageToBase64,
    CLIENT_FETCH,
    API_ENDPOINTS,
} from './image-utils'
import { encodeVibeImage } from './api-client'

type PreparedImg2ImgInput = {
    image: string
    mask?: string | null
    width: number
    height: number
    source_width: number
    source_height: number
}

const isTauriBackendEnabled = () =>
    typeof window !== 'undefined' &&
    (window as any)['__TAURI__'] &&
    window.localStorage.getItem('NAI_BACKEND_GENERATE') !== '0'

/**
 * Generate image using NovelAI API
 */
export async function generateImage(
    token: string,
    params: GenerationParams
): Promise<GenerationResult> {
    if (!token) return { success: false, error: 'API token required' }

    try {
        // 1. Process Vibe Images
        const processedVibeImages: string[] = []
        const newlyEncodedVibes: (string | null)[] = []
        
        if (params.vibeImages && params.vibeImages.length > 0) {
            for (let i = 0; i < params.vibeImages.length; i++) {
                 if (!params.vibeImages[i] && !params.preEncodedVibes?.[i]) {
                     continue
                 }
                 if (params.preEncodedVibes?.[i]) {
                     processedVibeImages.push(params.preEncodedVibes[i]!)
                     newlyEncodedVibes.push(null)
                     continue
                 }
                 try {
                     const encoded = await encodeVibeImage(
                         token, 
                         params.vibeImages[i], 
                         params.vibeInfo?.[i] || 1.0,
                         params.model
                     )
                      processedVibeImages.push(encoded)
                      newlyEncodedVibes.push(encoded)
                  } catch (e) {
                     return { success: false, error: `Vibe Encoding Failed: ${e}` }
                 }
            }
        }

        // 2. Process Character Images
        const processedCharImages: string[] = []
        if (params.charImages && params.charImages.length > 0) {
            for (const img of params.charImages) {
                try {
                    const processed = await processCharacterImage(img)
                    processedCharImages.push(processed)
                } catch (e) {
                     return { success: false, error: `Character Processing Failed: ${e}` }
                }
            }
        }
    
        // 3. Build API Parameters
        const apiParams: any = {
            width: params.width,
            height: params.height,
            n_samples: 1,
            seed: params.seed,
            extra_noise_seed: params.seed,
            sampler: params.sampler,
            steps: params.steps,
            scale: params.cfg_scale,
            negative_prompt: params.negative_prompt,
            cfg_rescale: params.cfg_rescale,
            noise_schedule: params.scheduler,
            
            // Fixed / Default 
            params_version: 3,
            legacy: false,
            legacy_v3_extend: false,
            dynamic_thresholding: false,
            add_original_image: true,
            legacy_uc: false,
            prefer_brownian: true,
            ucPreset: params.ucPreset ?? 0,
            use_coords: false,
            
            // Variety (Skip CFG)
            skip_cfg_above_sigma: params.variety ? 58 : null,

            // NAI Compatibility
            autoSmea: false, 
            sm: params.smea,
            sm_dyn: params.smea_dyn,
            qualityToggle: params.qualityToggle ?? false,
            controlnet_strength: 1,
            normalize_reference_strength_multiple: true,
            inpaintImg2ImgStrength: 1,
            deliberate_euler_ancestral_bug: false,
            image_format: 'png',
            
            // Reference / Vibe
            reference_image_multiple: processedVibeImages,
            reference_information_extracted_multiple: params.vibeInfo || [],
            reference_strength_multiple: params.vibeStrength || [],
        }

        // 4. V4 Specific Parameters
        const isV4Model = params.model.includes('nai-diffusion-4')
        
        if (isV4Model) {
            // Add V4 Prompts
            apiParams.v4_prompt = {
                caption: {
                    base_caption: removeComments(params.prompt),
                    char_captions: [] as { char_caption: string; centers: { x: number; y: number }[] }[],
                },
                use_coords: false,
                use_order: true,
            }
            apiParams.v4_negative_prompt = {
                caption: {
                    base_caption: removeComments(params.negative_prompt),
                    char_captions: [] as { char_caption: string; centers: { x: number; y: number }[] }[],
                },
            }

            // Process Character Prompts for V4
            if (params.characterPrompts && params.characterPrompts.length > 0) {
                const usePositions = params.characterPositionEnabled ?? false
                for (const char of params.characterPrompts) {
                    if (char.enabled && char.prompt.trim()) {
                        const centers = usePositions
                            ? [{ x: char.position.x, y: char.position.y }]
                            : [{ x: 0.5, y: 0.5 }]
    
                        apiParams.v4_prompt.caption.char_captions.push({
                            char_caption: removeComments(char.prompt),
                            centers: centers,
                        })
                        apiParams.v4_negative_prompt.caption.char_captions.push({
                            char_caption: removeComments(char.negative?.trim() || ''),
                            centers: centers,
                        })
                    }
                }
                if (apiParams.v4_prompt.caption.char_captions.length > 0 && usePositions) {
                    apiParams.v4_prompt.use_coords = true
                    apiParams.use_coords = true
                }
            }

            if (processedCharImages.length > 0) {
                apiParams.director_reference_images = processedCharImages
                apiParams.director_reference_information_extracted = processedCharImages.map(() => 1.0)
                
                // Strength (Alpha)
                apiParams.director_reference_strength_values = params.charStrength || processedCharImages.map(() => 1.0)
                
                // Fidelity (1 - Beta) - Inverted logic: 0(UI) -> 1(API), 1(UI) -> 0
                apiParams.director_reference_secondary_strength_values = (params.charFidelity || processedCharImages.map(() => 1.0)).map(f => 1.0 - f)
                
                // Reference Type (Character / Style / Both)
                apiParams.director_reference_descriptions = (params.charReferenceType || processedCharImages.map(() => 'character&style')).map(type => ({
                    caption: {
                        base_caption: type,
                        char_captions: []
                    },
                    legacy_uc: false
                }))
            }
        }
        
        // 6. Img2Img / Inpainting Logic
        let requestModel = params.model
        let action = 'generate'

        if (params.sourceImage) {
            let preparedInput: PreparedImg2ImgInput | null = null

            if (isTauriBackendEnabled()) {
                try {
                    const resolvedSource = await resolveImageToBase64(params.sourceImage)
                    const resolvedMask = params.mask ? await resolveImageToBase64(params.mask) : null
                    preparedInput = await invoke<PreparedImg2ImgInput>('prepare_img2img_input_backend', {
                        source: resolvedSource,
                        mask: resolvedMask,
                    })
                } catch (error) {
                    console.warn('[Img2Img] Rust preprocessing unavailable, falling back to WebView preprocessing:', error)
                }
            }

            let resolvedSource = ''

            if (preparedInput) {
                apiParams.image = preparedInput.image
            } else {
                resolvedSource = await resolveImageToBase64(params.sourceImage)
                apiParams.image = stripBase64Header(resolvedSource)
            }

            if (params.mask) {
                action = 'infill'

                if (!requestModel.includes('inpainting')) {
                    requestModel = requestModel + '-inpainting'
                }

                const userStrength = params.strength ?? 0.7
                console.log('[Inpaint] User Params Strength:', params.strength, 'Defaulted:', userStrength);

                apiParams.inpaintImg2ImgStrength = userStrength
                apiParams.add_original_image = false

                console.log('[Inpaint] API Payload InpaintStrength:', apiParams.inpaintImg2ImgStrength);

                // Noise is kept for infill (not deleted)
                apiParams.noise = params.noise ?? 0

                if (preparedInput?.mask) {
                    console.log(`[Inpaint] Source image: ${preparedInput.source_width}x${preparedInput.source_height}`)
                    apiParams.width = preparedInput.width
                    apiParams.height = preparedInput.height
                    apiParams.mask = preparedInput.mask
                } else {
                    const getImageDimensions = async (base64: string): Promise<{ width: number; height: number }> => {
                        return new Promise((resolve, reject) => {
                            const img = new Image()
                            img.onload = () => {
                                const result = { width: img.width, height: img.height }
                                img.src = ''
                                resolve(result)
                            }
                            img.onerror = (e) => {
                                img.src = ''
                                reject(e)
                            }
                            img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
                        })
                    }
                    const sourceForFallback = resolvedSource || await resolveImageToBase64(params.sourceImage)
                    const srcDimensions = await getImageDimensions(sourceForFallback)
                    console.log(`[Inpaint] Source image: ${srcDimensions.width}x${srcDimensions.height}`)

                    const roundTo64 = (val: number) => Math.round(val / 64) * 64
                    apiParams.width = roundTo64(srcDimensions.width)
                    apiParams.height = roundTo64(srcDimensions.height)

                    const resolvedMask = await resolveImageToBase64(params.mask)
                    const grayscaleMask = await convertMaskToGrayscale(resolvedMask, srcDimensions.width, srcDimensions.height)
                    apiParams.mask = grayscaleMask
                }

            } else {
                action = 'img2img'
                apiParams.strength = params.strength ?? 0.7
                apiParams.noise = params.noise ?? 0.0
            }
        }

        if (processedVibeImages.length > 1) {
            apiParams.normalize_reference_strength_multiple = true
        }

        const body = {
            input: params.prompt,
            model: requestModel,
            action: action,
            parameters: apiParams
        }

        if (
            isTauriBackendEnabled()
        ) {
            try {
                const backendResult = await invoke<{ success: boolean; image_data?: string; error?: string }>('generate_image_backend', {
                    token,
                    body,
                })

                return {
                    success: backendResult.success,
                    imageData: backendResult.image_data,
                    error: backendResult.error,
                    encodedVibes: newlyEncodedVibes.filter((v): v is string => v !== null),
                }
            } catch (error) {
                console.warn('[API] Rust backend generation unavailable, falling back to WebView fetch:', error)
            }
        }

        const response = await CLIENT_FETCH(API_ENDPOINTS.IMAGE_GENERATE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'NAI_Assistant/1.0'
            },
            body: JSON.stringify(body)
        })
        
        // Debug Logging
        console.log('[API] Request Payload:', JSON.stringify(body, null, 2))

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[API] Error Response:', response.status, errorText)
            console.error('[API] Failed Payload:', JSON.stringify(body, null, 2))
            return { success: false, error: `API Error: ${response.status} - ${errorText}` }
        }

        const arrayBuffer = await response.arrayBuffer()
        const zip = new JSZip()
        const unzipped = await zip.loadAsync(arrayBuffer)
        
        const filename = Object.keys(unzipped.files)[0]
        if (!filename) {
             return { success: false, error: 'No files in response ZIP' }
        }

        const fileData = await unzipped.files[filename].async('base64')
        
        return {
            success: true,
            imageData: fileData,
            encodedVibes: newlyEncodedVibes.filter((v): v is string => v !== null)
        }
    } catch (e) {
        return { success: false, error: String(e) }
    }
}
