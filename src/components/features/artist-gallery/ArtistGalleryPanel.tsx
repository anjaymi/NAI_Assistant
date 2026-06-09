import React, { useEffect, useState, useMemo, useDeferredValue, useRef } from 'react';
import { useArtistStore } from '../../../stores/artist-store';
import { ArtistCard } from './ArtistCard';
import { GalleryToolbar } from './GalleryToolbar';
import { ArtistPromptBuilder } from './ArtistPromptBuilder';
import { EditArtistDialog } from './EditArtistDialog';
import { cn, generateUUID } from '@/lib/utils';
import { ArtistDiscoveryDialog } from '../artist-discovery/ArtistDiscoveryDialog';
import { SyncStatusDialog } from './SyncStatusDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { PublishArtistDialog } from './PublishArtistDialog';
import { BatchPublishPanel } from './BatchPublishPanel';
import { Loader2, Plus, PenTool, Cloud, CheckSquare, XSquare, UploadCloud, MousePointerClick, Wand2, Globe, Palette, Wrench } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { danbooruService } from '../../../services/danbooru-service';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Artist, ArtistLite } from '@/stores/artist-store';

// ...

interface ArtistGalleryPanelProps {
    className?: string;
    minimal?: boolean; // For embedded use (e.g. Random Generator Picker)
    compact?: boolean; // For smaller thumbnails
    onSelectArtist?: (artist: ArtistLite) => void;
    onSelectCallback?: ((artist: ArtistLite) => void) | null;
}

// Define ArtistGridProps interface
interface ArtistGridProps {
    artists: ArtistLite[];
    compact?: boolean;
    minimal?: boolean;
    columnOverride?: number | null;
    selectedArtists: Record<string, number>;
    onSelectArtist?: (artist: ArtistLite) => void;
    globalSelectMode: boolean;
    onSelectCallback?: ((artist: ArtistLite) => void) | null;
    isSelectMode: boolean;
    toggleSelection: (id: string) => void;
    updateArtistIsFavorite: (id: string, isFavorite: boolean) => void;
    handleDeleteRequest: (id: string) => void;
    handlePublishRequest: (id: string, artist: ArtistLite) => void;
    handleEditRequest: (artist: ArtistLite) => void;
}

