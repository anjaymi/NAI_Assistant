import { create } from 'zustand'

export type SyncFlowTone = 'neutral' | 'info' | 'success' | 'error'

export interface SyncFlowTask {
  id: string
  kind: 'airdrop' | 'generate' | 'sync'
  title: string
  detail: string
  tone: SyncFlowTone
  status: 'idle' | 'active' | 'success' | 'error'
  updatedAt: number
}

interface SyncFlowState {
  relayState: 'offline' | 'listening' | 'busy' | 'error'
  currentTask: SyncFlowTask | null
  setRelayState: (state: SyncFlowState['relayState']) => void
  showTask: (task: Omit<SyncFlowTask, 'updatedAt'>) => void
  updateTask: (patch: Partial<Omit<SyncFlowTask, 'id' | 'kind'>>) => void
  clearTask: () => void
}

let clearTaskTimeout: number | null = null

function scheduleClearTask(clearTask: () => void, delayMs: number) {
  if (typeof window === 'undefined') return
  if (clearTaskTimeout !== null) {
    window.clearTimeout(clearTaskTimeout)
  }
  clearTaskTimeout = window.setTimeout(() => {
    clearTaskTimeout = null
    clearTask()
  }, delayMs)
}

export const useSyncFlowStore = create<SyncFlowState>((set) => ({
  relayState: 'offline',
  currentTask: null,
  setRelayState: (relayState) => set((state) => {
    if (state.relayState === relayState) {
      return state
    }

    return { relayState }
  }),
  showTask: (task) => {
    if (typeof window !== 'undefined' && clearTaskTimeout !== null) {
      window.clearTimeout(clearTaskTimeout)
      clearTaskTimeout = null
    }
    set({ currentTask: { ...task, updatedAt: Date.now() } })
  },
  updateTask: (patch) => set((state) => {
    if (!state.currentTask) return state

    const nextTask = {
      ...state.currentTask,
      ...patch,
      updatedAt: Date.now(),
    }

    if (nextTask.status === 'success') {
      scheduleClearTask(() => set({ currentTask: null }), 2600)
    } else if (nextTask.status === 'error') {
      scheduleClearTask(() => set({ currentTask: null }), 4200)
    }

    return { currentTask: nextTask }
  }),
  clearTask: () => {
    if (typeof window !== 'undefined' && clearTaskTimeout !== null) {
      window.clearTimeout(clearTaskTimeout)
      clearTaskTimeout = null
    }
    set({ currentTask: null })
  },
}))
