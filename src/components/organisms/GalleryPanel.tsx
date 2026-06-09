import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGalleryStore, GalleryItem as GalleryItemType, IncomingGalleryItem } from '@/stores/gallery-store'
import { GalleryItem } from '@/components/molecules/GalleryItem'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { Button } from '@/components/atoms/Button'
import { RefreshCw, Image as ImageIcon, LayoutGrid, GripVertical, CheckSquare, XSquare, Trash2, MousePointerClick, CheckCircle2, Circle, DownloadCloud, LoaderCircle, CheckCheck, AlertCircle } from 'lucide-react'
import { GalleryViewer } from './GalleryViewer'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import { ImageContextMenu } from '@/components/features/ImageContextMenu'
import { useGenerationStore } from '@/stores/generation-store'
import { useCharacterStore } from '@/stores/character-store'
import { open, Command } from '@tauri-apps/plugin-shell'
import { remove } from '@tauri-apps/plugin-fs'
import { toast } from '@/hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { shallow } from 'zustand/shallow'

const EMPTY_SELECTION = new Set<string>()
const DESKTOP_GALLERY_PAGE_SIZE = 24

export function GalleryPanel({ className, onNavigate }: { className?: string, onNavigate?: (tab: string) => void }) {
    const { t } = useTranslation()
    const { items, incomingItems, isLoading, error, refreshGallery, removeGalleryItem, removeGalleryItems } = useGalleryStore(
        (state) => ({
            items: state.items,
            incomingItems: state.incomingItems,
            isLoading: state.isLoading,
            error: state.error,
            refreshGallery: state.refreshGallery,
            removeGalleryItem: state.removeGalleryItem,
            removeGalleryItems: state.removeGalleryItems,
        }),
        shallow
    )
    const { galleryLayout, setGalleryLayout } = useSettingsStore(
        (state) => ({
            galleryLayout: state.galleryLayout,
            setGalleryLayout: state.setGalleryLayout,
        }),
        shallow
    )
    
    // We use a separate state object for the viewer to ensure it only opens when explicitly set
    const [viewerItem, setViewerItem] = useState<GalleryItemType | null>(null)
    
    // Range Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
    const [isDeleting, setIsDeleting] = useState(false)
    const [visibleCount, setVisibleCount] = useState(DESKTOP_GALLERY_PAGE_SIZE)
    const loadMoreRef = useRef<HTMLDivElement | null>(null)
    const masonryContainerRef = useRef<HTMLDivElement | null>(null)
    const [masonryColumnCount, setMasonryColumnCount] = useState(1)
    const selectedCount = selectedPaths.size
    const allSelected = items.length > 0 && selectedCount === items.length
    const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount])
    const hasMoreItems = visibleCount < items.length

    useEffect(() => {
        // console.log('[GalleryPanel] MOUNTED, calling refreshGallery')
        refreshGallery()
    }, [refreshGallery])

    useEffect(() => {
        setVisibleCount(DESKTOP_GALLERY_PAGE_SIZE)
    }, [items.length, galleryLayout])

    useEffect(() => {
        if (!hasMoreItems || !loadMoreRef.current || typeof IntersectionObserver === 'undefined') return

        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) {
                setVisibleCount((prev) => Math.min(prev + DESKTOP_GALLERY_PAGE_SIZE, items.length))
            }
        }, { rootMargin: '40px 0px' })

        observer.observe(loadMoreRef.current)
        return () => observer.disconnect()
    }, [hasMoreItems, items.length, visibleCount])

    useEffect(() => {
        if (galleryLayout !== 'masonry' || !masonryContainerRef.current || typeof ResizeObserver === 'undefined') {
            return
        }

        const updateColumns = () => {
            const width = masonryContainerRef.current?.clientWidth ?? 0
            const nextColumnCount = Math.max(1, Math.min(3, Math.floor((width + 12) / 240)))
            setMasonryColumnCount(nextColumnCount)
        }

        updateColumns()
        const observer = new ResizeObserver(() => updateColumns())
        observer.observe(masonryContainerRef.current)

        return () => observer.disconnect()
    }, [galleryLayout])

    const handleItemClick = useCallback((item: GalleryItemType) => {
        if (isSelectionMode) {
            toggleSelection(item.path)
        } else {
            setViewerItem(item)
        }
    }, [isSelectionMode])
    
    const toggleSelection = useCallback((path: string) => {
        setSelectedPaths((prev) => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }, [])

    const handleNavigateTo = useCallback((tab: string, fallbackTitle: string, fallbackDescription?: string) => {
        if (onNavigate) {
            onNavigate(tab)
            return
        }

        toast({ title: fallbackTitle, description: fallbackDescription })
    }, [onNavigate])

    const handleSelectAll = useCallback(() => {
        if (allSelected) {
            setSelectedPaths(EMPTY_SELECTION)
        } else {
            setSelectedPaths(new Set(items.map(i => i.path)))
        }
    }, [allSelected, items])

    const exitSelectionMode = useCallback(() => {
        setIsSelectionMode(false)
        setSelectedPaths(EMPTY_SELECTION)
    }, [])

    const handleBatchDelete = useCallback(async () => {
        if (selectedCount === 0 || isDeleting) return
        
        setIsDeleting(true)
        try {
            const pathsToDel = Array.from(selectedPaths)
            await Promise.all(pathsToDel.map(p => remove(p).catch(e => console.error("Remove file error:", e))))
            
            toast({ title: '删除成功', description: `已清理 ${pathsToDel.length} 张图片` })
            removeGalleryItems(pathsToDel)
            exitSelectionMode()
        } catch (err: any) {
            console.error(err)
            toast({ title: '删除失败', description: err.message, variant: 'destructive' })
        } finally {
            setIsDeleting(false)
        }
    }, [exitSelectionMode, isDeleting, removeGalleryItems, selectedCount, selectedPaths, t])

    // --- Actions ---
    const handleOpenFolder = useCallback(async (path: string) => {
        try {
            // Get directory path (Windows/Unix safeish)
            // On Windows path is string, usually backslash.
            const sep = path.includes('\\') ? '\\' : '/'
            const dir = path.substring(0, path.lastIndexOf(sep))
            
            // Try explicit explorer command first (Windows)
            try {
                const command = Command.create('explorer', [dir])
                await command.spawn()
            } catch (cmdErr) {
                // Fallback to open (which might fail with regex error, but worth a shot on other platforms if explorer is not matched)
                console.warn("Explorer command failed, trying open:", cmdErr)
                await open(dir)
            }
        } catch (e) {
            toast({ title: "打开文件夹失败", description: String(e), variant: "destructive" })
        }
    }, [])

    const handleDelete = useCallback(async (item: GalleryItemType) => {
        try {
            await remove(item.path)
            removeGalleryItem(item.path)
            toast({ title: t('actions.deleted', "已删除") })
        } catch (e) {
            toast({ title: "删除失败", description: String(e), variant: "destructive" })
        }
    }, [removeGalleryItem, t])

    const handleLoadMetadata = useCallback((item: GalleryItemType) => {
        if (!item.metadata) return
        const meta = item.metadata
        
        toast({
            title: "Metadata Loaded",
            description: `Seed: ${meta.seed} | Prompt: ${meta.prompt?.slice(0, 20)}...`
        })
        
        // Ideally we pop up a dialog or fill prompt area
        if (meta.prompt) useGenerationStore.getState().setPrompt(meta.prompt)
        if (meta.negativePrompt) useGenerationStore.getState().setNegativePrompt(meta.negativePrompt)
        if (meta.seed) useGenerationStore.getState().setSeed(meta.seed)
        if (meta.steps) useGenerationStore.getState().setSteps(meta.steps)
        if (meta.cfgScale) useGenerationStore.getState().setCfgScale(meta.cfgScale)
        if (meta.width && meta.height) useGenerationStore.getState().setDimensions(meta.width, meta.height)
        if (meta.model) useGenerationStore.getState().setModel(meta.model)
    }, [])

    const renderIncomingPlaceholder = useCallback((item: IncomingGalleryItem) => {
        const statusIcon = item.status === 'success'
            ? <CheckCheck className="h-4 w-4" />
            : item.status === 'error'
                ? <AlertCircle className="h-4 w-4" />
                : item.status === 'saving'
                    ? <LoaderCircle className="h-4 w-4 animate-spin" />
                    : <DownloadCloud className="h-4 w-4" />

        return (
            <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.985 }}
                className={cn(
                    "relative overflow-hidden rounded-[1.4rem] border shadow-sm",
                    galleryLayout === 'grid' ? "aspect-square" : "mb-3 break-inside-avoid min-h-[220px]",
                    item.status === 'success'
                        ? "border-emerald-500/20 bg-emerald-500/10"
                        : item.status === 'error'
                            ? "border-rose-500/20 bg-rose-500/10"
                            : "border-slate-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5"
                )}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/15 to-slate-200/40 dark:from-white/10 dark:via-white/5 dark:to-transparent" />
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                <div className="relative z-10 flex h-full flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                        <span className="rounded-full border border-white/40 bg-white/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white/65">
                            Incoming
                        </span>
                        <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-2xl",
                            item.status === 'success'
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                : item.status === 'error'
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                                    : "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300"
                        )}>
                            {statusIcon}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-slate-800 dark:text-white/85 line-clamp-2 break-all">
                            {item.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-white/55">
                            {item.progressLabel}
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                            <div className={cn(
                                "h-full rounded-full transition-all duration-300",
                                item.status === 'success'
                                    ? "w-full bg-emerald-500"
                                    : item.status === 'error'
                                        ? "w-full bg-rose-500"
                                        : item.status === 'saving'
                                            ? "w-4/5 bg-indigo-500"
                                            : "w-2/5 bg-indigo-400"
                            )} />
                        </div>
                    </div>
                </div>
            </motion.div>
        )
    }, [galleryLayout])

    const renderGalleryContextItem = useCallback((item: GalleryItemType) => {
        const isSelected = selectedPaths.has(item.path)

        return (
            <ImageContextMenu
                key={item.path}
                imageSrc={item.url}
                onRegenerate={() => {
                    if(item.metadata) {
                        handleLoadMetadata(item)
                        setTimeout(() => {
                            useGenerationStore.getState().generate()
                        }, 50)
                    }
                }}
                onSmartTools={() => {
                    useGenerationStore.getState().setSourceImage(item.url)
                    handleNavigateTo('tools', t('tools.title', 'Smart Tools'), 'Please switch to Tools tab')
                }}
                onInpaint={() => {
                    useGenerationStore.getState().setSourceImage(item.url)
                    useGenerationStore.getState().setMask(null)
                    handleNavigateTo('canvas', t('tools.inpainting.title', 'Sent to Inpaint'))
                }}
                onI2I={() => {
                    useGenerationStore.getState().setSourceImage(item.url)
                    handleNavigateTo('tools', t('tools.i2i.title', 'Sent to Img2Img'))
                }}
                onAddRef={() => {
                    void useCharacterStore.getState().addCharacterImage(item.url)
                    toast({ title: t('common.addedReference', 'Added to Reference') })
                }}
                onOpenFolder={() => handleOpenFolder(item.path)}
                onLoadMetadata={() => handleLoadMetadata(item)}
                onDelete={() => handleDelete(item)}
            >
                <div className="relative cursor-pointer group" onClick={() => handleItemClick(item)}>
                    <GalleryItem
                        item={item}
                        variant={galleryLayout === 'masonry' ? 'masonry' : 'square'}
                        className={cn(
                            galleryLayout === 'masonry' && 'mb-3',
                            isSelectionMode && 'transition-all duration-200',
                            isSelected && 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-black opacity-90 scale-[0.985]'
                        )}
                        selected={viewerItem?.path === item.path}
                    />

                    {isSelectionMode && (
                        <div className="absolute top-2 right-2 z-10 pointer-events-none">
                            {isSelected ? (
                                <CheckCircle2 className="w-6 h-6 text-indigo-500 fill-white" />
                            ) : (
                                <Circle className="w-6 h-6 text-white/80 group-hover:text-white transition-colors" />
                            )}
                        </div>
                    )}
                </div>
            </ImageContextMenu>
        )
    }, [galleryLayout, handleDelete, handleItemClick, handleLoadMetadata, handleNavigateTo, handleOpenFolder, isSelectionMode, selectedPaths, t, viewerItem?.path])

    const handleLoadMore = useCallback(() => {
        setVisibleCount((prev) => Math.min(prev + DESKTOP_GALLERY_PAGE_SIZE, items.length))
    }, [items.length])

    const viewerPath = viewerItem?.path ?? null
    const viewerIndex = useMemo(() => {
        if (!viewerPath) return -1
        return items.findIndex((item) => item.path === viewerPath)
    }, [items, viewerPath])

    return (
        <div data-nai-gallery-panel className={cn("flex flex-col h-full bg-slate-50/90 dark:bg-[#05060a] border-l border-slate-200 dark:border-[#101116] shadow-sm dark:shadow-[-8px_0_24px_rgba(0,0,0,0.38)] z-20", className)}>
            <div className="min-h-[56px] pt-[env(safe-area-inset-top)] border-b border-slate-200 dark:border-[#101116] px-4 shrink-0 bg-transparent dark:bg-[#05060a]">
                <AnimatePresence mode="wait" initial={false}>
                    {isSelectionMode ? (
                        <motion.div
                            key="selection-header"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            className="h-[56px] flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                                <button
                                    onClick={handleSelectAll}
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-xl text-slate-500 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white transition-colors"
                                    title={allSelected ? '取消全选' : '全选'}
                                >
                                    <CheckSquare className="w-4 h-4" />
                                </button>
                                <span className="text-sm font-semibold tracking-[-0.01em]">已选 {selectedCount}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleBatchDelete}
                                    disabled={selectedCount === 0 || isDeleting}
                                    className="h-8 w-8 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                    title={isDeleting ? '删除中...' : '删除所选'}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={exitSelectionMode}
                                    className="h-8 w-8 rounded-xl text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10"
                                    title="退出多选"
                                >
                                    <XSquare className="w-4 h-4" />
                                </Button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="default-header"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            className="h-[56px] flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3 text-slate-800 dark:text-white min-w-0">
                                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 dark:bg-[#0e0f12] border border-slate-200 dark:border-[#14161a] shrink-0">
                                    <ImageIcon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold tracking-[-0.01em] truncate">{t('gallery.galleryTitle', '画廊')}</div>
                                    <div className="text-[11px] text-slate-500 dark:text-white/45">{items.length + incomingItems.length} 项</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-slate-100 dark:bg-[#0e0f12] border border-slate-200 dark:border-[#14161a] rounded-xl p-1 shadow-inner">
                                    <Button
                                        variant={galleryLayout === 'grid' ? 'secondary' : 'ghost'}
                                        size="icon"
                                        className={cn("h-7 w-7 rounded-lg transition-colors", galleryLayout === 'grid' ? "bg-white dark:bg-white/20 text-slate-800 dark:text-white shadow-sm" : "text-slate-400 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10")}
                                        onClick={() => setGalleryLayout('grid')}
                                        title={t('gallery.layoutGrid', '网格视图')}
                                    >
                                        <LayoutGrid className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant={galleryLayout === 'masonry' ? 'secondary' : 'ghost'}
                                        size="icon"
                                        className={cn("h-7 w-7 rounded-lg transition-colors", galleryLayout === 'masonry' ? "bg-white dark:bg-white/20 text-slate-800 dark:text-white shadow-sm" : "text-slate-400 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10")}
                                        onClick={() => setGalleryLayout('masonry')}
                                        title={t('gallery.layoutMasonry', '瀑布流视图')}
                                    >
                                        <GripVertical className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                {items.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors"
                                        onClick={() => setIsSelectionMode(true)}
                                        title="多选"
                                    >
                                        <MousePointerClick className="w-3.5 h-3.5" />
                                    </Button>
                                )}

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => refreshGallery()}
                                    disabled={isLoading}
                                    className={cn("h-9 w-9 text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors", isLoading && "animate-spin")}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0">
                {error ? (
                    <div className="p-4 text-sm text-destructive text-center">
                        {t('gallery.loadError', { error })}
                        <Button variant="link" onClick={() => refreshGallery()}>{t('gallery.retry')}</Button>
                    </div>
                ) : (
                    <ScrollArea className="h-full">
                        <div className={cn(
                            "p-4 gap-3",
                            galleryLayout === 'grid' 
                                ? "grid grid-cols-2 lg:grid-cols-3" 
                                : "space-y-3 block"
                        )}
                        ref={galleryLayout === 'masonry' ? masonryContainerRef : undefined}
                        style={galleryLayout === 'masonry' ? { columnCount: masonryColumnCount, columnGap: '12px' } : undefined}>
                            <AnimatePresence>
                                {incomingItems.map(renderIncomingPlaceholder)}
                            </AnimatePresence>
                           {visibleItems.map(renderGalleryContextItem)}
                             {items.length === 0 && incomingItems.length === 0 && !isLoading && (
                                 <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-white/30 space-y-4">
                                     <ImageIcon className="w-12 h-12 opacity-50 dark:opacity-20" />
                                     <span className="text-sm font-medium tracking-wide">{t('gallery.empty')}</span>
                                 </div>
                             )}
                            {hasMoreItems && (
                                <div ref={loadMoreRef} className="col-span-full flex justify-center pt-4">
                                    <Button variant="outline" onClick={handleLoadMore} className="rounded-xl">
                                        {t('gallery.loadMore', '加载更多')} ({visibleItems.length}/{items.length})
                                    </Button>
                                </div>
                            )}
                         </div>
                     </ScrollArea>
                )}
            </div>

            {/* Viewer Dialog */}
            <GalleryViewer 
                item={viewerItem} 
                onClose={() => setViewerItem(null)} 
                onPrevious={() => {
                    if (viewerIndex > 0) setViewerItem(items[viewerIndex - 1])
                }}
                onNext={() => {
                    if (viewerIndex !== -1 && viewerIndex < items.length - 1) setViewerItem(items[viewerIndex + 1])
                }}
                hasPrevious={viewerIndex > 0}
                hasNext={viewerIndex !== -1 && viewerIndex < items.length - 1}
            />
        </div>
    )
}
