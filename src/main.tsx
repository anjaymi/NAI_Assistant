import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initI18n } from './i18n/config'
import { useGenerationStore } from '@/stores/generation-store'

// Disable browser shortcuts in Production Build
if (import.meta.env.PROD) {
  document.addEventListener('keydown', (e) => {
    // Prevent F5 or Ctrl+R (Refresh)
    if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
      e.preventDefault()
    }
    // Prevent F12 or Ctrl+Shift+I (DevTools)
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I'))) {
      e.preventDefault()
    }
    // Prevent F11 (Fullscreen)
    if (e.key === 'F11') {
      e.preventDefault()
    }
  })
  
  // Disable Right Click Context Menu in Production configuration
  document.addEventListener('contextmenu', (e) => {
      // Allow context menu only on inputs or textareas if needed, otherwise block globally
      const target = e.target as HTMLElement
      if (!['INPUT', 'TEXTAREA'].includes(target.tagName)) {
         e.preventDefault() 
      }
  })
}

function startCpuProbe() {
  if (!import.meta.env.DEV) return
  if (typeof window === 'undefined') return
  if (!('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) return
  if (window.localStorage.getItem('NAI_CPU_PROBE') !== '1') return
  if ((window as any).__NAI_CPU_PROBE_STARTED__) return
  ;(window as any).__NAI_CPU_PROBE_STARTED__ = true

  let frameCount = 0
  let maxFrameGap = 0
  let lastFrameAt = performance.now()
  let longTaskCount = 0
  let longTaskTotal = 0
  let maxEventLoopLag = 0
  let progressChanges = 0
  let previewChanges = 0
  let generatingChanges = 0
  let isGenerating = useGenerationStore.getState().isGenerating

  const unsubscribe = useGenerationStore.subscribe((state, previousState) => {
    if (state.generationProgress !== previousState.generationProgress) progressChanges++
    if (state.previewImage !== previousState.previewImage) previewChanges++
    if (state.isGenerating !== previousState.isGenerating) {
      generatingChanges++
      isGenerating = state.isGenerating
    }
  })

  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskCount++
          longTaskTotal += entry.duration
        }
      })
      observer.observe({ entryTypes: ['longtask'] })
    } catch {
    }
  }

  const tickFrame = (now: number) => {
    if (isGenerating) {
      frameCount++
      maxFrameGap = Math.max(maxFrameGap, now - lastFrameAt)
    }
    lastFrameAt = now
    requestAnimationFrame(tickFrame)
  }
  requestAnimationFrame(tickFrame)

  let expectedTick = performance.now() + 250
  setInterval(() => {
    const now = performance.now()
    maxEventLoopLag = Math.max(maxEventLoopLag, now - expectedTick)
    expectedTick = now + 250
  }, 250)

  setInterval(() => {
    const state = useGenerationStore.getState()
    console.table({
      isGenerating: state.isGenerating,
      fps: Math.round(frameCount / 5),
      maxFrameGapMs: Math.round(maxFrameGap),
      longTaskCount,
      longTaskTotalMs: Math.round(longTaskTotal),
      maxEventLoopLagMs: Math.round(maxEventLoopLag),
      progressChanges,
      previewChanges,
      generatingChanges,
      previewKind: state.previewImage?.startsWith('data:')
        ? 'data'
        : state.previewImage?.startsWith('blob:')
          ? 'blob'
          : state.previewImage
            ? 'url'
            : 'none',
    })
    frameCount = 0
    maxFrameGap = 0
    longTaskCount = 0
    longTaskTotal = 0
    maxEventLoopLag = 0
    progressChanges = 0
    previewChanges = 0
    generatingChanges = 0
  }, 5000)

  window.addEventListener('beforeunload', unsubscribe)
}

function setupGeneratingDomFlag() {
  if (typeof document === 'undefined') return

  const apply = (isGenerating: boolean) => {
    if (isGenerating) {
      document.documentElement.dataset.naiGenerating = 'true'
    } else {
      delete document.documentElement.dataset.naiGenerating
    }
  }

  apply(useGenerationStore.getState().isGenerating)
  return useGenerationStore.subscribe((state, previousState) => {
    if (state.isGenerating !== previousState.isGenerating) {
      apply(state.isGenerating)
    }
  })
}

function setupCpuLiteDomFlag() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) return
  if (window.localStorage.getItem('NAI_CPU_LITE') === '0') return

  document.documentElement.dataset.naiCpuLite = 'true'
}

async function bootstrap() {
  await initI18n()
  setupCpuLiteDomFlag()
  setupGeneratingDomFlag()
  startCpuProbe()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />,
  )
}

bootstrap()
