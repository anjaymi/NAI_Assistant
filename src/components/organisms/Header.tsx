import { History, Menu, Settings, Minus, X, PictureInPicture } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { PCSyncIndicator } from '@/components/organisms/PCSyncIndicator'
import { cn } from '@/lib/utils'

interface HeaderProps {
    onHistoryClick: () => void
    onSettingsClick: () => void
    onMenuClick: () => void
}

export function Header({ onHistoryClick, onSettingsClick, onMenuClick }: HeaderProps) {
    const navigate = useNavigate()
    const setWindowFocused = useAppStore((state) => state.setWindowFocused)
    const isWindowFocused = useAppStore((state) => state.isWindowFocused)
    const [isWindowMaximized, setIsWindowMaximized] = useState(false)

    const syncWindowState = useCallback(async () => {
        try {
            const maximized = await getCurrentWindow().isMaximized()
            setIsWindowMaximized(maximized)
        } catch (err) {
            console.warn('Failed to sync window state:', err)
        }
    }, [])

    useEffect(() => {
        const handleFocus = () => setWindowFocused(true)
        const handleBlur = () => setWindowFocused(false)

        window.addEventListener('focus', handleFocus)
        window.addEventListener('blur', handleBlur)
        syncWindowState()

        return () => {
            window.removeEventListener('focus', handleFocus)
            window.removeEventListener('blur', handleBlur)
        }
    }, [setWindowFocused, syncWindowState])

    const handleToggleMaximize = useCallback(async () => {
        const currentWindow = getCurrentWindow()
        await currentWindow.toggleMaximize()
        const maximized = await currentWindow.isMaximized()
        setIsWindowMaximized(maximized)
    }, [])

    return (
        <header 
            className="relative z-50 flex items-center justify-between px-6 py-4 w-full max-w-[1920px] mx-auto select-none" 
            style={{ touchAction: 'none' }}
        >
            {/* Native drag region - more stable for pen input */}
            <div 
                data-tauri-drag-region
                className="absolute inset-0 z-10 bg-transparent cursor-move"
                style={{ touchAction: 'none' }}
            />

            {/* Left: Logo - Layer 20 (Above Overlay) */}
            <div className="flex items-center space-x-4 relative z-20 pointer-events-none">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.05),0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_10px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-slate-200/50 dark:ring-white/10 overflow-hidden pointer-events-auto bg-white/80 dark:bg-black/40 backdrop-blur-xl">
                    <img src="/app-icon.png" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div className="hidden sm:flex flex-col">
                    <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white leading-none drop-shadow-sm dark:drop-shadow-md">NovelAI</span>
                    <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 tracking-wider uppercase drop-shadow-sm dark:drop-shadow">Assistant</span>
                </div>
            </div>


            {/* Right: Controls - Layer 20 (Above Overlay) */}
            <div className="flex items-center space-x-4 relative z-20">
                <PCSyncIndicator />

                {/* Divider */}
                <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 hidden sm:block"></div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-1.5 bg-white/60 dark:bg-transparent px-1.5 py-1.5 rounded-2xl border border-slate-200/50 dark:border-transparent shadow-sm dark:shadow-none">
                    <Button 
                        variant="ghost" 
                        size="icon"
                        className="rounded-xl hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white w-9 h-9 transition-colors"
                        onClick={onHistoryClick}
                    >
                        <History className="h-4 w-4" />
                    </Button>

                    <Button 
                        variant="ghost" 
                        size="icon"
                        className="rounded-xl hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white w-9 h-9 transition-colors"
                        onClick={onSettingsClick}
                    >
                        <Settings className="h-4 w-4" />
                    </Button>

                    <Button 
                        variant="ghost" 
                        size="icon"
                        className="rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-200 w-9 h-9 transition-colors"
                        onClick={() => navigate('/mini')}
                        title="Mini Mode"
                    >
                        <PictureInPicture className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="ghost" 
                        size="icon"
                        className="rounded-xl hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white w-9 h-9 lg:hidden transition-colors"
                        onClick={onMenuClick}
                    >
                        <Menu className="h-4 w-4" />
                    </Button>
                </div>

                {/* Window Controls Divider */}
                <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 mx-1"></div>

                {/* Window Controls Group */}
                <div className={cn(
                    "flex items-center space-x-1 no-drag px-1 py-1 rounded-2xl border shadow-sm dark:shadow-none transition-all duration-300",
                    isWindowFocused
                        ? "bg-white/70 dark:bg-transparent border-slate-200/60 dark:border-transparent"
                        : "bg-white/50 dark:bg-transparent border-slate-200/40 dark:border-transparent"
                )}>
                    {/* OS Controls */}
                    <Button 
                        variant="ghost" 
                        size="icon"
                        className="group relative h-9 w-9 rounded-xl border border-transparent text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white/85 hover:text-slate-700 hover:shadow-sm active:translate-y-0 active:scale-95 dark:text-white/40 dark:hover:border-[#1a1c21] dark:hover:bg-[#0e0f12] dark:hover:text-white"
                        onClick={() => getCurrentWindow().minimize()}
                        title="最小化"
                    >
                        <Minus className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon"
                        className={cn(
                            "group relative h-9 w-9 rounded-xl border text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95 dark:text-white/40",
                            isWindowMaximized
                                ? "border-slate-300/80 bg-slate-900 text-white dark:border-[#1a1c21] dark:bg-[#0e0f12] dark:text-white"
                                : "border-transparent hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-[#1a1c21] dark:hover:bg-[#0e0f12] dark:hover:text-sky-200"
                        )}
                        onClick={handleToggleMaximize}
                        title={isWindowMaximized ? '还原窗口' : '最大化'}
                    >
                        <span className="relative block h-3.5 w-3.5">
                            <span className={cn(
                                "absolute rounded-[2px] border-[1.6px] transition-all duration-200",
                                isWindowMaximized
                                    ? "inset-x-[1px] inset-y-[3px]"
                                    : "inset-0"
                            )} />
                            {isWindowMaximized && (
                                <span className="absolute inset-x-[3px] inset-y-[1px] rounded-[2px] border-[1.6px] bg-transparent" />
                            )}
                        </span>
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon"
                        className="group relative h-9 w-9 rounded-xl border border-transparent text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-400/20 hover:bg-gradient-to-br hover:from-rose-500 hover:to-rose-600 hover:text-white hover:shadow-[0_10px_24px_rgba(244,63,94,0.28)] active:translate-y-0 active:scale-95 dark:text-white/40 dark:hover:border-[#1a1c21] dark:hover:text-white"
                        onClick={() => useAppStore.getState().requestClose()}
                        title="关闭"
                    >
                        <X className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90 group-hover:text-white" />
                    </Button>
                </div>
            </div>
        </header>
    )
}
