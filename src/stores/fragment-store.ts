import { create } from 'zustand'

export interface FragmentFile {
    name: string
    folder: string
    lineCount: number
}

interface FragmentState {
    files: FragmentFile[]
    // Add other methods as needed later
}

export const normalizeFragmentPath = (path: string) => path.trim().toLowerCase().replace(/\\/g, '/')

export const useFragmentStore = create<FragmentState>()((_set) => ({
    files: [], // Empty for now, can be populated later
}))
