import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

const Slider = React.forwardRef<
    React.ElementRef<typeof SliderPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
    <SliderPrimitive.Root
        ref={ref}
        className={cn(
            'relative flex w-full touch-none select-none items-center',
            className
        )}
        {...props}
    >
        <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-slate-200 dark:bg-black/40 border border-black/5 dark:border-white/5 shadow-inner">
            <SliderPrimitive.Range className="absolute h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)] dark:shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb asChild>
            <motion.div 
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="block h-5 w-5 rounded-full border border-slate-300 dark:border-white/20 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing" 
            />
        </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
