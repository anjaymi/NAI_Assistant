import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

/**
 * 选项卡列表容器
 */
const TabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(
            'inline-flex h-10 items-center justify-center rounded-2xl bg-slate-200/50 dark:bg-black/40 p-1.5 text-slate-500 dark:text-white/50 border border-black/5 dark:border-white/5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] backdrop-blur-3xl',
            className
        )}
        {...props}
    />
))
TabsList.displayName = TabsPrimitive.List.displayName

/**
 * 选项卡触发器按钮
 */
const TabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-1.5 text-sm font-semibold tracking-wide',
            'ring-offset-background transition-all duration-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
            'disabled:pointer-events-none disabled:opacity-50',
            'data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/10',
            'hover:text-slate-800 dark:hover:text-white/80 hover:bg-white/50 dark:hover:bg-white/5 data-[state=active]:hover:bg-white dark:data-[state=active]:hover:bg-white/10',
            className
        )}
        {...props}
    />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

/**
 * 选项卡内容面板
 */
const TabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            'mt-4 ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
            className
        )}
        {...props}
    />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
