import { create } from 'zustand'
import { useGenerationStore } from './generation-store'
import { presetDB } from '@/services/preset-db'

export const DEFAULT_PRESET_ID = 'default'

export interface Preset {
    id: string
    name: string
    createdAt: number
    isDefault?: boolean

    // Generation Parameters
    prompt: string
    negativePrompt: string
    width: number
    height: number
    steps: number
    cfgScale: number
    seed: number
    model: string
    sampler: string
    scheduler: string
    smea: boolean
    smeaDyn: boolean
    cfgRescale: number
    variety: boolean
    ucPreset: number
    order?: number
}

const createDefaultPreset = (): Preset => ({
    id: DEFAULT_PRESET_ID,
    name: '默认预设',
    createdAt: 0,
    isDefault: true,
    
    // Default values matching generation-store defaults
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
    ucPreset: 0
})

interface PresetState {
    presets: Preset[]
    activePresetId: string

    // Actions
    init: () => Promise<void>
    addPreset: (name: string) => Promise<void>
    deletePreset: (id: string) => Promise<void>
    loadPreset: (id: string) => void
    syncFromGenerationStore: () => Promise<void>
    renamePreset: (id: string, name: string) => Promise<void>
    reorderPresets: (oldIndex: number, newIndex: number) => void
    getActivePreset: () => Preset | undefined
    exportPreset: (id: string) => string
    importPreset: (json: string) => boolean
}

