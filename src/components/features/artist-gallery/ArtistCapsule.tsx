import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/atoms/Slider';
import { Button } from '@/components/atoms/Button';

import { Input } from '@/components/atoms/Input';

interface ArtistCapsuleProps {
    tag: string;
    /** 画师显示名（优先于 tag） */
    name?: string;
    /** 画师私人备注 */
    memo?: string;
    weight: number; 
    onUpdate: (weight: number) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
    year?: string;
    withYearPrefix?: boolean;
    onYearChange: (year?: string) => void;
    onToggleYearPrefix: () => void;
}

export const ArtistCapsule = React.forwardRef<HTMLDivElement, ArtistCapsuleProps>(({ 
    tag, 
    name,
    memo,
    weight: initialWeight, 
    onUpdate, 
    onRemove, 
    onMoveUp, 
    onMoveDown,
    isFirst, 
    isLast,
    year,
    withYearPrefix = true,
    onYearChange,
    onToggleYearPrefix
}, ref) => {
    const [localWeight, setLocalWeight] = useState(initialWeight);
    const [isHovered, setIsHovered] = useState(false);

    // Sync local weight with prop if prop changes (e.g. external update)
    useEffect(() => {
        setLocalWeight(initialWeight);
    }, [initialWeight]);

    // Strip "artist:" prefix for display
    const displayName = tag.replace(/^artist:/, '');

    // Determine color based on weight
    const getWeightColor = (w: number) => {
        if (w > 1.5) return "text-purple-400";
        if (w < 0.8) return "text-slate-500";
        return "text-indigo-400";
    };

    const getBgColor = (w: number) => {
        if (w > 1.5) return "bg-purple-50 dark:bg-purple-900/10 border-purple-200/50 dark:border-purple-500/10 shadow-sm dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] hover:border-purple-300 dark:hover:border-purple-500/30";
        if (w < 0.8) return "bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] hover:border-slate-300 dark:hover:border-white/10";
        return "bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200/50 dark:border-indigo-500/10 shadow-sm dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] hover:border-indigo-300 dark:hover:border-indigo-500/30";
    };

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 500, damping: 40, mass: 1 }}
            className={cn(
                "group relative flex items-center gap-3 px-3 py-1.5 rounded-2xl border backdrop-blur-md transition-colors",
                getBgColor(localWeight),
                isHovered ? "z-10 bg-white/50 dark:bg-black/40 shadow-md dark:shadow-none" : "z-0"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Section 1: Name, Memo & Indicator */}
            <div className="flex items-center gap-2 min-w-[80px] max-w-[40%] shrink-0 overflow-hidden">
                <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-500",
                    localWeight > 1.0 ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" : "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                )} />
                <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate tracking-tight" title={name || displayName}>
                        {name || displayName}
                    </span>
                    {memo && (
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400/80 truncate leading-tight" title={memo}>
                            {memo}
                        </span>
                    )}
                </div>
            </div>

            {/* Section 2: Slider (Flexible) */}
            <div className="flex-1 flex items-center gap-1.5 min-w-[60px] touch-none" onPointerDown={(e) => e.stopPropagation()}>
                 <Slider
                    value={[localWeight]}
                    min={0.1}
                    max={5.0}
                    step={0.05}
                    onValueChange={([val]) => setLocalWeight(val)}
                    onValueCommit={([val]) => onUpdate(val)}
                    className="flex-1 h-4 py-1 cursor-grab active:cursor-grabbing touch-none"
                    style={{ touchAction: 'none' }}
                />
                <span className={cn(
                        "text-[10px] font-mono font-bold shrink-0 tabular-nums transition-colors",
                        getWeightColor(localWeight)
                    )}>
                        {localWeight.toFixed(2)}x
                </span>
            </div>

            {/* Section 2.5: Year Input & Toggle */}
            <div className="flex items-center gap-0.5 shrink-0 bg-slate-200/50 dark:bg-black/20 rounded-lg p-0.5 border border-slate-300/50 dark:border-white/5 shadow-inner" onPointerDown={(e) => e.stopPropagation()}>
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); onToggleYearPrefix(); }}
                    className={cn(
                        "h-5 w-4 flex items-center justify-center text-[9px] font-mono rounded-[6px] hover:bg-white/50 dark:hover:bg-white/10 transition-colors",
                        withYearPrefix ? "text-indigo-600 dark:text-indigo-400 bg-white dark:bg-white/5 shadow-sm" : "text-slate-400 dark:text-slate-600"
                    )}
                    title={withYearPrefix ? "Prefix 'year' included" : "No prefix"}
                >
                    Yr
                </motion.button>
                <div className="w-[1px] h-3 bg-slate-200 dark:bg-white/10 mx-0.5" />
                <Input
                    value={year || ''}
                    onChange={(e) => onYearChange(e.target.value || undefined)}
                    placeholder="Year"
                    className="h-5 w-[32px] text-[10px] px-0.5 bg-transparent border-0 focus-visible:ring-0 focus-visible:bg-white/50 dark:focus-visible:bg-white/10 hover:bg-white/40 dark:hover:bg-white/5 rounded-[6px] transition-colors text-center placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-700 dark:text-slate-200 focus:text-indigo-600 dark:focus:text-indigo-300"
                />
            </div>

            {/* Section 3: Controls (Fixed) */}
            <div className="flex items-center shrink-0 min-w-0 ml-1">
                <div className="flex flex-col gap-0.5 mr-0.5">
                     <button
                        disabled={isFirst}
                        onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                        className="h-3 w-4 p-0 flex items-center justify-center rounded-[4px] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 transition-colors"
                    >
                        <ChevronUp className="w-2.5 h-2.5" />
                    </button>
                    <button
                        disabled={isLast}
                        onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                        className="h-3 w-4 p-0 flex items-center justify-center rounded-[4px] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 transition-colors"
                    >
                        <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                </div>

                <motion.button
                    whileTap={{ scale: 0.8 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="h-6 w-5 p-0 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </motion.button>
            </div>
            
            {/* Background Glow Effect */}
            <div className={cn(
                "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                "bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent"
            )} />
        </motion.div>
    );
});
ArtistCapsule.displayName = 'ArtistCapsule';

