import { lazy, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eraser, Maximize2, Grid3X3, Paintbrush, ImageIcon, ChevronRight, X, Download, Plus } from 'lucide-react'
import { useToolsStore } from '@/stores/tools-store'
import { useAuthStore } from '@/stores/auth-store'
import { useGenerationStore } from '@/stores/generation-store'
import { smartTools, TagResult } from '@/services/smart-tools'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'

import { MobileToolsHeader } from './tools/MobileToolsHeader'
import { MobileAnalysisPanel } from './tools/MobileAnalysisPanel'
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary'

const MosaicDialog = lazy(() => import('@/components/molecules/MosaicDialog').then((module) => ({ default: module.MosaicDialog })))

// Helper to convert Uint8Array to base64 safely avoiding call stack limits
function uint8ArrayToBase64(bytes: Uint8Array) {
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    return window.btoa(binary);
}

export function MobileToolsPanel() {
    const { t } = useTranslation()
    const { toast } = useToast()
    const { activeImage, setActiveImage, isProcessing, setIsProcessing, processedImage, setProcessedImage } = useToolsStore()
    const { token } = useAuthStore()
    
    // Mosaic State
    const [mosaicOpen, setMosaicOpen] = useState(false)

    // Analyzed Tags State
    const [analyzedTags, setAnalyzedTags] = useState<TagResult[]>([])
    const [statusMessage, setStatusMessage] = useState('')

    const handleSelectImage = async () => {
        if (isProcessing) return;
        try {
            const selected = await openDialog({
                multiple: false,
                filters: [{ name: 'Images', extensions: ['png', 'jpeg', 'jpg', 'webp', 'bmp', 'gif'] }]
            });
            if (!selected || typeof selected !== 'string') return;
            
            setStatusMessage(t('smartTools.processing', 'Loading Image...'));
            setIsProcessing(true);
            
            const bytes = await readFile(selected);
            const base64 = uint8ArrayToBase64(bytes);
            
            const ext = selected.split('.').pop()?.toLowerCase();
            let mime = 'image/jpeg';
            if (ext === 'png') mime = 'image/png';
            if (ext === 'webp') mime = 'image/webp';
            if (ext === 'gif') mime = 'image/gif';
            if (ext === 'bmp') mime = 'image/bmp';
            
            setActiveImage(`data:${mime};base64,${base64}`);
            setProcessedImage(null);
            setAnalyzedTags([]);
        } catch (e) {
            toast({ title: t('smartTools.error', 'Failed to read file'), description: String(e), variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    }

    const handleClearImage = () => {
        if (isProcessing) return;
        setActiveImage(null);
        setProcessedImage(null);
        setAnalyzedTags([]);
    }

    const handleDownload = () => {
        if (processedImage) {
            const a = document.createElement('a')
            a.href = processedImage
            a.download = `NAI_Tool_${Date.now()}.png`
            a.click()
        }
    }

    // Tools Handlers Map
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
             const tags = await smartTools.analyzeStyle(activeImage)
             const filteredTags = tags.filter(t => t.score > 0.1).slice(0, 20)
             
             if (filteredTags.length === 0) {
                 toast({ title: t('smartTools.noResult', 'No matching style found'), duration: 3000 })
                 return
             }
             setAnalyzedTags(filteredTags)
             const tagString = filteredTags.map(t => t.label).join(', ')
             await navigator.clipboard.writeText(tagString)
             toast({ title: t('smartTools.analysisSuccess', 'Styles found & copied!'), duration: 3000 })
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
        const { setPendingTagsToAppend } = useGenerationStore.getState()
        setPendingTagsToAppend(tagString)
        toast({ title: t('smartTools.appliedToPrompt', 'Tags applied to subject!'), duration: 2000 })
    }

    const currentImage = processedImage || activeImage

    return (
        <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-[#000000] overflow-hidden relative">
             {/* Header */}
             <MobileToolsHeader />

             {/* Content */}
             <ScrollArea className="flex-1 overflow-x-hidden">
                <div className="px-4 pb-32 space-y-6 pt-4 w-full max-w-full">
                    
                    {/* Workspace Area: Sleek iOS Card */}
                    <div className="w-full bg-white dark:bg-[#1c1c1e] rounded-[1.25rem] shadow-sm overflow-hidden relative">
                        {!currentImage ? (
                            <div 
                                onClick={handleSelectImage}
                                className="h-44 flex flex-col items-center justify-center gap-3 cursor-pointer active:bg-slate-50 dark:active:bg-white/5 transition-colors"
                            >
                                <div className="p-4 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
                                    <ImageIcon strokeWidth={2} className="w-8 h-8" />
                                </div>
                                <span className="text-sm font-semibold text-slate-600 dark:text-white/70 tracking-wide">
                                    {t('smartTools.openImage', 'Select Photo')}
                                </span>
                            </div>
                        ) : (
                            <div className="relative w-full">
                                {/* Image Display */}
                                <div className="relative w-full bg-[#f2f2f7]/50 dark:bg-[#000000]/50 flex items-center justify-center overflow-hidden min-h-[16rem] max-h-[50vh] p-4">
                                    <img 
                                        src={currentImage} 
                                        className="relative z-10 max-w-full max-h-full object-contain rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10" 
                                        alt="Workspace" 
                                    />
                                    
                                    {/* Edit Status Overlay */}
                                    {isProcessing && (
                                        <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center">
                                            <div className="mb-3">
                                                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                            </div>
                                            <span className="text-white/90 font-medium text-sm tracking-widest uppercase">{statusMessage || t('smartTools.processing', 'Processing...')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Floating Action Pill */}
                                {!isProcessing && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/98 dark:bg-zinc-900/98 border border-slate-200/50 dark:border-white/10 py-1.5 px-2 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-30">
                                        <button 
                                            onClick={handleSelectImage}
                                            className="h-9 px-3 flex items-center gap-2 rounded-full text-slate-700 dark:text-white/90 active:bg-slate-100 dark:active:bg-white/10 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span className="text-xs font-bold">{t('common.replace', 'Replace')}</span>
                                        </button>
                                        <div className="w-px h-4 bg-slate-300 dark:bg-white/20 mx-1" />
                                        {processedImage && (
                                            <>
                                                <button 
                                                    onClick={handleDownload}
                                                    className="h-9 px-3 flex items-center gap-2 rounded-full text-blue-600 dark:text-blue-400 active:bg-blue-50 dark:active:bg-blue-500/10 transition-colors font-bold"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    <span className="text-xs">{t('common.save', 'Save')}</span>
                                                </button>
                                                <div className="w-px h-4 bg-slate-300 dark:bg-white/20 mx-1" />
                                            </>
                                        )}
                                        <button 
                                            onClick={handleClearImage}
                                            className="h-9 w-9 flex items-center justify-center rounded-full text-rose-500 dark:text-rose-400 active:bg-rose-50 dark:active:bg-rose-500/10 transition-colors"
                                        >
                                            <X className="w-4 h-4" strokeWidth={2.5} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Spacer for floating pill */}
                    {currentImage && <div className="h-2" />}

                    {/* Action Center: iOS Inset Grouped Section */}
                    <div className="w-full">
                        <h3 className="uppercase text-[0.68rem] tracking-wider font-semibold text-slate-500 dark:text-white/40 mb-2 pl-4">
                            {t('smartTools.actionCenter', 'Action Center')}
                        </h3>
                        <div className="bg-white dark:bg-[#1c1c1e] rounded-[1.25rem] overflow-hidden shadow-sm">
                            
                            {/* Canvas Row */}
                            <button 
                                onClick={() => window.dispatchEvent(new CustomEvent('navigate-mobile', { detail: 'canvas' }))}
                                className="w-full h-16 flex items-center gap-4 pl-4 pr-3 text-left active:bg-slate-100 dark:active:bg-[#2c2c2e] transition-colors relative"
                            >
                                <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] bg-blue-500/10 text-blue-500">
                                    <Paintbrush className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center translate-y-[-1px]">
                                    <div className="font-[500] text-[17px] tracking-tight text-slate-900 dark:text-white truncate leading-tight mb-0.5">{t('tabs.canvas', 'Canvas')}</div>
                                    <div className="text-[13px] text-slate-500 dark:text-white/50 truncate tracking-tight leading-tight">{t('workbench.canvasSubtitle', 'Img2Img & Inpainting Editor')}</div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 dark:text-[#3a3a3c] shrink-0" />
                                {/* Bottom separator */}
                                <div className="absolute bottom-0 left-[3.5rem] right-0 h-[0.5px] bg-slate-200 dark:bg-[#38383a] pointer-events-none" />
                            </button>

                            {/* Upscale Row */}
                            <button 
                                onClick={handleUpscale}
                                disabled={!activeImage || isProcessing}
                                className="w-full h-16 flex items-center gap-4 pl-4 pr-3 text-left active:bg-slate-100 dark:active:bg-[#2c2c2e] transition-colors disabled:opacity-40 disabled:active:bg-transparent relative"
                            >
                                <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] bg-purple-500/10 text-purple-500">
                                    <Maximize2 className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center translate-y-[-1px]">
                                    <div className="font-[500] text-[17px] tracking-tight text-slate-900 dark:text-white truncate leading-tight mb-0.5">{t('smartTools.upscale', '4x Upscale')}</div>
                                    <div className="text-[13px] text-slate-500 dark:text-white/50 truncate tracking-tight leading-tight">Super Resolution</div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 dark:text-[#3a3a3c] shrink-0" />
                                {/* Bottom separator */}
                                <div className="absolute bottom-0 left-[3.5rem] right-0 h-[0.5px] bg-slate-200 dark:bg-[#38383a] pointer-events-none" />
                            </button>

                            {/* Remove BG Row */}
                            <button 
                                onClick={handleRemoveBackground}
                                disabled={!activeImage || isProcessing}
                                className="w-full h-16 flex items-center gap-4 pl-4 pr-3 text-left active:bg-slate-100 dark:active:bg-[#2c2c2e] transition-colors disabled:opacity-40 disabled:active:bg-transparent relative"
                            >
                                <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] bg-rose-500/10 text-rose-500">
                                    <Eraser className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center translate-y-[-1px]">
                                    <div className="font-[500] text-[17px] tracking-tight text-slate-900 dark:text-white truncate leading-tight mb-0.5">{t('smartTools.rembg', 'Remove BG')}</div>
                                    <div className="text-[13px] text-slate-500 dark:text-white/50 truncate tracking-tight leading-tight">AI Extraction</div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 dark:text-[#3a3a3c] shrink-0" />
                                {/* Bottom separator */}
                                <div className="absolute bottom-0 left-[3.5rem] right-0 h-[0.5px] bg-slate-200 dark:bg-[#38383a] pointer-events-none" />
                            </button>

                            {/* Mosaic Row */}
                            <button 
                                onClick={() => setMosaicOpen(true)}
                                disabled={!activeImage || isProcessing}
                                className="w-full h-16 flex items-center gap-4 pl-4 pr-3 text-left active:bg-slate-100 dark:active:bg-[#2c2c2e] transition-colors disabled:opacity-40 disabled:active:bg-transparent"
                            >
                                <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] bg-amber-500/10 text-amber-500">
                                    <Grid3X3 className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center translate-y-[-1px]">
                                    <div className="font-[500] text-[17px] tracking-tight text-slate-900 dark:text-white truncate leading-tight mb-0.5">{t('smartTools.mosaic', 'Mosaic')}</div>
                                    <div className="text-[13px] text-slate-500 dark:text-white/50 truncate tracking-tight leading-tight">Pixelate & Blur</div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 dark:text-[#3a3a3c] shrink-0" />
                            </button>

                        </div>
                    </div>

                    <MobileAnalysisPanel 
                        activeImage={activeImage}
                        isProcessing={isProcessing}
                        analyzedTags={analyzedTags}
                        onAnalyze={handleAnalyze}
                        onCopyAll={handleCopyTags}
                        onApplyToPrompt={handleApplyToPrompt}
                    />

                    {/* Bottom padding for tab bar safety */}
                    <div className="h-6" />
                </div>
            </ScrollArea>

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

