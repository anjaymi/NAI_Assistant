import React, { lazy, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary'
import { useAppStore } from '@/stores/app-store'
import { useSettingsStore } from '@/stores/settings-store'
import { SyncProvider } from '@/context/SyncContext'

// CRITICAL FIX: Clean up corrupted isClosing state from localStorage
// This prevents the app from immediately closing on startup
try {
  const stored = localStorage.getItem('app-storage')
  if (stored) {
    const parsed = JSON.parse(stored)
    if (parsed?.state?.isClosing === true) {
      console.log('[App] Fixing corrupted isClosing state in localStorage')
      parsed.state.isClosing = false
      localStorage.setItem('app-storage', JSON.stringify(parsed))
    }
  }
} catch (e) {
  console.error('[App] Error cleaning localStorage:', e)
}

/** Full-screen black overlay that fades out after React mounts, bridging the inline splash → app transition. */
function SplashOverlay() {
  const [visible, setVisible] = useState(true)
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setOpacity(0), 50)
    const removeTimer = setTimeout(() => setVisible(false), 500)
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer) }
  }, [])

  if (!visible) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 99999,
        pointerEvents: 'none',
        opacity,
        transition: 'opacity 0.4s ease-out',
      }}
    />
  )
}

/** Full-screen black overlay that fades IN when the app is closing, then destroys the window. */
function CloseOverlay() {
  const isClosing = useAppStore((s) => s.isClosing)
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    if (!isClosing) return
    // Fade to black
    requestAnimationFrame(() => setOpacity(1))
    // After animation, actually close
    const timer = setTimeout(() => {
      getCurrentWindow().close()
    }, 350)
    return () => clearTimeout(timer)
  }, [isClosing])

  if (!isClosing) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 99999,
        pointerEvents: 'all',
        opacity,
        transition: 'opacity 0.3s ease-in',
      }}
    />
  )
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("React ErrorBoundary caught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'white', background: '#330000' }}>
          <h1>Something went wrong.</h1>
          <pre>{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

import { useWildcardSync } from '@/hooks/use-wildcard-sync'

const MiniWidget = lazy(() => import('@/components/windows/MiniWidget').then((module) => ({ default: module.MiniWidget })))
const AdaptiveLayout = lazy(() => import('@/layouts/AdaptiveLayout').then((module) => ({ default: module.AdaptiveLayout })))
const CloudSyncInitializer = lazy(() => import('@/components/organisms/CloudSyncInitializer').then((module) => ({ default: module.CloudSyncInitializer })))
const CpuDiagnosticsPanel = lazy(() => import('@/components/diagnostics/CpuDiagnosticsPanel').then((module) => ({ default: module.CpuDiagnosticsPanel })))

function shouldUseEmptyShellDiagnostic() {
  if (typeof window === 'undefined') return false
  if (!('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) return false
  return window.localStorage.getItem('NAI_EMPTY_SHELL') !== '0'
}

function EmptyShellDiagnostic() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', color: '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', fontSize: 12 }}>
      <button
        style={{ background: '#111', color: '#777', border: '1px solid #222', borderRadius: 8, padding: '8px 12px' }}
        onClick={() => {
          window.localStorage.setItem('NAI_EMPTY_SHELL', '0')
          window.location.reload()
        }}
      >
        Empty Shell Diagnostic · Click to restore app
      </button>
    </div>
  )
}

function AnimatedAppRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, scale: 0.985, filter: 'blur(10px)', y: 10 }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
        exit={{ opacity: 0, scale: 0.985, filter: 'blur(8px)', y: 8 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="h-full"
      >
        <Routes location={location}>
          <Route path="/" element={<AdaptiveLayout />} />
          <Route path="/mini" element={<MiniWidget />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  if (shouldUseEmptyShellDiagnostic()) {
    return <EmptyShellDiagnostic />
  }

  const theme = useAppStore((state) => state.theme)
  
  // Initialize Global Syncs
  useWildcardSync()

  useEffect(() => {
    console.log("[App] Mounted")
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  useEffect(() => {
    let unlisten: (() => void) | undefined

    const applyProxyDeepLink = (urlString: string) => {
      try {
        const url = new URL(urlString)
        if (url.protocol !== 'nais2:') return
        if (url.hostname !== 'proxy') return

        const workerUrl = url.searchParams.get('workerUrl')?.trim()
        if (!workerUrl) return

        const { setNovelAiProxyMode, setNovelAiProxyUrl } = useSettingsStore.getState()
        setNovelAiProxyMode('custom')
        setNovelAiProxyUrl(workerUrl)
        console.log('[DeepLink] Applied custom NovelAI proxy URL:', workerUrl)
      } catch (error) {
        console.warn('[DeepLink] Failed to parse deep link:', error)
      }
    }

    const setupDeepLink = async () => {
      try {
        const [{ getCurrent, onOpenUrl }] = await Promise.all([
          import('@tauri-apps/plugin-deep-link'),
        ])

        const current = await getCurrent()
        ;(current ?? []).forEach(applyProxyDeepLink)

        unlisten = await onOpenUrl((urls) => {
          urls.forEach(applyProxyDeepLink)
        })
      } catch (error) {
        console.warn('[DeepLink] Plugin unavailable in current environment:', error)
      }
    }

    setupDeepLink()
    return () => {
      unlisten?.()
    }
  }, [])

  return (
    <ErrorBoundary>
      <SplashOverlay />
      <CloseOverlay />
      <LazyModuleBoundary mode="overlay" label="Loading application shell...">
        <SyncProvider>
          <CloudSyncInitializer />
          <BrowserRouter>
            <AnimatedAppRoutes />
          </BrowserRouter>
          <CpuDiagnosticsPanel />
        </SyncProvider>
      </LazyModuleBoundary>
    </ErrorBoundary>
  )
}

export default App
