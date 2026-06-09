// NAI Service — 流式生成
// generateImageStream: msgpack 流解析 + 渐进式预览 + 元数据注入

import { decode as msgpackDecode } from '@msgpack/msgpack'
import { injectNAIMetadata } from '@/lib/metadata-writer'
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

const STREAM_PREVIEW_MAX_UPDATES = 6
const STREAM_PREVIEW_MIN_INTERVAL_MS = 700
const STREAM_INTERMEDIATE_IMAGE_ENABLED = false

/**
 * Generate image using NovelAI Streaming API
 * Returns images progressively with progress updates
 */
export async function generateImageStream(
    token: string,
    params: GenerationParams,
    onProgress?: (progress: number, partialImage?: string) => void
): Promise<GenerationResult> {
    if (!token) {
        return { success: false, error: 'API Token Required' }
    }

    try {
        // Use the streaming endpoint
        const endpoint = API_ENDPOINTS.IMAGE_GENERATE_STREAM

        // ===========================================
        // 1. Process Vibe Images & Reference Images
        // ===========================================

        // Process Vibe Images
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
                    const encoded = await encodeVibeImage(token, params.vibeImages[i], params.vibeInfo?.[i] || 1.0, params.model)
                    processedVibeImages.push(encoded)
                    newlyEncodedVibes.push(encoded)
                } catch (e) {
                    console.error('Vibe encoding error (Stream):', e)
                    return { success: false, error: `Vibe Processing Failed: ${e}` }
                }
            }
        }

        // Process Character Images
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

        // ===========================================
        // 2. Build API Parameters
        // ===========================================

        let requestModel = params.model
        let action = 'generate'

        const apiParameters: Record<string, any> = {
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

            // Streaming specific
            stream: 'msgpack',

            // NAI compatibility fields
            qualityToggle: params.qualityToggle ?? false,
            autoSmea: false,
            sm: params.smea,
            sm_dyn: params.smea_dyn,
            controlnet_strength: 1,
            normalize_reference_strength_multiple: true,
            inpaintImg2ImgStrength: 1,
            deliberate_euler_ancestral_bug: false,
            image_format: 'png', // Always PNG for consistency

            // Reference/Vibe Transfer
            reference_image_multiple: processedVibeImages,
            reference_information_extracted_multiple: params.vibeInfo || [],
            reference_strength_multiple: params.vibeStrength || [],
            
            // Skip CFG
            skip_cfg_above_sigma: params.variety ? 58 : null,
        }

        // V4 Specific Parameters
        if (params.model.includes('nai-diffusion-4')) {
             apiParameters.v4_prompt = {
                caption: {
                    base_caption: removeComments(params.prompt),
                    char_captions: [] as { char_caption: string, centers: { x: number, y: number }[] }[],
                },
                use_coords: false,
                use_order: true,
            }
            apiParameters.v4_negative_prompt = {
                caption: {
                    base_caption: removeComments(params.negative_prompt),
                    char_captions: [] as { char_caption: string, centers: { x: number, y: number }[] }[],
                },
            }

            // Character Prompts
            if (params.characterPrompts && params.characterPrompts.length > 0) {
                 const usePositions = params.characterPositionEnabled ?? false
                 for (const char of params.characterPrompts) {
                    if (char.enabled && char.prompt.trim()) {
                        const centers = usePositions
                            ? [{ x: char.position.x, y: char.position.y }]
                            : [{ x: 0.5, y: 0.5 }]

                        apiParameters.v4_prompt.caption.char_captions.push({
                            char_caption: removeComments(char.prompt),
                            centers: centers
                        })
                        apiParameters.v4_negative_prompt.caption.char_captions.push({
                            char_caption: removeComments(char.negative?.trim() || ''),
                            centers: centers
                        })
                    }
                 }
                 if (apiParameters.v4_prompt.caption.char_captions.length > 0 && usePositions) {
                    apiParameters.v4_prompt.use_coords = true
                    apiParameters.use_coords = true
                }
            }

            // Character Reference (Director Tools)
            if (processedCharImages.length > 0) {
                apiParameters.director_reference_images = processedCharImages
                apiParameters.director_reference_information_extracted = processedCharImages.map(() => 1.0)
                apiParameters.director_reference_strength_values = params.charStrength || processedCharImages.map(() => 1.0)
                apiParameters.director_reference_secondary_strength_values = (params.charFidelity || processedCharImages.map(() => 1.0)).map(f => 1.0 - f)
                apiParameters.director_reference_descriptions = (params.charReferenceType || processedCharImages.map(() => 'character&style')).map(type => ({
                    caption: { base_caption: type, char_captions: [] },
                    legacy_uc: false
                }))
            }
        }

        if (processedVibeImages.length > 1) {
            apiParameters.normalize_reference_strength_multiple = true
        }

        // ===========================================
        // 3. Handle I2I and Inpainting logic
        // ===========================================
        
        if (params.sourceImage) {
            const resolvedSource = await resolveImageToBase64(params.sourceImage)
            const rawSourceImage = stripBase64Header(resolvedSource)
            apiParameters.image = rawSourceImage

            if (params.mask) {
                // --- INPAINTING (INFILL) ---
                action = 'infill'
                if (!requestModel.includes('inpainting')) {
                    requestModel = requestModel + '-inpainting'
                }
                const userStrength = params.strength ?? 0.7
                apiParameters.inpaintImg2ImgStrength = userStrength
                apiParameters.noise = params.noise ?? 0
                
                // Mask Logic
                const img = new Image()
                const dims = await new Promise<{w:number,h:number}>((res, reject) => {
                    img.onload = () => {
                        const result = { w: img.width, h: img.height }
                        img.src = ''
                        res(result)
                    }
                    img.onerror = (event) => {
                        img.src = ''
                        reject(event)
                    }
                    img.src = resolvedSource
                })
                
                const resolvedMask = await resolveImageToBase64(params.mask)
                const grayscaleMask = await convertMaskToGrayscale(resolvedMask, dims.w, dims.h)
                apiParameters.mask = grayscaleMask
                
                apiParameters.add_original_image = false

            } else {
                // --- IMG2IMG ---
                action = 'img2img'
                apiParameters.strength = params.strength ?? 0.7
                apiParameters.noise = params.noise ?? 0.0
            }
        }

        const requestBody = {
            input: params.prompt,
            model: requestModel,
            action: action,
            parameters: apiParameters
        }

        console.log('[Stream] Starting streaming generation...')

        const response = await CLIENT_FETCH(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.trim()}`,
                'Accept': 'application/x-msgpack',
                'User-Agent': 'NAI_Assistant/1.0'
            },
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[Stream] API Error:', response.status, errorText)
            return { success: false, error: `API Error: ${response.status} ${errorText}` }
        }

        if (!response.body) {
            return { success: false, error: 'No response body' }
        }

        // Helper function to convert binary to base64
        const binaryToBase64 = (uint8: Uint8Array): string => {
            let binary = ''
            const chunkSize = 32768
            for (let i = 0; i < uint8.length; i += chunkSize) {
                const chunk = uint8.subarray(i, Math.min(i + chunkSize, uint8.length))
                binary += String.fromCharCode.apply(null, Array.from(chunk))
            }
            return btoa(binary)
        }

        const reader = response.body.getReader()
        let buffer = new Uint8Array(0)
        let finalImageData: string | null = null
        let lastStepShown = -1
        let lastPreviewAt = 0
        const totalSteps = params.steps || 28
        const previewStepInterval = Math.max(1, Math.floor(totalSteps / STREAM_PREVIEW_MAX_UPDATES))

        // 安全读取函数（带超时机制），防止流挂起
        const readWithTimeout = async (timeoutMs = 90000) => {
            let timeoutId: any
            const timeoutPromise = new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`Stream read timeout (${timeoutMs}ms)`)), timeoutMs)
            })
            try {
                const result = await Promise.race([reader.read(), timeoutPromise])
                clearTimeout(timeoutId)
                return result
            } catch (err) {
                clearTimeout(timeoutId)
                reader.cancel().catch(e => console.error('[Stream] Cancel error:', e))
                throw err
            }
        }

        while (true) {
            const { done, value } = await readWithTimeout()

            if (value) {
                const newBuffer = new Uint8Array(buffer.length + value.length)
                newBuffer.set(buffer)
                newBuffer.set(value, buffer.length)
                buffer = newBuffer

                while (buffer.length >= 4) {
                    const length = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3]

                    if (length <= 0 || length > 50_000_000) break
                    if (buffer.length < 4 + length) break

                    const messageData = buffer.slice(4, 4 + length)
                    buffer = buffer.slice(4 + length)

                    try {
                        let decoded: any = msgpackDecode(messageData)
                        const eventType = decoded.event_type || decoded.event || 'unknown'
                        const stepIx = decoded.step_ix as number | undefined

                        if (typeof stepIx === 'number' && totalSteps > 0) {
                            const progress = Math.round((stepIx / totalSteps) * 100)
                            
                            if (eventType === 'intermediate') {
                                if (STREAM_INTERMEDIATE_IMAGE_ENABLED) {
                                    const imgField = decoded.image
                                    const now = Date.now()
                                    const shouldUpdatePreview = lastStepShown < 0
                                        || stepIx - lastStepShown >= previewStepInterval
                                        || now - lastPreviewAt >= STREAM_PREVIEW_MIN_INTERVAL_MS

                                    if (imgField && (imgField instanceof Uint8Array) && stepIx > lastStepShown && shouldUpdatePreview) {
                                        lastStepShown = stepIx
                                        lastPreviewAt = now
                                        const previewBase64 = binaryToBase64(imgField)
                                        onProgress?.(progress, previewBase64)
                                    } else {
                                        onProgress?.(progress)
                                    }
                                } else {
                                    onProgress?.(progress)
                                }
                            }
                        }

                        if (eventType === 'final') {
                            const imgField = decoded.image
                            if (imgField && (imgField instanceof Uint8Array)) {
                                // Inject Metadata
                                console.log('[Stream] Injecting Metadata...')
                                try {
                                    const metadataParams = {
                                        prompt: params.prompt,
                                        negativePrompt: params.negative_prompt,
                                        steps: params.steps,
                                        width: params.width,
                                        height: params.height,
                                        cfgScale: params.cfg_scale,
                                        cfgRescale: params.cfg_rescale,
                                        seed: params.seed,
                                        model: params.model,
                                        sampler: params.sampler,
                                        scheduler: params.scheduler,
                                        smea: params.smea,
                                        smeaDyn: params.smea_dyn,
                                        ucPreset: params.ucPreset ?? 0,
                                        characterPrompts: params.characterPrompts?.map(cp => ({
                                            prompt: cp.prompt,
                                            negative: cp.negative,
                                            enabled: cp.enabled
                                        })) || [],
                                        characterPositionEnabled: params.characterPositionEnabled ?? false
                                    }
                                    const withMetadata = injectNAIMetadata(imgField, metadataParams)
                                    finalImageData = binaryToBase64(withMetadata)
                                } catch (e) {
                                    console.error('[Stream] Metadata injection failed:', e)
                                    // Fallback to raw image
                                    finalImageData = binaryToBase64(imgField)
                                }
                            }
                            onProgress?.(100)
                        }

                        if (decoded.error || decoded.message) {
                            reader.cancel()
                            return { success: false, error: decoded.error || decoded.message }
                        }
                    } catch (e) {
                         console.error('[Stream] Decode error:', e)
                    }
                }
            }

            if (done) break
        }

        if (finalImageData) {
            return {
                success: true,
                imageData: finalImageData,
                encodedVibes: newlyEncodedVibes.filter((v): v is string => v !== null)
            }
        }

        return { success: false, error: 'No image data in stream' }

    } catch (error) {
        console.error('[Stream] Error:', error)
        return { success: false, error: `Stream Error: ${error}` }
    }
}
