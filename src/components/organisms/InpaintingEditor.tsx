import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Slider } from '@/components/atoms/Slider'
import { 
    Eraser, 
    Paintbrush, 
    Undo, 
    RotateCcw,
    X,
    Wand2,
    RefreshCw,
    Layers,
    Image as ImageIcon,
    Trash2,
    Download
} from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/atoms/Tooltip'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { useGenerationStore } from '@/stores/generation-store'
import { Label } from '@/components/atoms/Label'
import { useToast } from '@/hooks/use-toast'
import { processDroppedImageFile, applyMetadataToStore, type ImageDropError } from '@/lib/image-drop-utils'
import { shallow } from 'zustand/shallow'
import { createCanvasPreviewImage } from '@/lib/canvas-preview'

interface InpaintingEditorProps {
    sourceImage: string
    onSaveMask: (mask: string | null) => void
    onClose?: () => void
    className?: string
}

const MAX_HISTORY_ENTRIES = 12

export function InpaintingEditor({
    sourceImage,
    onSaveMask,
    onClose,
    className,
}: InpaintingEditorProps) {
    const { t } = useTranslation()
    const { toast } = useToast()
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    // Store access
    const { 
        strength, setStrength, 
        noise, setNoise,
        setSourceImage,
        generate,
        isGenerating
    } = useGenerationStore(
        (state) => ({
            strength: state.strength,
            setStrength: state.setStrength,
            noise: state.noise,
            setNoise: state.setNoise,
            setSourceImage: state.setSourceImage,
            generate: state.generate,
            isGenerating: state.isGenerating,
        }),
        shallow
    )

    // Local State
    const [brushSize, setBrushSize] = useState(50)
    const [mode, setMode] = useState<'paint' | 'erase'>('paint')
    const [history, setHistory] = useState<ImageData[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const [isDrawing, setIsDrawing] = useState(false)
    const [scale, setScale] = useState(1)
    const scaleRef = useRef(1)
    
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const bgImageRef = useRef<HTMLImageElement | null>(null)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [displayImage, setDisplayImage] = useState<string | null>(null)

    const [localStrength, setLocalStrength] = useState(strength)
    const [localNoise, setLocalNoise] = useState(noise)

    useEffect(() => setLocalStrength(strength), [strength])
    useEffect(() => setLocalNoise(noise), [noise])

    // Mode: Inpainting vs Img2Img
    const [isImg2ImgMode, setIsImg2ImgMode] = useState(true)

    // 拖拽状态
    const [isDragOver, setIsDragOver] = useState(false)
    const dragCounter = useRef(0)

    // --- Grid System Refs ---
    const GRID_SIZE = 8 // 8px grid resolution for mask optimization
    const gridDataRef = useRef<Set<string>>(new Set())
    const lastGridPosRef = useRef<{ gx: number; gy: number } | null>(null)

    const aRef = useRef<Set<string>>(new Set())

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            // Prevent triggering if user is typing in an input
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

            // Undo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault()
                undo()
            }

            // Delete / Clear
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Priority: Clear Mask -> Clear Image
                if (historyIndex >= 0 || gridDataRef.current.size > 0) {
                     e.preventDefault()
                     clearCanvas()
                     console.log("Delete Key: Cleared Mask")
                } else if (sourceImage) {
                    // If no mask but image exists, clear image (destructive, but expected if 'Delete' is hit on an image)
                    e.preventDefault()
                    handleClearImage()
                    console.log("Delete Key: Cleared Image")
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [historyIndex, history, sourceImage])

    // --- Init & Resize Logic ---
    useEffect(() => {
        if (!sourceImage) {
            bgImageRef.current = null
            setDisplayImage(null)
            setImageLoaded(false)
            return
        }

        let cancelled = false
        setImageLoaded(false) // Reset while loading new image
        setDisplayImage(null)

        createCanvasPreviewImage(sourceImage).then((preview) => {
            if (cancelled || !preview) return

            const img = new Image()
            img.onload = () => {
                if (cancelled) return
                bgImageRef.current = img
                setDisplayImage(preview)
                setImageLoaded(true)
                updateScale()
            }
            img.src = preview
        })

        return () => {
            cancelled = true
        }
    }, [sourceImage])

    useEffect(() => {
        if (!isImg2ImgMode && imageLoaded && bgImageRef.current && canvasRef.current) {
            initCanvas(bgImageRef.current)
        }
    }, [imageLoaded, isImg2ImgMode])

    useEffect(() => {
        if (!containerRef.current) return

        const observer = new ResizeObserver(() => {
            updateScale()
        })
        
        observer.observe(containerRef.current)

        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        return () => {
            setHistory([])
            setHistoryIndex(-1)
            gridDataRef.current.clear()
            lastGridPosRef.current = null
            bgImageRef.current = null
            ctxRef.current = null

            if (canvasRef.current) {
                canvasRef.current.width = 0
                canvasRef.current.height = 0
            }
        }
    }, [])

    const initCanvas = (img: HTMLImageElement) => {
        if (!canvasRef.current) return
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        const maxPreviewSize = 768
        const previewScale = Math.min(maxPreviewSize / img.width, maxPreviewSize / img.height, 1)
        const fallbackWidth = Math.max(1, Math.round(img.width * previewScale))
        const fallbackHeight = Math.max(1, Math.round(img.height * previewScale))
        canvas.width = Math.max(1, Math.round(rect.width || fallbackWidth))
        canvas.height = Math.max(1, Math.round(rect.height || fallbackHeight))
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
            ctxRef.current = ctx
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            gridDataRef.current.clear()

            if (useGenerationStore.getState().mask) {
                const maskImg = new Image()
                maskImg.crossOrigin = 'anonymous'
                maskImg.onload = () => {
                   ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height)
                   saveHistory()
                }
                maskImg.src = useGenerationStore.getState().mask!
            }
        }
    }

    const updateScale = () => {
        if (!bgImageRef.current || !containerRef.current) return
        
        const img = bgImageRef.current
        const container = containerRef.current
        // Padding 32px * 2 = 64px roughly
        const maxWidth = container.clientWidth - 64
        const maxHeight = container.clientHeight - 64
        
        if (maxWidth <= 0 || maxHeight <= 0) return

        const scaleW = maxWidth / img.width
        const scaleH = maxHeight / img.height
        const newScale = Math.min(scaleW, scaleH, 1)
        if (Math.abs(scaleRef.current - newScale) < 0.001) return

        scaleRef.current = newScale
        setScale(newScale)
    }

    // --- Grid Drawing Logic (Ported from NAIS2) ---
    
    // Convert pixel coordinates to grid coordinates
    const pixelToGrid = (pixelX: number, pixelY: number, canvasWidth: number, canvasHeight: number) => {
        const gx = Math.floor(pixelX / GRID_SIZE)
        const gy = Math.floor(pixelY / GRID_SIZE)
        // Clamp to grid boundaries
        const maxGx = Math.floor(canvasWidth / GRID_SIZE) - 1
        const maxGy = Math.floor(canvasHeight / GRID_SIZE) - 1
        return {
            gx: Math.max(0, Math.min(gx, maxGx)),
            gy: Math.max(0, Math.min(gy, maxGy))
        }
    }

    // Fill a single grid cell (8x8 block)
    const fillGridCell = (ctx: CanvasRenderingContext2D, gx: number, gy: number, erase: boolean) => {
        const cellKey = `${gx},${gy}`

        if (erase) {
            // Erase: clear the cell
            ctx.clearRect(gx * GRID_SIZE, gy * GRID_SIZE, GRID_SIZE, GRID_SIZE)
            gridDataRef.current.delete(cellKey)
        } else {
            // Paint: fill with pure white (fully opaque for clean data)
            // Visual transparency is handled by CSS opacity on the canvas element
            if (gridDataRef.current.has(cellKey)) return

            ctx.fillStyle = 'rgba(255, 255, 255, 1.0)' // Full opacity for data integrity
            ctx.fillRect(gx * GRID_SIZE, gy * GRID_SIZE, GRID_SIZE, GRID_SIZE)
            gridDataRef.current.add(cellKey)
        }
    }

    // Fill brush area (multiple grid cells based on brush size)
    const fillBrushArea = (ctx: CanvasRenderingContext2D, gx: number, gy: number, erase: boolean) => {
        const brushGridSize = Math.max(1, Math.floor(brushSize / GRID_SIZE))
        const halfBrush = Math.floor(brushGridSize / 2)

        for (let offsetY = -halfBrush; offsetY <= halfBrush; offsetY++) {
            for (let offsetX = -halfBrush; offsetX <= halfBrush; offsetX++) {
                const targetGx = gx + offsetX
                const targetGy = gy + offsetY

                // Check bounds (implicit in fillGridCell? No, we need valid coords mostly)
                // Actually fillGridCell key logic handles it somewhat, but better check positive
                if (targetGx >= 0 && targetGy >= 0) {
                     // Check max bounds too? 
                     // pixelToGrid clamps, but offset might push out. 
                     // Canvas clip will handle drawing out of bounds, but for logic:
                     fillGridCell(ctx, targetGx, targetGy, erase)
                }
            }
        }
    }

    // Draw line between two grid positions (Bresenham's algorithm)
    const drawGridLine = (ctx: CanvasRenderingContext2D, startGx: number, startGy: number, endGx: number, endGy: number, erase: boolean) => {
        const dx = Math.abs(endGx - startGx)
        const dy = Math.abs(endGy - startGy)
        const sx = startGx < endGx ? 1 : -1
        const sy = startGy < endGy ? 1 : -1
        let err = dx - dy

        let gx = startGx
        let gy = startGy

        while (true) {
            fillBrushArea(ctx, gx, gy, erase)

            if (gx === endGx && gy === endGy) break

            const e2 = 2 * err
            if (e2 > -dy) {
                err -= dy
                gx += sx
            }
            if (e2 < dx) {
                err += dx
                gy += sy
            }
        }
    }

    // --- Interaction Handlers ---

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (isImg2ImgMode) return
        
        setIsDrawing(true)
        
        if (!ctxRef.current || !canvasRef.current || !bgImageRef.current) return
        
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

        // Robust Coordinate Mapping (Match Reference)
        // Instead of relying on `scale` state, calculate ratio from DOM rect directly.
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        
        const x = (clientX - rect.left) * scaleX
        const y = (clientY - rect.top) * scaleY
        
        const { gx, gy } = pixelToGrid(x, y, canvas.width, canvas.height)
        lastGridPosRef.current = { gx, gy }
        
        fillBrushArea(ctxRef.current, gx, gy, mode === 'erase')
    }

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false)
            lastGridPosRef.current = null
            saveHistory()
            updateStoreMask()
        }
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !ctxRef.current || !canvasRef.current || !lastGridPosRef.current) return

        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

        // Robust Coordinate Mapping (Match Reference)
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        
        const x = (clientX - rect.left) * scaleX
        const y = (clientY - rect.top) * scaleY

        const { gx, gy } = pixelToGrid(x, y, canvas.width, canvas.height)
        
        // Only draw if moved to a different grid cell
        if (gx !== lastGridPosRef.current.gx || gy !== lastGridPosRef.current.gy) {
            drawGridLine(ctxRef.current, lastGridPosRef.current.gx, lastGridPosRef.current.gy, gx, gy, mode === 'erase')
            lastGridPosRef.current = { gx, gy }
        }
    }

    // --- Tools & Actions ---
    const saveHistory = () => {
        if (!ctxRef.current || !canvasRef.current) return
        const data = ctxRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
        const truncatedHistory = [...history.slice(0, historyIndex + 1), data]
        const newHistory = truncatedHistory.slice(-MAX_HISTORY_ENTRIES)
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
    }

    const undo = () => {
        if (historyIndex > 0 && ctxRef.current) {
            const newIndex = historyIndex - 1
            const data = history[newIndex]
            ctxRef.current.putImageData(data, 0, 0)
            setHistoryIndex(newIndex)
            // GridDataRef is an optimization to avoid refilling. If we undo, it might be out of sync.
            // A safe bet is: if we undo, we just reset the set to allow repainting everywhere.
            gridDataRef.current.clear() 
            updateStoreMask()
        } else if (historyIndex === 0 && ctxRef.current) {
            // Revert to clear
            if (canvasRef.current) {
                ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
            }
            setHistoryIndex(-1)
            gridDataRef.current.clear()
            updateStoreMask()
        }
    }
    


    const clearCanvas = () => {
        if (!ctxRef.current || !canvasRef.current) return
        ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        gridDataRef.current.clear()
        saveHistory()
        updateStoreMask()
    }

    const updateStoreMask = () => {
        if (!canvasRef.current || !bgImageRef.current) return
        if (isImg2ImgMode) {
            onSaveMask(null)
        } else {
            const exportCanvas = document.createElement('canvas')
            exportCanvas.width = bgImageRef.current.width
            exportCanvas.height = bgImageRef.current.height
            const exportCtx = exportCanvas.getContext('2d')
            if (!exportCtx) return
            exportCtx.imageSmoothingEnabled = false
            exportCtx.drawImage(canvasRef.current, 0, 0, exportCanvas.width, exportCanvas.height)
            onSaveMask(exportCanvas.toDataURL('image/png'))
            exportCanvas.width = 0
            exportCanvas.height = 0
        }
    }
    
    // Upload Handler (Same as before)
    const handleUploadClick = () => fileInputRef.current?.click()
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const result = await processDroppedImageFile(file)

            // 加载图片到画布
            setSourceImage(result.dataUrl)
            setIsImg2ImgMode(true)
            setHistory([])
            setHistoryIndex(-1)
            gridDataRef.current.clear()
            onSaveMask(null) // Urgent: Clear old mask from store

            // 如果检测到 NAI 元数据 → 自动应用参数
            if (result.metadata) {
                const genStore = useGenerationStore.getState()
                applyMetadataToStore(result.metadata, genStore)
                toast({
                    title: '✅ NAI 参数已自动加载',
                    description: result.metadata.prompt
                        ? `${result.metadata.prompt.slice(0, 60)}...`
                        : undefined,
                    duration: 4000,
                })
            }

            // 如果匹配分辨率预设 → 提示
            if (result.matchedPreset) {
                toast({
                    title: `📐 分辨率匹配：${result.matchedPreset}`,
                    duration: 3000,
                })
            }

            // 非 64 倍数宽容提示
            if (!result.isMultipleOf64) {
                toast({
                    title: '⚠️ 尺寸需要裁剪',
                    description: `当前图片 (${result.width}×${result.height}) 不是 64 的倍数，生成前将会被自动裁剪或缩放。`,
                    variant: 'default',
                    duration: 5000,
                })
            }
        } catch (err) {
            const dropError = err as ImageDropError
            toast({
                title: '❌ 图片载入失败',
                description: dropError.message || '未知错误',
                variant: 'destructive',
                duration: 5000,
            })
        } finally {
            e.target.value = '' // Reset input to allow selecting same file again
        }
    }

    const toggleImg2Img = (checked: boolean) => {
        setIsImg2ImgMode(checked)
        if (checked) {
            onSaveMask(null) 
        } else {
            updateStoreMask()
        }
    }

    const handleClearImage = () => {
        console.log("handleClearImage triggered")
        setSourceImage('') 
        setHistory([])
        setHistoryIndex(-1)
        gridDataRef.current.clear()
        bgImageRef.current = null
        setImageLoaded(false)
        if (ctxRef.current && canvasRef.current) {
             ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
             canvasRef.current.width = 0
             canvasRef.current.height = 0
        }
        onSaveMask(null)
    }

    // --- 拖拽处理 ---
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current++
        if (e.dataTransfer.types.includes('Files')) setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current--
        if (dragCounter.current === 0) setIsDragOver(false)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current = 0
        setIsDragOver(false)

        const file = e.dataTransfer.files?.[0]
        if (!file) return

        try {
            const result = await processDroppedImageFile(file)

            // 加载图片到画布
            setSourceImage(result.dataUrl)
            setIsImg2ImgMode(true)
            setHistory([])
            setHistoryIndex(-1)
            gridDataRef.current.clear()
            onSaveMask(null)

            // 如果检测到 NAI 元数据 → 自动应用参数
            if (result.metadata) {
                const genStore = useGenerationStore.getState()
                applyMetadataToStore(result.metadata, genStore)
                toast({
                    title: '✅ NAI 参数已自动加载',
                    description: result.metadata.prompt
                        ? `${result.metadata.prompt.slice(0, 60)}...`
                        : undefined,
                    duration: 4000,
                })
            }

            // 如果匹配分辨率预设 → 提示
            if (result.matchedPreset) {
                toast({
                    title: `📐 分辨率匹配：${result.matchedPreset}`,
                    duration: 3000,
                })
            }

            // 非 64 倍数宽容提示
            if (!result.isMultipleOf64) {
                toast({
                    title: '⚠️ 尺寸需要裁剪',
                    description: `当前图片 (${result.width}×${result.height}) 不是 64 的倍数，生成前将会被自动裁剪或缩放。`,
                    variant: 'default',
                    duration: 5000,
                })
            }
        } catch (err) {
            const dropError = err as ImageDropError
            toast({
                title: '❌ 图片拖入失败',
                description: dropError.message || '未知错误',
                variant: 'destructive',
                duration: 5000,
            })
        }
    }


    return (
        <TooltipProvider>
            <div className={cn('flex h-full w-full bg-slate-100/50 dark:bg-black/20 overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 relative contain-layout contain-paint', className)}>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange}
                />

                {/* Left: Canvas Area */}
                <div 
                    ref={containerRef}
                    className="flex-1 relative flex items-center justify-center bg-slate-50 dark:bg-[#030712] overflow-hidden p-8 rounded-l-3xl group contain-layout contain-paint"
                    onDragEnter={handleDragEnter}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {!sourceImage && (
                        <div className="flex flex-col items-center justify-center text-slate-500 dark:text-white/30 gap-6 w-full max-w-sm">
                            <div className="w-24 h-24 rounded-full bg-white dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[inset_0_2px_10px_rgba(255,255,255,0.02)]">
                                <ImageIcon className="w-10 h-10 text-slate-400 dark:text-white/40 drop-shadow-sm dark:drop-shadow-md" />
                            </div>
                            <p className="text-sm text-center font-medium tracking-wide">{t('workbench.noImageDesc', 'Please select or upload an image')}</p>
                            <Button onClick={handleUploadClick} className="rounded-full h-12 px-8 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 dark:hover:bg-indigo-500/30 border border-indigo-200 dark:border-indigo-500/30 font-semibold tracking-wide cursor-pointer pointer-events-auto">
                                {t('workbench.upload', 'Upload Image')}
                            </Button>
                        </div>
                    )}

                    {sourceImage && imageLoaded && bgImageRef.current && (
                        <div 
                            className="relative flex-shrink-0 mx-auto"
                            style={{ 
                                width: `${Math.max(1, Math.round(bgImageRef.current.width * scale))}px`,
                                height: `${Math.max(1, Math.round(bgImageRef.current.height * scale))}px`,
                                aspectRatio: `${bgImageRef.current.width} / ${bgImageRef.current.height}`
                            }}
                        >
                            <img 
                                src={displayImage || ''} 
                                className="w-full h-full pointer-events-none select-none object-contain block"
                                alt="Reference"
                            />

                            {!isImg2ImgMode && (
                                <canvas
                                    ref={canvasRef}
                                    onMouseDown={startDrawing}
                                    onMouseUp={stopDrawing}
                                    onMouseOut={stopDrawing}
                                    onMouseMove={(e) => {
                                        if(isDrawing) draw(e)
                                    }}
                                    onTouchStart={startDrawing}
                                    onTouchEnd={stopDrawing}
                                    onTouchMove={(e) => {
                                        if(isDrawing) draw(e)
                                    }}
                                    className="absolute top-0 left-0 w-full h-full touch-none z-10 rounded-lg cursor-crosshair"
                                />
                            )}
                        </div>
                    )}

                    {/* 拖拽视觉反馈遮罩 */}
                    {isDragOver && (
                            <div
                                className="absolute inset-4 bg-indigo-500/15 dark:bg-indigo-500/20 border-2 border-dashed border-indigo-400 dark:border-indigo-500 rounded-2xl flex flex-col items-center justify-center z-50 pointer-events-none"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 dark:bg-indigo-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                                    <Download className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
                                </div>
                                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-300 tracking-wide">
                                    {t('workbench.dropImage', '拖入图片')}
                                </p>
                                <p className="text-xs text-indigo-500/70 dark:text-indigo-400/60 mt-1 font-medium">
                                    {t('workbench.dropImageHint', '支持 NAI 元数据自动加载 · 仅限 64 倍数尺寸')}
                                </p>
                            </div>
                    )}
                </div>

                {/* Right: Workbench Sidebar */}
                <div className="w-[320px] bg-white dark:bg-black border-l border-slate-200 dark:border-white/10 flex flex-col shrink-0 h-full rounded-r-3xl z-30">
                    
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-800 dark:text-white drop-shadow-sm">
                            {isImg2ImgMode ? <Layers className="w-5 h-5 text-indigo-400" /> : <Paintbrush className="w-5 h-5 text-indigo-400" />}
                            {isImg2ImgMode ? t('workbench.img2img', 'Image to Image') : t('workbench.inpaint', 'Inpainting')}
                        </div>
                        {onClose && (
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white rounded-xl">
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        
                        {/* Mode Toggle (Segmented Control) */}
                        <div className="flex bg-slate-100 dark:bg-black/60 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 h-12 shrink-0">
                            <button 
                                className={cn("flex-1 text-xs tracking-wide font-bold rounded-xl", !isImg2ImgMode ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-white/20" : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60")}
                                onClick={() => toggleImg2Img(false)}
                            >
                                {t('workbench.inpaint', 'Inpainting')}
                            </button>
                            <button 
                                className={cn("flex-1 text-xs tracking-wide font-bold rounded-xl", isImg2ImgMode ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-white/20" : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60")}
                                onClick={() => toggleImg2Img(true)}
                            >
                                {t('workbench.img2img', 'Img2Img')}
                            </button>
                        </div>

                        {!isImg2ImgMode && (
                        <div className="space-y-5">
                            
                            <div className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-slate-600 dark:text-white/70 font-semibold tracking-wide drop-shadow-sm">{t('workbench.tools', 'Brush Tools')}</Label>
                                    <div className="flex bg-slate-100 dark:bg-black/60 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 gap-1">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn("h-8 w-10 rounded-lg", mode === 'paint' ? "bg-white dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-indigo-500/30" : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white/70")}
                                                    onClick={() => setMode('paint')}
                                                >
                                                    <Paintbrush className="w-4 h-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">{t('workbench.paint', 'Paint Mask')}</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn("h-8 w-10 rounded-lg", mode === 'erase' ? "bg-white dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-indigo-500/30" : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white/70")}
                                                    onClick={() => setMode('erase')}
                                                >
                                                    <Eraser className="w-4 h-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">{t('workbench.erase', 'Erase Mask')}</TooltipContent>
                                        </Tooltip>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Slider
                                            value={[brushSize]}
                                            onValueChange={([v]) => setBrushSize(v)}
                                            min={8}
                                            max={128}
                                            step={8}
                                            className="flex-1"
                                        />
                                        <div className="bg-white/50 dark:bg-black/40 rounded-lg px-2 py-1 border border-slate-200 dark:border-white/5 shadow-inner min-w-[40px] flex justify-center">
                                            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-300 tracking-wide">{brushSize}px</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <Button 
                                        variant="outline" 
                                        onClick={undo}
                                        disabled={historyIndex < 0}
                                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-white/70 disabled:opacity-30 disabled:border-transparent rounded-xl h-10 transition-all shadow-sm"
                                    >
                                        <Undo className="w-4 h-4 mr-2" />
                                        {t('workbench.undo', 'Undo')}
                                    </Button>
                                </div>
                                <div className="flex-1">
                                    <Button 
                                        variant="outline" 
                                        onClick={clearCanvas}
                                        className="w-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-xl h-10 transition-all shadow-sm"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {t('common.clear', 'Clear')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        )}

                        <div className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl p-5 space-y-5">
                            <Label className="text-xs text-slate-600 dark:text-white/70 font-semibold tracking-wide drop-shadow-sm block">{t('workbench.genSettings', 'Generation Parameters')}</Label>
                            
                            <div className="space-y-5">
                                <div className="flex justify-between text-xs items-center">
                                    <span className="text-slate-800 dark:text-white/90 font-medium tracking-wide">{t('settings.strength', 'Strength')}</span>
                                    <div className="bg-white/50 dark:bg-black/40 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner">
                                        <span className="text-indigo-600 dark:text-indigo-300 font-mono text-xs font-bold">{localStrength.toFixed(2)}</span>
                                    </div>
                                </div>
                                <Slider
                                    value={[localStrength]}
                                    onValueChange={([v]) => setLocalStrength(v)}
                                    onValueCommit={([v]) => setStrength(v)}
                                    min={0.01}
                                    max={0.99}
                                    step={0.01}
                                    className="w-full"
                                />
                                <p className="text-[11px] text-white/40 font-medium tracking-wide leading-relaxed">
                                    {t('workbench.strengthHint', '推荐：0.5–0.7（低值变化更敏感）')}
                                </p>
                            </div>

                            {isImg2ImgMode && (
                                <div className="space-y-5">
                                    <div className="flex justify-between text-xs items-center">
                                        <span className="text-slate-800 dark:text-white/90 font-medium tracking-wide">{t('settings.noise', 'Noise')}</span>
                                        <div className="bg-white/50 dark:bg-black/40 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner">
                                            <span className="text-indigo-600 dark:text-indigo-300 font-mono text-xs font-bold">{localNoise.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <Slider
                                        value={[localNoise]}
                                        onValueChange={([v]) => setLocalNoise(v)}
                                        onValueCommit={([v]) => setNoise(v)}
                                        min={0.0}
                                        max={0.99}
                                        step={0.01}
                                        className="w-full"
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-white/40 font-medium tracking-wide leading-relaxed">
                                        {t('settings.noiseDesc', '增加画面的细节或随机性')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/40 space-y-4">
                        {sourceImage ? (
                            <div className="flex gap-3">
                                <div className="flex-[3]">
                                    <Button
                                        variant="outline"
                                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-white shadow-sm h-11 rounded-xl transition-all"
                                        onClick={handleUploadClick}
                                    >
                                        <ImageIcon className="mr-2 h-4 w-4 opacity-70" />
                                        {t('workbench.replace', 'Replace')}
                                    </Button>
                                </div>
                                <div className="flex-[1]">
                                    <Button
                                        variant="outline"
                                        className="w-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-500 h-11 shadow-sm rounded-xl transition-all p-0"
                                        onClick={handleClearImage}
                                    >
                                        <Trash2 className="h-4 w-4 opacity-80" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <Button
                                    variant="outline"
                                    className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-white shadow-sm h-11 rounded-xl transition-all"
                                    onClick={handleUploadClick}
                                >
                                    <ImageIcon className="mr-2 h-4 w-4 opacity-70" />
                                    {t('workbench.upload', 'Upload Image')}
                                </Button>
                            </div>
                        )}

                        <div>
                            <Button
                                variant="premium"
                                className={cn(
                                    "w-full h-12 text-base font-bold rounded-xl",
                                    isGenerating && "opacity-80 cursor-wait sepia-[.2]"
                                )}
                                onClick={() => generate({ seed: -1 })}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        {t('common.generating', 'Generating...')}
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="mr-2 h-4 w-4" />
                                        {t('common.generate', 'Generate')}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}
