// Generation Store — 核心生成与保存 Actions
// generate() 参数组装 + API 调用 + 自动保存
// saveImage() 手动保存逻辑

import type { GenerationState, QueueItem } from './types'
import { generateImage, generateImageStream } from '@/services/novelai-service'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useAuthStore } from '../auth-store'
import { useCharacterStore } from '../character-store'
import { createGalleryItem, useGalleryStore } from '../gallery-store'
import { useSettingsStore } from '../settings-store'
import { toast } from '@/hooks/use-toast'
import { processWildcards } from '@/lib/fragment-processor'
import { convertGeneratedBase64ToFormat } from '@/lib/image-format'
import type { ReferenceImage } from '../character-store'
import { buildNAIMetadata, injectWebPMetadata } from '@/lib/metadata-writer-webp'
import { resolveImageInputToBase64, saveGeneratedPreviewImage } from '@/lib/image-utils'

type SetFn = (partial: Partial<GenerationState> | ((state: GenerationState) => Partial<GenerationState>)) => void
type GetFn = () => GenerationState
const STREAM_INTERMEDIATE_PREVIEW_ENABLED = true

function shouldFallbackToNonStreaming(error?: string) {
    if (!error) return false

    const normalized = error.toLowerCase()
    return normalized.includes('failed to fetch') || normalized.includes('insufficient_resources')
}

function createPngObjectUrl(base64: string) {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }

    return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
}

function resolveReferenceImages(images: ReferenceImage[], hydratedImages: ReferenceImage[]) {
    return images.map((image) => {
        if (image.base64 || !image.filePath) return image

        const hydrated = hydratedImages.find((candidate) =>
            candidate.id === image.id || (candidate.filePath && candidate.filePath === image.filePath)
        )

        return hydrated ? { ...image, base64: hydrated.base64, encodedVibe: image.encodedVibe ?? hydrated.encodedVibe } : image
    })
}

