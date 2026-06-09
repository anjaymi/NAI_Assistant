import { useCharacterPromptStore } from '@/stores/character-prompt-store'
import { CharacterPromptCard } from '@/components/molecules/CharacterPromptCard'
import { Button } from '@/components/atoms/Button'
import { Label } from '@/components/atoms/Label'
import { Switch } from '@/components/atoms/Switch'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { Plus, Users, Trash2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface CharacterPromptPanelProps {
    /** 是否展开 */
    open?: boolean
    /** 展开/收起回调 */
    onOpenChange?: (open: boolean) => void
    /** 自定义样式 */
    className?: string
}

/**
 * CharacterPromptPanel 有机体组件
 * 
 * V4 角色提示词管理面板
 * - 添加/删除角色
 * - 编辑每个角色的 prompt/negative
 * - 启用/禁用位置控制
 */
export function CharacterPromptPanel({
    open = true,
    className,
}: CharacterPromptPanelProps) {
    const { t } = useTranslation()
    const {
        characters,
        positionEnabled,
        addCharacter,
        updateCharacter,
        removeCharacter,
        toggleEnabled,
        clearAll,
        setPositionEnabled,
    } = useCharacterPromptStore()

    const enabledCount = characters.filter((c) => c.enabled).length

    if (!open) {
        return null
    }

    return (
        <div
            className={cn(
                'flex flex-col border rounded-lg bg-card/50 backdrop-blur-sm overflow-hidden',
                className
            )}
        >
            {/* 头部 */}
            <div className='flex items-center justify-between p-3 border-b bg-muted/30'>
                <div className='flex items-center gap-2'>
                    <Users className='h-4 w-4 text-primary' />
                    <span className='font-semibold text-sm'>
                        {t('character.title', '角色提示词')}
                    </span>
                    {enabledCount > 0 && (
                        <span className='text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full'>
                            {enabledCount}
                        </span>
                    )}
                </div>
                <div className='flex items-center gap-2'>
                    {/* 位置控制开关 */}
                    <div className='flex items-center gap-1.5'>
                        <MapPin className='h-3 w-3 text-muted-foreground' />
                        <Label className='text-[10px] text-muted-foreground'>
                            {t('character.position', '位置')}
                        </Label>
                        <Switch
                            checked={positionEnabled}
                            onCheckedChange={setPositionEnabled}
                            className='scale-75'
                        />
                    </div>
                    {characters.length > 0 && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 text-xs text-destructive hover:text-destructive'
                            onClick={clearAll}
                        >
                            <Trash2 className='h-3 w-3 mr-1' />
                            {t('character.clearAll', '清空')}
                        </Button>
                    )}
                </div>
            </div>

            {/* 角色列表 */}
            <ScrollArea className='flex-1 max-h-[400px]'>
                <div className='p-3 space-y-3'>
                    {characters.length === 0 ? (
                        <div className='text-center py-8 text-muted-foreground text-sm'>
                            <Users className='h-8 w-8 mx-auto mb-2 opacity-30' />
                            <p>{t('character.empty', '暂无角色')}</p>
                            <p className='text-xs opacity-60 mt-1'>
                                {t('character.emptyDesc', '点击下方按钮添加角色')}
                            </p>
                        </div>
                    ) : (
                        characters.map((char, index) => (
                            <CharacterPromptCard
                                key={char.id}
                                character={char}
                                index={index}
                                onUpdate={(data) => updateCharacter(char.id, data)}
                                onRemove={() => removeCharacter(char.id)}
                                onToggle={() => toggleEnabled(char.id)}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>

            {/* 添加按钮 */}
            <div className='p-3 border-t'>
                <Button
                    variant='outline'
                    size='sm'
                    className='w-full h-8 text-xs'
                    onClick={() => addCharacter()}
                    disabled={characters.length >= 6}
                >
                    <Plus className='h-3 w-3 mr-1' />
                    {t('character.add', '添加角色')}
                    {characters.length >= 6 && (
                        <span className='ml-1 text-muted-foreground'>(最多 6 个)</span>
                    )}
                </Button>
            </div>
        </div>
    )
}
