import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    'flex min-h-[80px] w-full rounded-2xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 px-4 py-3 text-sm text-slate-900 dark:text-white shadow-inner placeholder:text-slate-400 dark:placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all',
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Textarea.displayName = 'Textarea'

export { Textarea }
