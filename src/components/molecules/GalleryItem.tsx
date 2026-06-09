import { memo, useState, useEffect, useRef } from 'react'
import { GalleryItem as GalleryItemType } from '@/stores/gallery-store'
import { Card } from '@/components/atoms/Card'
import { cn } from '@/lib/utils'
import { CheckCircle2, Info, Copy } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/atoms/Tooltip'
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/atoms/Popover'
import { useInView } from 'framer-motion'

interface GalleryItemProps {
    item: GalleryItemType
    selected?: boolean
    onClick?: () => void
    onDoubleClick?: () => void
    /** 复制参数回调 */
    onCopyParams?: () => void
    className?: string
    variant?: 'square' | 'masonry'
}

/**
 * GalleryItem 分子组件
 * 
 * 功能：
 * - 缩略图显示
 * - 悬停放大效果
 * - 元数据弹出窗
 * - 选中状态指示
 */
export const GalleryItem = memo(function GalleryItem({ 
    item, 
    selected, 
    onClick, 
    onDoubleClick,
    onCopyParams,
    className,
    variant = 'square'
}: GalleryItemProps) {
    const ref = useRef<HTMLDivElement>(null)
    const isInView = useInView(ref, { once: true, margin: "200px" })

    const [imageSrc, setImageSrc] = useState<string | undefined>(undefined)
    const [isLoaded, setIsLoaded] = useState(false)
    const [hasError, setHasError] = useState(false)
    const metadata = item.metadata

    useEffect(() => {
        if (isInView) {
            setImageSrc(item.url)
            setIsLoaded(false)
            setHasError(false)
        }
    }, [item.url, isInView])

    const handleImageError = async () => {
        if (hasError) return // Prevent infinite loop
        
        try {
            console.log('Image load failed, trying fallback for:', item.path)
            const { invoke } = await import('@tauri-apps/api/core')
            const base64 = await invoke<string>('read_image_base64', { path: item.path })
            // Detect mime type from extension
            const ext = item.path.split('.').pop()?.toLowerCase() || 'png'
            let mime = 'image/png'
            if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg'
            if (ext === 'webp') mime = 'image/webp'
            
            setImageSrc(`data:${mime};base64,${base64}`)
            setHasError(true) // Mark as fallback used
        } catch (e) {
            console.error('Fallback image load failed:', e)
            setHasError(true)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    return (
        <TooltipProvider>
            <Card
                ref={ref}
                className={cn(
                    "group relative overflow-hidden cursor-pointer transition-all",
                    "hover:ring-1 hover:ring-primary/35 hover:shadow-md",
                    selected && "ring-2 ring-primary/80",
                    variant === 'square' && "aspect-square",
                    variant === 'masonry' && "break-inside-avoid",
                    className
                )}
                style={{ contain: 'layout style paint' }}
                onClick={onClick}
                onDoubleClick={onDoubleClick}
            >
                {/* 缩略图 */}
                {imageSrc && (
                    <img
                        src={imageSrc}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        onLoad={() => setIsLoaded(true)}
                        onError={handleImageError}
                        className={cn(
                            "w-full",
                            variant === 'square' ? "h-full object-cover" : "h-auto",
                            !isLoaded && "opacity-0"
                        )}
                    />
                )}

                {/* 加载骨架屏 (Skeleton Shimmer Wave) */}
                {!isLoaded && !hasError && (
                    <div className="absolute inset-0 bg-slate-200/50 dark:bg-white/5 overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-shimmer" />
                    </div>
                )}
                
                {/* 渐变遮罩 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* 底部文件名 */}
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate font-medium drop-shadow-md">
                        {item.name}
                    </p>
                </div>

                {/* 工具按钮区 (右上角) */}
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* 元数据弹窗 */}
                    {metadata && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-6 w-6 bg-background/80 hover:bg-background"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Info className="h-3 w-3" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent 
                                className="w-64 p-3 text-xs"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="space-y-2">
                                    <div className="font-semibold text-sm border-b pb-1 mb-2">
                                        生成参数
                                    </div>
                                    {metadata.model && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">模型</span>
                                            <span className="font-mono">{metadata.model.split('-').slice(-2).join('-')}</span>
                                        </div>
                                    )}
                                    {metadata.seed !== undefined && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Seed</span>
                                            <div className="flex items-center gap-1">
                                                <span className="font-mono">{metadata.seed}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4"
                                                    onClick={() => copyToClipboard(String(metadata.seed))}
                                                >
                                                    <Copy className="h-2.5 w-2.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    {metadata.steps && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Steps</span>
                                            <span>{metadata.steps}</span>
                                        </div>
                                    )}
                                    {metadata.cfgScale && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">CFG</span>
                                            <span>{metadata.cfgScale}</span>
                                        </div>
                                    )}
                                    {metadata.width && metadata.height && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">分辨率</span>
                                            <span>{metadata.width} × {metadata.height}</span>
                                        </div>
                                    )}
                                    {metadata.prompt && (
                                        <div className="pt-2 border-t">
                                            <span className="text-muted-foreground block mb-1">Prompt</span>
                                            <p className="text-[10px] font-mono bg-muted/50 p-1.5 rounded max-h-20 overflow-y-auto">
                                                {metadata.prompt.slice(0, 200)}{metadata.prompt.length > 200 && '...'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}

                    {/* 复制参数按钮 */}
                    {onCopyParams && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-6 w-6 bg-background/80 hover:bg-background"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onCopyParams()
                                    }}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>复制参数</TooltipContent>
                        </Tooltip>
                    )}
                </div>

                {/* 选中指示器 */}
                {selected && (
                    <div className="absolute top-2 left-2 text-primary bg-background/80 rounded-full p-0.5">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                )}
            </Card>
        </TooltipProvider>
    )
}, (prevProps, nextProps) => (
    prevProps.item === nextProps.item &&
    prevProps.selected === nextProps.selected &&
    prevProps.className === nextProps.className &&
    prevProps.variant === nextProps.variant &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onDoubleClick === nextProps.onDoubleClick &&
    prevProps.onCopyParams === nextProps.onCopyParams
))
