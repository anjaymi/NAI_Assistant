import { create } from 'zustand'
import { BaseDirectory, readDir, exists, mkdir, stat } from '@tauri-apps/plugin-fs'
import { pictureDir, join } from '@tauri-apps/api/path'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useSettingsStore } from './settings-store'

const IMAGE_FILE_RE = /\.(png|jpg|jpeg|webp)$/i

interface FileEntry {
    name: string
    isFile: boolean
    isDirectory: boolean
}

interface ScannedImage {
    name: string
    relativePath: string
}

function sortGalleryItems(items: GalleryItem[]) {
    items.sort((a, b) => b.createdAt - a.createdAt || b.path.localeCompare(a.path))
    return items
}

export function createGalleryItem(path: string, name: string, createdAt = Date.now()): GalleryItem {
    return {
        name,
        path,
        url: convertFileSrc(path),
        createdAt,
    }
}

let activeRefreshPromise: Promise<void> | null = null
let queuedRefresh = false

async function collectImages(dirPath: string, opts: Record<string, unknown>, useAbsolutePath: boolean): Promise<ScannedImage[]> {
    const entries = await readDir(dirPath, opts) as FileEntry[]
    const results: ScannedImage[] = []

    for (const entry of entries) {
        if (entry.isFile && IMAGE_FILE_RE.test(entry.name)) {
            results.push({ name: entry.name, relativePath: dirPath })
            continue
        }

        if (!entry.isDirectory) {
            continue
        }

        const subPath = await join(dirPath, entry.name)
        const subOpts = useAbsolutePath ? {} : { baseDir: BaseDirectory.Picture }

        try {
            const subResults = await collectImages(subPath, subOpts, useAbsolutePath)
            results.push(...subResults)
        } catch (err) {
            console.warn(`[Gallery] Skip inaccessible dir: ${subPath}`, err)
        }
    }

    return results
}

async function loadGalleryItems(previousItemsByPath: Map<string, GalleryItem>): Promise<GalleryItem[]> {
    const { savePath, useAbsolutePath } = useSettingsStore.getState()
    const outputDir = savePath || 'NAIS_Output'

    let readOptions: Record<string, unknown> = {}
    let scanPath = outputDir

    if (useAbsolutePath) {
        if (!(await exists(scanPath))) {
            await mkdir(scanPath, { recursive: true })
        }
    } else {
        readOptions = { baseDir: BaseDirectory.Picture }
        if (!(await exists(scanPath, readOptions))) {
            await mkdir(scanPath, { ...readOptions, recursive: true })
        }
    }

    const allImages = await collectImages(scanPath, readOptions, useAbsolutePath)
    const picDir = useAbsolutePath ? null : await pictureDir()

    const items = await Promise.all(allImages.map(async (img) => {
        const fullPath = useAbsolutePath
            ? await join(img.relativePath, img.name)
            : await join(picDir!, img.relativePath, img.name)

        const cachedItem = previousItemsByPath.get(fullPath)
        if (cachedItem && cachedItem.name === img.name) {
            return cachedItem
        }

        let createdAt = 0
        try {
            const fileStat = await stat(fullPath)
            createdAt = fileStat.birthtime
                ? new Date(fileStat.birthtime).getTime()
                : (fileStat.mtime ? new Date(fileStat.mtime).getTime() : 0)
        } catch {
            // ignore stat failure and keep fallback timestamp
        }

        return {
            name: img.name,
            path: fullPath,
            url: convertFileSrc(fullPath),
            createdAt,
        }
    }))

    return sortGalleryItems(items)
}

export interface GenerationMetadata {
    prompt?: string
    negativePrompt?: string
    seed?: number
    model?: string
    steps?: number
    cfgScale?: number
    sampler?: string
    width?: number
    height?: number
}

export interface GalleryItem {
    name: string
    path: string
    url: string
    createdAt: number // timestamp
    metadata?: GenerationMetadata
}

export interface IncomingGalleryItem {
    id: string
    name: string
    createdAt: number
    status: 'downloading' | 'saving' | 'success' | 'error'
    progressLabel: string
}

interface GalleryState {
    items: GalleryItem[]
    incomingItems: IncomingGalleryItem[]
    isLoading: boolean
    error: string | null
    source: 'output' | 'library'
    
    // Actions
    refreshGallery: () => Promise<void>
    setSource: (source: 'output' | 'library') => void
    addIncomingItems: (items: IncomingGalleryItem[]) => void
    updateIncomingItem: (id: string, patch: Partial<IncomingGalleryItem>) => void
    removeIncomingItems: (ids: string[]) => void
    upsertGalleryItem: (item: GalleryItem) => void
    removeGalleryItem: (path: string) => void
    removeGalleryItems: (paths: string[]) => void
}

export const useGalleryStore = create<GalleryState>((set, get) => ({
    items: [],
    incomingItems: [],
    isLoading: false,
    error: null,
    source: 'output', // Default to 'output' (Gallery/Generations)

    setSource: (source) => {
        set({ source })
        // Trigger refresh when source changes
        get().refreshGallery()
    },

    addIncomingItems: (items) => set((state) => ({
        incomingItems: [...items, ...state.incomingItems].sort((a, b) => b.createdAt - a.createdAt),
    })),

    updateIncomingItem: (id, patch) => set((state) => ({
        incomingItems: state.incomingItems.map((item) => item.id === id ? { ...item, ...patch } : item),
    })),

    removeIncomingItems: (ids) => set((state) => ({
        incomingItems: state.incomingItems.filter((item) => !ids.includes(item.id)),
    })),

    upsertGalleryItem: (item) => set((state) => {
        const existingIndex = state.items.findIndex((galleryItem) => galleryItem.path === item.path)
        if (existingIndex === -1) {
            return { items: sortGalleryItems([item, ...state.items]) }
        }

        const nextItems = [...state.items]
        nextItems[existingIndex] = { ...nextItems[existingIndex], ...item }
        return { items: sortGalleryItems(nextItems) }
    }),

    removeGalleryItem: (path) => set((state) => ({
        items: state.items.filter((item) => item.path !== path),
    })),

    removeGalleryItems: (paths) => set((state) => ({
        items: state.items.filter((item) => !paths.includes(item.path)),
    })),

    refreshGallery: async () => {
        if (activeRefreshPromise) {
            queuedRefresh = true
            return activeRefreshPromise
        }

        activeRefreshPromise = (async () => {
            set({ isLoading: true, error: null })

            try {
                // Web environment fallback to prevent invoke error
                if (!(window as any).__TAURI_INTERNALS__) {
                    console.warn('[Gallery] Running in web mode. Local filesystem access is disabled.')
                    set({ items: [], error: null })
                    return
                }

                do {
                    queuedRefresh = false
                    const previousItemsByPath = new Map(get().items.map((item) => [item.path, item]))
                    const items = await loadGalleryItems(previousItemsByPath)
                    set({ items, error: null })
                } while (queuedRefresh)
            } catch (e) {
                console.error('Failed to load gallery:', e)
                set({ error: String(e) })
            } finally {
                set({ isLoading: false })
                activeRefreshPromise = null
            }
        })()

        return activeRefreshPromise
    }
}))

