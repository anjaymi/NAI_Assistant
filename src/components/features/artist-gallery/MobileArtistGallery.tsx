import React, { useEffect, useState, useMemo, useRef, useDeferredValue, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, DatabaseZap, X } from 'lucide-react';
import { MobileArtistCard } from './MobileArtistCard';
import { Input } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';
import { artistDB as db } from '@/services/artist-db';
import { danbooruService } from '@/services/danbooru-service';
import type { MobileArtistDTO } from '@/types/artist';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface MobileArtistGalleryProps {
    className?: string;
    onSelectArtist: (artist: { id: string, name: string, tag: string }) => void;
}

export const MobileArtistGallery = memo(({ className, onSelectArtist }: MobileArtistGalleryProps) => {
    const { t } = useTranslation();
    const parentRef = useRef<HTMLDivElement>(null);
    
    // UI State
    const [artists, setArtists] = useState<MobileArtistDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearch = useDeferredValue(searchQuery);

    // Repair State
    const [isRepairing, setIsRepairing] = useState(false);
    const [repairProgress, setRepairProgress] = useState({ current: 0, total: 0, text: '' });
    const repairStopRef = useRef(false);

    // Load Data
    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await db.getMobileArtistsLite();
            setArtists(data);
        } catch (error) {
            console.error("Failed to load mobile artists:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filter Logic — 搜索时同时匹配名称、标签和备注
    const filteredArtists = useMemo(() => {
        if (!deferredSearch) return artists;
        const q = deferredSearch.toLowerCase();
        return artists.filter(a => 
            a.name.toLowerCase().includes(q) || 
            a.tag.toLowerCase().includes(q) ||
            (a.memo && a.memo.toLowerCase().includes(q))
        );
    }, [artists, deferredSearch]);

    // Grid Layout constants
    const columns = 3;
    const gap = 16; // 16px — 增大行间距，避免遮挡画师名字
    const rowCount = Math.ceil(filteredArtists.length / columns);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        if (!parentRef.current) return;
        const observer = new ResizeObserver(entries => {
            setContainerWidth(entries[0].contentRect.width);
        });
        observer.observe(parentRef.current);
        return () => observer.disconnect();
    }, []);

    const itemHeight = useMemo(() => {
        if (!containerWidth) return 160; 
        const availableWidth = containerWidth - 24; // 12px padding on sides
        const columnWidth = (availableWidth - (gap * (columns - 1))) / columns;
        return columnWidth * (4 / 3) + 4; // aspect-[3/4] + 4px 额外呼吸空间
    }, [containerWidth, columns, gap]);

    const virtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => itemHeight + gap,
        overscan: 6, // Render a few extra rows outside the viewport
    });

    // Handle Danbooru Fallback Sync
    const handleStartRepair = async () => {
        if (isRepairing) return;
        setIsRepairing(true);
        repairStopRef.current = false;
        
        try {
            await danbooruService.batchPurgeAndFetchArtistLinks(
                (current: number, total: number, status: string) => {
                    setRepairProgress({ current, total, text: status });
                },
                () => repairStopRef.current
            );
        } catch (e) {
            console.error("Purge & Repair failed", e);
        } finally {
            setIsRepairing(false);
            loadData(); // Reload after repair
        }
    };

    const handleCancelRepair = () => {
        repairStopRef.current = true;
    };

    return (
        <div className={cn("flex flex-col h-full bg-slate-50 dark:bg-black", className)}>
            {/* Header / Toolbar */}
            <div className="flex-none p-3 pb-2 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search artists..."
                            className="w-full pl-9 pr-8 h-10 bg-white/50 dark:bg-zinc-900 border-none shadow-sm rounded-xl text-[13px]"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <motion.button 
                        whileTap={{ scale: 0.95 }}
                        className="shrink-0"
                    >
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={handleStartRepair}
                            disabled={isRepairing || isLoading}
                            className="h-10 px-3 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 border-none font-medium w-full"
                        >
                            <DatabaseZap className="w-4 h-4 mr-1.5" />
                            {t('common.repair', 'Sync Missing')}
                        </Button>
                    </motion.button>
                </div>
                
                {/* Stats */}
                <div className="flex justify-between items-center px-1 text-[11px] text-slate-500 font-medium">
                    <span>{filteredArtists.length} Artists</span>
                </div>
            </div>

            {/* Virtualized Grid */}
            <div className="flex-1 relative min-h-0">
                {isLoading ? (
                    <div className="absolute inset-0 px-3 pb-24 overflow-hidden">
                        <div className="flex gap-[12px] mb-[12px]">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex-1 aspect-[3/4] rounded-2xl bg-slate-200/50 dark:bg-white/5 animate-pulse overflow-hidden relative">
                                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-[12px] mb-[12px]">
                            {[4, 5, 6].map(i => (
                                <div key={i} className="flex-1 aspect-[3/4] rounded-2xl bg-slate-200/50 dark:bg-white/5 animate-pulse overflow-hidden relative">
                                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-[12px]">
                            {[7, 8, 9].map(i => (
                                <div key={i} className="flex-1 aspect-[3/4] rounded-2xl bg-slate-200/50 dark:bg-white/5 animate-pulse overflow-hidden relative">
                                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : filteredArtists.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 opacity-50">
                        <Search className="w-10 h-10 mb-2" />
                        <p>No artists found.</p>
                    </div>
                ) : (
                    <div 
                        ref={parentRef} 
                        className="h-full w-full overflow-y-auto overflow-x-hidden no-scrollbar pb-24"
                    >
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                const fromIndex = virtualRow.index * columns;
                                const toIndex = Math.min(fromIndex + columns, filteredArtists.length);
                                const rowArtists = filteredArtists.slice(fromIndex, toIndex);

                                return (
                                    <div
                                        key={virtualRow.key}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            display: 'flex',
                                            gap: `${gap}px`,
                                            paddingLeft: '12px',
                                            paddingRight: '12px',
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        {rowArtists.map((artist) => {
                                            const itemWidth = `calc(${100 / columns}% - ${(gap * (columns - 1)) / columns}px)`;
                                            return (
                                                <div key={artist.id} style={{ width: itemWidth, flexShrink: 0 }}>
                                                    <MobileArtistCard
                                                        artist={artist}
                                                        isSelected={false}
                                                        onToggle={() => onSelectArtist(artist)}
                                                        onFavorite={async (id, isFav) => {
                                                            // Optimistic update
                                                            setArtists(prev => prev.map(a => a.id === id ? { ...a, isFavorite: isFav } : a));
                                                            const database = await db.getDB();
                                                            if (database) {
                                                                await database.execute(
                                                                    'UPDATE artists SET is_favorite = $1, last_modified = $2 WHERE id = $3', 
                                                                    [isFav ? 1 : 0, Date.now(), id]
                                                                );
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Repair Progress Overlay (Modal) */}
            <AnimatePresence>
                {isRepairing && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl w-full max-w-sm flex flex-col items-center text-center"
                        >
                            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                                同步缺失缩略图
                            </h3>
                            <p className="text-xs text-slate-500 mb-6 font-medium px-4">
                                {repairProgress.text || 'Connecting to Danbooru API...'}
                            </p>
                            
                            <div className="w-full bg-slate-100 dark:bg-black/40 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner">
                                <motion.div 
                                    className="bg-indigo-500 h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${repairProgress.total > 0 ? (repairProgress.current / repairProgress.total) * 100 : 0}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 w-full text-right mb-6">
                                {repairProgress.current} / {repairProgress.total}
                            </div>
                            
                            <Button variant="outline" onClick={handleCancelRepair} className="w-full rounded-xl border-red-200 text-red-500 hover:bg-red-50">
                                Abort
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});
MobileArtistGallery.displayName = 'MobileArtistGallery';
