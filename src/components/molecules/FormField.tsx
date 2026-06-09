import { Label } from '@/components/atoms/Label'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

export interface FormFieldProps {
  label?: string
  description?: string
  error?: string
  children: ReactNode
  className?: string
  horizontal?: boolean
}

export function FormField({
  label,
  description,
  error,
  children,
  className,
  horizontal = false
}: FormFieldProps) {
  if (horizontal) {
    return (
      <div className={cn('flex items-center justify-between gap-4 space-y-0', className)}>
        <div className="flex flex-col space-y-1">
          {label && <Label>{label}</Label>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex-1 max-w-[50%] flex justify-end">
          {children}
        </div>
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between">
        {label && <Label>{label}</Label>}
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
      {children}
      {description && <p className="text-[0.8rem] text-muted-foreground">{description}</p>}
    </div>
  )
}
