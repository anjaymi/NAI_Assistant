import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Plugin {
    id: string
    name: string
    description: string
    enabled: boolean
}

interface PluginState {
    plugins: Plugin[]
    togglePlugin: (id: string) => void
    isPluginEnabled: (id: string) => boolean
}

export const usePluginStore = create<PluginState>()(
    persist(
        (set, get) => ({
            plugins: [
                {
                    id: 'tag_completion',
                    name: 'Tag Completion',
                    description: 'Enables interactive tag autocomplete in the prompt editor.',
                    enabled: false
                }
            ],
            togglePlugin: (id) => set((state) => ({
                plugins: state.plugins.map(p => 
                    p.id === id ? { ...p, enabled: !p.enabled } : p
                )
            })),
            isPluginEnabled: (id) => get().plugins.find(p => p.id === id)?.enabled ?? false
        }),
        {
            name: 'nai-assistant-plugins',
        }
    )
)
