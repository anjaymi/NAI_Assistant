import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { GalleryItem as GalleryItemType, useGalleryStore } from '@/stores/gallery-store';
import { useGenerationStore } from '@/stores/generation-store';
import { NAIMetadata, parseNAIMetadata } from '@/lib/metadata-parser';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/atoms/Button';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { ScrollArea } from '@/components/atoms/ScrollArea';
import { X, ChevronLeft, ChevronRight, Info, Save, Copy, Trash2, FolderOpen, Wand2, Paintbrush, ImageIcon, Users, RefreshCw, MoreVertical } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { remove } from '@tauri-apps/plugin-fs';
import { Command, open } from '@tauri-apps/plugin-shell';
import { cn } from '@/lib/utils';
import { ImageInfoOverlay } from '@/components/molecules/ImageInfoOverlay';
import { shallow } from 'zustand/shallow';

interface MobileGalleryViewerProps {
    item: GalleryItemType | null;
    items: GalleryItemType[];
    onClose: () => void;
}

export function MobileGalleryViewer({ item: initialItem, items, onClose }: MobileGalleryViewerProps) {
    const { t } = useTranslation();
    const removeGalleryItem = useGalleryStore((state) => state.removeGalleryItem);
    
    const [currentItem, setCurrentItem] = useState<GalleryItemType | null>(initialItem);
    const [metadata, setMetadata] = useState<NAIMetadata | null>(null);
    const [isLoadingMeta, setIsLoadingMeta] = useState(false);
    const [imageSrc, setImageSrc] = useState<string>('');
    const [showBottomSheet, setShowBottomSheetState] = useState(false);
    const [showMetadataSheet, setShowMetadataSheetState] = useState(false);

    // Sync Bottom Sheet and Metadata Sheet with Location Hash for Physical Back Button
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash !== '#gallery-viewer-actions' && showBottomSheet) {
                setShowBottomSheetState(false);
            }
            if (hash !== '#gallery-viewer-metadata' && showMetadataSheet) {
                setShowMetadataSheetState(false);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [showBottomSheet, showMetadataSheet]);

    // Helpers to open and close sheets via Hash
    const setShowBottomSheet = (show: boolean) => {
        if (show) {
            window.location.hash = 'gallery-viewer-actions';
            setShowBottomSheetState(true);
        } else {
            if (window.location.hash === '#gallery-viewer-actions') {
                window.history.back();
            } else {
                setShowBottomSheetState(false);
            }
        }
    };

    const setShowMetadataSheet = (show: boolean) => {
        if (show) {
            window.location.hash = 'gallery-viewer-metadata';
            setShowMetadataSheetState(true);
        } else {
            if (window.location.hash === '#gallery-viewer-metadata') {
                window.history.back();
            } else {
                setShowMetadataSheetState(false);
            }
        }
    };

    // Calculate indices
    const currentIndex = currentItem ? items.findIndex(i => i.path === currentItem.path) : -1;
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex !== -1 && currentIndex < items.length - 1;

    // Helper: Buffer loader
    const getFileBuffer = async (url: string, path: string): Promise<ArrayBuffer> => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            return await response.arrayBuffer();
        } catch (e) {
            console.log('Fetch failed, trying backend read:', path);
            const { invoke } = await import('@tauri-apps/api/core');
            const base64 = await invoke<string>('read_image_base64', { path });
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        }
    };

    // Load Image & Metadata when currentItem changes
    useEffect(() => {
        if (!currentItem) return;
        setImageSrc(currentItem.url);

        const loadMetadata = async () => {
            setIsLoadingMeta(true);
            try {
                const buffer = await getFileBuffer(currentItem.url, currentItem.path);
                const meta = await parseNAIMetadata(buffer);
                setMetadata(meta);
            } catch (e) {
                console.error('Failed to load metadata', e);
            } finally {
                setIsLoadingMeta(false);
            }
        };

        loadMetadata();
    }, [currentItem]);

    // Navigation
    const goPrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (hasPrevious) setCurrentItem(items[currentIndex - 1]);
    };
    const goNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (hasNext) setCurrentItem(items[currentIndex + 1]);
    };

    // --- Actions ---
    const handleSaveAs = async () => {
        if (!currentItem) return;
        try {
            const defaultName = `image_${Date.now()}.png`;
            const filePath = await save({
                defaultPath: defaultName,
                filters: [{ name: 'Image', extensions: ['png', 'jpg', 'webp'] }]
            });

            if (!filePath) return;

            const response = await fetch(imageSrc);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            await writeFile(filePath, uint8Array);
            toast({ title: t('actions.saved', 'Saved successfully'), duration: 2000 });
            setShowBottomSheet(false);
        } catch (error) {
            console.error(error);
            toast({ title: t('actions.saveFailed', 'Save failed'), variant: "destructive" });
        }
    };

    const handleCopy = async () => {
        if (!currentItem) return;
        try {
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            const clipboardItem = new ClipboardItem({ [blob.type]: blob });
            await navigator.clipboard.write([clipboardItem]);
            toast({ title: t('actions.copied', 'Copied to clipboard'), duration: 2000 });
            setShowBottomSheet(false);
        } catch (error) {
            console.error(error);
            toast({ title: t('actions.copyFailed', 'Copy failed'), variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!currentItem) return;
        try {
            await remove(currentItem.path);
            removeGalleryItem(currentItem.path);
            toast({ title: t('actions.deleted', "Deleted") });
            setShowBottomSheet(false);
            onClose();
        } catch (e) {
            toast({ title: "Delete failed", description: String(e), variant: "destructive" });
        }
    };

    const handleOpenFolder = async () => {
        if (!currentItem) return;
        try {
            const sep = currentItem.path.includes('\\') ? '\\' : '/';
            const dir = currentItem.path.substring(0, currentItem.path.lastIndexOf(sep));
            try {
                const command = Command.create('explorer', [dir]);
                await command.spawn();
            } catch (cmdErr) {
                await open(dir);
            }
            setShowBottomSheet(false);
        } catch (e) {
            toast({ title: "Open folder failed", description: String(e), variant: "destructive" });
        }
    };

    const handleApplyMetadata = () => {
        if (!metadata) return;
        
        const genStore = useGenerationStore.getState();

        if (metadata.prompt) genStore.setPrompt(metadata.prompt);
        if (metadata.negativePrompt || metadata.v4_negative_prompt?.caption?.base_caption) {
            genStore.setNegativePrompt(
                metadata.v4_negative_prompt?.caption?.base_caption || metadata.negativePrompt || ''
            );
        }
        if (metadata.steps) genStore.setSteps(metadata.steps);
        if (metadata.cfgScale) genStore.setCfgScale(metadata.cfgScale);
        if (metadata.seed) genStore.setSeed(metadata.seed);
        if (metadata.model) genStore.setModel(metadata.model);
        if (metadata.width && metadata.height) genStore.setDimensions(metadata.width, metadata.height);

        toast({ title: t('gallery.regenerateApplied', 'Parameters applied') });
        setShowMetadataSheet(false);
        setShowBottomSheet(false);
    };

    const handleRegenerate = () => {
        handleApplyMetadata();
        setTimeout(() => {
            useGenerationStore.getState().generate();
        }, 50);
        onClose();
    };

    const handleSendToTool = (tool: 'img2img' | 'inpaint' | 'smart') => {
        if (!currentItem) return;
        const genStore = useGenerationStore.getState();
        genStore.setSourceImage(currentItem.url);
        
        if (tool === 'inpaint') {
             genStore.setMask(null);
        }
        
        toast({ title: t(`tools.sentTo${tool}`, `Sent to ${tool}`) });
        setShowBottomSheet(false);
        onClose(); 
        
        if (tool === 'img2img' || tool === 'inpaint') {
            window.dispatchEvent(new CustomEvent('navigate-mobile', { detail: 'canvas' }));
        } else if (tool === 'smart') {
            window.dispatchEvent(new CustomEvent('navigate-mobile', { detail: 'tools' }));
        }
    };

    if (!currentItem) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50, transition: { duration: 0.2 } }}
            className="fixed inset-0 z-[100] bg-black/98 flex flex-col"
        >
            {/* Top Toolbar */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent z-50 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-[#0e0f12] text-white border border-white/10" onClick={onClose}>
                    <X className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-[#0e0f12] text-white border border-white/10" onClick={() => setShowMetadataSheet(true)}>
                        <Info className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-[#0e0f12] text-white border border-white/10" onClick={() => setShowBottomSheet(true)}>
                        <MoreVertical className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Main Image Area with Gestures */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                <motion.img
                    layoutId={`gallery-item-${currentItem.path}`}
                    src={imageSrc}
                    alt={currentItem.name}
                    className="max-w-full max-h-full object-contain"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.8}
                    onDragEnd={(e, { offset, velocity }) => {
                        const swipe = offset.x + velocity.x * 0.2;
                        if (swipe < -50 && hasNext) goNext();
                        else if (swipe > 50 && hasPrevious) goPrev();
                    }}
                />

                {/* Left/Right Click zones */}
                <div className="absolute inset-y-0 left-0 w-1/4" onClick={goPrev} />
                <div className="absolute inset-y-0 right-0 w-1/4" onClick={goNext} />

                {/* Left/Right Overlays (visible on tap hint) */}
                {hasPrevious && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#0e0f12] flex items-center justify-center text-white/50 pointer-events-none border border-white/10">
                        <ChevronLeft className="w-6 h-6" />
                    </div>
                )}
                {hasNext && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#0e0f12] flex items-center justify-center text-white/50 pointer-events-none border border-white/10">
                        <ChevronRight className="w-6 h-6" />
                    </div>
                )}
            </div>

            {/* Bottom Sheet Actions */}
            <AnimatePresence>
                {showBottomSheet && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBottomSheet(false)} className="absolute inset-0 bg-black/60 z-[110]" />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 left-0 right-0 bg-[#05060a] rounded-t-[32px] border-t border-white/10 z-[120] pb-[env(safe-area-inset-bottom,0px)] px-6 pt-2">
                             <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3" />
                             
                             <div className="py-4 space-y-6">
                                {/* Row 1: Quick Send to Tools */}
                                <div>
                                    <h4 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Send To</h4>
                                    <div className="grid grid-cols-4 gap-3">
                                        <button onClick={handleRegenerate} className="flex flex-col items-center gap-2 group">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-active:scale-95 transition-transform"><RefreshCw className="w-5 h-5" /></div>
                                            <span className="text-[10px] text-white/60">Generate</span>
                                        </button>
                                        <button onClick={() => handleSendToTool('img2img')} className="flex flex-col items-center gap-2 group">
                                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-active:scale-95 transition-transform"><ImageIcon className="w-5 h-5" /></div>
                                            <span className="text-[10px] text-white/60">Img2Img</span>
                                        </button>
                                        <button onClick={() => handleSendToTool('inpaint')} className="flex flex-col items-center gap-2 group">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-active:scale-95 transition-transform"><Paintbrush className="w-5 h-5" /></div>
                                            <span className="text-[10px] text-white/60">Inpaint</span>
                                        </button>
                                        <button onClick={() => handleSendToTool('smart')} className="flex flex-col items-center gap-2 group">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-active:scale-95 transition-transform"><Wand2 className="w-5 h-5" /></div>
                                            <span className="text-[10px] text-white/60">Tools</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Row 2: File Actions */}
                                <div>
                                    <h4 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">{t('gallery.fileActions', 'File Actions')}</h4>
                                    <div className="flex flex-col gap-2">
                                        <Button variant="ghost" onClick={handleSaveAs} className="w-full justify-start h-12 bg-[#0e0f12] hover:bg-[#15171b] rounded-2xl text-white/80 border border-white/10"><Save className="w-4 h-4 mr-3 text-white/50" /> Save As...</Button>
                                        <Button variant="ghost" onClick={handleCopy} className="w-full justify-start h-12 bg-[#0e0f12] hover:bg-[#15171b] rounded-2xl text-white/80 border border-white/10"><Copy className="w-4 h-4 mr-3 text-white/50" /> Copy Image</Button>
                                        <Button variant="ghost" onClick={handleOpenFolder} className="w-full justify-start h-12 bg-[#0e0f12] hover:bg-[#15171b] rounded-2xl text-white/80 border border-white/10"><FolderOpen className="w-4 h-4 mr-3 text-white/50" /> Open Folder</Button>
                                        <Button variant="ghost" onClick={handleDelete} className="w-full justify-start h-12 bg-red-500/10 hover:bg-red-500/20 rounded-2xl text-red-400"><Trash2 className="w-4 h-4 mr-3" /> Delete</Button>
                                    </div>
                                </div>
                             </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Metadata Bottom Sheet */}
            <AnimatePresence>
                {showMetadataSheet && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMetadataSheet(false)} className="absolute inset-0 bg-black/60 z-[110]" />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 left-0 right-0 bg-[#05060a] rounded-t-[32px] border-t border-white/10 z-[120] pb-[env(safe-area-inset-bottom,0px)] px-6 pt-2 h-[80dvh] flex flex-col">
                             <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3 shrink-0" />
                             
                             <div className="flex-1 overflow-y-auto no-scrollbar pb-6 space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-white">{t('gallery.metadata', 'Metadata')}</h3>
                                    <Button size="sm" onClick={handleApplyMetadata} className="rounded-xl bg-indigo-500 hover:bg-indigo-600 font-medium">{t('gallery.applyAll', 'Apply All')}</Button>
                                </div>
                                {isLoadingMeta ? (
                                    <div className="flex items-center justify-center p-10"><RefreshCw className="w-6 h-6 animate-spin text-white/30" /></div>
                                ) : !metadata ? (
                                    <div className="text-white/40 text-sm text-center p-10">{t('gallery.noMetadata', 'No metadata found')}</div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <span className="text-xs font-semibold text-white/40 uppercase">{t('gallery.metaPrompt', 'Prompt')}</span>
                                            <div className="p-3 rounded-xl bg-[#0e0f12] text-xs text-white/80 leading-relaxed font-mono break-words border border-white/10">
                                                {metadata.prompt}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <span className="text-xs font-semibold text-white/40 uppercase">{t('gallery.metaNegative', 'Negative Prompt')}</span>
                                            <div className="p-3 rounded-2xl bg-[#0e0f12] text-sm font-mono text-white/80 break-words border border-white/10">{metadata.v4_negative_prompt?.caption?.base_caption || metadata.negativePrompt || 'None'}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-2xl bg-[#0e0f12] flex flex-col gap-1 border border-white/10">
                                                <span className="text-[10px] font-semibold text-white/40 uppercase">{t('gallery.metaResolution', 'Resolution')}</span>
                                                <span className="text-sm font-mono text-white/80">{metadata.width}x{metadata.height}</span>
                                            </div>
                                            <div className="p-3 rounded-2xl bg-[#0e0f12] flex flex-col gap-1 border border-white/10">
                                                <span className="text-[10px] font-semibold text-white/40 uppercase">{t('gallery.metaSeed', 'Seed')}</span>
                                                <span className="text-sm font-mono text-white/80 truncate">{metadata.seed}</span>
                                            </div>
                                            <div className="p-3 rounded-2xl bg-[#0e0f12] flex flex-col gap-1 border border-white/10">
                                                <span className="text-[10px] font-semibold text-white/40 uppercase">{t('gallery.metaSteps', 'Steps')}</span>
                                                <span className="text-sm font-mono text-white/80">{metadata.steps}</span>
                                            </div>
                                            <div className="p-3 rounded-2xl bg-[#0e0f12] flex flex-col gap-1 border border-white/10">
                                                <span className="text-[10px] font-semibold text-white/40 uppercase">{t('gallery.metaSampler', 'Sampler')}</span>
                                                <span className="text-sm font-mono text-white/80 truncate">{metadata.sampler}</span>
                                            </div>
                                            <div className="col-span-2 p-3 rounded-2xl bg-[#0e0f12] flex flex-col gap-1 border border-white/10">
                                                <span className="text-[10px] font-semibold text-white/40 uppercase">{t('gallery.metaModel', 'Model')}</span>
                                                <span className="text-sm font-mono text-white/80 truncate">{metadata.model}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </motion.div>
    );
}
