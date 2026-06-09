import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SceneImage {
    id: string
    path: string
    createdAt: number
    isFavorite: boolean
}

export interface Scene {
    id: string
    name: string
    prompt: string
    queueCount: number
    images: SceneImage[]
    width?: number
    height?: number
    seed?: number // Optional override
}

export interface Project {
    id: string
    name: string
    scenes: Scene[]
    createdAt: number
}

interface SceneState {
    projects: Project[]
    activeProjectId: string | null

    // Project Actions
    addProject: (name: string) => void
    deleteProject: (id: string) => void
    renameProject: (id: string, name: string) => void
    setActiveProject: (id: string) => void
    getActiveProject: () => Project | undefined

    // Scene Actions
    addScene: (projectId: string, name?: string) => void
    deleteScene: (projectId: string, sceneId: string) => void
    updateScene: (projectId: string, sceneId: string, updates: Partial<Scene>) => void
    reorderScenes: (projectId: string, scenes: Scene[]) => void

    // Queue Actions
    setQueueCount: (projectId: string, sceneId: string, count: number) => void
    incrementQueue: (projectId: string, sceneId: string, count?: number) => void
    clearQueue: (projectId: string) => void
    
    // Image Actions
    addImageToScene: (projectId: string, sceneId: string, path: string) => void
    toggleImageFavorite: (projectId: string, sceneId: string, imageId: string) => void
    deleteImage: (projectId: string, sceneId: string, imageId: string) => void
    
    // Generation State
    isGenerating: boolean
    setIsGenerating: (isGenerating: boolean) => void
}

export const useSceneStore = create<SceneState>()(
    persist(
        (set, get) => ({
            projects: [],
            activeProjectId: null,
            isGenerating: false,

            setIsGenerating: (isGenerating) => set({ isGenerating }),

            addProject: (name) => {
                const newProject: Project = {
                    id: Date.now().toString(),
                    name,
                    scenes: [],
                    createdAt: Date.now()
                }
                set(state => ({
                    projects: [...state.projects, newProject],
                    activeProjectId: newProject.id
                }))
            },

            deleteProject: (id) => {
                set(state => ({
                    projects: state.projects.filter(p => p.id !== id),
                    activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
                }))
            },

            renameProject: (id, name) => {
                set(state => ({
                    projects: state.projects.map(p => p.id === id ? { ...p, name } : p)
                }))
            },

            setActiveProject: (id) => set({ activeProjectId: id }),

            getActiveProject: () => get().projects.find(p => p.id === get().activeProjectId),

            addScene: (projectId, name) => {
                set(state => ({
                    projects: state.projects.map(p => {
                        if (p.id !== projectId) return p
                        const newScene: Scene = {
                            id: Date.now().toString(),
                            name: name || `场景 ${p.scenes.length + 1}`,
                            prompt: '',
                            queueCount: 0,
                            images: [],
                        }
                        return { ...p, scenes: [...p.scenes, newScene] }
                    })
                }))
            },

            deleteScene: (projectId, sceneId) => {
                set(state => ({
                    projects: state.projects.map(p =>
                        p.id === projectId
                            ? { ...p, scenes: p.scenes.filter(s => s.id !== sceneId) }
                            : p
                    )
                }))
            },

            updateScene: (projectId, sceneId, updates) => {
                set(state => ({
                    projects: state.projects.map(p =>
                        p.id === projectId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId ? { ...s, ...updates } : s
                                )
                            }
                            : p
                    )
                }))
            },

            reorderScenes: (projectId, scenes) => {
                set(state => ({
                    projects: state.projects.map(p =>
                        p.id === projectId ? { ...p, scenes } : p
                    )
                }))
            },

            setQueueCount: (projectId, sceneId, count) => {
                set(state => ({
                    projects: state.projects.map(p =>
                        p.id === projectId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId ? { ...s, queueCount: Math.max(0, count) } : s
                                )
                            }
                            : p
                    )
                }))
            },

            incrementQueue: (projectId, sceneId, count = 1) => {
                const project = get().projects.find(p => p.id === projectId)
                const scene = project?.scenes.find(s => s.id === sceneId)
                if (scene) {
                    get().setQueueCount(projectId, sceneId, scene.queueCount + count)
                }
            },

            clearQueue: (projectId) => {
                set(state => ({
                    projects: state.projects.map(p =>
                        p.id === projectId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s => ({ ...s, queueCount: 0 }))
                            }
                            : p
                    )
                }))
            },

            addImageToScene: (projectId, sceneId, path) => {
                const newImage: SceneImage = {
                    id: Date.now().toString(),
                    path,
                    createdAt: Date.now(),
                    isFavorite: false
                }
                set(state => ({
                    projects: state.projects.map(p =>
                        p.id === projectId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId
                                        ? { ...s, images: [newImage, ...s.images] }
                                        : s
                                )
                            }
                            : p
                    )
                }))
            },

            toggleImageFavorite: (projectId, sceneId, imageId) => {
                set(state => ({
                    projects: state.projects.map(p =>
                        p.id === projectId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId
                                        ? {
                                            ...s,
                                            images: s.images.map(img =>
                                                img.id === imageId ? { ...img, isFavorite: !img.isFavorite } : img
                                            )
                                        }
                                        : s
                                )
                            }
                            : p
                    )
                }))
            },

            deleteImage: (projectId, sceneId, imageId) => {
                set(state => ({
                    projects: state.projects.map(p =>
                        p.id === projectId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId
                                        ? { ...s, images: s.images.filter(img => img.id !== imageId) }
                                        : s
                                )
                            }
                            : p
                    )
                }))
            }
        }),
        {
            name: 'nais-scenes',
        }
    )
)
