
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface WorkspaceLayoutProps {
    leftPanel: ReactNode
    rightPanel: ReactNode
    centerPanel: ReactNode
    rightPanelOpen: boolean
    onToggleRightPanel: () => void
}

export function WorkspaceLayout({
    leftPanel,
    rightPanel,
    centerPanel,
    rightPanelOpen,
    // onToggleRightPanel - currently unused in this layout component directly
}: WorkspaceLayoutProps) {
    return (
        <div className="flex h-screen w-full bg-background overflow-hidden">
            {/* Left Panel (Fixed Width) */}
            <aside className="w-[400px] shrink-0 flex flex-col border-r bg-card/50 backdrop-blur-sm z-20 shadow-xl">
                {leftPanel}
            </aside>

            {/* Center Panel (Flexible) */}
            <main className="flex-1 flex flex-col min-w-0 bg-secondary/5 relative">
                {centerPanel}
            </main>

            {/* Right Panel (Collapsible) */}
            <aside 
                className={cn(
                    "w-[320px] shrink-0 flex flex-col border-l bg-card/50 backdrop-blur-sm z-10 transition-all duration-300 ease-in-out absolute right-0 top-0 bottom-0 shadow-xl md:relative",
                    !rightPanelOpen && "translate-x-full w-0 md:translate-x-0 md:hidden"
                )}
            >
                {rightPanel}
            </aside>
        </div>
    )
}
