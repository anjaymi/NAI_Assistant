import { useState } from 'react'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/atoms/Popover'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/atoms/Dialog'
import { GlassInput } from '@/components/atoms/GlassInput'
import { Label } from '@/components/atoms/Label'
import { Button } from '@/components/atoms/Button'
import { Plus, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * NovelAI 标准分辨率预设
 * 所有尺寸必须是 64 的倍数
 */
export const RESOLUTION_PRESETS = [
    { key: 'portrait', label: '竖版 (Portrait)', width: 832, height: 1216 },
    { key: 'landscape', label: '横版 (Landscape)', width: 1216, height: 832 },
    { key: 'square', label: '方形 (Square)', width: 1024, height: 1024 },
    { key: 'tallPortrait', label: '长竖版', width: 640, height: 1536 },
    { key: 'wideLandscape', label: '宽横版', width: 1536, height: 640 },
] as const

/** 将数值四舍五入到最近的 64 倍数 (NovelAI 要求) */
export const roundTo64 = (value: number): number => Math.round(value / 64) * 64

export interface Resolution {
    label: string
    width: number
    height: number
}

interface ResolutionSelectorProps {
    value: Resolution
    onChange: (resolution: Resolution) => void
    disabled?: boolean
}

/**
 * 分辨率选择器组件
 * 
 * 支持预设分辨率和自定义分辨率，自动将自定义值校正为 64 的倍数
 */
export function ResolutionSelector({ value, onChange, disabled }: ResolutionSelectorProps) {
    const [open, setOpen] = useState(false)
    const [customDialogOpen, setCustomDialogOpen] = useState(false)
    const [customWidth, setCustomWidth] = useState(1024)
    const [customHeight, setCustomHeight] = useState(1024)
    const [customLabel, setCustomLabel] = useState('自定义')

    // 查找当前值是否匹配标准预设
    const matchedPreset = RESOLUTION_PRESETS.find(
        (p) => p.width === value.width && p.height === value.height
    )

    // 显示文本
    const displayText = matchedPreset
        ? matchedPreset.label
        : `${value.width} × ${value.height}`

    const handleSelect = (preset: typeof RESOLUTION_PRESETS[number]) => {
        onChange({
            label: preset.label,
            width: preset.width,
            height: preset.height,
        })
        setOpen(false)
    }

    const handleAddCustom = () => {
        setOpen(false)
        setCustomDialogOpen(true)
    }

    const handleCustomSave = () => {
        const width = roundTo64(customWidth)
        const height = roundTo64(customHeight)
        const label = customLabel || `${width}×${height}`

        onChange({ label, width, height })
        setCustomDialogOpen(false)

        // 重置状态
        setCustomWidth(1024)
        setCustomHeight(1024)
        setCustomLabel('自定义')
    }

    const isSelected = (w: number, h: number) => value.width === w && value.height === h

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className="w-full justify-between font-normal text-left h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10"
                    >
                        <span className="truncate">{displayText}</span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="p-0 border-white/10 bg-black/90 backdrop-blur-xl rounded-xl"
                    align="start"
                    style={{ width: 'var(--radix-popover-trigger-width)' }}
                >
                    <div className="max-h-[300px] overflow-auto">
                        {/* 标准预设 */}
                        <div className="p-1">
                            {RESOLUTION_PRESETS.map((p) => (
                                <button
                                    key={p.key}
                                    onClick={() => handleSelect(p)}
                                    className={cn(
                                        "flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-lg transition-colors",
                                        "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                        isSelected(p.width, p.height) && "bg-accent/50 text-accent-foreground"
                                    )}
                                >
                                    <span className="flex items-center gap-2">
                                        {isSelected(p.width, p.height) && <Check className="h-4 w-4" />}
                                        {!isSelected(p.width, p.height) && <span className="w-4" />}
                                        <span>{p.label}</span>
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {p.width} × {p.height}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* 添加自定义按钮 */}
                        <div className="h-px bg-border/20 mx-1" />
                        <div className="p-1">
                            <button
                                onClick={handleAddCustom}
                                className="flex items-center w-full px-2 py-1.5 text-sm rounded-lg hover:bg-accent/50 hover:text-accent-foreground cursor-pointer text-primary font-medium transition-colors"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                自定义分辨率
                            </button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {/* 自定义分辨率对话框 */}
            <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} className="bg-black/90 backdrop-blur-xl border-white/20 text-white">
                    <DialogHeader>
                        <DialogTitle>自定义分辨率</DialogTitle>
                        <DialogDescription>
                            设置自定义分辨率，数值会自动校正为 64 的倍数
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                名称
                            </Label>
                            <GlassInput
                                id="name"
                                value={customLabel}
                                onChange={(e) => setCustomLabel(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="width" className="text-right">
                                宽度
                            </Label>
                            <div className="col-span-3 flex items-center gap-2">
                                <GlassInput
                                    id="width"
                                    type="number"
                                    step={64}
                                    value={customWidth}
                                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                                    className="flex-1"
                                />
                                {roundTo64(customWidth) !== customWidth && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        → {roundTo64(customWidth)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="height" className="text-right">
                                高度
                            </Label>
                            <div className="col-span-3 flex items-center gap-2">
                                <GlassInput
                                    id="height"
                                    type="number"
                                    step={64}
                                    value={customHeight}
                                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                                    className="flex-1"
                                />
                                {roundTo64(customHeight) !== customHeight && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        → {roundTo64(customHeight)}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* 最终分辨率预览 */}
                        <div className="text-center text-sm text-muted-foreground pt-2 border-t border-white/10">
                            最终分辨率: <span className="font-mono font-medium text-foreground">{roundTo64(customWidth)} × {roundTo64(customHeight)}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" onClick={handleCustomSave}>
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
