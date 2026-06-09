import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { windowShellTransitionClass } from '@/lib/motion'

interface GlassLayoutProps {
    header: ReactNode
    navigation?: ReactNode
    leftPanel: ReactNode
    centerPanel: ReactNode
    rightDrawer?: ReactNode
    rightPanel?: ReactNode
    
    // State for responsiveness
    leftSidebarVisible?: boolean
    rightPanelVisible?: boolean
}

export function GlassLayout({ 
    header, 
    navigation, 
    leftPanel, 
    centerPanel, 
    rightDrawer,
    rightPanel,
    leftSidebarVisible = true,
    rightPanelVisible = false
}: GlassLayoutProps) {
    const isWindowDragging = useAppStore((state) => state.isWindowDragging)
    const isWindowFocused = useAppStore((state) => state.isWindowFocused)
    
    // Background Blobs
    const BackgroundBlobs = () => (
        <div className="nai-background-blobs fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[radial-gradient(circle_at_18%_12%,rgba(199,210,254,0.16),transparent_34%),radial-gradient(circle_at_86%_82%,rgba(216,180,254,0.14),transparent_32%),radial-gradient(circle_at_46%_56%,rgba(191,219,254,0.12),transparent_28%)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(49,46,129,0.08),transparent_34%),radial-gradient(circle_at_86%_82%,rgba(88,28,135,0.07),transparent_32%),radial-gradient(circle_at_46%_56%,rgba(30,58,138,0.06),transparent_28%)]">
        </div>
    )

    return (
        <div className={cn(
            "flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans transition-colors duration-500 overflow-hidden selection:bg-indigo-500/30",
            windowShellTransitionClass,
            isWindowDragging && "scale-[0.995] saturate-[1.03]",
            !isWindowFocused && "opacity-[0.985]"
        )}>
            <BackgroundBlobs />

            {header}

            <div className={cn(
                "relative z-10 flex-1 flex overflow-hidden px-6 pb-6 gap-6 max-w-[1920px] mx-auto w-full",
                windowShellTransitionClass,
                isWindowDragging && "translate-y-[1px]"
            )}>
                {/* Left Panel - Glass */}
                <aside className={cn(
                    "w-[420px] flex-shrink-0 flex flex-col bg-white/72 dark:bg-[#020206] rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.48)] overflow-hidden border border-black/5 dark:border-[#0d0e12]",
                    windowShellTransitionClass,
                    isWindowFocused && "ring-1 ring-white/25 dark:ring-white/10",
                    isWindowDragging && "shadow-[0_18px_48px_rgba(15,23,42,0.16)] dark:shadow-[0_20px_56px_rgba(2,6,23,0.6)]",
                    !isWindowFocused && "bg-white/30 dark:bg-[#020206]",
                    !leftSidebarVisible && "hidden lg:flex"
                )}>
                    {leftPanel}
                </aside>

                {/* Main Content - Glass Container */}
                <section className={cn(
                    "flex-1 relative flex flex-col overflow-hidden rounded-[2rem] bg-white/72 dark:bg-[#05060a] border border-black/5 dark:border-[#101116] shadow-xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.52)]",
                    windowShellTransitionClass,
                    isWindowFocused && "ring-1 ring-white/30 dark:ring-white/10 shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:shadow-[0_28px_90px_rgba(2,6,23,0.55)]",
                    isWindowDragging && "shadow-[0_28px_96px_rgba(15,23,42,0.2)] dark:shadow-[0_32px_110px_rgba(2,6,23,0.68)]",
                    !isWindowFocused && "bg-white/34 dark:bg-[#05060a]"
                )}>
                    <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar relative flex flex-col touch-pan-y">
                         {/* Navigation Pills (Sticky) */}
                        {navigation}
                        
                        {/* Page Content */}
                        <main className="flex-1 relative min-h-0">
                             {centerPanel}
                        </main>
                    </div>
                </section>

                {/* Right Panel - Glass (Persistent) */}
                <aside className={cn(
                    "w-[340px] flex-shrink-0 flex flex-col bg-white/72 dark:bg-[#020206] rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.48)] overflow-hidden border border-black/5 dark:border-[#0d0e12]",
                    windowShellTransitionClass,
                    isWindowFocused && "ring-1 ring-white/20 dark:ring-white/10",
                    isWindowDragging && "shadow-[0_18px_48px_rgba(15,23,42,0.16)] dark:shadow-[0_20px_56px_rgba(2,6,23,0.6)]",
                    !isWindowFocused && "bg-white/30 dark:bg-[#020206]",
                    !rightPanelVisible && "hidden",
                    // If we want it to hide on mobile but show on LG
                    !rightPanelVisible && "lg:hidden" 
                )}>
                    {rightPanel}
                </aside>
            </div>

            {/* Right Drawer (if provided) */}
            {rightDrawer}
        </div>
    )
}
