import React, { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/atoms/Button'
import { Slider } from '@/components/atoms/Slider'
import { Switch } from '@/components/atoms/Switch'
import { Label } from '@/components/atoms/Label'
import { 
    Eraser, Paintbrush, Undo, RotateCcw,
    Layers, Image as ImageIcon, Trash2, SlidersHorizontal, Settings, ChevronLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGenerationStore } from '@/stores/generation-store'
import { MobileGenerateFAB } from '../generate/MobileGenerateFAB'
import { shallow } from 'zustand/shallow'
import { createCanvasPreviewImage } from '@/lib/canvas-preview'

interface MobileCanvasPanelProps {
    className?: string;
}

export function MobileCanvasPanel({ className }: MobileCanvasPanelProps) {
    const { t } = useTranslation()
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    // Store access
    const { 
        strength, setStrength, 
        noise, setNoise,
        sourceImage, setSourceImage,
        setMask,
        isGenerating
    } = useGenerationStore(
        (state) => ({
            strength: state.strength,
            setStrength: state.setStrength,
            noise: state.noise,
            setNoise: state.setNoise,
            sourceImage: state.sourceImage,
            setSourceImage: state.setSourceImage,
            setMask: state.setMask,
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

    // --- Grid System Refs ---
    const GRID_SIZE = 8
    const gridDataRef = useRef<Set<string>>(new Set())
    const lastGridPosRef = useRef<{ gx: number; gy: number } | null>(null)

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
        const observer = new ResizeObserver(() => updateScale())
        observer.observe(containerRef.current)
        return () => observer.disconnect()
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
        
        const maxWidth = container.clientWidth - 32
        const maxHeight = container.clientHeight - 120 // Space for toolbars
        
        if (maxWidth <= 0 || maxHeight <= 0) return

        const scaleW = maxWidth / img.width
        const scaleH = maxHeight / img.height
        const newScale = Math.min(scaleW, scaleH, 1)
        if (Math.abs(scaleRef.current - newScale) < 0.001) return

        scaleRef.current = newScale
        setScale(newScale)
    }

    // --- Grid Drawing Logic ---
    const pixelToGrid = (pixelX: number, pixelY: number, canvasWidth: number, canvasHeight: number) => {
        const gx = Math.floor(pixelX / GRID_SIZE)
        const gy = Math.floor(pixelY / GRID_SIZE)
        const maxGx = Math.floor(canvasWidth / GRID_SIZE) - 1
        const maxGy = Math.floor(canvasHeight / GRID_SIZE) - 1
        return {
            gx: Math.max(0, Math.min(gx, maxGx)),
            gy: Math.max(0, Math.min(gy, maxGy))
        }
    }

    const fillGridCell = (ctx: CanvasRenderingContext2D, gx: number, gy: number, erase: boolean) => {
        const cellKey = `${gx},${gy}`
        if (erase) {
            ctx.clearRect(gx * GRID_SIZE, gy * GRID_SIZE, GRID_SIZE, GRID_SIZE)
            gridDataRef.current.delete(cellKey)
        } else {
            if (gridDataRef.current.has(cellKey)) return
            ctx.fillStyle = 'rgba(255, 255, 255, 1.0)' 
            ctx.fillRect(gx * GRID_SIZE, gy * GRID_SIZE, GRID_SIZE, GRID_SIZE)
            gridDataRef.current.add(cellKey)
        }
    }

    const fillBrushArea = (ctx: CanvasRenderingContext2D, gx: number, gy: number, erase: boolean) => {
        const brushGridSize = Math.max(1, Math.floor(brushSize / GRID_SIZE))
        const halfBrush = Math.floor(brushGridSize / 2)
        for (let offsetY = -halfBrush; offsetY <= halfBrush; offsetY++) {
            for (let offsetX = -halfBrush; offsetX <= halfBrush; offsetX++) {
                const targetGx = gx + offsetX
                const targetGy = gy + offsetY
                if (targetGx >= 0 && targetGy >= 0) {
                     fillGridCell(ctx, targetGx, targetGy, erase)
                }
            }
        }
    }

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
            if (e2 > -dy) { err -= dy; gx += sx }
            if (e2 < dx) { err += dx; gy += sy }
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

        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        const x = (clientX - rect.left) * scaleX
        const y = (clientY - rect.top) * scaleY

        const { gx, gy } = pixelToGrid(x, y, canvas.width, canvas.height)
        if (gx !== lastGridPosRef.current.gx || gy !== lastGridPosRef.current.gy) {
            drawGridLine(ctxRef.current, lastGridPosRef.current.gx, lastGridPosRef.current.gy, gx, gy, mode === 'erase')
            lastGridPosRef.current = { gx, gy }
        }
    }

    // --- Tools & Actions ---
    const saveHistory = () => {
        if (!ctxRef.current || !canvasRef.current) return
        const data = ctxRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
        const newHistory = [...history.slice(0, historyIndex + 1), data]
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
    }

    const undo = () => {
        if (historyIndex > 0 && ctxRef.current) {
            const newIndex = historyIndex - 1
            const data = history[newIndex]
            ctxRef.current.putImageData(data, 0, 0)
            setHistoryIndex(newIndex)
            gridDataRef.current.clear() 
            updateStoreMask()
        } else if (historyIndex === 0 && ctxRef.current) {
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
            setMask(null)
        } else {
            const exportCanvas = document.createElement('canvas')
            exportCanvas.width = bgImageRef.current.width
            exportCanvas.height = bgImageRef.current.height
            const exportCtx = exportCanvas.getContext('2d')
            if (!exportCtx) return
            exportCtx.imageSmoothingEnabled = false
            exportCtx.drawImage(canvasRef.current, 0, 0, exportCanvas.width, exportCanvas.height)
            setMask(exportCanvas.toDataURL('image/png'))
            exportCanvas.width = 0
            exportCanvas.height = 0
        }
    }
    
    // Upload Handler
    const handleUploadClick = () => fileInputRef.current?.click()
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setSourceImage(ev.target.result as string)
                    setIsImg2ImgMode(true)
                    setHistory([])
                    setHistoryIndex(-1)
                    gridDataRef.current.clear()
                    setMask(null)
                }
            }
            reader.readAsDataURL(file)
        }
        e.target.value = '' // Reset input to allow selecting same file again
    }

    const toggleImg2Img = (checked: boolean) => {
        setIsImg2ImgMode(checked)
        if (checked) {
            setMask(null) 
        } else {
            updateStoreMask()
        }
    }

    const handleClearImage = () => {
        setSourceImage(null) 
        setHistory([])
        setHistoryIndex(-1)
        gridDataRef.current.clear()
        if (ctxRef.current && canvasRef.current) {
             ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
             canvasRef.current.width = 0
             canvasRef.current.height = 0
        }
        ctxRef.current = null
        bgImageRef.current = null
        setImageLoaded(false)
        setMask(null)
    }

    return (
        <div className={cn("flex flex-col h-full bg-slate-50 dark:bg-[#030712] relative overflow-hidden contain-layout contain-paint", className)}>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange}
            />

            {/* Header */}
            <div className="px-6 pt-12 pb-2 shrink-0 flex items-center justify-between z-10 relative bg-gradient-to-b from-slate-200/80 dark:from-black/60 to-transparent">
                <div className="flex items-center">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => window.dispatchEvent(new CustomEvent('navigate-mobile', { detail: 'tools' }))}
                        className="h-10 w-10 mr-3 rounded-full bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300/50 dark:hover:bg-white/10 text-slate-500 dark:text-white/60 border border-slate-300/50 dark:border-white/5 shadow-sm"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white drop-shadow-sm">
                            {t('tabs.canvas', 'Canvas')}
                        </h1>
                        <p className="text-[11px] text-indigo-600 dark:text-indigo-300/80 font-bold tracking-widest uppercase mt-0.5">
                            {isImg2ImgMode ? t('workbench.img2img', 'Image to Image') : t('workbench.inpaint', 'Inpainting')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Area (Scrollable) */}
            <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col contain-layout contain-paint">
                {/* Canvas Container */}
                <div 
                    ref={containerRef}
                    className="relative flex items-center justify-center p-4 min-h-[50vh] shrink-0 contain-layout contain-paint"
                >
                {!sourceImage && (
                    <div className="flex flex-col items-center justify-center text-slate-500 dark:text-white/30 gap-6 w-full max-w-sm">
                        <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.02)]">
                            <ImageIcon className="w-10 h-10 text-slate-400 dark:text-white/40 drop-shadow-md" />
                        </div>
                        <p className="text-sm text-center font-medium tracking-wide">{t('workbench.noImageDesc', 'Please select or upload an image')}</p>
                        <Button onClick={handleUploadClick} className="rounded-full h-12 px-8 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-200 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/30 border border-indigo-200 dark:border-indigo-500/30 font-semibold tracking-wide">
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
                                onMouseMove={draw}
                                onTouchStart={startDrawing}
                                onTouchEnd={stopDrawing}
                                onTouchMove={draw}
                                className="absolute top-0 left-0 w-full h-full touch-none z-10 rounded-[20px] cursor-crosshair"
                            />
                        )}
                    </div>
                )}


            </div>

            {/* Inline Generation Settings (Visible when image exists) */}
            {sourceImage && (
                <div className="px-6 py-8 space-y-8 pb-32">
                    {/* Mode Toggle (Segmented Control) */}
                    <div className="flex bg-slate-200/50 dark:bg-black/40 p-1.5 rounded-full ring-1 ring-slate-300/50 dark:ring-white/10 shadow-inner overflow-hidden h-14 shrink-0">
                        <button 
                            className={cn("flex-1 text-sm tracking-wide font-bold rounded-full", !isImg2ImgMode ? "bg-white dark:bg-white/15 text-slate-800 dark:text-white ring-1 ring-slate-200 dark:ring-white/20" : "text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/60")}
                            onClick={() => toggleImg2Img(false)}
                        >
                            {t('workbench.inpaint', 'Inpainting')}
                        </button>
                        <button 
                            className={cn("flex-1 text-sm tracking-wide font-bold rounded-full", isImg2ImgMode ? "bg-white dark:bg-white/15 text-slate-800 dark:text-white ring-1 ring-slate-200 dark:ring-white/20" : "text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/60")}
                            onClick={() => toggleImg2Img(true)}
                        >
                            {t('workbench.img2img', 'Img2Img')}
                        </button>
                    </div>

                    {/* Inline Paint Tools (Only show in Inpaint mode) */}
                    {sourceImage && !isImg2ImgMode && (
                            <div className="overflow-hidden">
                                <div className="bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-700 dark:text-white font-semibold tracking-wide drop-shadow-sm">{t('workbench.paintTools', 'Paint Tools')}</span>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={undo}
                                                disabled={historyIndex < 0}
                                                className="h-9 w-9 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm text-slate-500 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 disabled:border-transparent"
                                            >
                                                <Undo className="w-[16px] h-[16px]" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={clearCanvas}
                                                className="h-9 w-9 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 shadow-sm text-red-500 dark:text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-300 font-bold"
                                            >
                                                <Trash2 className="w-[16px] h-[16px]" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-5">
                                        {/* Paint / Erase Toggle */}
                                        <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-black/40 p-1 rounded-2xl ring-1 ring-slate-200/50 dark:ring-white/10 shadow-inner shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn("h-12 w-16 rounded-[14px]", mode === 'paint' ? "bg-white dark:bg-white/15 text-indigo-500 dark:text-indigo-300 ring-1 ring-slate-200 dark:ring-white/10" : "text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70")}
                                                onClick={() => setMode('paint')}
                                            >
                                                <Paintbrush className="w-5 h-5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn("h-12 w-16 rounded-[14px]", mode === 'erase' ? "bg-white dark:bg-white/15 text-indigo-500 dark:text-indigo-300 ring-1 ring-slate-200 dark:ring-white/10" : "text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70")}
                                                onClick={() => setMode('erase')}
                                            >
                                                <Eraser className="w-5 h-5" />
                                            </Button>
                                        </div>

                                        {/* Brush Size Slider */}
                                        <div className="flex-1 flex flex-col gap-4">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[11px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest leading-none">Size</span>
                                                <div className="bg-slate-100 dark:bg-black/40 px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/5 shadow-inner leading-none">
                                                    <span className="text-[11px] font-mono font-bold text-indigo-500 dark:text-indigo-300 tracking-wide">{brushSize}</span>
                                                </div>
                                            </div>
                                            <div className="px-1 flex items-center">
                                                <Slider
                                                    value={[brushSize]}
                                                    onValueChange={([v]) => setBrushSize(v)}
                                                    min={8}
                                                    max={128}
                                                    step={8}
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                    )}

                    {/* Strength Slider */}
                    <div className="bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-white/5 rounded-[24px] p-5 space-y-5 shadow-sm">
                        <div className="flex justify-between text-sm items-center">
                            <span className="text-slate-700 dark:text-white font-semibold tracking-wide drop-shadow-sm">{t('settings.strength', 'Strength')}</span>
                            <div className="bg-slate-100 dark:bg-black/40 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner">
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
                        <p className="text-[11px] text-slate-400 dark:text-white/40 font-medium tracking-wide leading-relaxed">
                            {t('workbench.strengthHint', '推荐：0.5–0.7（低值变化更敏感）')}
                        </p>
                    </div>

                    {/* Noise Slider */}
                    {isImg2ImgMode && (
                        <div className="bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-white/5 rounded-[24px] p-5 space-y-5 shadow-sm">
                            <div className="flex justify-between text-sm items-center">
                                <span className="text-slate-700 dark:text-white font-semibold tracking-wide drop-shadow-sm">{t('settings.noise', 'Noise')}</span>
                                <div className="bg-slate-100 dark:bg-black/40 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner">
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
                            <p className="text-[11px] text-slate-400 dark:text-white/40 font-medium tracking-wide leading-relaxed">
                                {t('settings.noiseDesc', '增加画面的细节或随机性')}
                            </p>
                        </div>
                    )}

                    {/* File Actions */}
                    <div className="flex gap-4 items-center">
                        <div className="flex-[3]">
                            <Button
                                variant="outline"
                                className="w-full bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-white shadow-sm h-14 rounded-2xl border border-slate-200 dark:border-white/10 transition-all font-semibold"
                                onClick={handleUploadClick}
                            >
                                <ImageIcon className="mr-2 h-5 w-5 opacity-70" />
                                {t('workbench.replace', 'Replace Image')}
                            </Button>
                        </div>
                        <div className="flex-[1]">
                            <Button
                                variant="outline"
                                className="w-full bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 dark:text-red-400 h-14 rounded-2xl border border-red-100 dark:border-red-500/20 shadow-sm transition-all"
                                onClick={handleClearImage}
                                title={t('common.clear', 'Clear Image')}
                            >
                                <Trash2 className="h-5 w-5 opacity-80" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            </div> {/* End Main Content Area */}

            {/* Generate FAB */}
            {sourceImage && (
                <div className="absolute top-1/2 right-4 -translate-y-1/2 z-20 pointer-events-none">
                     <div className="pointer-events-auto">
                        <MobileGenerateFAB />
                     </div>
                </div>
            )}
        </div>
    )
}
