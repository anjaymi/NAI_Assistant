import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * 带 IME Composition 守卫的 Textarea。
 * 在 CJK 输入法组合过程中抑制 onChange，防止标点符号双写。
 * compositionEnd 之后才触发一次真正的 onChange。
 */
const GlassTextarea = React.forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ className, onChange, value, defaultValue, ...props }, ref) => {
    const isComposing = React.useRef(false)
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null)
    const [localValue, setLocalValue] = React.useState(value ?? defaultValue ?? "")

    React.useEffect(() => {
      if (value !== undefined) {
        setLocalValue(value)
      }
    }, [value])

    // Merge external ref with internal ref
    const mergedRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        internalRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
      },
      [ref]
    )

    const handleCompositionStart = () => {
      isComposing.current = true
    }

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      isComposing.current = false
      // IME 提交后，手动触发一次 onChange 以同步最终值
      if (onChange && internalRef.current) {
        const syntheticEvent = {
          ...e,
          target: internalRef.current,
          currentTarget: internalRef.current,
        } as unknown as React.ChangeEvent<HTMLTextAreaElement>
        onChange(syntheticEvent)
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value
      setLocalValue(newVal) // 在本地状态立即生效
      // 在 IME 组合过程中不触发外部 onChange，防止双写和其他数据回流突变
      if (isComposing.current) return
      onChange?.(e)
    }

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-2xl border border-white/5 bg-black/40 px-4 py-3 text-sm shadow-inner placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:bg-black/60 dark:bg-black/40 dark:focus-visible:bg-black/60 disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-xl resize-none transition-all duration-300",
          className
        )}
        ref={mergedRef}
        value={localValue}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
GlassTextarea.displayName = "GlassTextarea"

export { GlassTextarea }

