import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  theme: 'light' | 'dark' | 'system'
  sidebarOpen: boolean
  isClosing: boolean
  isWindowDragging: boolean
  isWindowFocused: boolean
  lastWindowSize: { width: number; height: number }
  lastWindowPos: { x: number; y: number }
  forceMobile: boolean
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  toggleSidebar: () => void
  toggleForceMobile: () => void
  requestClose: () => void
  setWindowDragging: (dragging: boolean) => void
  setWindowFocused: (focused: boolean) => void
  setLastWindowSize: (size: { width: number; height: number }) => void
  setLastWindowPos: (pos: { x: number; y: number }) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarOpen: true,
      isClosing: false,
      isWindowDragging: false,
      isWindowFocused: true,
      lastWindowSize: { width: 1600, height: 900 },
      lastWindowPos: { x: 0, y: 0 },
      forceMobile: false,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleForceMobile: () => set((state) => ({ forceMobile: !state.forceMobile })),
      requestClose: () => set({ isClosing: true }),
      setWindowDragging: (dragging) => set({ isWindowDragging: dragging }),
      setWindowFocused: (focused) => set({ isWindowFocused: focused }),
      setLastWindowSize: (size) => set({ lastWindowSize: size }),
      setLastWindowPos: (pos) => set({ lastWindowPos: pos }),
    }),
    {
      name: 'app-storage',
      // Exclude isClosing from persistence - it should always start as false
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        forceMobile: state.forceMobile,
        lastWindowSize: state.lastWindowSize,
        lastWindowPos: state.lastWindowPos,
      }),
    }
  )
)