export const usePresetStore = create<PresetState>((set, get) => ({
    presets: [],
    activePresetId: DEFAULT_PRESET_ID,

    init: async () => {
        try {
            let loadedPresets = await presetDB.getAllPresets()
            
            // Ensure default preset exists
            if (!loadedPresets.find(p => p.id === DEFAULT_PRESET_ID)) {
                const def = createDefaultPreset()
                await presetDB.addPreset(def)
                loadedPresets = [def, ...loadedPresets]
            }

            // Provide default state if empty (fallback)
            if (loadedPresets.length === 0) {
                 const def = createDefaultPreset()
                 loadedPresets = [def]
            }

            // Sort by order, then createdAt
            loadedPresets.sort((a, b) => {
                const orderA = a.order ?? 9999
                const orderB = b.order ?? 9999
                if (orderA !== orderB) return orderA - orderB
                return b.createdAt - a.createdAt
            })

            set({ presets: loadedPresets })
            
            // If active preset not found (e.g. deleted), reset to default
            if (!loadedPresets.find(p => p.id === get().activePresetId)) {
                set({ activePresetId: DEFAULT_PRESET_ID })
            }
        } catch (e) {
            console.error("Failed to init preset store:", e)
            // Fallback to in-memory default
            set({ presets: [createDefaultPreset()] })
        }
    },

    addPreset: async (name) => {
        const genStore = useGenerationStore.getState()
        
        const newPreset: Preset = {
            id: Date.now().toString(),
            name,
            createdAt: Date.now(),
            
            prompt: genStore.prompt,
            negativePrompt: genStore.negativePrompt,
            width: genStore.width,
            height: genStore.height,
            steps: genStore.steps,
            cfgScale: genStore.cfgScale,
            seed: genStore.seed,
            model: genStore.model,
            sampler: genStore.sampler,
            scheduler: genStore.scheduler,
            smea: genStore.smea,
            smeaDyn: genStore.smeaDyn,
            cfgRescale: genStore.cfgRescale,
            variety: genStore.variety,
            ucPreset: genStore.ucPreset
        }

        await presetDB.addPreset(newPreset)

        set(state => ({
            presets: [...state.presets, newPreset],
            activePresetId: newPreset.id
        }))
    },

    deletePreset: async (id) => {
        const preset = get().presets.find(p => p.id === id)
        if (preset?.isDefault) return

        const wasActive = get().activePresetId === id
        
        await presetDB.deletePreset(id)

        set(state => ({
            presets: state.presets.filter(p => p.id !== id),
            activePresetId: wasActive ? DEFAULT_PRESET_ID : state.activePresetId
        }))

        if (wasActive) {
            get().loadPreset(DEFAULT_PRESET_ID)
        }
    },

    loadPreset: (id) => {
        const preset = get().presets.find(p => p.id === id)
        if (!preset) return

        set({ activePresetId: id })

        // Apply to generation store
        const genStore = useGenerationStore.getState()
        
        // Batch updates to avoid multiple sync triggers if possible
        // But Zustand updates are synchronous. 
        // We rely on isLoadingPreset flag in subscription to avoid loops.
        
        genStore.setPrompt(preset.prompt)
        genStore.setNegativePrompt(preset.negativePrompt)
        genStore.setDimensions(preset.width, preset.height)
        genStore.setSteps(preset.steps)
        genStore.setCfgScale(preset.cfgScale)
        genStore.setSeed(preset.seed)
        genStore.setModel(preset.model)
        genStore.setSampler(preset.sampler)
        genStore.setScheduler(preset.scheduler)
        genStore.setSmea(preset.smea)
        genStore.setSmeaDyn(preset.smeaDyn)
        genStore.setCfgRescale(preset.cfgRescale)
        genStore.setVariety(preset.variety)
        genStore.setUcPreset(preset.ucPreset)
    },

    syncFromGenerationStore: async () => {
        const activeId = get().activePresetId
        if (!activeId) return
        
        // Don't auto-update the Default preset
        if (activeId === DEFAULT_PRESET_ID) return 
        
        const genStore = useGenerationStore.getState()

        // Find current preset to preserve other fields
        const currentPreset = get().presets.find(p => p.id === activeId)
        if (!currentPreset) return

        const updatedPreset: Preset = {
            ...currentPreset,
            prompt: genStore.prompt,
            negativePrompt: genStore.negativePrompt,
            width: genStore.width,
            height: genStore.height,
            steps: genStore.steps,
            cfgScale: genStore.cfgScale,
            seed: genStore.seed,
            model: genStore.model,
            sampler: genStore.sampler,
            scheduler: genStore.scheduler,
            smea: genStore.smea,
            smeaDyn: genStore.smeaDyn,
            cfgRescale: genStore.cfgRescale,
            variety: genStore.variety,
            ucPreset: genStore.ucPreset
        }

        // Update DB
        await presetDB.addPreset(updatedPreset)

        // Update State
        set(state => ({
            presets: state.presets.map(p => p.id === activeId ? updatedPreset : p)
        }))
    },

    renamePreset: async (id, name) => {
        const preset = get().presets.find(p => p.id === id)
        if (preset?.isDefault) return

        if (preset) {
            const updated = { ...preset, name }
            await presetDB.addPreset(updated)
            
            set(state => ({
                presets: state.presets.map(p => p.id === id ? updated : p)
            }))
        }
    },

    reorderPresets: (oldIndex, newIndex) => {
        if (oldIndex === 0 || newIndex === 0) return // Keep default at top
        
        const newPresets = [...get().presets]
        const [removed] = newPresets.splice(oldIndex, 1)
        newPresets.splice(newIndex, 0, removed)

        // Update order fields
        newPresets.forEach((p, idx) => {
            p.order = idx
        })

        set({ presets: newPresets })

        // Persist order to DB (fire and forget)
        Promise.all(newPresets.map(p => presetDB.addPreset(p))).catch(console.error)
    },

    getActivePreset: () => get().presets.find(p => p.id === get().activePresetId),

    exportPreset: (id) => {
        const preset = get().presets.find(p => p.id === id)
        if (!preset) return ''
        const { id: _, name: __, createdAt: ___, isDefault: ____, ...data } = preset
        return JSON.stringify(data)
    },

    importPreset: (json) => {
        try {
            const data = JSON.parse(json)
            // Basic validation
            if (!data.width || !data.height || !data.steps) {
                return false 
            }

            const newPreset: Preset = {
                ...data,
                id: Date.now().toString(),
                name: `Imported_${Date.now().toString().slice(-4)}`,
                createdAt: Date.now(),
                isDefault: false
            }

            // Sync with DB
            presetDB.addPreset(newPreset).then(() => {
                 set(state => ({
                    presets: [...state.presets, newPreset],
                    activePresetId: newPreset.id
                }))
            })
           
            // Optimistic update
            // (Actually we can just wait for the promise or fire and forget. 
            // Here we return boolean so we should probably wait? 
            // But function is sync in interface. Let's fire and forget DB update but update state primarily)
            
            // To be safe with return types, I'll update state immediately:
            set(state => ({
                 presets: [...state.presets, newPreset],
                 activePresetId: newPreset.id
            }))
            
            return true
        } catch (e) {
            console.error('Failed to import preset:', e)
            return false
        }
    }
}))

// Auto-sync subscription
let syncTimeout: ReturnType<typeof setTimeout> | null = null
let isLoadingPreset = false

useGenerationStore.subscribe((state, prevState) => {
    if (isLoadingPreset) return

    const fieldsToWatch = [
        'prompt', 'negativePrompt', 'width', 'height',
        'steps', 'cfgScale', 'seed', 'model',
        'sampler', 'scheduler', 'smea', 'smeaDyn', 'cfgRescale', 'variety', 'ucPreset'
    ] as const

    const hasChange = fieldsToWatch.some(field => state[field] !== prevState[field])
    if (!hasChange) return

    if (syncTimeout) clearTimeout(syncTimeout)
    syncTimeout = setTimeout(() => {
        usePresetStore.getState().syncFromGenerationStore()
    }, 1000) // Debounce 1s
})

// Wrap loadPreset to prevent sync loop
const originalLoadPreset = usePresetStore.getState().loadPreset
usePresetStore.setState({
    loadPreset: (id: string) => {
        isLoadingPreset = true
        originalLoadPreset(id)
        setTimeout(() => {
            isLoadingPreset = false
        }, 300)
    }
})

// Initialize Store
setTimeout(() => {
    usePresetStore.getState().init()
}, 100)
