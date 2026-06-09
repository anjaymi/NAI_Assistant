import { FormField } from '@/components/molecules/FormField'
import { Slider } from '@/components/atoms/Slider'
import { Input } from '@/components/atoms/Input'
import { Switch } from '@/components/atoms/Switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/Select'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export type ParameterType = 'slider' | 'input' | 'number' | 'switch' | 'select'

export interface ParameterControlProps {
  label: string
  description?: string
  type: ParameterType
  value: any
  onChange: (value: any) => void
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: string }[]
  className?: string
  horizontal?: boolean // For switches usually
  suffix?: string
}

export function ParameterControl({
  label,
  description,
  type,
  value,
  onChange,
  min,
  max,
  step,
  options,
  className,
  horizontal,
  suffix
}: ParameterControlProps) {
  // Local state for slider input syncing to avoid lag
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const renderControl = () => {
    switch (type) {
      case 'slider':
        return (
          <div className="flex items-center gap-4">
            <Slider
              value={[localValue]}
              min={min}
              max={max}
              step={step}
              onValueChange={(val) => {
                setLocalValue(val[0])
              }}
              onValueCommit={(val) => {
                onChange(val[0])
              }}
              className="flex-1"
            />
            <div className="flex items-center gap-2">
                <Input
                type="number"
                value={localValue}
                onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setLocalValue(val)
                    onChange(val)
                }}
                className="w-16 text-right font-mono"
                />
                {suffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>}
            </div>
          </div>
        )
      case 'switch':
        return (
          <Switch
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
          />
        )
      case 'select':
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'number':
        return (
            <Input
              type="number"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
            />
        )
      case 'input':
      default:
        return (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )
    }
  }

  // Switches often look better in horizontal layout
  const isHorizontal = horizontal ?? type === 'switch'

  return (
    <FormField
      label={label}
      description={description}
      horizontal={isHorizontal}
      className={cn(className)}
    >
      {renderControl()}
    </FormField>
  )
}
