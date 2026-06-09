import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:pointer-events-none disabled:opacity-50 active:scale-95',
  {
    variants: {
      variant: {
        default: 'bg-black/5 dark:bg-white/10 text-slate-900 dark:text-white shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)] hover:bg-black/10 dark:hover:bg-white/20 border border-black/5 dark:border-white/5',
        destructive: 'bg-red-500/90 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)] dark:shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-red-500 border border-red-500/50',
        outline: 'border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 shadow-sm dark:shadow-inner hover:bg-white dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-700 dark:text-white',
        secondary: 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white',
        ghost: 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white',
        link: 'text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline',
        glass: 'bg-white/60 dark:bg-black/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] hover:bg-white/80 dark:hover:bg-white/10 text-slate-800 dark:text-white',
        generate: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_4px_20px_rgba(245,158,11,0.3)] dark:shadow-[0_4px_20px_rgba(245,158,11,0.4)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.4)] dark:hover:shadow-[0_4px_25px_rgba(245,158,11,0.6)] hover:from-amber-400 hover:to-orange-400 border border-amber-400/50',
        premium: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-[0_4px_20px_rgba(139,92,246,0.3)] dark:shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:shadow-[0_4px_25px_rgba(139,92,246,0.4)] dark:hover:shadow-[0_4px_25px_rgba(139,92,246,0.6)] hover:opacity-90 border border-indigo-400/50',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-2xl px-8',
        xl: 'h-14 rounded-2xl px-10 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