interface ArtistListProps {
    artists: { id: string; tag: string; weight: number; year?: string; withYearPrefix?: boolean; name?: string; memo?: string }[];
    onUpdate: (id: string, weight: number) => void;
    onRemove: (id: string) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
    onYearChange: (id: string, year?: string) => void;
    onToggleYearPrefix: (id: string) => void;
}

export function ArtistList({ artists, onUpdate, onRemove, onMove, onYearChange, onToggleYearPrefix }: ArtistListProps) {
    return (
        <div className="flex flex-col gap-1.5 p-1">
            <AnimatePresence mode="popLayout" initial={false}>
                {artists.map((artist, index) => (
                    <ArtistCapsule
                        key={artist.id}
                        tag={artist.tag}
                        name={artist.name}
                        memo={artist.memo}
                        weight={artist.weight}
                        onUpdate={(w) => onUpdate(artist.id, w)}
                        onRemove={() => onRemove(artist.id)}
                        onMoveUp={() => onMove(artist.id, 'up')}
                        onMoveDown={() => onMove(artist.id, 'down')}
                        isFirst={index === 0}
                        isLast={index === artists.length - 1}
                        year={artist.year}
                        withYearPrefix={artist.withYearPrefix}
                        onYearChange={(y) => onYearChange(artist.id, y)}
                        onToggleYearPrefix={() => onToggleYearPrefix(artist.id)}
                    />
                ))}
            </AnimatePresence>
            
            {artists.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 mt-2 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-black/20 shadow-inner">
                    <Layers className="w-8 h-8 mb-3 opacity-20" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">无固定画师</p>
                    <p className="text-xs opacity-60 mt-1 text-center leading-relaxed text-slate-600 dark:text-slate-400">
                        从右侧画师库首选项添加
                        <br />
                        支持独立权重和年代调节
                    </p>
                </div>
            )}
        </div>
    );
}
