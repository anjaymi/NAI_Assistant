import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/indexed-db'
import { saveReferenceImage, loadReferenceImage, deleteReferenceImage, saveEncodedVibe, loadEncodedVibe, resolveImageInputToBase64 } from '@/lib/image-utils'

export interface ReferenceImage {
    id: string
    base64?: string           // 运行时数据（按需加载，不持久化）
    filePath?: string         // 持久化文件路径
    encodedVibe?: string      // 运行时缓存的 vibe 编码
    encodedVibePath?: string  // vibe 编码文件路径
    informationExtracted: number // 0 to 1
    strength: number // 0 to 1
    fidelity?: number // 0 to 1, default 1.0
    referenceType?: 'character' | 'style' | 'character&style' // default 'character&style'
}

async function persistEncodedVibe(id: string, encodedVibe: string): Promise<string | null> {
    try {
        return await saveEncodedVibe(encodedVibe, id)
    } catch (e) {
        console.error('[CharStore] 保存 vibe 编码失败:', e)
        return null
    }
}

async function persistReferenceBase64(id: string, base64: string, type: 'character' | 'vibe', previousPath?: string): Promise<string | null> {
    try {
        const nextPath = await saveReferenceImage(base64, id, type)
        if (previousPath && previousPath !== nextPath) {
            await deleteReferenceImage(previousPath)
        }
        return nextPath
    } catch (e) {
        console.error(`[CharStore] 保存${type === 'character' ? '角色' : '氛围'}参考图失败:`, e)
        return null
    }
}

interface CharacterState {
    characterImages: ReferenceImage[]
    vibeImages: ReferenceImage[]

    // Actions
    addCharacterImage: (imageInput: string) => Promise<void>
    updateCharacterImage: (id: string, updates: Partial<ReferenceImage>) => void
    removeCharacterImage: (id: string) => Promise<void>

    addVibeImage: (base64: string, encodedVibe?: string, informationExtracted?: number, strength?: number) => Promise<void>
    updateVibeImage: (id: string, updates: Partial<ReferenceImage>) => void
    removeVibeImage: (id: string) => Promise<void>

    clearAll: () => void

    /** 按需确保引用图已加载到运行时内存 */
    ensureImagesLoaded: () => Promise<void>
    /** 清空运行时 base64 数据，释放内存 */
    clearRuntimeData: () => void
}

