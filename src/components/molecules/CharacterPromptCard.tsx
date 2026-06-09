import { cn } from '@/lib/utils'
import { CharacterPrompt, CHARACTER_COLORS } from '@/stores/character-prompt-store'
import { Button } from '@/components/atoms/Button'
import { Textarea } from '@/components/atoms/Textarea'
import { Switch } from '@/components/atoms/Switch'
import { Label } from '@/components/atoms/Label'
import { X, GripVertical } from 'lucide-react'

interface CharacterPromptCardProps {
    /** 角色数据 */
    character: CharacterPrompt
    /** 索引 (用于颜色) */
    index: number
    /** 更新回调 */
    onUpdate: (data: Partial<CharacterPrompt>) => void
    /** 删除回调 */
    onRemove: () => void
    /** 切换启用回调 */
    onToggle: () => void
    /** 是否可拖拽 */
    draggable?: boolean
    /** 自定义样式 */
    className?: string
}

/**
 * CharacterPromptCard 分子组件
 * 
 * 显示单个角色的提示词编辑卡片
 * - 名称输入
 * - 正面/负面提示词
 * - 启用/禁用开关
 * - 删除按钮
 */
export function CharacterPromptCard({
    character,
    index,
    onUpdate,
    onRemove,
    onToggle,
    draggable = false,
    className,
}: CharacterPromptCardProps) {
    const color = CHARACTER_COLORS[index % CHARACTER_COLORS.length]

    return (
        <div
            className={cn(
                'group relative rounded-lg border bg-card/50 p-3 transition-all',
                'hover:bg-card/80 hover:shadow-md',
                !character.enabled && 'opacity-50',
                className
            )}
            style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
        >
            {/* 拖拽手柄 & 头部 */}
            <div className='flex items-center gap-2 mb-2'>
                {draggable && (
                    <GripVertical className='h-4 w-4 text-muted-foreground cursor-grab' />
                )}
                <div
                    className='flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold text-white'
                    style={{ backgroundColor: color }}
                >
                    {index + 1}
                </div>
                <input
                    type='text'
                    value={character.name || ''}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    placeholder={`角色 ${index + 1}`}
                    className='flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50'
                />
                <Switch
                    checked={character.enabled}
                    onCheckedChange={onToggle}
                    className='data-[state=checked]:bg-primary'
                />
                <Button
                    variant='ghost'
                    size='icon'
                    className='h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity'
                    onClick={onRemove}
                >
                    <X className='h-3 w-3' />
                </Button>
            </div>

            {/* 提示词输入区 */}
            <div className='space-y-2'>
                <div className='space-y-1'>
                    <Label className='text-[10px] uppercase tracking-wider text-muted-foreground'>
                        Prompt
                    </Label>
                    <Textarea
                        value={character.prompt}
                        onChange={(e) => onUpdate({ prompt: e.target.value })}
                        placeholder='blue hair, red eyes, school uniform...'
                        className='min-h-[60px] text-xs font-mono resize-none'
                        disabled={!character.enabled}
                    />
                </div>
                <div className='space-y-1'>
                    <Label className='text-[10px] uppercase tracking-wider text-muted-foreground/70'>
                        Negative
                    </Label>
                    <Textarea
                        value={character.negative}
                        onChange={(e) => onUpdate({ negative: e.target.value })}
                        placeholder='bad hands, extra fingers...'
                        className='min-h-[40px] text-xs font-mono resize-none border-destructive/20 bg-destructive/5'
                        disabled={!character.enabled}
                    />
                </div>
            </div>
        </div>
    )
}
