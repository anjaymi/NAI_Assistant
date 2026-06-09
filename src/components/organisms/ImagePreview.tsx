import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/atoms/Button'
import { Tip } from '@/components/atoms/Tooltip'
import { TooltipProvider } from '@/components/atoms/Tooltip'
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImageContextMenu } from '@/components/features/ImageContextMenu'

interface ImagePreviewProps {
    /** 图片 URL (base64 或 http) */
    imageSrc: string | null
    /** 原始宽度 (用于比例缩放) */
    originalWidth?: number
    /** 原始高度 */
    originalHeight?: number
    /** 是否正在生成 */
    isGenerating?: boolean
    /** 生成进度 (0-100) */
    progress?: number
    /** 全屏回调 */
    onFullscreen?: () => void
    /** 自定义 className */
    className?: string
    /** 是否隐藏控制栏 (移动端) */
    hideControls?: boolean
    // Context Menu Callbacks
    onRegenerate?: () => void
    onSmartTools?: () => void
    onInpaint?: () => void
    onI2I?: () => void
    onAddRef?: () => void
    onOpenFolder?: () => void
    onLoadMetadata?: () => void
    onDelete?: () => void
}

/**
 * 图片预览组件
 * 
 * 功能：
 * - 缩放 (滚轮 / 按钮)
 * - 拖拽平移
 * - 右键高级菜单 (复制/保存/打印等)
 * - 空状态提示
 */
export function ImagePreview({
    imageSrc,
    originalWidth = 1024,
    originalHeight = 1024,
    isGenerating = false,
    progress,
    onFullscreen,
    className,
    hideControls = false,
    onRegenerate,
    onSmartTools,
    onInpaint,
    onI2I,
    onAddRef,
    onOpenFolder,
    onLoadMetadata,
    onDelete,
}: ImagePreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const visibleImageSrc = isGenerating ? null : imageSrc

    // 计算适应容器的初始缩放
    const calculateFitScale = useCallback(() => {
        if (!containerRef.current) return 0.5
        const containerRect = containerRef.current.getBoundingClientRect()
        const scaleX = (containerRect.width - 48) / originalWidth
        const scaleY = (containerRect.height - 48) / originalHeight
        return Math.min(scaleX, scaleY, 1) // 最大不超过 100%
    }, [originalWidth, originalHeight])

    // Dimensions changed -> Always reset
    useEffect(() => {
        setScale(calculateFitScale())
        setPosition({ x: 0, y: 0 })
    }, [calculateFitScale])

    // Image Source changed -> Reset unless generating (preserves zoom during stream)
    useEffect(() => {
        if (!isGenerating) {
             // Only reset if we are NOT generating (e.g. valid final image loaded)
             // This prevents the view from snapping back 20 times a second during streaming
             setScale(calculateFitScale())
             setPosition({ x: 0, y: 0 })
        }
    }, [imageSrc, isGenerating])

    // 滚轮缩放
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (!visibleImageSrc) return
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setScale((prev) => Math.min(Math.max(prev * delta, 0.1), 5))
    }, [visibleImageSrc])

    // 拖拽开始
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!visibleImageSrc || scale <= calculateFitScale()) return
        // Only left click drags
        if (e.button !== 0) return
        setIsDragging(true)
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }, [visibleImageSrc, scale, position, calculateFitScale])

    // 拖拽移动
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        })
    }, [isDragging, dragStart])

    // 拖拽结束
    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    // 重置视图
    const handleReset = useCallback(() => {
        setScale(calculateFitScale())
        setPosition({ x: 0, y: 0 })
    }, [calculateFitScale])

    // 缩放按钮
    const handleZoomIn = () => setScale((prev) => Math.min(prev * 1.25, 5))
    const handleZoomOut = () => setScale((prev) => Math.max(prev * 0.8, 0.1))

    return (
        <TooltipProvider>
            <div
                ref={containerRef}
                className={cn(
                    "relative flex-1 bg-black/40 flex items-center justify-center overflow-hidden border border-white/5 rounded-2xl shadow-inner",
                    isDragging ? "cursor-grabbing" : visibleImageSrc && scale > calculateFitScale() ? "cursor-grab" : "cursor-default",
                    className
                )}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                // Prevent default browser menu on empty areas
                onContextMenu={(e) => e.preventDefault()}
            >
                {isGenerating && (
                    <div className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 bg-black/40 p-6 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                            <div className="h-2 w-16 rounded-full bg-indigo-400/70" />
                            <span className="text-sm font-medium tracking-wide text-white/80">生成中{progress ? ` ${progress}%` : ''}</span>
                        </div>
                    </div>
                )}

                {/* 图片内容 */}
                {visibleImageSrc ? (
                    <div
                        className="transition-transform duration-75 pointer-events-none"
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            transformOrigin: 'center',
                        }}
                    >
                        <div
                            className="relative shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-md overflow-hidden ring-1 ring-white/10 bg-black/40"
                            style={{ width: originalWidth, height: originalHeight }}
                        >
                            <img
                                src={visibleImageSrc}
                                alt="Generated Content"
                                className="w-full h-full object-contain select-none pointer-events-none"
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                            />
                        </div>
                    </div>
                ) : (
                    /* 空状态 */
                    <div className="text-white/30 select-none flex flex-col items-center gap-3">
                        <ImageIcon className="h-16 w-16 opacity-20 drop-shadow-lg" />
                        <span className="text-sm font-bold tracking-widest uppercase text-white/40">预览画布</span>
                        <span className="text-[10px] opacity-40 uppercase tracking-widest">生成图片后会显示在这里</span>
                    </div>
                )}

                {/* Context Menu Overlay Trigger - Covers the entire area */}
                {visibleImageSrc && (
                     <ImageContextMenu 
                        imageSrc={visibleImageSrc} 
                        onRegenerate={onRegenerate}
                        onSmartTools={onSmartTools}
                        onInpaint={onInpaint}
                        onI2I={onI2I}
                        onAddRef={onAddRef}
                        onOpenFolder={onOpenFolder}
                        onLoadMetadata={onLoadMetadata}
                        onDelete={onDelete}
                        asChild
                    >
                        <div className="absolute inset-0 z-10 cursor-context-menu" />
                    </ImageContextMenu>
                )}

                {/* 工具栏 - Above overlay (z-20) - hidden if hideControls is true */}
                {visibleImageSrc && !hideControls && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-3xl rounded-2xl border border-white/10 px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]" onContextMenu={(e) => e.stopPropagation()}>
                        <Tip content="缩小">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors" onClick={handleZoomOut}>
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                        </Tip>
                        <span className="text-[11px] font-mono w-12 text-center text-white/60 font-medium">
                            {Math.round(scale * 100)}%
                        </span>
                        <Tip content="放大">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors" onClick={handleZoomIn}>
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                        </Tip>
                        <div className="w-px h-5 bg-white/10 mx-1.5" />
                        <Tip content="重置视图">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors" onClick={handleReset}>
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </Tip>
                        {onFullscreen && (
                            <Tip content="全屏">
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors" onClick={onFullscreen}>
                                    <Maximize2 className="h-4 w-4" />
                                </Button>
                            </Tip>
                        )}
                    </div>
                )}
            </div>
        </TooltipProvider>
    )
}
