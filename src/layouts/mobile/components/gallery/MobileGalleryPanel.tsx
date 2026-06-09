import React, { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useGalleryStore, GalleryItem as GalleryItemType, IncomingGalleryItem } from '@/stores/gallery-store';
import { useSync } from '@/context/SyncContext';
import { useSettingsStore } from '@/stores/settings-store';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { Button } from '@/components/atoms/Button';
import { LayoutGrid, GripVertical, RefreshCw, Image as ImageIcon, CheckCircle2, Circle, X, Send, CloudLightning, Loader2, CheckSquare, Trash2, DownloadCloud, CheckCheck, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileGalleryViewer } from './MobileGalleryViewer';
import { GalleryItem } from '@/components/molecules/GalleryItem';
import { uploadToImageHost, sendPushSignalToWorker, pingLanHost, uploadToLanHost } from '@/services/cloud-push-service';
import { toast } from '@/hooks/use-toast';
import { useNetworkHealth } from '@/hooks/use-network-health';
import { VirtuosoGrid } from 'react-virtuoso';
import { shallow } from 'zustand/shallow';
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary';

const LottieAnimation = lazy(() => import('@/components/atoms/LottieAnimation').then((module) => ({ default: module.LottieAnimation })));
const MOBILE_MASONRY_PAGE_SIZE = 60;