function ArtistGrid({
    artists, compact, minimal, columnOverride, selectedArtists, onSelectArtist,
    globalSelectMode, onSelectCallback, isSelectMode,
    toggleSelection, updateArtistIsFavorite, handleDeleteRequest, handlePublishRequest, handleEditRequest
}: ArtistGridProps) {
    const parentRef = React.useRef<HTMLDivElement>(null);
    const [columns, setColumns] = useState(4); // Default desktop fallback
    const [containerWidth, setContainerWidth] = useState(0);

    // 计算列数：优先使用手动设定值，否则自动计算
    useEffect(() => {
        if (columnOverride) {
            setColumns(columnOverride);
            return;
        }
        if (!parentRef.current) return;
        const observer = new ResizeObserver(entries => {
            const width = entries[0].contentRect.width;
            setContainerWidth(width);
            if (compact) {
                setColumns(4); 
            } else if (minimal) {
                if (width < 640) setColumns(2);
                else if (width < 768) setColumns(3);
                else setColumns(4);
            } else {
                if (width < 640) setColumns(2);
                else if (width < 1024) setColumns(3);
                else if (width < 1280) setColumns(4);
                else if (width < 1536) setColumns(5);
                else setColumns(6);
            }
        });
        observer.observe(parentRef.current);
        return () => observer.disconnect();
    }, [compact, minimal, columnOverride]);

    const gap = compact ? 8 : minimal ? 16 : 24; // 2, 4, 6 in tailwind terms (8px = gap-2)

    const itemHeight = useMemo(() => {
        if (!containerWidth) return compact ? 100 : minimal ? 180 : 280;
        
        const horizontalPadding = minimal ? 24 : 64; // 12+12 or 32+32
        const availableWidth = Math.max(0, containerWidth - horizontalPadding);
        const totalGapWidth = gap * (columns - 1);
        
        const columnWidth = (availableWidth - totalGapWidth) / columns;
        
        // aspect-[3/4] means height = width * (4/3) + 额外呼吸空间
        return columnWidth * (4 / 3) + 6;
    }, [containerWidth, columns, gap, minimal, compact]);
    const rowCount = Math.ceil(artists.length / columns);

    const virtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => itemHeight + gap,
        overscan: 5,
    });

    const items = virtualizer.getVirtualItems();

    return (
        <div ref={parentRef} className="h-full w-full overflow-y-auto overflow-x-hidden custom-scrollbar absolute inset-0">
            <div
                style={{
                    height: `${virtualizer.getTotalSize() + (minimal ? 24 : 48)}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {items.map((virtualRow) => {
                    const fromIndex = virtualRow.index * columns;
                    const toIndex = Math.min(fromIndex + columns, artists.length);
                    const rowArtists = artists.slice(fromIndex, toIndex);

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
                                paddingLeft: minimal ? '12px' : '32px',
                                paddingRight: minimal ? '12px' : '32px',
                                paddingBottom: `${gap}px`,
                                transform: `translateY(${virtualRow.start + (minimal ? 12 : 24)}px)`,
                            }}
                        >
                            {rowArtists.map((artist) => {
                                // For flex rendering, we just drop the `width` percentage calc because
                                // width gets clipped when flex wrapper shrinks.
                                // Instead we use a percentage width and force `flex-shrink-0`.
                                const itemWidth = `calc(${100 / columns}% - ${(gap * (columns - 1)) / columns}px)`;
                                return (
                                <div key={artist.id} style={{ width: itemWidth, flexShrink: 0 }}>
                                    <ArtistCard 
                                        artist={artist} 
                                        compact={compact}
                                        isSelected={!!selectedArtists[artist.id]}
                                        onToggle={(id) => {
                                            if (onSelectArtist) onSelectArtist(artist);
                                            else if (globalSelectMode && onSelectCallback) onSelectCallback(artist);
                                            else toggleSelection(id);
                                        }}
                                        onFavorite={updateArtistIsFavorite}
                                        onDelete={minimal ? undefined : () => handleDeleteRequest(artist.id)}
                                        onEdit={minimal ? undefined : () => handleEditRequest(artist)}
                                        onPublish={handlePublishRequest}
                                    />
                                </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
            
            {/* Spacer for bottom padding */}
            <div className="h-20 w-full flex-shrink-0 pointer-events-none" />
        </div>
    );
}

export const ArtistGalleryPanel: React.FC<ArtistGalleryPanelProps> = ({ className, minimal, compact, onSelectArtist, onSelectCallback }) => {
    const { 
        artists, 
        loadArtists, 
        searchQuery, 
        setSearchQuery, 
        sortMode, 
        setSortMode, 
        selectedArtists, 
        toggleSelection, 
        updateArtistIsFavorite,
        importArtists,
        isDataLoading,
        previewIds,
        setPreviewIds,
        deleteArtist,
        isSidebarOpen,
        setIsSidebarOpen,
        selectMode: globalSelectMode,
        onSelectCallback: storeOnSelectCallback
    } = useArtistStore();

    // ... (Keep existing state) ...
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [artistToEdit, setArtistToEdit] = useState<Artist | null>(null);
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
    const [discoveryTab, setDiscoveryTab] = useState<'discovery' | 'community'>('discovery');
    const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
    
    // --- Mobile Purge & Repair State ---
    const [isRepairing, setIsRepairing] = useState(false);
    const [repairProgress, setRepairProgress] = useState({ current: 0, total: 0, text: '' });
    const repairStopRef = useRef(false);

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
            loadArtists(); // Refresh list
        }
    };

    const handleCancelRepair = () => {
        repairStopRef.current = true;
    };
    // -----------------------------------
    
    const [artistToDelete, setArtistToDelete] = useState<{id: string, name: string} | null>(null);
    const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
    const [isBatchPublishOpen, setIsBatchPublishOpen] = useState(false);
    const [artistToPublish, setArtistToPublish] = useState<{id: string, name: string, tag: string, description?: string} | null>(null);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [columnOverride, setColumnOverride] = useState<number | null>(null);

    const deferredSearchQuery = useDeferredValue(searchQuery);
    const deferredSortMode = useDeferredValue(sortMode);

    const selectedCount = Object.keys(selectedArtists).length;

    const handleSelectAll = () => {
        const ids = filteredArtists.map(a => a.id);
        if (selectedCount === ids.length) {
            useArtistStore.getState().clearSelection();
        } else {
             // Select all visible
             ids.forEach(id => {
                 if (!selectedArtists[id]) toggleSelection(id);
             });
        }
    };
    
    // Toggle Select Mode
    const toggleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        if (isSelectMode) {
             useArtistStore.getState().clearSelection();
        }
    };
    
    // ... (Keep existing effects and handlers) ...
    useEffect(() => {
        loadArtists();
    }, []);

    const filteredArtists = useMemo(() => {
        // ... (Keep existing logic) ...
        let result = [...artists];
        if (previewIds) return result.filter(a => previewIds.includes(a.id));
        if (deferredSearchQuery) {
            const lowQ = deferredSearchQuery.toLowerCase();
            result = result.filter(a => 
                a.name.toLowerCase().includes(lowQ) || 
                a.tag.toLowerCase().includes(lowQ) ||
                (a.memo && a.memo.toLowerCase().includes(lowQ))
            );
        }
        switch (deferredSortMode) {
            case 'alpha-asc': result.sort((a,b) => a.name.localeCompare(b.name)); break;
            case 'alpha-desc': result.sort((a,b) => b.name.localeCompare(a.name)); break;
            case 'danbooru-desc': result.sort((a,b) => (b.danbooruCount || 0) - (a.danbooruCount || 0)); break;
            case 'danbooru-asc': result.sort((a,b) => (a.danbooruCount || 0) - (b.danbooruCount || 0)); break;
            case 'favorite': result = result.filter(a => a.isFavorite).sort((a,b) => a.name.localeCompare(b.name)); break;
            default: result.sort((a,b) => b.createdAt - a.createdAt); break; 
        }
        return result;
    }, [artists, deferredSearchQuery, deferredSortMode, previewIds]);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (Keep existing logic) ...
         const file = e.target.files?.[0];
         if (!file) return;
 
         const reader = new FileReader();
         reader.onload = async (event) => {
             try {
                 const json = JSON.parse(event.target?.result as string);
                 
                 const normalize = (list: any[]) => {
                     return list.map(item => ({
                         id: String(item.id || generateUUID()),
                         name: item.name || 'Unknown',
                         tag: item.tag || item.name || 'unknown',
                         imageUrl: item.imageUrl || item.image || '',
                         createdAt: typeof item.time === 'string' ? new Date(item.time).getTime() : (item.createdAt || Date.now()),
                         danbooruCount: item.danbooruCount || item.count || 0,
                         isFavorite: !!item.isFavorite,
                         description: item.description || ''
                     }));
                 };
 
                 let dataToImport: any[] = [];
                 if (Array.isArray(json)) {
                     dataToImport = json;
                 } else if (json.artists && Array.isArray(json.artists)) {
                     dataToImport = json.artists;
                 }
 
                 if (dataToImport.length > 0) {
                     const normalized = normalize(dataToImport);
                     await importArtists(normalized);
                     alert(`成功导入 ${dataToImport.length} 位画师!`);
                 } else {
                     alert('文件中未发现画师数据。');
                 }
             } catch (err) {
                 console.error("[ArtistImport] Import error:", err);
                 alert("JSON 解析失败: " + String(err));
             }
         };
         reader.readAsText(file);
    };

    const handleExport = () => {
         // ... (Keep logic) ...
         import('../../../services/artist-db').then(async ({ artistDB }) => {
            const all = await artistDB.getAllArtists();
            const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `artists_export_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    };

    const handleDeleteRequest = (id: string) => {
        const artist = artists.find(a => a.id === id);
        if (artist) {
            setArtistToDelete({ id: artist.id, name: artist.name });
        }
    };

    const handleEditRequest = async (artistLite: ArtistLite) => {
        try {
            // Need the full Artist object to edit memo
            const { artistDB } = await import('../../../services/artist-db');
            const fullArtist = await artistDB.getArtist(artistLite.id);
            if (fullArtist) {
                setArtistToEdit(fullArtist);
            }
        } catch (error) {
            console.error("Failed to load full artist for editing", error);
        }
    };

    const handleConfirmDelete = () => {
        if (artistToDelete) {
            deleteArtist(artistToDelete.id);
            setArtistToDelete(null);
        }
    };

    const handlePublishRequest = (id: string, artist: any) => {
        setArtistToPublish({ id: artist.id, name: artist.name, tag: artist.tag, description: artist.description });
        setIsPublishDialogOpen(true);
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    return (
        <div className={cn("flex h-full w-full overflow-hidden text-slate-900 dark:text-slate-100", minimal ? "bg-transparent" : "bg-slate-50 dark:bg-[#030712]", className)}>
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className={cn("flex-none z-10", minimal ? "p-3 pb-0" : "p-8 pb-0 bg-white/70 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 backdrop-blur-md mb-2 shadow-sm dark:shadow-none")}>
                    {!minimal && (
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-800 dark:text-white/90 tracking-tight">
                                    <Palette className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                                    <span>画师库</span>
                                <span className="text-xs font-semibold text-slate-500 dark:text-white/40 ml-3 px-3 py-1 bg-black/5 dark:bg-black/30 rounded-full border border-black/5 dark:border-white/5 shadow-inner">
                                        {artists.length} 位画师
                                    </span>
                                    {selectedCount > 0 && (
                                        <span className="text-indigo-400 text-xs font-semibold ml-2 px-3 py-1 bg-indigo-500/20 rounded-full border border-indigo-500/20 shadow-inner">
                                            已选 {selectedCount}
                                        </span>
                                    )}
                                </h1>
                            </div>
                            <div className="flex gap-2">
                                {isSelectMode ? (
                                    <>
                                        <Button 
                                            variant="outline"
                                            onClick={handleSelectAll}
                                            className="text-slate-600 dark:text-slate-300"
                                        >
                                            <CheckSquare className="w-4 h-4 mr-2" />
                                            {selectedCount === filteredArtists.length ? '全不选' : '全选'}
                                        </Button>
                                        <Button 
                                            onClick={() => setIsBatchPublishOpen(true)}
                                            disabled={selectedCount === 0}
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            <UploadCloud className="w-4 h-4 mr-2" />
                                            批量发布
                                        </Button>
                                        <Button 
                                            variant="ghost"
                                            onClick={toggleSelectMode}
                                            className="text-slate-500 hover:text-red-500"
                                        >
                                            <XSquare className="w-4 h-4 mr-2" />
                                            退出选择
                                        </Button>
                                    </>
                                ) : (
                                    !globalSelectMode && (
                                        <Button 
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleSelectMode}
                                            className="text-slate-500 hover:text-indigo-500"
                                            title="进入多选模式"
                                        >
                                            <MousePointerClick className="w-5 h-5" />
                                        </Button>
                                    )
                                )}
                                
                                <motion.button 
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setDiscoveryTab('community'); setIsDiscoveryOpen(true); }} 
                                    className="h-9 px-4 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors shadow-sm dark:shadow-lg"
                                >
                                    <Globe className="w-4 h-4 mr-1.5 opacity-70" />
                                    社区中心
                                </motion.button>
                                
                                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 my-auto" />
                                
                                <motion.button 
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleStartRepair} 
                                    disabled={isRepairing}
                                    className="h-9 px-4 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors shadow-lg disabled:opacity-50"
                                >
                                    {isRepairing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wrench className="w-4 h-4 mr-2 " />}
                                    {isRepairing ? '清理体积并修复' : '清理体积并修复'}
                                </motion.button>
                                
                                <motion.button 
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsSyncDialogOpen(true)}
                                    className="h-9 px-4 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors shadow-lg"
                                >
                                    <Cloud className="w-4 h-4 mr-2 " />
                                    Sync
                                </motion.button>
                                <motion.button 
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setArtistToEdit(null); setIsAddDialogOpen(true); }} 
                                    className="h-9 px-4 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors shadow-sm dark:shadow-lg"
                                >
                                    <Plus className="w-4 h-4 mr-1.5 opacity-70" />
                                    添加画师
                                </motion.button>
                            </div>
                        </div>
                    )}

                    {minimal && (
                        <div className="flex items-center justify-between mb-3 px-1 overflow-x-auto no-scrollbar">
                             <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap mr-2">
                                 {artists.length} 位画师
                             </div>
                             <div className="flex gap-1.5 shrink-0 bg-black/5 dark:bg-black/20 p-1 rounded-2xl border border-black/5 dark:border-white/5 shadow-inner">
                                <motion.button 
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setDiscoveryTab('discovery'); setIsDiscoveryOpen(true); }} 
                                    className="h-8 w-8 px-0 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-black/5 dark:hover:bg-black/40 transition-colors"
                                    title="发现画师"
                                >
                                    <Wand2 className="w-4 h-4" />
                                </motion.button>
                                <motion.button 
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setDiscoveryTab('community'); setIsDiscoveryOpen(true); }} 
                                    className="h-8 w-8 px-0 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-black/5 dark:hover:bg-black/40 transition-colors"
                                    title="社区画师"
                                >
                                    <Globe className="w-4 h-4" />
                                </motion.button>
                                <div className="w-px h-4 bg-black/10 dark:bg-white/10 my-auto mx-1" />
                                <motion.button 
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleStartRepair} 
                                    disabled={isRepairing}
                                    className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 border border-indigo-200 dark:border-indigo-500/30 transition-colors disabled:opacity-50"
                                >
                                    {isRepairing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5 mr-1.5" />}
                                    瘦身补全
                                </motion.button>
                                <motion.button 
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsSyncDialogOpen(true)} 
                                    className="h-8 w-8 px-0 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-black/5 dark:hover:bg-black/40 transition-colors"
                                    title="Sync Status"
                                >
                                    <Cloud className="w-4 h-4" />
                                </motion.button>
                                <motion.button 
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setArtistToEdit(null); setIsAddDialogOpen(true); }} 
                                    className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 transition-colors shadow-sm shadow-black/5 dark:shadow-inner"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                                    Add
                                </motion.button>
                             </div>
                        </div>
                    )}

                    <GalleryToolbar 
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        sortMode={sortMode}
                        onSortChange={setSortMode}
                        onImport={handleImport}
                        onExport={handleExport}
                        onDiscovery={() => { 
                            setDiscoveryTab('discovery'); 
                            setIsDiscoveryOpen(true); 
                        }}
                        onCommunity={() => { 
                            setDiscoveryTab('community'); 
                            setIsDiscoveryOpen(true); 
                        }}
                        minimal={minimal}
                        columnCount={columnOverride ?? undefined}
                        onColumnChange={(cols) => setColumnOverride(prev => prev === cols ? null : cols)}
                    />
                </div>

                {previewIds && (
                    <div className="px-6 pb-4 flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 mx-6 mb-4 rounded-lg border border-indigo-100 dark:border-indigo-800 p-3 shadow-sm dark:shadow-none">
                        {/* ... keep preview banner ... */}
                         <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300">
                             <span className="font-semibold">正在预览画师组合</span>
                             <span className="bg-white dark:bg-indigo-950 px-2 py-0.5 rounded text-xs opacity-80 border border-indigo-100 dark:border-transparent">
                                 {filteredArtists.length} 位画师
                             </span>
                        </div>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-800/30 h-8"
                            onClick={() => setPreviewIds(null)}
                        >
                            退出预览
                        </Button>
                    </div>
                )}

                <div className="flex-1 min-h-0 relative w-full h-full pb-0 bg-transparent">
                    {isDataLoading && artists.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                        </div>
                    ) : filteredArtists.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                            <p className="text-lg font-medium">未找到画师</p>
                            <p className="text-sm">请尝试调整搜索条件或导入数据。</p>
                        </div>
                    ) : (
                                <ArtistGrid
                                    artists={filteredArtists}
                                    compact={compact}
                                    minimal={minimal}
                                    columnOverride={columnOverride}
                                    selectedArtists={selectedArtists}
                                    onSelectArtist={onSelectArtist}
                                    globalSelectMode={globalSelectMode}
                                    onSelectCallback={onSelectCallback || storeOnSelectCallback}
                                    isSelectMode={isSelectMode}
                                    toggleSelection={toggleSelection}
                                    updateArtistIsFavorite={updateArtistIsFavorite}
                                    handleDeleteRequest={handleDeleteRequest}
                                    handleEditRequest={handleEditRequest}
                                    handlePublishRequest={handlePublishRequest as any}
                                />
                        )}
                </div>
            </div>
            
            {/* Sidebar (Prompt Builder) - Hide in minimal mode */}
            {!minimal && (
                <div className={cn(
                    "w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out flex-none z-20 shadow-xl",
                    !isSidebarOpen && "w-0 opacity-0 overflow-hidden border-none"
                )}>
                    <ArtistPromptBuilder onClose={() => setIsSidebarOpen(false)} />
                </div>
            )}

            {/* Modals and Overlays */}
            <SyncStatusDialog 
                open={isSyncDialogOpen} 
                onOpenChange={(open) => {
                    setIsSyncDialogOpen(open);
                    if (!open) loadArtists();
                }}
            />

            <EditArtistDialog 
                open={isAddDialogOpen || artistToEdit !== null} 
                onOpenChange={(open) => {
                    if (!open) {
                        setIsAddDialogOpen(false);
                        setArtistToEdit(null);
                        loadArtists();
                    }
                }}
                initialData={artistToEdit}
            />

            <ArtistDiscoveryDialog
                open={isDiscoveryOpen}
                onOpenChange={setIsDiscoveryOpen}
                initialTab={discoveryTab}
            />

            {/* Repair Progress Overlay */}
            <AnimatePresence>
                {isRepairing && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 dark:border-white/10 flex flex-col items-center text-center"
                        >
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                正在进行数据瘦身与在线补偿
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                {repairProgress.text}
                            </p>
                            
                            <div className="w-full bg-slate-100 dark:bg-black/40 rounded-full h-2 mb-2 overflow-hidden">
                                <motion.div 
                                    className="bg-indigo-500 h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${repairProgress.total > 0 ? (repairProgress.current / repairProgress.total) * 100 : 0}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                            <div className="text-xs font-mono text-slate-400 dark:text-slate-500 w-full text-right mb-6">
                                {repairProgress.current} / {repairProgress.total}
                            </div>
                            
                            <button
                                onClick={handleCancelRepair}
                                className="px-6 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-medium transition-colors text-sm"
                            >
                                中止任务
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <DeleteConfirmationDialog 
                open={!!artistToDelete} 
                onOpenChange={(open) => !open && setArtistToDelete(null)}
                onConfirm={handleConfirmDelete}
                artistName={artistToDelete?.name}
            />

            <PublishArtistDialog 
                open={isPublishDialogOpen} 
                onOpenChange={(open) => {
                    setIsPublishDialogOpen(open);
                    if (!open) loadArtists(); // Refresh after publish (which might update preview link)
                }}
                artist={artistToPublish} 
            />

            <BatchPublishPanel
                isOpen={isBatchPublishOpen}
                onClose={() => setIsBatchPublishOpen(false)}
                selectedArtists={filteredArtists.filter(a => selectedArtists[a.id])}
                onComplete={() => {
                    useArtistStore.getState().clearSelection();
                    setIsSelectMode(false);
                }}
            />
        </div>
    );
};
