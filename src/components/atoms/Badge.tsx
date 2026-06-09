import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Badge 变体样式定义
 * 圆角标签，用于状态标识、分类标记等
 */
const badgeVariants = cva(
    "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
    {
        variants: {
            variant: {
                default: "border-slate-200 dark:border-white/10 bg-black/5 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-black/10 dark:hover:bg-white/20 shadow-inner",
                secondary: "border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 text-slate-600 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white",
                destructive: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/20",
                outline: "text-slate-600 dark:text-white/60 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white",
                success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20",
                warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
