import { useEffect, useRef } from 'react'
import { useSceneStore } from '@/stores/scene-store'
import { useGenerationStore } from '@/stores/generation-store'
import { useCharacterStore } from '@/stores/character-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useAuthStore } from '@/stores/auth-store'
import { generateImage, GenerationParams } from '@/services/novelai-service'
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import { pictureDir, join } from '@tauri-apps/api/path'
import { useToast } from '@/hooks/use-toast'
import { shallow } from 'zustand/shallow'
import { convertGeneratedBase64ToFormat } from '@/lib/image-format'
import { buildNAIMetadata, injectWebPMetadata } from '@/lib/metadata-writer-webp'

export function useSceneGeneration() {
    const { 
        activeProjectId, 
        isGenerating, 
        setIsGenerating,
        setQueueCount,
        addImageToScene,
        getActiveProject
    } = useSceneStore((state) => ({
        activeProjectId: state.activeProjectId,
        isGenerating: state.isGenerating,
        setIsGenerating: state.setIsGenerating,
        setQueueCount: state.setQueueCount,
        addImageToScene: state.addImageToScene,
        getActiveProject: state.getActiveProject,
    }), shallow)

    const token = useAuthStore((state) => state.token)
    const { libraryPath, useAbsoluteLibraryPath } = useSettingsStore((state) => ({
        libraryPath: state.libraryPath,
        useAbsoluteLibraryPath: state.useAbsoluteLibraryPath,
    }), shallow)
    const { toast } = useToast()
    
    const isProcessingRef = useRef(false)

    useEffect(() => {
        let mounted = true

        const processQueue = async () => {
            if (isProcessingRef.current || !mounted) return
            
            const activeProject = getActiveProject()
            if (!activeProject || !token) {
                setIsGenerating(false)
                return
            }

            // Find next scene with queue > 0
            const scene = activeProject.scenes.find(s => s.queueCount > 0)
            
            if (!scene) {
                setIsGenerating(false)
                toast({
                    title: "生成完成",
                    description: "当前项目的所有队列已完成",
                    variant: "success"
                })
                return
            }

            isProcessingRef.current = true

            try {
                await useCharacterStore.getState().ensureImagesLoaded()
                const charStore = useCharacterStore.getState()
                const generationState = useGenerationStore.getState()
                const activeVibeImages = charStore.vibeImages.filter(v => Boolean(v.base64 || v.encodedVibe))
                const activeCharImages = charStore.characterImages.filter(c => Boolean(c.base64))

                // Construct Params
                // Combine Base Prompt + Scene Prompt
                const finalPrompt = [generationState.prompt, scene.prompt].filter(Boolean).join(', ')
                
                // Use scene resolution if set, otherwise global
                const finalWidth = scene.width || generationState.width
                const finalHeight = scene.height || generationState.height

                const params: GenerationParams = {
                     prompt: finalPrompt,
                     negative_prompt: generationState.negativePrompt,
                     width: finalWidth,
                     height: finalHeight,
                     steps: generationState.steps,
                     cfg_scale: generationState.cfgScale,
                     cfg_rescale: generationState.cfgRescale,
                     sampler: generationState.sampler,
                     scheduler: generationState.scheduler,
                     seed: scene.seed || (generationState.seed === -1 ? Math.floor(Math.random() * 4294967295) : generationState.seed),
                     model: generationState.model,
                     smea: generationState.smea,
                     smea_dyn: generationState.smeaDyn,
                     variety: generationState.variety,
                      
                      // Helper: pass global extra params
                     sourceImage: generationState.sourceImage,
                     strength: generationState.strength,
                     noise: generationState.noise,
                     mask: generationState.mask,
                     vibeImages: activeVibeImages.map(v => v.base64 || ''),
                     vibeInfo: activeVibeImages.map(v => v.informationExtracted),
                     vibeStrength: activeVibeImages.map(v => v.strength),
                     preEncodedVibes: activeVibeImages.map(v => v.encodedVibe || null),
                       
                     charImages: activeCharImages.map(c => c.base64 || ''),
                     charFidelity: activeCharImages.map(c => c.fidelity ?? 1.0)
                  }

                console.log(`[Scene] Generating for ${scene.name}...`)
                const result = await generateImage(token, params)

                if (result.success && result.imageData) {
                     if (result.encodedVibes && result.encodedVibes.length > 0) {
                         const { vibeImages, updateVibeImage } = useCharacterStore.getState()
                         let encodedIndex = 0

                         for (let i = 0; i < vibeImages.length && encodedIndex < result.encodedVibes.length; i++) {
                             if (!vibeImages[i].encodedVibe) {
                                 updateVibeImage(vibeImages[i].id, { encodedVibe: result.encodedVibes[encodedIndex] })
                                 encodedIndex++
                             }
                         }
                     }

                      // Save Image
                      const timestamp = Date.now()
                     const safeProjectName = activeProject.name.replace(/[<>:"/\\|?*]/g, '_')
                     const safeSceneName = scene.name.replace(/[<>:"/\\|?*]/g, '_')
                     const { imageFormat } = useSettingsStore.getState()
                     const convertedImage = await convertGeneratedBase64ToFormat(result.imageData, imageFormat)
                     const fileName = `SCENE_${timestamp}.${convertedImage.extension}`
                     
                     let fullPath = ''
                     let binaryData: Uint8Array

                     // Decode base64
                     const binString = atob(convertedImage.base64)
                     binaryData = new Uint8Array(binString.length)
                     for (let i = 0; i < binString.length; i++) {
                         binaryData[i] = binString.charCodeAt(i)
                     }

                     if (convertedImage.extension === 'webp') {
                         binaryData = new Uint8Array(injectWebPMetadata(binaryData, buildNAIMetadata({
                             prompt: finalPrompt,
                             negativePrompt: generationState.negativePrompt,
                             steps: generationState.steps,
                             width: finalWidth,
                             height: finalHeight,
                             cfgScale: generationState.cfgScale,
                             cfgRescale: generationState.cfgRescale,
                             seed: params.seed,
                             model: generationState.model,
                             sampler: generationState.sampler,
                             scheduler: generationState.scheduler,
                             smea: generationState.smea,
                             smeaDyn: generationState.smeaDyn,
                             ucPreset: generationState.ucPreset,
                             characterPrompts: [],
                             characterPositionEnabled: false,
                         })))
                     }

                     if (useAbsoluteLibraryPath && libraryPath) {
                         const projectDir = await join(libraryPath, safeProjectName)
                         const sceneDir = await join(projectDir, safeSceneName)
                         if (!(await exists(sceneDir))) {
                             await mkdir(sceneDir, { recursive: true })
                         }
                         fullPath = await join(sceneDir, fileName)
                         await writeFile(fullPath, binaryData)
                     } else {
                         // Default to Pictures/NAIS_Scenes/Project/Scene
                         const base = 'NAIS_Scenes'
                         const relPath = `${base}/${safeProjectName}/${safeSceneName}`
                         if (!(await exists(relPath, { baseDir: BaseDirectory.Picture }))) {
                             await mkdir(relPath, { baseDir: BaseDirectory.Picture, recursive: true })
                         }
                         await writeFile(`${relPath}/${fileName}`, binaryData, { baseDir: BaseDirectory.Picture })
                         
                         const picDir = await pictureDir()
                         fullPath = await join(picDir, relPath, fileName)
                     }

                     // Update Store
                     addImageToScene(activeProject.id, scene.id, fullPath)
                     
                     // Decrement Queue
                     setQueueCount(activeProject.id, scene.id, scene.queueCount - 1)
                } else {
                    console.error("Generation Failed", result.error)
                    // Optional: stop or skip? For now, skip decrement to retry? 
                    // Or stop to avoid burning credits on loops.
                    setIsGenerating(false)
                    toast({
                        title: "生成失败",
                        description: result.error,
                        variant: "destructive"
                    })
                }

            } catch (e) {
                console.error("Scene Generation Error", e)
                setIsGenerating(false)
            } finally {
                useCharacterStore.getState().clearRuntimeData()
                isProcessingRef.current = false
                // Loop
                if (mounted && useSceneStore.getState().isGenerating) {
                    // Small delay
                    setTimeout(processQueue, 500)
                }
            }
        }

        if (isGenerating) {
            processQueue()
        }

        return () => {
             mounted = false
        }
    }, [isGenerating, activeProjectId, token]) // Dependencies

    return {
        isGenerating,
        startQueue: () => setIsGenerating(true),
        stopQueue: () => setIsGenerating(false)
    }
}
