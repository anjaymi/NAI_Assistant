import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/atoms/Dialog"
import { Button } from "@/components/atoms/Button"
import { Slider } from "@/components/atoms/Slider"
import { Label } from "@/components/atoms/Label"
import { useState, useRef, useCallback, useEffect, PointerEvent } from "react"
import { useTranslation } from "react-i18next"
import { Download, Grid3X3, Minus, Plus } from "lucide-react"
// import { save } from "@tauri-apps/plugin-dialog" // Simplify for now using link download
// import { writeFile } from "@tauri-apps/plugin-fs"
import { useToast } from "@/hooks/use-toast"

interface MosaicDialogProps {
    sourceImage: string | null
    isOpen: boolean
    onClose: () => void
}

export function MosaicDialog({
    sourceImage,
    isOpen,
    onClose
}: MosaicDialogProps) {
    const { t } = useTranslation()
    const { toast } = useToast()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    // Local state for brush settings (simplify vs global store for now)
    const [pixelSize, setPixelSize] = useState(10)
    const [brushSize, setBrushSize] = useState(50)

    // Track which grid cells have been mosaicked to prevent stacking
    const mosaickedCellsRef = useRef<Set<string>>(new Set())
    // Store original image pixels
    const originalImageDataRef = useRef<ImageData | null>(null)


    // Initialize canvas when dialog opens or image changes
    useEffect(() => {
        if (!isOpen || !sourceImage) return

        // Small delay to ensure canvas is rendered
        const timer = setTimeout(() => {
            const canvas = canvasRef.current
            if (!canvas) {
                console.log("Canvas not ready")
                return
            }

            const ctx = canvas.getContext('2d')
            if (!ctx) {
                console.log("Context not ready")
                return
            }

            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                console.log("Image loaded:", img.width, img.height)
                // Set canvas size to match image
                canvas.width = img.width
                canvas.height = img.height

                // Draw original image
                ctx.drawImage(img, 0, 0)

                // Store original image data for reference
                originalImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)

                // Clear mosaicked regions tracking
                mosaickedCellsRef.current.clear()
                
                // 释放 Image 内存
                img.src = ''
            }
            img.onerror = (e) => {
                console.error("Image load error", e)
                img.src = ''
            }
            img.src = sourceImage
        }, 100)

        return () => clearTimeout(timer)
    }, [isOpen, sourceImage])

    const getCellKey = (cellX: number, cellY: number): string => {
        return `${cellX},${cellY}`
    }

    const applyMosaicToRegion = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current
        if (!canvas || !originalImageDataRef.current) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        const centerX = (clientX - rect.left) * scaleX
        const centerY = (clientY - rect.top) * scaleY

        const halfBrush = brushSize / 2
        const startX = Math.max(0, centerX - halfBrush)
        const startY = Math.max(0, centerY - halfBrush)
        const endX = Math.min(canvas.width, centerX + halfBrush)
        const endY = Math.min(canvas.height, centerY + halfBrush)

        // Calculate grid-aligned positions
        const gridStartX = Math.floor(startX / pixelSize) * pixelSize
        const gridStartY = Math.floor(startY / pixelSize) * pixelSize

        const originalData = originalImageDataRef.current

        for (let py = gridStartY; py < endY; py += pixelSize) {
            for (let px = gridStartX; px < endX; px += pixelSize) {
                const cellX = Math.floor(px / pixelSize)
                const cellY = Math.floor(py / pixelSize)
                const cellKey = getCellKey(cellX, cellY)

                // Skip if this cell was already mosaicked
                if (mosaickedCellsRef.current.has(cellKey)) continue

                // Get the average color from the ORIGINAL image data
                const sampleX = Math.min(Math.floor(px), canvas.width - 1)
                const sampleY = Math.min(Math.floor(py), canvas.height - 1)
                const pixelIndex = (sampleY * canvas.width + sampleX) * 4

                const r = originalData.data[pixelIndex]
                const g = originalData.data[pixelIndex + 1]
                const b = originalData.data[pixelIndex + 2]
                const a = originalData.data[pixelIndex + 3]

                // Draw mosaic block
                ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`
                ctx.fillRect(px, py, pixelSize, pixelSize)

                // Mark this cell as mosaicked
                mosaickedCellsRef.current.add(cellKey)
            }
        }
    }, [pixelSize, brushSize])

    const handlePointerDown = useCallback((e: PointerEvent) => {
        e.preventDefault()
        const el = e.currentTarget as HTMLElement
        el.setPointerCapture(e.pointerId)
        setIsDrawing(true)
        applyMosaicToRegion(e.clientX, e.clientY)
    }, [applyMosaicToRegion])

    const handlePointerMove = useCallback((e: PointerEvent) => {
        if (!isDrawing) return
        e.preventDefault()
        applyMosaicToRegion(e.clientX, e.clientY)
    }, [isDrawing, applyMosaicToRegion])

    const handlePointerUp = useCallback((e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement
        if (el.releasePointerCapture) el.releasePointerCapture(e.pointerId)
        setIsDrawing(false)
    }, [])

    useEffect(() => {
        if (isDrawing) {
            const handleGlobalPointerUp = () => setIsDrawing(false)
            window.addEventListener('pointerup', handleGlobalPointerUp)
            return () => window.removeEventListener('pointerup', handleGlobalPointerUp)
        }
    }, [isDrawing])

    const handleReset = useCallback(() => {
        if (!canvasRef.current || !sourceImage) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const img = new Image()
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)
            originalImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
            mosaickedCellsRef.current.clear()
            img.src = '' // 释放 Image 内存
        }
        img.src = sourceImage
    }, [sourceImage])

    const handleSaveAs = async () => {
        if (!canvasRef.current) return

        const dataUrl = canvasRef.current.toDataURL('image/png')
        
        // Simple download trigger for now (web compatible)
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `mosaic_${Date.now()}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        
        toast({ title: t('common.saved', 'Saved'), duration: 2000 })
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex flex-col p-6 max-w-[80vw] w-[80vw] h-[85vh] max-h-[85vh]">
                <DialogHeader className="mb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Grid3X3 className="h-5 w-5" />
                        {t('smartTools.mosaic', 'Mosaic Editor')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('smartTools.mosaicEditorDesc', 'Drag to apply mosaic effect')}
                    </DialogDescription>
                </DialogHeader>

                {/* Controls */}
                <div className="flex gap-6 mb-4 shrink-0 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Label className="text-sm whitespace-nowrap">{t('smartTools.pixelSize', 'Pixel Size')}</Label>
                        <div className="flex items-center gap-2">
                            <Minus className="h-3 w-3 text-muted-foreground" />
                            <Slider
                                value={[pixelSize]}
                                onValueChange={(v) => setPixelSize(v[0])}
                                min={5}
                                max={30}
                                step={1}
                                className="w-24"
                            />
                            <Plus className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground w-6">{pixelSize}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Label className="text-sm whitespace-nowrap">{t('smartTools.brushSize', 'Brush Size')}</Label>
                        <div className="flex items-center gap-2">
                            <Minus className="h-3 w-3 text-muted-foreground" />
                            <Slider
                                value={[brushSize]}
                                onValueChange={(v) => setBrushSize(v[0])}
                                min={20}
                                max={150}
                                step={5}
                                className="w-24"
                            />
                            <Plus className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground w-8">{brushSize}</span>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        {t('common.reset', 'Reset')}
                    </Button>
                </div>

                {/* Canvas Container */}
                <div
                    ref={containerRef}
                    className="flex-1 relative overflow-hidden rounded-lg bg-muted/50 flex items-center justify-center p-4 checkerboard"
                >
                    <canvas
                        ref={canvasRef}
                        className="cursor-crosshair shadow-lg"
                        style={{
                            imageRendering: 'pixelated',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            touchAction: 'none'
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    />
                </div>

                <DialogFooter className="mt-4 sm:justify-end items-center gap-2">
                    <Button variant="outline" onClick={onClose}>
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleSaveAs}>
                        <Download className="h-4 w-4 mr-2" />
                        {t('common.save', 'Save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
