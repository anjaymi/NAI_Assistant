// Generation Store — 队列管理 Actions
// addToQueue, removeFromQueue, startQueue, pauseQueue, processQueue

import type { GenerationState, QueueItem } from './types'
import { useSettingsStore } from '../settings-store'
import { type ReferenceImage, useCharacterStore } from '../character-store'
import { toast } from '@/hooks/use-toast'

type SetFn = (partial: Partial<GenerationState> | ((state: GenerationState) => Partial<GenerationState>)) => void
type GetFn = () => GenerationState

/** 模块级会话计数器（用于批量延迟） */
let sessionCount = 0

function createQueueReferenceSnapshot(images: ReferenceImage[]) {
    return images.map((image) => ({
        ...image,
        base64: image.filePath ? undefined : image.base64,
    }))
}

/** 队列 Actions 工厂 — 接受 Zustand 的 set/get 返回 action 对象 */
export function createQueueActions(set: SetFn, get: GetFn) {
    return {
        addToQueue: (count = 1) => {
            const state = get()
            const charStore = useCharacterStore.getState()
            const newItems: QueueItem[] = []
            const batchId = Date.now().toString()
            
            for (let i = 0; i < count; i++) {
                const MAX_SEED = 4294967295
                let itemSeed: number

                console.log(`[BatchDebug] i=${i}, state.seed=${state.seed} (type=${typeof state.seed})`)

                if (state.seed === -1) {
                     itemSeed = Math.floor(Math.random() * MAX_SEED)
                } else {
                     const STRIDE = 333333 
                     itemSeed = (state.seed + (i * STRIDE)) % MAX_SEED
                }

                newItems.push({
                    id: Date.now().toString() + '_' + i,
                    batchId,
                    status: 'pending',
                    createdAt: Date.now(),
                    params: {
                        prompt: state.prompt,
                        negativePrompt: state.negativePrompt,
                        width: state.width,
                        height: state.height,
                        steps: state.steps,
                        cfgScale: state.cfgScale,
                        seed: itemSeed,
                        model: state.model,
                        sampler: state.sampler,
                        scheduler: state.scheduler,
                        smea: state.smea,
                        smeaDyn: state.smeaDyn,
                        cfgRescale: state.cfgRescale,
                        variety: state.variety,
                        ucPreset: state.ucPreset,
                        sourceImage: state.sourceImage,
                        mask: state.mask,
                        strength: state.strength,
                        noise: state.noise,
                        vibeImages: createQueueReferenceSnapshot(charStore.vibeImages),
                        charImages: createQueueReferenceSnapshot(charStore.characterImages),
                        characterPrompts: [...state.characterPrompts],
                        characterPositionEnabled: state.characterPositionEnabled
                    }
                })
            }
            
            set(state => ({ queue: [...state.queue, ...newItems] }))
            toast({ title: "已加入队列", description: `已添加 ${count} 个任务到队列` })
        },

        removeFromQueue: (id: string) => set(state => ({
            queue: state.queue.filter(item => item.id !== id)
        })),

        clearQueue: () => set({ queue: [] }),

        startQueue: () => {
            const state = get()
            if (state.isQueueRunning) return
            if (state.queue.filter(i => i.status === 'pending').length === 0) return
            
            set({ isQueueRunning: true })
            get().processQueue()
        },

        pauseQueue: () => set({ isQueueRunning: false }),
        
        processQueue: async () => {
            const state = get()
            if (!state.isQueueRunning) return

            const nextItem = state.queue.find(i => i.status === 'pending')
            if (!nextItem) {
                set({ isQueueRunning: false })
                toast({ title: "队列完成", description: "所有任务已处理完毕" })
                return
            }

            set(s => ({
                queue: s.queue.map(i => i.id === nextItem.id ? { ...i, status: 'generating' as const } : i)
            }))

            let generateParams = nextItem.params

            if (state.useDynamicQueueParams) {
                const charStore = useCharacterStore.getState()
                // 启用动态参数：除了 Seed 保持原有队列特征，其余所有生成参数全部重拉最新的主面板状态
                generateParams = {
                    ...generateParams, // 保留一些原项的初始信息作为基础结构打底
                    prompt: state.prompt,
                    negativePrompt: state.negativePrompt,
                    width: state.width,
                    height: state.height,
                    steps: state.steps,
                    cfgScale: state.cfgScale,
                    // seed: 维持 nextItem.params.seed 不变
                    model: state.model,
                    sampler: state.sampler,
                    scheduler: state.scheduler,
                    smea: state.smea,
                    smeaDyn: state.smeaDyn,
                    cfgRescale: state.cfgRescale,
                    variety: state.variety,
                    ucPreset: state.ucPreset,
                    sourceImage: state.sourceImage,
                    mask: state.mask,
                    strength: state.strength,
                    noise: state.noise,
                    vibeImages: createQueueReferenceSnapshot(charStore.vibeImages),
                    charImages: createQueueReferenceSnapshot(charStore.characterImages),
                    characterPrompts: [...state.characterPrompts],
                    characterPositionEnabled: state.characterPositionEnabled
                }
            }

            try {
                await get().generate(generateParams)
                
                const resultImage = get().previewImage
                set(s => ({
                    queue: s.queue.map(i => i.id === nextItem.id ? { 
                        ...i, 
                        status: 'completed' as const,
                        imageUrl: resultImage || undefined
                    } : i)
                }))
            } catch (e) {
                set(s => ({
                    queue: s.queue.map(i => i.id === nextItem.id ? { 
                        ...i, 
                        status: 'failed' as const,
                        error: String(e)
                    } : i)
                }))
            }

            if (get().isQueueRunning) {
                const { generationDelay, randomizeDelay, batchDelaySize, batchDelay } = useSettingsStore.getState()
                
                sessionCount++

                let delay = generationDelay
                if (randomizeDelay) {
                     const jitter = delay * 0.2
                     delay = delay - jitter + Math.random() * (jitter * 2)
                     delay = Math.max(0, delay)
                }

                if (batchDelaySize > 0 && sessionCount > 0 && sessionCount % batchDelaySize === 0) {
                    const pauseMs = batchDelay * 1000
                    if (pauseMs > 0) {
                        delay += pauseMs
                        toast({ title: "休息一下", description: `已生成 ${batchDelaySize} 张，暂停 ${batchDelay} 秒...` })
                    }
                }

                setTimeout(() => get().processQueue(), delay)
            }
        },
    }
}
