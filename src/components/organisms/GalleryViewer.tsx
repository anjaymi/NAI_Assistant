import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/atoms/Dialog'
import { Button } from '@/components/atoms/Button'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { useGenerationStore } from '@/stores/generation-store'
import { useCharacterStore } from '@/stores/character-store'
import { GalleryItem as GalleryItemType, useGalleryStore } from '@/stores/gallery-store'
import { NAIMetadata, parseNAIMetadata } from '@/lib/metadata-parser'
import { toast } from '@/hooks/use-toast'
import { RefreshCw, Copy, Image as ImageIcon, Wand2, X, Info, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { ImageInfoOverlay } from '@/components/molecules/ImageInfoOverlay'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '@/components/atoms/ContextMenu'
import { save } from '@tauri-apps/plugin-dialog'
import { remove, writeFile } from '@tauri-apps/plugin-fs'
import { Command, open } from '@tauri-apps/plugin-shell'

function PromptTextBlock({
    label,
    value,
    className,
    onCopy,
    onApply,
    applyLabel,
}: {
    label: string
    value: string
    className?: string
    onCopy: (value: string, label: string) => void
    onApply?: () => void
    applyLabel?: string
}) {
    const textRef = useRef<HTMLDivElement>(null)
    const [copied, setCopied] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const isLongText = value.length > 240 || value.includes('\n')

    const handleSelectAll = () => {
        const selection = window.getSelection()
        const range = document.createRange()
        if (!selection || !textRef.current) return

        range.selectNodeContents(textRef.current)
        selection.removeAllRanges()
        selection.addRange(range)
    }

    return (
        <div className={`space-y-2 rounded-2xl border p-3 ${className ?? ''}`}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{label}</span>
                <div className="flex items-center gap-2">
                    {onApply && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-white/70 hover:text-white hover:bg-white/10" onClick={onApply}>
                            {applyLabel}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => {
                            onCopy(value, label)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 1200)
                        }}
                    >
                        {copied ? '已复制' : '复制'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-white/70 hover:text-white hover:bg-white/10" onClick={handleSelectAll}>
                        全选
                    </Button>
                </div>
            </div>
            <div
                ref={textRef}
                className={`font-mono text-xs leading-relaxed text-white/80 whitespace-pre-wrap break-words ${expanded ? '' : 'max-h-24 overflow-hidden'}`}
            >
                {value}
            </div>
            {isLongText && (
                <Button size="sm" variant="ghost" className="h-7 px-0 text-[11px] text-white/55 hover:text-white hover:bg-transparent justify-start" onClick={() => setExpanded((prev) => !prev)}>
                    {expanded ? '收起' : '展开'}
                </Button>
            )}
        </div>
    )
}

interface GalleryViewerProps {
    item: GalleryItemType | null
    onClose: () => void
    onPrevious?: () => void
    onNext?: () => void
    hasPrevious?: boolean
    hasNext?: boolean
}

export function GalleryViewer({ item, onClose, onPrevious, onNext, hasPrevious = false, hasNext = false }: GalleryViewerProps) {
    const { t } = useTranslation()
    const removeGalleryItem = useGalleryStore((state) => state.removeGalleryItem)
    const [metadata, setMetadata] = useState<NAIMetadata | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [imageSrc, setImageSrc] = useState('')
    const [showInfo, setShowInfo] = useState(true)
    const [imageLoadError, setImageLoadError] = useState(false)

    useEffect(() => {
        if (!item) {
            setMetadata(null)
            setImageSrc('')
            setImageLoadError(false)
            return
        }

        setImageSrc(item.url)
        setImageLoadError(false)

        const loadMetadata = async () => {
            setIsLoading(true)
            try {
                const buffer = await getFileBuffer(item.url, item.path)
                const meta = await parseNAIMetadata(buffer)
                setMetadata(meta)
            } catch (error) {
                console.error('Failed to load metadata', error)
                setMetadata(null)
            } finally {
                setIsLoading(false)
            }
        }

        void loadMetadata()
    }, [item])

    const getFileBuffer = async (url: string, path: string): Promise<ArrayBuffer> => {
        try {
            const response = await fetch(url)
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)
            return await response.arrayBuffer()
        } catch (error) {
            console.log('Fetch failed, trying backend read:', path, error)
            const { invoke } = await import('@tauri-apps/api/core')
            const base64 = await invoke<string>('read_image_base64', { path })
            const binaryString = atob(base64)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }
            return bytes.buffer
        }
    }

    const handleImageError = async () => {
        if (!item || imageLoadError) return

        try {
            const { invoke } = await import('@tauri-apps/api/core')
            const base64 = await invoke<string>('read_image_base64', { path: item.path })
            const ext = item.path.split('.').pop()?.toLowerCase() || 'png'
            let mime = 'image/png'
            if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg'
            if (ext === 'webp') mime = 'image/webp'
            setImageSrc(`data:${mime};base64,${base64}`)
            setImageLoadError(true)
        } catch (error) {
            console.error('Fallback image load failed:', error)
            setImageLoadError(true)
        }
    }

    const copyText = async (text: string, successTitle: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast({ title: successTitle })
        } catch (error) {
            console.error(error)
            toast({ title: t('actions.copyFailed', 'Copy failed'), variant: 'destructive' })
        }
    }

    const handleCopyPromptText = (text: string, label: string) => {
        void copyText(text, `${label} 已复制`)
    }

    const handleCopySeed = () => {
        if (metadata?.seed === undefined || metadata.seed === null) return
        void copyText(String(metadata.seed), 'Seed 已复制')
    }

    const handleCopyParam = (label: string, value: unknown) => {
        if (value === undefined || value === null) return
        void copyText(String(value), `${label} 已复制`)
    }

    const handleUsePrompt = () => {
        if (!metadata?.prompt) return
        useGenerationStore.getState().setPrompt(metadata.prompt)
        toast({ title: t('gallery.promptApplied', '提示词已应用') })
    }

    const handleUseNegativePrompt = () => {
        const negativePrompt = metadata?.v4_negative_prompt?.caption?.base_caption || metadata?.negativePrompt
        if (!negativePrompt) return
        useGenerationStore.getState().setNegativePrompt(negativePrompt)
        toast({ title: '负面提示词已应用' })
    }

    const handleApplyMetadata = () => {
        if (!metadata) return

        const genStore = useGenerationStore.getState()
        if (metadata.prompt) genStore.setPrompt(metadata.prompt)
        if (metadata.negativePrompt || metadata.v4_negative_prompt?.caption?.base_caption) {
            genStore.setNegativePrompt(metadata.v4_negative_prompt?.caption?.base_caption || metadata.negativePrompt || '')
        }
        if (metadata.steps) genStore.setSteps(metadata.steps)
        if (metadata.cfgScale) genStore.setCfgScale(metadata.cfgScale)
        if (metadata.seed) genStore.setSeed(metadata.seed)
        if (metadata.model) genStore.setModel(metadata.model)
        if (metadata.width && metadata.height) genStore.setDimensions(metadata.width, metadata.height)

        toast({ title: t('gallery.regenerateApplied', 'Parameters applied') })
    }

    const handleRegenerate = () => {
        handleApplyMetadata()
        setTimeout(() => {
            void useGenerationStore.getState().generate()
        }, 50)
        onClose()
    }

    const handleSendToImg2Img = () => {
        if (!item) return
        useGenerationStore.getState().setSourceImage(item.url)
        toast({ title: t('gallery.sentToImg2Img', '已发送到 图生图') })
        onClose()
    }

    const handleSendToVibe = async () => {
        if (!item) return

        try {
            const buffer = await getFileBuffer(item.url, item.path)
            const bytes = new Uint8Array(buffer)
            let binary = ''
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i])
            }
            const base64 = btoa(binary)
            const ext = item.path.split('.').pop()?.toLowerCase() || 'png'
            let mime = 'image/png'
            if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg'
            if (ext === 'webp') mime = 'image/webp'

            void useCharacterStore.getState().addVibeImage(`data:${mime};base64,${base64}`)
            toast({ title: t('gallery.sentToVibe', '已发送到 Vibe Transfer') })
            onClose()
        } catch (error) {
            console.error(error)
            toast({ title: t('gallery.loadError', '读取图片失败'), variant: 'destructive' })
        }
    }

    const handleSaveAs = async () => {
        if (!item) return

        try {
            const ext = item.path.split('.').pop()?.toLowerCase() || 'png'
            const filePath = await save({
                defaultPath: item.name || `image_${Date.now()}.${ext}`,
                filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
            })

            if (!filePath) return

            const response = await fetch(imageSrc || item.url)
            const blob = await response.blob()
            const arrayBuffer = await blob.arrayBuffer()
            await writeFile(filePath, new Uint8Array(arrayBuffer))
            toast({ title: t('actions.saved', 'Saved successfully') })
        } catch (error) {
            console.error(error)
            toast({ title: t('actions.saveFailed', 'Save failed'), variant: 'destructive' })
        }
    }

    const handleCopy = async () => {
        if (!item) return

        try {
            const response = await fetch(imageSrc || item.url)
            const blob = await response.blob()
            const clipboardItem = new ClipboardItem({ [blob.type]: blob })
            await navigator.clipboard.write([clipboardItem])
            toast({ title: t('actions.copied', 'Copied to clipboard') })
        } catch (error) {
            console.error(error)
            toast({ title: t('actions.copyFailed', 'Copy failed'), variant: 'destructive' })
        }
    }

    const handleOpenFolder = async () => {
        if (!item) return

        try {
            const sep = item.path.includes('\\') ? '\\' : '/'
            const dir = item.path.substring(0, item.path.lastIndexOf(sep))
            try {
                const command = Command.create('explorer', [dir])
                await command.spawn()
            } catch (error) {
                console.warn('Explorer command failed, trying open:', error)
                await open(dir)
            }
        } catch (error) {
            toast({ title: 'Open folder failed', description: String(error), variant: 'destructive' })
        }
    }

    const handleDelete = async () => {
        if (!item) return

        try {
            await remove(item.path)
            removeGalleryItem(item.path)
            toast({ title: t('actions.deleted', 'Deleted') })
            onClose()
        } catch (error) {
            console.error(error)
            toast({ title: 'Delete failed', description: String(error), variant: 'destructive' })
        }
    }

    if (!item) return null

    const negativePrompt = metadata?.v4_negative_prompt?.caption?.base_caption || metadata?.negativePrompt || 'None'

    return (
        <Dialog open={!!item} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent hideClose className="max-w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden bg-background/95 border-none shadow-2xl flex flex-row dark:bg-[#05060a]">
                <DialogTitle className="sr-only">Image Gallery</DialogTitle>
                <DialogDescription className="sr-only">Image Preview</DialogDescription>
                <ContextMenu>
                    <ContextMenuTrigger className="flex flex-1">
                        <div className="flex-1 bg-black/60 relative flex items-center justify-center p-4">
                            <img
                                src={imageSrc || item.url}
                                alt={item.name}
                                decoding="async"
                                onError={handleImageError}
                                className="max-w-full max-h-full object-contain shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl"
                            />
                            {metadata && (
                                <ImageInfoOverlay width={metadata.width ?? 0} height={metadata.height ?? 0} seed={metadata.seed ?? -1} />
                            )}

                            {hasPrevious && onPrevious && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black/30 hover:bg-[#0e0f12] text-white transition-all z-10 border border-white/10 shadow-lg"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPrevious()
                                    }}
                                >
                                    <ChevronLeft className="w-8 h-8 opacity-70" />
                                </Button>
                            )}

                            {hasNext && onNext && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black/30 hover:bg-[#0e0f12] text-white transition-all z-10 border border-white/10 shadow-lg"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onNext()
                                    }}
                                >
                                    <ChevronRight className="w-8 h-8 opacity-70" />
                                </Button>
                            )}

                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-4 right-4 text-white/50 hover:text-white hover:bg-red-500/20 rounded-full transition-colors"
                                onClick={onClose}
                            >
                                <X className="w-5 h-5" />
                            </Button>

                            {!showInfo && (
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="absolute bottom-6 right-6 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.5)] bg-black/35 hover:bg-[#0e0f12] text-white border border-white/10"
                                    onClick={() => setShowInfo(true)}
                                >
                                    <Info className="w-5 h-5" />
                                </Button>
                            )}
                        </div>

                        {showInfo && (
                            <div className="w-[380px] border-l border-white/8 bg-[#05060a] flex flex-col transition-all duration-300 shadow-[-8px_0_32px_rgba(0,0,0,0.5)]">
                                <div className="p-4 border-b border-white/8 flex items-center justify-between bg-[#08090d]">
                                    <h3 className="font-bold text-sm text-white tracking-wide uppercase">图片详情</h3>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors" onClick={() => setShowInfo(false)}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>

                                <ScrollArea className="flex-1 p-4">
                                    {!metadata && isLoading && (
                                        <div className="text-center py-10 text-white/50 text-sm">解析元数据中...</div>
                                    )}

                                    {metadata && (
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Button onClick={handleRegenerate} className="w-full flex gap-2 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-indigo-200 border border-indigo-500/30 shadow-inner transition-all" variant="outline">
                                                        <RefreshCw className="w-4 h-4" />
                                                        <span className="font-medium">重新生成</span>
                                                    </Button>
                                                    <Button onClick={handleUsePrompt} className="w-full flex gap-2 h-10 rounded-xl bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border border-white/10 shadow-sm transition-all" variant="outline">
                                                        <Copy className="w-4 h-4" />
                                                        <span className="font-medium">应用提示词</span>
                                                    </Button>
                                                </div>

                                                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 space-y-2">
                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/35 px-1">转换操作</div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Button onClick={handleSendToImg2Img} className="w-full flex gap-2 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10 transition-all border" variant="outline">
                                                            <ImageIcon className="w-4 h-4" />
                                                            <span className="font-medium">图生图</span>
                                                        </Button>
                                                        <Button onClick={handleSendToVibe} className="w-full flex gap-2 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10 transition-all border" variant="outline">
                                                            <Wand2 className="w-4 h-4" />
                                                            <span className="font-medium">Vibe Transfer</span>
                                                        </Button>
                                                    </div>
                                                </div>

                                                <Button onClick={handleDelete} className="w-full flex gap-2 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border-red-500/20 transition-all border" variant="outline">
                                                    <Trash2 className="w-4 h-4" />
                                                    <span className="font-medium">删除本地图片</span>
                                                </Button>
                                            </div>

                                            <PromptTextBlock label="Positive Prompt" value={metadata.prompt || 'None'} className="bg-black/40 border-white/5 text-white/80" onCopy={handleCopyPromptText} onApply={handleUsePrompt} applyLabel="应用正向" />
                                            <PromptTextBlock label="Negative Prompt" value={negativePrompt} className="bg-red-500/5 border-red-500/10 text-white/80 max-h-24" onCopy={handleCopyPromptText} onApply={handleUseNegativePrompt} applyLabel="应用负向" />

                                            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner">
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-white/40 font-medium">Seed</span>
                                                    <button type="button" onClick={handleCopySeed} className="font-mono text-white/80 hover:text-white transition-colors" title="复制 Seed">
                                                        {metadata.seed}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-white/40 font-medium">Steps</span>
                                                    <button type="button" onClick={() => handleCopyParam('Steps', metadata.steps)} className="font-mono text-white/80 hover:text-white transition-colors" title="复制 Steps">
                                                        {metadata.steps}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-white/40 font-medium">Scale</span>
                                                    <button type="button" onClick={() => handleCopyParam('Scale', metadata.cfgScale)} className="font-mono text-white/80 hover:text-white transition-colors" title="复制 Scale">
                                                        {metadata.cfgScale}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-white/40 font-medium">Sampler</span>
                                                    <button type="button" onClick={() => handleCopyParam('Sampler', metadata.sampler)} className="font-mono text-white/80 truncate max-w-[100px] hover:text-white transition-colors text-right" title={metadata.sampler ? `复制 Sampler: ${metadata.sampler}` : '复制 Sampler'}>
                                                        {metadata.sampler}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-white/40 font-medium">Size</span>
                                                    <button type="button" onClick={() => handleCopyParam('Size', `${metadata.width}x${metadata.height}`)} className="font-mono text-white/80 hover:text-white transition-colors" title="复制 Size">
                                                        {metadata.width}x{metadata.height}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-white/40 font-medium">Model</span>
                                                    <button type="button" onClick={() => handleCopyParam('Model', metadata.model)} className="font-mono text-white/80 truncate max-w-[100px] hover:text-white transition-colors text-right" title={metadata.model ? `复制 Model: ${metadata.model}` : '复制 Model'}>
                                                        {metadata.model}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!metadata && !isLoading && (
                                        <div className="text-center py-10 text-white/50 text-sm">该图片不包含 NovelAI 元数据或解析失败。</div>
                                    )}
                                </ScrollArea>
                            </div>
                        )}
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                        <ContextMenuItem onSelect={handleCopy}>
                            复制图片
                            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={handleSaveAs}>另存为...</ContextMenuItem>
                        <ContextMenuItem onSelect={handleOpenFolder}>打开所在目录</ContextMenuItem>
                        <ContextMenuSeparator />
                        {metadata && <ContextMenuItem onSelect={handleUsePrompt}>应用提示词</ContextMenuItem>}
                        {metadata && <ContextMenuItem onSelect={handleRegenerate}>重新生成</ContextMenuItem>}
                        <ContextMenuItem onSelect={handleSendToImg2Img}>发送到图生图</ContextMenuItem>
                        <ContextMenuItem onSelect={handleSendToVibe}>发送到 Vibe Transfer</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={handleDelete} className="text-red-400 focus:text-red-300">删除本地图片</ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>
            </DialogContent>
        </Dialog>
    )
}
