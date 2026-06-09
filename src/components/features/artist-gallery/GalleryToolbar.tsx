import React, { useRef } from 'react';
import { SortMode } from '../../../types/artist';
import { ArrowUpCircle, ArrowDownCircle, Filter, AlignLeft, Layers, Heart, ArrowUp, ArrowDown, Wand2, Globe, Grid2x2, Grid3x3, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/atoms/Button';
import { motion } from 'framer-motion';

interface GalleryToolbarProps {
    searchQuery: string;
    onSearchChange: (val: string) => void;
    sortMode: SortMode;
    onSortChange: (mode: SortMode) => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExport: () => void;
    onDiscovery: () => void;
    onCommunity: () => void;
    minimal?: boolean;
    columnCount?: number;
    onColumnChange?: (cols: number) => void;
}

export const GalleryToolbar: React.FC<GalleryToolbarProps> = ({ 
    searchQuery, onSearchChange, sortMode, onSortChange, onImport, onExport, onDiscovery, onCommunity, minimal, columnCount, onColumnChange
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);


    const FilterBtn = ({ mode, label, icon: Icon, hasDir }: { mode: SortMode | 'default' | 'alpha' | 'danbooru' | 'favorite', label: string, icon: any, hasDir?: boolean }) => {
        // ... (Keep existing logic) ...
        let isActive = false;
        let currentDir = '';

        if (mode === 'default') {
            isActive = sortMode === 'default';
        } else if (mode === 'alpha') {
            isActive = sortMode.includes('alpha');
            currentDir = sortMode === 'alpha-asc' ? 'up' : 'down';
        } else if (mode === 'danbooru') {
            isActive = sortMode.includes('danbooru');
            currentDir = sortMode === 'danbooru-asc' ? 'up' : 'down'; 
        } else if (mode === 'favorite') {
             isActive = sortMode === 'favorite';
        }

        const handleClick = () => {
             // ... keep logic ...
             if (mode === 'default') onSortChange('default');
             else if (mode === 'favorite') onSortChange('favorite');
             else if (mode === 'alpha') {
                 onSortChange(sortMode === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc');
             } else if (mode === 'danbooru') {
                 onSortChange(sortMode === 'danbooru-desc' ? 'danbooru-asc' : 'danbooru-desc');
             }
        };

        return (
            <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleClick}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all border",
                    isActive 
                        ? (minimal ? "bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white border-black/10 dark:border-white/20 shadow-sm" : "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 shadow-none dark:shadow-inner")
                        : (minimal ? "bg-slate-50 dark:bg-black/20 border-black/5 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-black/40 hover:text-slate-700 dark:hover:text-slate-300 shadow-sm dark:shadow-inner" : "bg-white dark:bg-white/5 border-black/10 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm dark:shadow-none")
                )}
            >
                <Icon className={cn("w-3.5 h-3.5", isActive && !minimal && "text-indigo-600 dark:text-indigo-400")} />
                <span>{label}</span>
                {hasDir && isActive && (
                    <span className="ml-1 text-indigo-600 dark:text-indigo-400">
                        {currentDir === 'up' 
                            ? <ArrowUp className="w-3 h-3"/>
                            : <ArrowDown className="w-3 h-3"/>
                        }
                    </span>
                )}
            </motion.button>
        );
    };

    return (
        <div className={cn("flex flex-col gap-4 mb-2 z-10 relative", minimal ? "gap-3" : "md:flex-row items-center mb-6")}>
            {/* Search Bar */}
            <div className={cn("relative group w-full", minimal ? "" : "md:w-80")}>
                <svg className={cn("w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 transition-colors", minimal ? "text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400" : "text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400")} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                    type="text"
                    placeholder="搜索画师..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className={cn(
                        "w-full pl-11 pr-4 h-10 transition-all text-sm focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 rounded-2xl",
                        minimal 
                            ? "bg-slate-100 dark:bg-black/20 border border-black/5 dark:border-white/5 text-slate-700 dark:text-slate-200 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-500/50 shadow-inner" 
                            : "bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-500/50 shadow-sm dark:shadow-inner"
                    )}
                />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full scrollbar-hide">
                <FilterBtn mode="default" label="默认" icon={Filter} />
                <FilterBtn mode="favorite" label="收藏" icon={Heart} />
                {!minimal && (
                    <>
                        <FilterBtn mode="alpha" label="名称" icon={AlignLeft} hasDir />
                        <FilterBtn mode="danbooru" label="热度" icon={Layers} hasDir />
                    </>
                )}

                {/* 列数切换按钮组 */}
                {onColumnChange && (
                    <div className="flex items-center gap-1 ml-auto bg-slate-100 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl p-1 shadow-inner">
                        {[2, 3, 4].map(cols => (
                            <motion.button
                                key={cols}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onColumnChange(cols)}
                                className={cn(
                                    "h-7 w-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all",
                                    columnCount === cols
                                        ? "bg-white dark:bg-white/15 text-indigo-600 dark:text-indigo-300 shadow-sm"
                                        : "text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/60 hover:bg-white/50 dark:hover:bg-white/5"
                                )}
                                title={`${cols} 列`}
                            >
                                {cols === 2 && <Grid2x2 className="w-3.5 h-3.5" />}
                                {cols === 3 && <Grid3x3 className="w-3.5 h-3.5" />}
                                {cols === 4 && <LayoutGrid className="w-3.5 h-3.5" />}
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>

            {!minimal && <div className="flex-1" />}

                <div className="flex items-center gap-2">
                    <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={onImport} 
                    />
                    {!minimal && (
                        <div className="flex items-center py-1 px-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-full backdrop-blur-sm mr-2 shadow-sm dark:shadow-inner">
                            <motion.button 
                                whileTap={{ scale: 0.9 }}
                                className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                onClick={onDiscovery}
                                title="发现画师 (Danbooru)"
                            >
                                <Wand2 className="w-4 h-4" />
                            </motion.button>
                            <motion.button 
                                whileTap={{ scale: 0.9 }}
                                className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                onClick={onCommunity}
                                title="社区画师库 (Community)"
                            >
                                <Globe className="w-4 h-4" />
                            </motion.button>
                        </div>
                    )}
                    
                    {!minimal && (
                        <div className="flex items-center py-1 px-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-full backdrop-blur-sm shadow-sm dark:shadow-inner">
                            <motion.button 
                                whileTap={{ scale: 0.9 }}
                                className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                                title="导入数据"
                            >
                                <ArrowUpCircle className="w-4 h-4" />
                            </motion.button>
                            <motion.button 
                                whileTap={{ scale: 0.9 }}
                                className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                onClick={onExport}
                                title="导出数据"
                            >
                                <ArrowDownCircle className="w-4 h-4" />
                            </motion.button>
                        </div>
                    )}
                </div>
        </div>
    );
};
