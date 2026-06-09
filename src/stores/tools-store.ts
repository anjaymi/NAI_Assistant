import { create } from 'zustand'

interface ToolsState {
    activeImage: string | null
    processedImage: string | null
    isProcessing: boolean
    
    // Actions
    setActiveImage: (image: string | null) => void
    setProcessedImage: (image: string | null) => void
    setIsProcessing: (isProcessing: boolean) => void
}

export const useToolsStore = create<ToolsState>((set) => ({
    activeImage: null,
    processedImage: null,
    isProcessing: false,

    setActiveImage: (image) => set({ activeImage: image, processedImage: null }), // Reset processed when new image loaded
    setProcessedImage: (image) => set({ processedImage: image }),
    setIsProcessing: (isProcessing) => set({ isProcessing }),
}))