export function MobileGalleryPanel({ className }: { className?: string }) {
    const { t } = useTranslation();
    const { items, incomingItems, isLoading, error, refreshGallery, removeGalleryItems } = useGalleryStore(
        (state) => ({
            items: state.items,
            incomingItems: state.incomingItems,
            isLoading: state.isLoading,
            error: state.error,
            refreshGallery: state.refreshGallery,
            removeGalleryItems: state.removeGalleryItems,
        }),
        shallow
    );
    const { galleryLayout, setGalleryLayout, lanPcIp, manualToken } = useSettingsStore(
        (state) => ({
            galleryLayout: state.galleryLayout,
            setGalleryLayout: state.setGalleryLayout,
            lanPcIp: state.lanPcIp,
            manualToken: state.cloudSyncToken,
        }),
        shallow
    );
    const { user } = useSync();

    const [viewerItem, setViewerItem] = useState<GalleryItemType | null>(null);

    // Multi-select state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [isPushing, setIsPushing] = useState(false);
    const [pushProgress, setPushProgress] = useState({ current: 0, total: 0, percent: 0 });
    const [visibleCount, setVisibleCount] = useState(MOBILE_MASONRY_PAGE_SIZE);
    const masonryLoadMoreRef = useRef<HTMLDivElement | null>(null);
    const selectedCount = selectedPaths.size;
    const allSelected = items.length > 0 && selectedCount === items.length;
    const visibleMasonryItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
    const hasMoreMasonryItems = visibleCount < items.length;
    const gridData = useMemo(() => [...incomingItems, ...items], [incomingItems, items]);
    const masonryData = useMemo(() => [...incomingItems, ...visibleMasonryItems], [incomingItems, visibleMasonryItems]);

    // Effective Token: 优先 Supabase 登录 ID，回退到手动 Token
    const effectiveCloudToken = user?.id || manualToken || '';

    // Network Health
    const { lanReady, cloudReady } = useNetworkHealth(effectiveCloudToken);

    // Sync viewer state with hash
    useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash !== '#gallery-viewer' && viewerItem) {
                setViewerItem(null);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [viewerItem]);

    useEffect(() => {
        refreshGallery();
    }, [refreshGallery]);

    useEffect(() => {
        setVisibleCount(MOBILE_MASONRY_PAGE_SIZE);
    }, [items.length, galleryLayout]);

    useEffect(() => {
        if (galleryLayout !== 'masonry' || !hasMoreMasonryItems || !masonryLoadMoreRef.current || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) {
                setVisibleCount((prev) => Math.min(prev + MOBILE_MASONRY_PAGE_SIZE, items.length));
            }
        }, { rootMargin: '240px 0px' });

        observer.observe(masonryLoadMoreRef.current);
        return () => observer.disconnect();
    }, [galleryLayout, hasMoreMasonryItems, items.length, visibleCount]);

    const selectedItems = useMemo(() => items.filter(i => selectedPaths.has(i.path)), [items, selectedPaths]);

    const toggleSelection = useCallback((path: string) => {
        setSelectedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const handleItemClick = useCallback((item: GalleryItemType) => {
        if (isSelectionMode) {
            toggleSelection(item.path);
        } else {
            window.location.hash = 'gallery-viewer';
            setViewerItem(item);
        }
    }, [isSelectionMode, toggleSelection]);

    const handleItemLongPress = useCallback((item: GalleryItemType) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedPaths(new Set([item.path]));
        }
    }, [isSelectionMode]);

    const handleCloseViewer = useCallback(() => {
        if (window.location.hash === '#gallery-viewer') {
            window.history.back(); // This triggers hashchange which clears viewerItem
        } else {
            setViewerItem(null);
        }
    }, []);

    const exitSelectionMode = useCallback(() => {
        setIsSelectionMode(false);
        setSelectedPaths(new Set());
    }, []);

    const toggleSelectAll = useCallback(() => {
        if (allSelected) {
            setSelectedPaths(new Set());
        } else {
            setSelectedPaths(new Set(items.map(i => i.path)));
        }
    }, [allSelected, items]);

    const handleBatchPush = async () => {
        if (!effectiveCloudToken) {
            toast({ title: "尚未登入云端系统", variant: "destructive", description: "前往设置中登录 Cloud Sync 才能获取内网中继服务" });
            return;
        }
        if (selectedPaths.size === 0 || isPushing) return;

        setIsPushing(true);
        setPushProgress({ current: 0, total: selectedItems.length, percent: 0 });

        try {
            const { readFile } = await import('@tauri-apps/plugin-fs');
            
            // 1. Probe LAN P2P fast path
            let useLan = false;
            // Since we know health state, we can skip explicit pinging or rely on it
            if (lanReady && lanPcIp) {
                useLan = true;
            } else if (lanPcIp) {
                // Secondary fallback attempt if health probe hasn't caught up
                useLan = (await pingLanHost(lanPcIp)) === true;
            }

            if (useLan) {
                // 🚀 GOLDEN PATH: LAN Direct Transfer (Blazing Fast, No Compression)
                let completed = 0;
                
                await Promise.all(selectedItems.map(async (item, i) => {
                    const buffer = await readFile(item.path);
                    const filename = item.path.split(/[\/\\]/).pop() || `nai_airdrop_${Date.now()}_${i}.png`;
                    const blob = new Blob([buffer], { type: 'image/png' }); 
                    
                    await uploadToLanHost(lanPcIp, blob, filename);
                    
                    completed++;
                    // Update progress UI carefully here
                    setPushProgress(prev => ({ ...prev, current: completed, percent: (completed / selectedItems.length) * 100 }));
                }));

                toast({ 
                    title: 'Airdrop 闪传成功', 
                    description: `局域网极速到达：${selectedItems.length} 张图片`,
                });
                
            } else {
                // ☁️ SILVER PATH: Cloud Concurrency (Fallback)
                const urls: string[] = [];
                let completed = 0;
                
                // Concurrency Pool Setup
                const limit = 3; 
                const executing = new Set<Promise<void>>();

                for (let i = 0; i < selectedItems.length; i++) {
                    const item = selectedItems[i];
                    
                    const p = (async () => {
                        const buffer = await readFile(item.path);
                        const filename = item.path.split(/[\/\\]/).pop() || `nai_airdrop_${Date.now()}_${i}.png`;
                        const blob = new Blob([buffer], { type: 'image/png' }); 
                        
                        const url = await uploadToImageHost(blob, filename, (p) => {
                            setPushProgress(prev => ({ ...prev, percent: p }));
                        });
                        urls.push(url);
                        
                        completed++;
                        setPushProgress(prev => ({ ...prev, current: completed, percent: 0 }));
                    })();

                    executing.add(p);
                    p.then(() => executing.delete(p));

                    if (executing.size >= limit) {
                        await Promise.race(executing);
                    }
                }
                
                // Wait for the remaining tail uploads
                await Promise.all(executing);

                // 发微信令
                await sendPushSignalToWorker(effectiveCloudToken, urls);
                toast({ 
                    title: 'Airdrop 云端送达', 
                    description: `多通道推送完成：${selectedItems.length} 张图片`,
                });
            }

            exitSelectionMode();
            
        } catch (err: any) {
            console.error(err);
            toast({ title: '推送失败', description: err.message, variant: 'destructive' });
        } finally {
            setIsPushing(false);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedCount === 0 || isPushing) return;
        
        try {
            const { remove } = await import('@tauri-apps/plugin-fs');
            // Delete files one by one (or concurrently)
            const pathsToDel = Array.from(selectedPaths);
            await Promise.all(pathsToDel.map(p => remove(p).catch(e => console.error("Remove file error:", e))));
            
            toast({ title: '删除成功', description: `已清理 ${pathsToDel.length} 张图片` });
            removeGalleryItems(pathsToDel);
            exitSelectionMode();
        } catch (err: any) {
            console.error(err);
            toast({ title: '删除失败', description: err.message, variant: 'destructive' });
        }
    };

    const renderGalleryItem = useCallback((index: number, item: GalleryItemType) => {
        const isSelected = selectedPaths.has(item.path);
        return (
            <div 
                key={item.path}
                className={cn(
                    "relative rounded-[16px] gallery-item-container",
                    "transition-transform duration-200 ease-out",
                    galleryLayout === 'masonry' && "mb-3 break-inside-avoid",
                    isSelected && "scale-[0.92]"
                )}
                style={{
                    animation: `gallery-fade-in 0.3s ease-out ${Math.min(index * 0.03, 0.3)}s both`,
                    willChange: 'transform',
                }}
            >
                <GalleryItem
                    item={item}
                    variant={galleryLayout === 'masonry' ? 'masonry' : 'square'}
                    className={cn(
                        "border border-transparent bg-white/5 rounded-[16px] shadow-sm pointer-events-none transition-all duration-200",
                        isSelected && "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-black opacity-90"
                    )}
                />
                
                {/* 选择指示器 — 纯 CSS transition 替代 AnimatePresence */}
                {isSelectionMode && (
                    <div className="absolute top-2 right-2 z-20 pointer-events-none transition-all duration-200">
                        {isSelected ? (
                            <CheckCircle2 className="w-6 h-6 text-indigo-500 fill-white" />
                        ) : (
                            <Circle className="w-6 h-6 text-white/80" />
                        )}
                    </div>
                )}

                {/* 拦截触摸事件，防止原生长按菜单 */}
                <div 
                    className="absolute inset-0 z-10 cursor-pointer rounded-[16px] active:bg-black/5 transition-colors" 
                    onClick={() => handleItemClick(item)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        handleItemLongPress(item);
                    }}
                    onTouchStart={(e) => {
                        const timer = setTimeout(() => {
                            handleItemLongPress(item);
                        }, 500);
                        e.currentTarget.setAttribute('data-timer', timer.toString());
                    }}
                    onTouchEnd={(e) => {
                        const timer = e.currentTarget.getAttribute('data-timer');
                        if (timer) clearTimeout(parseInt(timer));
                    }}
                    onTouchMove={(e) => {
                        const timer = e.currentTarget.getAttribute('data-timer');
                        if (timer) clearTimeout(parseInt(timer));
                    }}
                />
            </div>
        );
    }, [galleryLayout, handleItemClick, handleItemLongPress, isSelectionMode, selectedPaths]);

    const handleLoadMoreMasonry = useCallback(() => {
        setVisibleCount((prev) => Math.min(prev + MOBILE_MASONRY_PAGE_SIZE, items.length));
    }, [items.length]);

    const renderIncomingPlaceholder = useCallback((item: IncomingGalleryItem, index: number) => {
        const statusIcon = item.status === 'success'
            ? <CheckCheck className="h-4 w-4" />
            : item.status === 'error'
                ? <AlertCircle className="h-4 w-4" />
                : <DownloadCloud className="h-4 w-4" />;

        return (
            <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                className={cn(
                    "relative overflow-hidden rounded-[16px] border shadow-sm",
                    galleryLayout === 'masonry' ? "mb-3 break-inside-avoid min-h-[220px]" : "aspect-square",
                    item.status === 'success'
                        ? "border-emerald-500/20 bg-emerald-500/10"
                        : item.status === 'error'
                            ? "border-rose-500/20 bg-rose-500/10"
                            : "border-slate-200/60 bg-white/70 dark:border-white/10 dark:bg-white/5"
                )}
                style={{
                    animation: `gallery-fade-in 0.3s ease-out ${Math.min(index * 0.03, 0.3)}s both`,
                    willChange: 'transform',
                }}
            >
                <div className="relative z-10 flex h-full flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                        <span className="rounded-full border border-black/5 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#0e0f12] dark:text-white/65">
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
        );
    }, [galleryLayout]);

    const renderGridEntry = useCallback((index: number, item: GalleryItemType | IncomingGalleryItem) => {
        if ('path' in item) {
            return renderGalleryItem(index, item);
        }
        return renderIncomingPlaceholder(item, index);
    }, [renderGalleryItem, renderIncomingPlaceholder]);

    return (
        <div className={cn("flex flex-col h-full bg-slate-50 dark:bg-gradient-to-b dark:from-zinc-950 dark:to-black overflow-hidden relative", className)}>
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
            
            {/* Header */}
            <div className="px-6 pt-12 pb-2 shrink-0 flex items-center justify-between z-10 relative">
                <div>
                    <AnimatePresence mode="wait">
                        {isSelectionMode ? (
                            <motion.div key="selecting" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                                <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {selectedCount > 0 ? `已选择 ${selectedCount} 张` : '请选择图片'}
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-white/40 font-medium tracking-wide uppercase mt-0.5">
                                    Airdrop Selection
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div key="gallery" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-white/60">
                                        {t('nav.gallery', 'Gallery')}
                                    </h1>
                                    <div className="flex items-center gap-1">
                                        <div 
                                            title="局域网 (LAN) 通信状态" 
                                            className={cn("w-2 h-2 rounded-full ring-2 shadow-sm transition-colors", lanReady ? "bg-emerald-500 ring-emerald-500/20" : "bg-slate-300 dark:bg-zinc-700 ring-transparent")} 
                                        />
                                        <div 
                                            title="云中继 (Cloud) 通信状态" 
                                            className={cn("w-2 h-2 rounded-full ring-2 shadow-sm transition-colors", cloudReady ? "bg-indigo-500 ring-indigo-500/20" : "bg-slate-300 dark:bg-zinc-700 ring-transparent")} 
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-white/40 font-medium tracking-wide uppercase mt-0.5">
                                    {items.length + incomingItems.length} {t('gallery.itemsCount', 'ITEMS')}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                
                <div className="flex items-center gap-2">
                    <AnimatePresence>
                        {isSelectionMode ? (
                            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex gap-2">
                                <Button 
                                    variant="ghost" size="icon" 
                                    onClick={toggleSelectAll}
                                    title={allSelected ? "取消全选" : "全选"}
                                    className={cn(
                                        "h-10 w-10 py-0 rounded-2xl transition-colors",
                                        allSelected
                                            ? "bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white" 
                                            : "bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                    )}
                                >
                                    <CheckSquare className="h-5 w-5" />
                                </Button>
                                <Button 
                                    variant="ghost" size="icon" 
                                    onClick={exitSelectionMode}
                                    className="h-10 w-10 py-0 rounded-2xl bg-slate-200/50 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-600 dark:text-white/80"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-2">
                                <Button 
                                    variant="ghost" size="icon" 
                                    onClick={() => setIsSelectionMode(true)}
                                    className="h-10 w-10 py-0 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm dark:shadow-none"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <GlassSurface borderRadius={16} backgroundOpacity={0.05} brightness={60} className="p-1 relative border border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-transparent shadow-sm dark:shadow-none">
                                    <div className="flex items-center gap-1">
                                        <motion.button whileTap={{ scale: 0.85 }} className={cn("h-8 w-8 rounded-xl flex items-center justify-center relative z-10 transition-colors", galleryLayout === 'grid' ? "text-slate-800 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white/80")} onClick={() => setGalleryLayout('grid')}>
                                            <LayoutGrid className="h-4 w-4" />
                                            {galleryLayout === 'grid' && <motion.div layoutId="mobileGalleryLayout" className="absolute inset-0 bg-white dark:bg-white/10 shadow-sm dark:shadow-none rounded-xl -z-10 border border-slate-200/50 dark:border-transparent" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                                        </motion.button>
                                        <motion.button whileTap={{ scale: 0.85 }} className={cn("h-8 w-8 rounded-xl flex items-center justify-center relative z-10 transition-colors", galleryLayout === 'masonry' ? "text-slate-800 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white/80")} onClick={() => setGalleryLayout('masonry')}>
                                            <GripVertical className="h-4 w-4" />
                                            {galleryLayout === 'masonry' && <motion.div layoutId="mobileGalleryLayout" className="absolute inset-0 bg-white dark:bg-white/10 shadow-sm dark:shadow-none rounded-xl -z-10 border border-slate-200/50 dark:border-transparent" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                                        </motion.button>
                                    </div>
                                </GlassSurface>
                                <motion.div whileTap={{ scale: 0.9 }}>
                                    <Button variant="ghost" size="icon" onClick={() => refreshGallery()} disabled={isLoading} className={cn("h-10 w-10 rounded-2xl bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/60 border border-slate-200/50 dark:border-transparent shadow-sm dark:shadow-none", isLoading && "animate-spin text-indigo-500 dark:text-indigo-400")}>
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Content Area */}
            {error ? (
                <div className="flex-1 overflow-y-auto w-full no-scrollbar relative z-10 pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-red-500/50" />
                        </div>
                        <p className="text-sm text-red-400/80">{t('gallery.loadError', { error })}</p>
                        <Button variant="outline" className="rounded-xl border-red-500/20 text-red-400 hover:bg-red-500/10" onClick={() => refreshGallery()}>
                            {t('gallery.retry')}
                        </Button>
                    </div>
                </div>
            ) : items.length === 0 && incomingItems.length === 0 && !isLoading ? (
                <div className="flex-1 overflow-y-auto w-full no-scrollbar relative z-10 pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                        <LazyModuleBoundary mode="inline" className="w-32 h-32" label="Loading animation...">
                            <LottieAnimation 
                                src="https://lottie.host/825ed996-52bb-41bb-92dd-1ec5b8719fde/n7xR0mH4S5.lottie"
                                className="w-32 h-32 opacity-80 mix-blend-multiply dark:mix-blend-screen"
                            />
                        </LazyModuleBoundary>
                        <p className="text-sm font-medium text-slate-400 dark:text-white/40">{t('gallery.empty', 'No images found')}</p>
                    </div>
                </div>
            ) : galleryLayout === 'grid' ? (
                <div className="flex-1 w-full relative z-10">
                    <VirtuosoGrid
                        style={{ height: '100%', width: '100%' }}
                        data={gridData}
                        listClassName="grid grid-cols-2 lg:grid-cols-3 gap-3 px-5"
                        itemClassName="relative w-full"
                        components={{
                            Footer: () => <div className="h-[calc(100px+env(safe-area-inset-bottom,0px))]" />
                        }}
                        itemContent={(index, item) => renderGridEntry(index, item)}
                    />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto w-full no-scrollbar relative z-10 pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
                    <div className="columns-2 lg:columns-3 space-y-3 px-5 pb-6 block">
                        <AnimatePresence>
                            {masonryData.map((item, index) => 'path' in item ? renderGalleryItem(index, item) : renderIncomingPlaceholder(item, index))}
                        </AnimatePresence>
                        {hasMoreMasonryItems && (
                            <div ref={masonryLoadMoreRef} className="break-inside-avoid flex justify-center pt-2 pb-4">
                                <Button variant="outline" onClick={handleLoadMoreMasonry} className="rounded-xl w-full">
                                    {t('gallery.loadMore', '加载更多')} ({visibleMasonryItems.length}/{items.length})
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom Floating Action Bar for Selection Mode */}
            <AnimatePresence>
                {isSelectionMode && (
                    <motion.div 
                        initial={{ y: 150, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 150, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] left-4 right-4 z-50 pointer-events-none"
                    >
                        <GlassSurface borderRadius={20} className="p-3 shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.6)] pointer-events-auto border border-white/20 dark:border-white/10 flex items-center justify-between">
                            <span className="pl-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {selectedCount} {t('gallery.itemsSelected', 'Selected')}
                            </span>
                            
                            <div className="flex items-center gap-2">
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    disabled={selectedCount === 0 || isPushing}
                                    onClick={handleBatchDelete}
                                    className={cn(
                                        "h-10 w-10 flex items-center justify-center rounded-xl transition-all",
                                        selectedCount === 0 
                                            ? "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-white/20" 
                                            : "bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400"
                                    )}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </motion.button>
                                
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    disabled={selectedCount === 0 || isPushing}
                                    onClick={handleBatchPush}
                                    className={cn(
                                        "px-5 py-2.5 rounded-xl font-medium text-[13px] flex items-center justify-center gap-2 transition-all relative overflow-hidden",
                                        selectedCount === 0 
                                            ? "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-white/20" 
                                            : "bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/25"
                                    )}
                                >
                                    {isPushing && (
                                        <div 
                                            className="absolute left-0 bottom-0 h-1 bg-white/30 transition-transform duration-300 origin-left"
                                            style={{ width: '100%', transform: `scaleX(${pushProgress.percent / 100})` }}
                                        />
                                    )}

                                    {isPushing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>{pushProgress.current}/{pushProgress.total} 推送中...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CloudLightning className="w-4 h-4" />
                                            <span>Airdrop 推送</span>
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </GlassSurface>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Full Screen Viewer */}
            <AnimatePresence>
                {viewerItem && !isSelectionMode && (
                    <MobileGalleryViewer 
                        item={viewerItem} 
                        onClose={handleCloseViewer} 
                        items={items}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

