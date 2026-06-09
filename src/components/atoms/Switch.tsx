import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    /** 是否选中 */
    checked?: boolean
    /** 选中状态变化回调 (shadcn/Radix 风格) */
    onCheckedChange?: (checked: boolean) => void
    /** 原生 onChange (可选) */
    onChange?: React.ChangeEventHandler<HTMLInputElement>
}

/**
 * Switch 原子组件
 * 
 * 支持两种 API 风格：
 * - `onCheckedChange(boolean)` - shadcn/Radix 风格
 * - `onChange(event)` - 原生 HTML 风格
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
    ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onCheckedChange?.(e.target.checked)
            onChange?.(e)
        }

        return (
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    className="peer sr-only"
                    ref={ref}
                    checked={checked}
                    onChange={handleChange}
                    {...props}
                />
                <div
                    className={cn(
                        "h-6 w-11 rounded-full bg-slate-200 dark:bg-black/40 border border-black/5 dark:border-white/5 shadow-inner transition-colors duration-300",
                        "peer-checked:bg-indigo-500 peer-checked:border-indigo-400 peer-checked:shadow-[0_0_10px_rgba(99,102,241,0.3)] dark:peer-checked:shadow-[0_0_10px_rgba(99,102,241,0.5)]",
                        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                        className
                    )}
                />
                <div
                    className={cn(
                        "absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] transition-transform duration-300 pointer-events-none",
                        "peer-checked:translate-x-5"
                    )}
                />
            </label>
        )
    }
)
Switch.displayName = "Switch"

export { Switch }
