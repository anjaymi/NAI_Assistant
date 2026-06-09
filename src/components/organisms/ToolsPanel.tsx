
import { lazy, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Eraser, Wand2, Upload, RefreshCw, Download, X, Maximize2, Grid3X3, Tags, PenTool, Copy, Plus } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { useToolsStore } from '@/stores/tools-store'
import { useAuthStore } from '@/stores/auth-store'
import { useArtistStore } from '@/stores/artist-store'
import { useGenerationStore } from '@/stores/generation-store'
import { smartTools, TagResult } from '@/services/smart-tools'
import { ToolCard } from '@/components/molecules/ToolCard'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { Badge } from '@/components/atoms/Badge'
import { processDroppedImageFile, applyMetadataToStore, type ImageDropError } from '@/lib/image-drop-utils'
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary'

const MosaicDialog = lazy(() => import('@/components/molecules/MosaicDialog').then((module) => ({ default: module.MosaicDialog })))

export function ToolsPanel() {
    const { t } = useTranslation()
    const { toast } = useToast()
    const { activeImage, setActiveImage, isProcessing, setIsProcessing, processedImage, setProcessedImage } = useToolsStore()
    const { token } = useAuthStore()
    
    // Mosaic State
    const [mosaicOpen, setMosaicOpen] = useState(false)

    // Analyzed Tags State
    const [analyzedTags, setAnalyzedTags] = useState<TagResult[]>([])

    // ... (rest of local state)
    const [statusMessage, setStatusMessage] = useState('')

    // Drag & Drop
    const [isDragOver, setIsDragOver] = useState(false)
    const dragCounter = useRef(0)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
                setActiveImage(e.target?.result as string)
            }
            reader.readAsDataURL(file)
        }
        e.target.value = '' // Reset input to allow selecting same file again
    }

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

        // 简单模式：ToolsPanel 不强制 64 倍数，直接加载图片
        // 但如果是 NAI 图片仍然尝试解析元数据并提示
        if (!file.type.startsWith('image/')) return

        const reader = new FileReader()
        reader.onload = (ev) => setActiveImage(ev.target?.result as string)
        reader.readAsDataURL(file)

        // 异步尝试解析 NAI 元数据（仅 PNG）
        if (file.type === 'image/png') {
            try {
                const result = await processDroppedImageFile(file)
                if (result.metadata) {
                    toast({
                        title: '💡 检测到 NAI 元数据',
                        description: '可在图生图面板拖入以自动加载参数',
                        duration: 4000,
                    })
                }
            } catch (err) {
                console.warn('[ToolsPanel] 解析图片失败:', err)
            }
        }
    }

    // Actions
    const handleUpscale = async () => {
        if (!activeImage || !token) {
             toast({ title: t('toast.tokenRequired.title', 'Token Required'), variant: 'destructive' })
             return
        }
        setIsProcessing(true)
        setStatusMessage(t('smartTools.processing', 'Processing...'))
        try {
            const result = await smartTools.upscale(token, activeImage)
            setProcessedImage(result)
            toast({ title: t('smartTools.upscaleComplete', 'Upscale Complete'), duration: 2000 })
        } catch (e) {
            toast({ title: t('smartTools.error', 'Failed'), description: String(e), variant: 'destructive' })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleRemoveBackground = async () => {
        if (!activeImage) return
        setIsProcessing(true)
        setStatusMessage(t('smartTools.processing', 'Processing...'))
        try {
            const result = await smartTools.removeBackground(activeImage)
            setProcessedImage(result)
            toast({ title: t('smartTools.complete', 'Complete'), duration: 2000 })
        } catch (e) {
            toast({ title: t('smartTools.error', 'Failed'), description: String(e), variant: 'destructive' })
        } finally {
            setIsProcessing(false)
        }
    }
    
    const handleAnalyze = async () => {
        if (!activeImage) return
         setIsProcessing(true)
         setStatusMessage('Analyzing...')
         try {
             // Analyze style
             const tags = await smartTools.analyzeStyle(activeImage)
             
             // Filter (confidence > 10%) and keep full tag objects
             const filteredTags = tags
                .filter(t => t.score > 0.1)
                .slice(0, 20) // Keep more for display
             
             if (filteredTags.length === 0) {
                 toast({ title: t('smartTools.noResult', 'No matching style found'), duration: 3000 })
                 return
             }

             // Save to state for display
             setAnalyzedTags(filteredTags)

             const tagString = filteredTags.map(t => t.label).join(', ')
             
             // Copy to clipboard
             await navigator.clipboard.writeText(tagString)
             
             toast({ 
                 title: t('smartTools.analysisSuccess', 'Styles found & copied!'), 
                 duration: 3000 
             })
         } catch(e) {
             toast({ title: t('smartTools.analysisFailed', 'Analysis Failed'), description: String(e), variant: 'destructive' })
         } finally {
             setIsProcessing(false)
         }
    }

    const handleCopyTags = async () => {
        const tagString = analyzedTags.map(t => t.label).join(', ')
        await navigator.clipboard.writeText(tagString)
        toast({ title: 'Copied!', duration: 2000 })
    }

    const handleApplyToPrompt = () => {
        const tagString = analyzedTags.map(t => t.label).join(', ')
        // Use pendingTagsToAppend to notify PromptArea to append to basePrompt (subject field)
        const { setPendingTagsToAppend } = useGenerationStore.getState()
        setPendingTagsToAppend(tagString)
        toast({ title: t('smartTools.appliedToPrompt', 'Tags applied to subject!'), duration: 2000 })
    }

    const currentImage = processedImage || activeImage

    return (
        <div className="flex flex-1 gap-6 h-full p-6 overflow-hidden bg-slate-50/50 dark:bg-transparent" 
             onDragEnter={handleDragEnter} 
             onDragOver={(e) => e.preventDefault()}
             onDragLeave={handleDragLeave} 
             onDrop={handleDrop}>
            
            {/* Left: Workspace */}
            <div className="flex-1 relative bg-white/60 dark:bg-black/40 rounded-[2rem] border border-black/5 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center shadow-sm dark:shadow-2xl backdrop-blur-xl transition-all">
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
                {currentImage ? (
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                        <img src={currentImage} className="max-w-full max-h-full object-contain shadow-md rounded-md" alt="Workspace" />
                        
                        {/* Overlay Actions */}
                        <div className="absolute bottom-8 flex gap-3">
                             <Button variant="secondary" size="sm" className="h-9 px-4 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-3xl bg-white/80 dark:bg-black/40 border border-black/10 dark:border-white/10 text-slate-800 dark:text-white hover:bg-white dark:hover:bg-white/10" onClick={() => setActiveImage(null)}>
                                <X className="h-4 w-4 mr-2" /> {t('common.clear', 'Clear')}
                             </Button>
                             {processedImage && (
                                 <Button variant="default" size="sm" className="h-9 px-4 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30" onClick={() => {
                                     const a = document.createElement('a')
                                     a.href = processedImage
                                     a.download = `NAI_Tool_${Date.now()}.png`
                                     a.click()
                                 }}>
                                    <Download className="h-4 w-4 mr-2" /> {t('common.save', 'Save')}
                                 </Button>
                             )}
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-8 text-center text-slate-400 dark:text-white/30 border-2 border-dashed border-black/10 dark:border-white/10 rounded-[2rem] hover:border-black/20 dark:hover:border-white/20 hover:bg-black/[0.02] dark:hover:bg-white/5 transition-all pointer-events-none z-10 flex flex-col items-center justify-center">
                        <div className="w-24 h-24 rounded-3xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-8 shadow-inner border border-black/5 dark:border-white/5">
                            <Upload className="h-12 w-12 opacity-50" />
                        </div>
                        <p className="text-2xl font-black tracking-widest uppercase mb-3 text-slate-500/80 dark:text-white/50">{t('smartTools.dropHint', 'Drop image here')}</p>
                        <p className="text-sm opacity-60 mb-10 font-bold tracking-widest text-slate-400 dark:text-white">{t('smartTools.supportedFormats', 'JPG, PNG, WEBP')}</p>
                        <Button variant="outline" className="pointer-events-auto absolute bottom-12 h-12 px-8 rounded-2xl bg-white shadow-sm hover:shadow-md dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-white text-base transition-all">
                             {t('smartTools.openImage', 'Open Image')}
                             <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleFileChange} />
                        </Button>
                    </div>
                )}
                
                {/* Loading Point */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center z-10">
                        <div className="bg-white/80 dark:bg-black/40 p-6 rounded-3xl border border-black/10 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col items-center gap-4">
                            <RefreshCw className="h-10 w-10 animate-spin text-indigo-500 dark:text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                            <p className="text-sm font-bold tracking-wide text-slate-800 dark:text-white/80 uppercase">{statusMessage}</p>
                        </div>
                    </div>
                )}

                {/* Drag Overlay */}
                {isDragOver && (
                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm border-2 border-primary border-dashed flex items-center justify-center z-50 rounded-xl m-2">
                        <p className="text-2xl font-bold text-primary">{t('smartTools.dropToLoad', 'Droooooooooop!')}</p>
                    </div>
                )}
            </div>

            {/* Right: Tools */}
            <div className="w-[360px] flex flex-col gap-5">
                <div className="p-5 bg-white shadow-sm dark:bg-black/40 backdrop-blur-3xl rounded-[2rem] border border-black/5 dark:border-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <h2 className="font-black flex items-center gap-3 text-base text-slate-900 dark:text-white uppercase tracking-widest pl-1">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-inner">
                            <Wand2 className="h-4 w-4" />
                        </div>
                        {t('smartTools.title', 'Smart Tools')}
                    </h2>
                </div>
                
                <ScrollArea className="flex-1 pr-3 custom-scrollbar hidden-scrollbar-thumb">
                    <div className="space-y-4 pb-12">
                        {/* Quick Actions Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <ToolCard 
                                title={t('smartTools.upscale', '4x Upscale')} 
                                description="Super Resolution"
                                icon={Maximize2} 
                                color="bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400"
                                disabled={!activeImage || isProcessing}
                            >
                                 <Button className="w-full h-9 rounded-xl shadow-sm transition-all text-xs font-semibold bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 hover:text-slate-900" variant="secondary" onClick={handleUpscale} disabled={!activeImage || isProcessing}>
                                    {t('smartTools.startUpscale', 'Start')}
                                 </Button>
                            </ToolCard>

                            <ToolCard 
                                title={t('smartTools.rembg', 'Remove BG')} 
                                description="AI Extraction"
                                icon={Eraser} 
                                color="bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                                disabled={!activeImage || isProcessing}
                            >
                                 <Button className="w-full h-9 rounded-xl shadow-sm transition-all text-xs font-semibold bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 hover:text-slate-900" variant="secondary" onClick={handleRemoveBackground} disabled={!activeImage || isProcessing}>
                                    {t('smartTools.runRembg', 'Start')}
                                 </Button>
                            </ToolCard>
                            
                            <ToolCard 
                                title={t('smartTools.mosaic', 'Mosaic')} 
                                description="Pixelate & Blur"
                                icon={Grid3X3} 
                                color="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                disabled={!activeImage || isProcessing}
                                className="col-span-2"
                            >
                                 <Button className="w-full h-10 rounded-xl shadow-sm transition-all text-sm font-semibold bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 hover:text-slate-900" variant="secondary" onClick={() => setMosaicOpen(true)} disabled={!activeImage || isProcessing}>
                                    {t('smartTools.openMosaic', 'Open Editor')}
                                 </Button>
                            </ToolCard>
                        </div>
                        
                        <ToolCard 
                            title={t('smartTools.styleAnalysis', "Style Analysis (Beta)")}
                            description={t('smartTools.styleAnalysisDesc', "Analyze image style/artist tags")}
                            icon={Tags} 
                            color="bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                            disabled={!activeImage || isProcessing}
                        >
                             <Button className="w-full h-10 rounded-xl shadow-sm transition-all text-sm font-semibold bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 hover:text-slate-900" variant="secondary" onClick={handleAnalyze} disabled={!activeImage || isProcessing}>
                                {t('smartTools.analyze', "Analyze Image")}
                             </Button>
                             
                             {/* Tag Display Panel */}
                             {analyzedTags.length > 0 && (
                                 <div className="mt-4 space-y-3">
                                     <ScrollArea className="h-32 rounded-2xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/40 p-3 shadow-inner">
                                         <div className="flex flex-wrap gap-1.5">
                                             {analyzedTags.map((tag, i) => (
                                                 <Badge key={i} variant="outline" className="text-xs bg-white dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-700 dark:text-white/80 px-2 py-0.5 rounded-lg font-mono">
                                                     {tag.label} <span className="text-[10px] opacity-40 ml-1.5">{tag.score.toFixed(2)}</span>
                                                 </Badge>
                                             ))}
                                         </div>
                                     </ScrollArea>
                                     <div className="flex gap-3">
                                         <Button variant="ghost" className="flex-1 h-9 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white border border-black/10 dark:border-white/10 font-medium transition-all" onClick={handleCopyTags}>
                                             <Copy className="h-3.5 w-3.5 mr-1.5" /> {t('common.copy', 'Copy')}
                                         </Button>
                                         <Button variant="default" className="flex-1 h-9 rounded-xl bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:shadow-[0_0_20px_rgba(99,102,241,0.6)] hover:bg-indigo-400 font-semibold transition-all" onClick={handleApplyToPrompt}>
                                             <Plus className="h-4 w-4 mr-1.5" /> {t('smartTools.apply', 'Apply')}
                                         </Button>
                                     </div>
                                 </div>
                             )}
                        </ToolCard>

                        <ToolCard 
                            title={t('smartTools.galleryItem', "Artist Library")}
                            description={t('smartTools.galleryItemDesc', "Browse and analyze artist styles for prompt engineering.")}
                            icon={PenTool} 
                            color="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        >
                             <Button className="w-full h-10 rounded-xl shadow-sm transition-all text-sm font-semibold bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 hover:text-slate-900" variant="secondary" onClick={() => useArtistStore.getState().setIsOpen(true)}>
                                {t('smartTools.openLibrary', "Open Library")}
                             </Button>
                        </ToolCard>
                    </div>
                </ScrollArea>
            </div>

            {mosaicOpen && (
                <LazyModuleBoundary mode="overlay" label="Loading mosaic editor...">
                    <MosaicDialog 
                        sourceImage={activeImage} 
                        isOpen={mosaicOpen} 
                        onClose={() => setMosaicOpen(false)} 
                    />
                </LazyModuleBoundary>
            )}
        </div>
    )
}
