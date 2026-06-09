import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { navSpring } from '@/lib/motion'

export interface NavItem {
    id: string
    icon: LucideIcon
    labelKey: string
    label?: string
}

interface AnimatedNavBarProps {
    items: NavItem[]
    activeTab: string
    onTabChange: (id: string) => void
    className?: string
}

export function AnimatedNavBar({ items, activeTab, onTabChange, className }: AnimatedNavBarProps) {
    const { t } = useTranslation()

    return (
        <nav className={cn("flex items-center gap-1 p-1", className)}>
            {items.map((item) => {
                const isActive = activeTab === item.id
                return (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                            "relative px-4 py-2 rounded-full text-sm font-medium transition-all z-0 flex items-center justify-center group",
                            isActive
                                ? "text-slate-800 dark:text-white"
                                : "text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/90 hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-white/40 dark:bg-white/10 backdrop-blur-md rounded-full border border-black/5 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.05)] -z-10"
                                transition={navSpring}
                            />
                        )}
                        <span className="flex items-center gap-2 relative z-10 transition-transform duration-200 group-active:scale-95">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label || t(item.labelKey)}</span>
                        </span>
                    </button>
                )
            })}
        </nav>
    )
}
