import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:bg-white/10 dark:bg-black/20 dark:focus-visible:bg-black/40 disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
GlassInput.displayName = "GlassInput"

export { GlassInput }