export const useCharacterStore = create<CharacterState>()(
    persist(
        (set, get) => ({
            characterImages: [],
            vibeImages: [],

            addCharacterImage: async (imageInput) => {
                const id = Date.now().toString()
                try {
                    const base64 = await resolveImageInputToBase64(imageInput)
                    // 先存文件，再更新状态
                    const filePath = await saveReferenceImage(base64, id, 'character')

                    set((state) => ({
                        characterImages: [
                            ...state.characterImages,
                            {
                                id,
                                base64: undefined,
                                filePath,    // 持久化路径
                                informationExtracted: 1.0,
                                strength: 1.0,
                                fidelity: 1.0,
                                referenceType: 'character&style'
                            }
                        ]
                    }))
                } catch (e) {
                    console.error('[CharStore] 保存角色参考图失败，回退到内存模式:', e)
                    const base64 = imageInput.startsWith('data:') ? imageInput : undefined
                    // 降级：仅保存到内存
                    set((state) => ({
                        characterImages: [
                            ...state.characterImages,
                            {
                                id,
                                base64,
                                informationExtracted: 1.0,
                                strength: 1.0,
                                fidelity: 1.0,
                                referenceType: 'character&style'
                            }
                        ]
                    }))
                }
            },

            updateCharacterImage: (id, updates) => {
                const current = get().characterImages.find(img => img.id === id)

                set((state) => ({
                    characterImages: state.characterImages.map(img =>
                        img.id === id ? { ...img, ...updates } : img
                    )
                }))

                if (typeof updates.base64 === 'string' && updates.base64.length > 0) {
                    void persistReferenceBase64(id, updates.base64, 'character', current?.filePath).then((filePath) => {
                        if (!filePath) return
                        set((state) => ({
                            characterImages: state.characterImages.map(img =>
                                img.id === id ? { ...img, filePath, base64: undefined } : img
                            )
                        }))
                    })
                }

                if (updates.base64 === '') {
                    if (current?.filePath) {
                        void deleteReferenceImage(current.filePath)
                    }

                    set((state) => ({
                        characterImages: state.characterImages.map(img =>
                            img.id === id ? { ...img, base64: undefined, filePath: undefined } : img
                        )
                    }))
                }
            },

            removeCharacterImage: async (id) => {
                const state = get()
                const img = state.characterImages.find(i => i.id === id)
                if (img?.filePath) {
                    await deleteReferenceImage(img.filePath)
                }
                set((s) => ({
                    characterImages: s.characterImages.filter(i => i.id !== id)
                }))
            },

            addVibeImage: async (base64, encodedVibe, informationExtracted, strength) => {
                const id = Date.now().toString()
                try {
                    const filePath = await saveReferenceImage(base64, id, 'vibe')
                    const encodedVibePath = encodedVibe ? await persistEncodedVibe(id, encodedVibe) : undefined
                    set((state) => ({
                        vibeImages: [
                            ...state.vibeImages,
                            {
                                id,
                                base64: undefined,
                                filePath,
                                encodedVibe: encodedVibePath ? undefined : encodedVibe,
                                encodedVibePath: encodedVibePath ?? undefined,
                                informationExtracted: informationExtracted ?? 1.0,
                                strength: strength ?? 0.6
                            }
                        ]
                    }))
                } catch (e) {
                    console.error('[CharStore] 保存氛围参考图失败，回退到内存模式:', e)
                    set((state) => ({
                        vibeImages: [
                            ...state.vibeImages,
                            {
                                id,
                                base64,
                                encodedVibe,
                                informationExtracted: informationExtracted ?? 1.0,
                                strength: strength ?? 0.6
                            }
                        ]
                    }))
                }
            },

            updateVibeImage: (id, updates) => {
                const current = get().vibeImages.find(img => img.id === id)

                set((state) => ({
                    vibeImages: state.vibeImages.map(img =>
                        img.id === id ? { ...img, ...updates } : img
                    )
                }))

                if (typeof updates.base64 === 'string') {
                    if (current?.encodedVibePath) {
                        void deleteReferenceImage(current.encodedVibePath)
                    }

                    if (updates.base64.length === 0) {
                        if (current?.filePath) {
                            void deleteReferenceImage(current.filePath)
                        }

                        set((state) => ({
                            vibeImages: state.vibeImages.map(img =>
                                img.id === id
                                    ? { ...img, base64: undefined, filePath: undefined, encodedVibe: undefined, encodedVibePath: undefined }
                                    : img
                            )
                        }))
                        return
                    }

                    void persistReferenceBase64(id, updates.base64, 'vibe', current?.filePath).then((filePath) => {
                        if (!filePath) return
                        set((state) => ({
                            vibeImages: state.vibeImages.map(img =>
                                img.id === id
                                    ? {
                                        ...img,
                                        filePath,
                                        base64: undefined,
                                        encodedVibe: undefined,
                                        encodedVibePath: undefined,
                                    }
                                    : img
                            )
                        }))
                    })
                }

                if (updates.encodedVibe && !current?.encodedVibePath) {
                    void persistEncodedVibe(id, updates.encodedVibe).then((encodedVibePath) => {
                        if (encodedVibePath) {
                            set((state) => ({
                                vibeImages: state.vibeImages.map(img =>
                                    img.id === id ? { ...img, encodedVibePath, encodedVibe: undefined } : img
                                )
                            }))
                        }
                    })
                }
            },

            removeVibeImage: async (id) => {
                const state = get()
                const img = state.vibeImages.find(i => i.id === id)
                if (img?.filePath) {
                    await deleteReferenceImage(img.filePath)
                }
                if (img?.encodedVibePath) {
                    await deleteReferenceImage(img.encodedVibePath)
                }
                set((s) => ({
                    vibeImages: s.vibeImages.filter(i => i.id !== id)
                }))
            },

            clearAll: () => {
                const state = get()
                void Promise.all(state.characterImages.map(async (img) => {
                    if (img.filePath) await deleteReferenceImage(img.filePath)
                }))
                void Promise.all(state.vibeImages.map(async (img) => {
                    if (img.filePath) await deleteReferenceImage(img.filePath)
                    if (img.encodedVibePath) await deleteReferenceImage(img.encodedVibePath)
                }))
                set({ characterImages: [], vibeImages: [] })
            },

            ensureImagesLoaded: async () => {
                const state = get()

                const restoredChars = await Promise.all(
                    state.characterImages.map(async (img) => {
                        if (img.base64 || !img.filePath) return img

                        const base64 = await loadReferenceImage(img.filePath)
                        if (!base64) {
                            console.warn(`[CharStore] 角色参考图文件丢失: ${img.filePath}`)
                            return img
                        }

                        return { ...img, base64 }
                    })
                )

                const restoredVibes = await Promise.all(
                    state.vibeImages.map(async (img) => {
                        if (img.base64 && (img.encodedVibe || !img.encodedVibePath || !img.filePath)) return img

                        let base64 = img.base64
                        let encodedVibe = img.encodedVibe

                        if (!base64 && img.filePath) {
                            base64 = await loadReferenceImage(img.filePath) || undefined
                            if (!base64) {
                                console.warn(`[CharStore] 氛围参考图文件丢失: ${img.filePath}`)
                            }
                        }

                        if (!encodedVibe && img.encodedVibePath) {
                            encodedVibe = await loadEncodedVibe(img.encodedVibePath) || undefined
                            if (!encodedVibe) {
                                console.warn(`[CharStore] 氛围编码文件丢失: ${img.encodedVibePath}`)
                            }
                        }

                        return { ...img, base64, encodedVibe }
                    })
                )

                set({
                    characterImages: restoredChars,
                    vibeImages: restoredVibes,
                })
            },

            clearRuntimeData: () => {
                console.log('[CharStore] 清空运行时 base64 数据')
                set((state) => ({
                    characterImages: state.characterImages.map(img => ({
                        ...img,
                        base64: img.filePath ? undefined : img.base64 // 有文件的清空 base64
                    })),
                    vibeImages: state.vibeImages.map(img => ({
                        ...img,
                        base64: img.filePath ? undefined : img.base64,
                        encodedVibe: img.encodedVibePath ? undefined : img.encodedVibe,
                    }))
                }))
            }
        }),
        {
            name: 'nais2-character-store',
            storage: createJSONStorage(() => indexedDBStorage),
            partialize: (state) => ({
                characterImages: state.characterImages.map(img => ({
                    ...img,
                    base64: undefined // 不持久化 base64，靠 filePath 恢复
                })),
                vibeImages: state.vibeImages.map(img => ({
                    ...img,
                    base64: undefined,
                    encodedVibe: undefined
                }))
            })
        }
    )
)
