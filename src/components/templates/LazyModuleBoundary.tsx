import { ReactNode, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LazyModuleBoundaryProps {
  children: ReactNode
  className?: string
  label?: string
  mode?: 'panel' | 'overlay' | 'inline'
}

function LazyFallback({
  className,
  label = 'Loading module...',
  mode = 'panel',
}: Omit<LazyModuleBoundaryProps, 'children'>) {
  const baseClassName =
    mode === 'overlay'
      ? 'absolute inset-0 flex items-center justify-center bg-slate-50/80 dark:bg-black/70 backdrop-blur-sm'
      : mode === 'inline'
        ? 'flex items-center justify-center py-8'
        : 'flex min-h-[240px] w-full items-center justify-center rounded-2xl border border-black/5 bg-white/50 dark:border-white/10 dark:bg-white/[0.03]'

  return (
    <div className={cn(baseClassName, className)}>
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-white/50">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
    </div>
  )
}

export function LazyModuleBoundary({ children, className, label, mode }: LazyModuleBoundaryProps) {
  return <Suspense fallback={<LazyFallback className={className} label={label} mode={mode} />}>{children}</Suspense>
}

export function LazyModuleFallback(props: Omit<LazyModuleBoundaryProps, 'children'>) {
  return <LazyFallback {...props} />
}
