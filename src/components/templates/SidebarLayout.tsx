import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SidebarLayoutProps {
  sidebar: ReactNode
  content: ReactNode
  sidebarOpen?: boolean
}

export function SidebarLayout({ sidebar, content, sidebarOpen = true }: SidebarLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside 
        className={cn(
            "w-80 border-r border-border bg-muted/10 flex flex-col transition-all duration-300 ease-in-out",
            !sidebarOpen && "-ml-80"
        )}
      >
        <div className="flex-1 overflow-y-auto">
            {sidebar}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {content}
      </main>
    </div>
  )
}
