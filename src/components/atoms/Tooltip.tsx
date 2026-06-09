import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
    <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            className={cn(
                "z-[1050] overflow-hidden rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] px-3 py-1.5 text-xs text-slate-800 dark:text-white tracking-wide font-medium",
                "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                className
            )}
            {...props}
        />
    </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

/**
 * 简化的 Tooltip 包装组件 (Tip)
 * 用法: <Tip content="提示内容"><Button>按钮</Button></Tip>
 */
interface TipProps {
    content: React.ReactNode
    children: React.ReactNode
    side?: 'top' | 'right' | 'bottom' | 'left'
    delayDuration?: number
}

function Tip({ content, children, side = 'top', delayDuration = 200 }: TipProps) {
    return (
        <Tooltip delayDuration={delayDuration}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side}>{content}</TooltipContent>
        </Tooltip>
    )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Tip }
