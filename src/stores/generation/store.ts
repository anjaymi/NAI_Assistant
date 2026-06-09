// Generation Store — Zustand Store 定义
// 状态初始值 + 简单 setters + 组合 action factories + persist 配置

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage, migrateFromLocalStorage } from '@/lib/indexed-db'
import type { GenerationState } from './types'
import { createQueueActions } from './queue-actions'
import { createGenerateActions } from './generate-action'

// 启动时迁移 localStorage 数据到 IndexedDB
migrateFromLocalStorage(['generation-storage'])

export const useGenerationStore = create<GenerationState>()(
    persist(
        (set, get) => ({
            // =====================
            // 默认值
            // =====================
            prompt: '',
            negativePrompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
            width: 832,
            height: 1216,
            steps: 28,
            cfgScale: 5.0,
            seed: -1,
            model: 'nai-diffusion-3',
            sampler: 'k_euler_ancestral',
            scheduler: 'karras',
            smea: true,
            smeaDyn: true,
            cfgRescale: 0,
            variety: false,
            ucPreset: 0,

            sourceImage: null,
            mask: null,
            strength: 0.7,
            noise: 0.0,
            characterPrompts: [],
            characterPositionEnabled: false,

            queue: [],
            isQueueRunning: false,
            useDynamicQueueParams: false,
            setUseDynamicQueueParams: (val) => set({ useDynamicQueueParams: val }),

            isGenerating: false,
            previewImage: null,
            generationProgress: 0,
            lastUsedSeed: null,

            // =====================
            // 标签通信
            // =====================
            pendingTagsToAppend: null,
            setPendingTagsToAppend: (tags) => set({ pendingTagsToAppend: tags }),
            clearPendingTagsToAppend: () => set({ pendingTagsToAppend: null }),

            // =====================
            // 简单 Setters
            // =====================
            setPrompt: (prompt) => set({ prompt }),
            setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
            setDimensions: (width, height) => set({ width, height }),
            setSteps: (steps) => set({ steps }),
            setCfgScale: (cfgScale) => set({ cfgScale }),
            setSeed: (seed) => set({ seed }),
            setModel: (model) => set({ model }),
            setSampler: (sampler) => set({ sampler }),
            setScheduler: (scheduler) => set({ scheduler }),
            setSmea: (smea) => set({ smea }),
            setSmeaDyn: (smeaDyn) => set({ smeaDyn }),
            setCfgRescale: (cfgRescale) => set({ cfgRescale }),
            setPreviewImage: (url) => {
                const previous = get().previewImage
                if (previous && previous !== url && previous.startsWith('blob:')) {
                    URL.revokeObjectURL(previous)
                }
                set({ previewImage: url })
            },
            setVariety: (variety) => set({ variety }),
            setUcPreset: (ucPreset) => set({ ucPreset }),
            
            setSourceImage: (sourceImage) => {
                if (get().sourceImage === sourceImage) return
                set({ sourceImage })
            },
            setMask: (mask) => {
                if (get().mask === mask) return
                set({ mask })
            },
            setStrength: (strength) => set({ strength }),
            setNoise: (noise) => set({ noise }),
            setGenerationProgress: (progress) => set({ generationProgress: progress }),

            // =====================
            // 角色提示词 (V4)
            // =====================
            addCharacterPrompt: () => set(state => ({
                characterPrompts: [...state.characterPrompts, {
                    id: Date.now().toString(),
                    prompt: '', negative: '', enabled: true,
                    position: { x: 0.5, y: 0.5 }
                }]
            })),
            updateCharacterPrompt: (id, updates) => set(state => ({
                characterPrompts: state.characterPrompts.map(cp => cp.id === id ? { ...cp, ...updates } : cp)
            })),
            removeCharacterPrompt: (id) => set(state => ({
                characterPrompts: state.characterPrompts.filter(cp => cp.id !== id)
            })),
            setCharacterPositionEnabled: (enabled) => set({ characterPositionEnabled: enabled }),

            // =====================
            // 复杂 Actions（工厂模式注入）
            // =====================
            ...createQueueActions(set, get),
            ...createGenerateActions(set, get),
        }),
        {
            name: 'generation-storage',
            version: 3,
            storage: createJSONStorage(() => indexedDBStorage),
            migrate: (persistedState) => {
                const nextState = (persistedState as Partial<GenerationState> | undefined) ?? {}
                const { vibeImages: _legacyVibeImages, charImages: _legacyCharImages, ...restState } = nextState as Partial<GenerationState> & {
                    vibeImages?: unknown
                    charImages?: unknown
                }
                return {
                    ...restState,
                    sourceImage: null,
                    mask: null,
                }
            },
            partialize: (state) => ({
                prompt: state.prompt,
                negativePrompt: state.negativePrompt,
                width: state.width,
                height: state.height,
                steps: state.steps,
                cfgScale: state.cfgScale,
                seed: state.seed,
                model: state.model,
                sampler: state.sampler,
                scheduler: state.scheduler,
                smea: state.smea,
                smeaDyn: state.smeaDyn,
                cfgRescale: state.cfgRescale,
                variety: state.variety,
                characterPrompts: state.characterPrompts,
                useDynamicQueueParams: state.useDynamicQueueParams
            })
        }
    )
)
