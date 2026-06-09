import { useTranslation } from 'react-i18next'
import { useGalleryStore, GalleryItem as GalleryItemType, GenerationMetadata } from '@/stores/gallery-store'
import { useGenerationStore } from '@/stores/generation-store'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { Button } from '@/components/atoms/Button'
import { cn } from '@/lib/utils'
import { History, ChevronRight, Upload } from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/atoms/Tooltip'

interface HistoryPanelProps {
    /** 是否展开 */
    expanded?: boolean
    /** 展开/折叠回调 */
    onExpandedChange?: (expanded: boolean) => void
    /** 自定义样式 */
    className?: string
}

/**
 * HistoryPanel 有机体组件
 * 
 * 显示最近生成的图片历史
 * - 垂直滚动列表
 * - 点击加载到预览
 * - 双击应用参数
 */
export function HistoryPanel({
    expanded = true,
    onExpandedChange,
    className,
}: HistoryPanelProps) {
    const { t } = useTranslation()
    const { items } = useGalleryStore()
    const setPreviewImage = useGenerationStore((state) => state.setPreviewImage)

    // 只显示最近 20 张
    const recentItems = items.slice(0, 20)

    const handleItemClick = (item: GalleryItemType) => {
        setPreviewImage(item.url)
    }

    const handleLoadParams = (metadata: GenerationMetadata | undefined) => {
        if (!metadata) return
        
        const store = useGenerationStore.getState()
        if (metadata.prompt) store.setPrompt(metadata.prompt)
        if (metadata.negativePrompt) store.setNegativePrompt(metadata.negativePrompt)
        if (metadata.seed !== undefined) store.setSeed(metadata.seed)
        if (metadata.model) store.setModel(metadata.model)
        if (metadata.steps) store.setSteps(metadata.steps)
        if (metadata.cfgScale) store.setCfgScale(metadata.cfgScale)
        if (metadata.width && metadata.height) store.setDimensions(metadata.width, metadata.height)
    }

    if (!expanded) {
        return (
            <TooltipProvider>
                <div className={cn('flex flex-col items-center py-2 w-10 bg-card/50 border-l', className)}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onExpandedChange?.(true)}
                            >
                                <History className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">{t('history.expand', '展开历史')}</TooltipContent>
                    </Tooltip>
                    <div className="text-[10px] text-muted-foreground mt-1 writing-mode-vertical">
                        {recentItems.length}
                    </div>
                </div>
            </TooltipProvider>
        )
    }

    return (
        <TooltipProvider>
            <div className={cn('flex flex-col w-20 bg-card/50 border-l', className)}>
                {/* 头部 */}
                <div className="h-10 border-b flex items-center justify-between px-2 shrink-0">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onExpandedChange?.(false)}
                    >
                        <ChevronRight className="h-3 w-3" />
                    </Button>
                </div>

                {/* 图片列表 */}
                <ScrollArea className="flex-1">
                    <div className="p-1.5 space-y-1.5">
                        {recentItems.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">
                                <History className="h-6 w-6 mx-auto mb-1 opacity-30" />
                                <span className="text-[10px]">{t('history.empty', '暂无')}</span>
                            </div>
                        ) : (
                            recentItems.map((item) => (
                                <Tooltip key={item.path}>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={cn(
                                                'relative aspect-square rounded overflow-hidden cursor-pointer',
                                                'ring-1 ring-border hover:ring-primary transition-all',
                                                'group'
                                            )}
                                            onClick={() => handleItemClick(item)}
                                            onDoubleClick={() => handleLoadParams(item.metadata)}
                                        >
                                            <img
                                                src={item.url}
                                                alt={item.name}
                                                loading="lazy"
                                                className="w-full h-full object-cover"
                                            />
                                            {/* 加载参数指示 */}
                                            {item.metadata && (
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Upload className="h-4 w-4 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-[200px]">
                                        <div className="text-xs">
                                            <p className="font-medium truncate">{item.name}</p>
                                            {item.metadata?.seed && (
                                                <p className="text-muted-foreground">Seed: {item.metadata.seed}</p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground">双击加载参数</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>
        </TooltipProvider>
    )
}