/** 生成与保存 Actions 工厂 */
export function createGenerateActions(set: SetFn, get: GetFn) {
    return {
        generate: async (overrideParams?: Partial<QueueItem['params']>) => {
            const state = get()
            const { token, isVerified } = useAuthStore.getState()
            const { autoSave, savePath, useAbsolutePath, imageFormat, streamingEnabled } = useSettingsStore.getState()

            if (!isVerified || !token) {
                toast({ title: "需要登录", description: "请先登录", variant: "destructive" })
                return
            }

            set({ isGenerating: true })
            await useCharacterStore.getState().ensureImagesLoaded()
            const hydratedReferenceState = useCharacterStore.getState()
            const hydratedCharImages = resolveReferenceImages(
                overrideParams?.charImages || hydratedReferenceState.characterImages,
                hydratedReferenceState.characterImages
            )
            const hydratedVibeImages = resolveReferenceImages(
                overrideParams?.vibeImages || hydratedReferenceState.vibeImages,
                hydratedReferenceState.vibeImages
            )

            const p = {
                ...state,
                ...overrideParams,
                charImages: hydratedCharImages,
                vibeImages: hydratedVibeImages,
                characterPrompts: overrideParams?.characterPrompts || state.characterPrompts,
            }

            const activeVibeImages = p.vibeImages.filter((img) => Boolean(img.base64 || img.encodedVibe))
            const activeCharImages = p.charImages.filter((img) => Boolean(img.base64))
            let activeStreamPreviewUrl: string | null = null
            let lastProgressUpdate = 0
            let lastProgressValue = -1

            try {
                // 1. Process Wildcards
                const processedPrompt = await processWildcards(p.prompt)
                const processedNegative = await processWildcards(p.negativePrompt)
                
                // 2. Determine Seed
                const effectiveSeed = p.seed === -1 
                    ? Math.floor(Math.random() * 4294967295) 
                    : p.seed

                // 3. Call API (Streaming)
                set({ generationProgress: 0 })
                const requestParams = {
                    prompt: processedPrompt,
                    negative_prompt: processedNegative,
                    width: p.width,
                    height: p.height,
                    steps: p.steps,
                    cfg_scale: p.cfgScale,
                    seed: effectiveSeed,
                    model: p.model,
                    sampler: p.sampler,
                    scheduler: p.scheduler,
                    smea: p.smea,
                    smea_dyn: p.smeaDyn,
                    variety: p.variety,
                    cfg_rescale: p.cfgRescale,
                    ucPreset: p.ucPreset,
                    qualityToggle: true,

                    sourceImage: p.sourceImage,
                    mask: p.mask,
                    strength: p.strength,
                    noise: p.noise,

                    vibeImages: activeVibeImages.map(img => img.base64 || ''),
                    vibeInfo: activeVibeImages.map(img => img.informationExtracted),
                    vibeStrength: activeVibeImages.map(img => img.strength),
                    preEncodedVibes: activeVibeImages.map(img => img.encodedVibe || null),

                    charImages: activeCharImages.map(img => img.base64 || ''),
                    charStrength: activeCharImages.map(img => img.strength),
                    charFidelity: activeCharImages.map(img => img.fidelity ?? 1.0),
                    charReferenceType: activeCharImages.map(img => img.referenceType ?? 'character&style'),

                    characterPrompts: p.characterPrompts,
                    characterPositionEnabled: p.characterPositionEnabled
                }

                let result

                const canUseStreaming = streamingEnabled && !p.sourceImage && !p.mask

                if (canUseStreaming) {
                    result = await generateImageStream(token, requestParams, (progress, partialImage) => {
                        const now = Date.now()
                        if (progress === 100 || progress - lastProgressValue >= 10 || now - lastProgressUpdate >= 500) {
                            lastProgressValue = progress
                            lastProgressUpdate = now
                            set({ generationProgress: progress })
                        }
                        if (partialImage && STREAM_INTERMEDIATE_PREVIEW_ENABLED) {
                            if (activeStreamPreviewUrl) {
                                URL.revokeObjectURL(activeStreamPreviewUrl)
                            }
                            activeStreamPreviewUrl = createPngObjectUrl(partialImage)
                            get().setPreviewImage(activeStreamPreviewUrl)
                        }
                    })
                } else {
                    result = await generateImage(token, requestParams)
                }

                if (canUseStreaming && !result.success && shouldFallbackToNonStreaming(result.error)) {
                    console.warn('[Generate] Stream request failed, falling back to non-streaming request', result.error)
                    set({ generationProgress: 0 })
                    result = await generateImage(token, requestParams)
                }

                if (result.success && result.imageData) {
                    if (activeStreamPreviewUrl) {
                        URL.revokeObjectURL(activeStreamPreviewUrl)
                        activeStreamPreviewUrl = null
                    }

                    const imageUrl = `data:image/png;base64,${result.imageData}`
                    let finalPreviewUrl = imageUrl
                    set({ lastUsedSeed: effectiveSeed })

                    if (result.encodedVibes && result.encodedVibes.length > 0 && !overrideParams) {
                        const { vibeImages, updateVibeImage } = useCharacterStore.getState()
                        let encodedIndex = 0

                        for (let i = 0; i < vibeImages.length && encodedIndex < result.encodedVibes.length; i++) {
                            if (!vibeImages[i].encodedVibe) {
                                updateVibeImage(vibeImages[i].id, { encodedVibe: result.encodedVibes[encodedIndex] })
                                encodedIndex++
                            }
                        }
                    }

                    // Auto Save
                    if (autoSave && (window as any)['__TAURI__']) {
                        try {
                            const { writeFile, mkdir, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
                            const { join } = await import('@tauri-apps/api/path')

                            const convertedImage = await convertGeneratedBase64ToFormat(result.imageData, imageFormat)
                            const binaryString = atob(convertedImage.base64)
                            const bytes = new Uint8Array(binaryString.length)
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i)
                            }

                            let finalBytes = bytes
                            if (convertedImage.extension === 'webp') {
                                finalBytes = new Uint8Array(injectWebPMetadata(finalBytes, buildNAIMetadata({
                                    prompt: processedPrompt,
                                    negativePrompt: processedNegative,
                                    steps: p.steps,
                                    width: p.width,
                                    height: p.height,
                                    cfgScale: p.cfgScale,
                                    cfgRescale: p.cfgRescale,
                                    seed: effectiveSeed,
                                    model: p.model,
                                    sampler: p.sampler,
                                    scheduler: p.scheduler,
                                    smea: p.smea,
                                    smeaDyn: p.smeaDyn,
                                    ucPreset: p.ucPreset,
                                    characterPrompts: p.characterPrompts,
                                    characterPositionEnabled: p.characterPositionEnabled,
                                })))
                            }
                            const ext = convertedImage.extension
                            const fileName = `NAIS_${Date.now()}.${ext}`
                            const outputDir = savePath || 'NAIS_Output'
                            
                            let finalPath = ''
                            if (useAbsolutePath) {
                                 if (!(await exists(outputDir))) {
                                    await mkdir(outputDir, { recursive: true })
                                 }
                                 const fullPath = await join(outputDir, fileName)
                                 await writeFile(fullPath, finalBytes)
                                 finalPath = fullPath
                            } else {
                                 const { pictureDir } = await import('@tauri-apps/api/path')
                                  if (!(await exists(outputDir, { baseDir: BaseDirectory.Picture }))) {
                                     await mkdir(outputDir, { baseDir: BaseDirectory.Picture })
                                  }
                                  await writeFile(`${outputDir}/${fileName}`, finalBytes, { baseDir: BaseDirectory.Picture })
                                  const picDir = await pictureDir()
                                  finalPath = await join(picDir, outputDir, fileName)
                             }
                              
                             if (!overrideParams) {
                                 toast({ title: "已保存", description: `保存至 ${outputDir}` })
                             }
                            const galleryItem = createGalleryItem(finalPath, fileName)
                            useGalleryStore.getState().upsertGalleryItem(galleryItem)
                            finalPreviewUrl = galleryItem.url
                        } catch (e) {
                            console.error('AutoSave Error:', e)
                            toast({ title: "自动保存失败", description: String(e), variant: "destructive" })
                        }
                    } else {
                        if ((window as any)['__TAURI__']) {
                            try {
                                const previewPath = await saveGeneratedPreviewImage(imageUrl, 'latest')
                                finalPreviewUrl = convertFileSrc(previewPath)
                            } catch (previewPersistError) {
                                console.warn('[Generate] Failed to persist temporary preview image', previewPersistError)
                            }
                        }

                        if (!overrideParams) {
                            toast({ title: "生成成功", description: "用时 " + (Date.now() - (state as any)._startTime) + "ms" })
                        }
                    }

                    get().setPreviewImage(finalPreviewUrl)

                } else {
                    throw new Error(result.error || "Generation failed")
                }

            } catch (e: any) {
                if (typeof activeStreamPreviewUrl === 'string') {
                    URL.revokeObjectURL(activeStreamPreviewUrl)
                }
                toast({ title: "生成失败", description: e.message || String(e), variant: "destructive" })
            } finally {
                useCharacterStore.getState().clearRuntimeData()
                set({ isGenerating: false })
            }
        },
        
        saveImage: async (imageData: string) => {
            const resolvedImage = await resolveImageInputToBase64(imageData)
            const base64Data = resolvedImage.replace(/^data:image\/\w+;base64,/, '')
            const { imageFormat } = useSettingsStore.getState()

            if ((window as any)['__TAURI__']) {
                try {
                    const { writeFile } = await import('@tauri-apps/plugin-fs')
                    const convertedImage = await convertGeneratedBase64ToFormat(base64Data, imageFormat)

                    const binaryString = atob(convertedImage.base64)
                    let bytes = new Uint8Array(binaryString.length)
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i)
                    }

                    if (convertedImage.extension === 'webp') {
                        const state = get()
                        bytes = new Uint8Array(injectWebPMetadata(bytes, buildNAIMetadata({
                            prompt: state.prompt,
                            negativePrompt: state.negativePrompt,
                            steps: state.steps,
                            width: state.width,
                            height: state.height,
                            cfgScale: state.cfgScale,
                            cfgRescale: state.cfgRescale,
                            seed: state.lastUsedSeed ?? state.seed,
                            model: state.model,
                            sampler: state.sampler,
                            scheduler: state.scheduler,
                            smea: state.smea,
                            smeaDyn: state.smeaDyn,
                            ucPreset: state.ucPreset,
                            characterPrompts: state.characterPrompts,
                            characterPositionEnabled: state.characterPositionEnabled,
                        })))
                    }

                    try {
                        const { save } = await import('@tauri-apps/plugin-dialog')
                            const filePath = await save({
                                filters: [{
                                    name: imageFormat === 'webp' ? 'WebP Image' : 'PNG Image',
                                    extensions: [imageFormat]
                                }],
                                defaultPath: `NAIS_${Date.now()}.${imageFormat}`
                            })

                        if (filePath) {
                            await writeFile(filePath, bytes)
                            toast({ title: "已保存", description: `Saved to ${filePath}` })
                            const fileName = filePath.split(/[/\\]/).pop() || `NAIS_${Date.now()}.${imageFormat}`
                            useGalleryStore.getState().upsertGalleryItem(createGalleryItem(filePath, fileName))
                        }
                    } catch (dialogErr) {
                        console.warn("Dialog save failed, falling back to auto-save path", dialogErr);
                        const { exists, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
                        const { join } = await import('@tauri-apps/api/path');
                        
                        const settings = useSettingsStore.getState();
                        const outputDir = settings.savePath || 'NAIS_Output';
                        const fileName = `NAIS_${Date.now()}.${settings.imageFormat}`;

                        if (settings.useAbsolutePath) {
                            if (!(await exists(outputDir))) {
                                await mkdir(outputDir, { recursive: true });
                            }
                            const fullPath = await join(outputDir, fileName);
                            await writeFile(fullPath, bytes);
                            toast({ title: "已保存", description: `Fallback saved to ${fullPath}` });
                            useGalleryStore.getState().upsertGalleryItem(createGalleryItem(fullPath, fileName))
                        } else {
                            if (!(await exists(outputDir, { baseDir: BaseDirectory.Picture }))) {
                                await mkdir(outputDir, { baseDir: BaseDirectory.Picture });
                            }
                            await writeFile(`${outputDir}/${fileName}`, bytes, { baseDir: BaseDirectory.Picture });
                            toast({ title: "已保存", description: `Fallback saved to Pictures/${outputDir}` });
                            const { pictureDir } = await import('@tauri-apps/api/path');
                            const picDir = await pictureDir();
                            const fullPath = await join(picDir, outputDir, fileName);
                            useGalleryStore.getState().upsertGalleryItem(createGalleryItem(fullPath, fileName))
                        }
                    }
                } catch (e) {
                    console.error('Save Error:', e)
                    toast({ title: "保存失败", description: String(e), variant: "destructive" })
                }
            } else {
                // Browser Fallback
                const link = document.createElement('a')
                const convertedImage = await convertGeneratedBase64ToFormat(base64Data, imageFormat)
                link.href = `data:${convertedImage.mimeType};base64,${convertedImage.base64}`
                link.download = `NAIS_${Date.now()}.${convertedImage.extension}`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
            }
        },
    }
}
