import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 px-4 py-3 text-sm text-slate-900 dark:text-white shadow-inner transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-semibold placeholder:text-slate-400 dark:placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
