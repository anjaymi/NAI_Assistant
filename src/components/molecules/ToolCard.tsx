import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { GlassSurface } from '@/components/atoms/GlassSurface'

interface ToolCardProps {
    children: React.ReactNode
    icon: LucideIcon
    color?: string 
    title: React.ReactNode
    description?: React.ReactNode
    disabled?: boolean
    className?: string
}

export function ToolCard({ children, icon: Icon, color, title, description, disabled, className }: ToolCardProps) {
    return (
        <div
            className={cn(
                "p-4 flex flex-col gap-4 rounded-2xl transition-all duration-300", 
                "bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-xl",
                disabled ? "opacity-50 pointer-events-none" : "hover:shadow-md dark:hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-white/20",
                className
            )}
        >
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl border shadow-sm", color || "bg-slate-100 border-slate-200 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-white")}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-[15px] tracking-wide text-slate-800 dark:text-zinc-100">{title}</span>
                </div>
                {description && (
                    <p className="text-[11px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest pl-[44px]">
                        {description}
                    </p>
                )}
            </div>
            <div className="flex flex-col gap-2 mt-auto">
                {children}
            </div>
        </div>
    )
}
