import React, { lazy, useState, useEffect } from 'react';
import { Button } from '@/components/atoms/Button';
import { Label } from '@/components/atoms/Label';
import { Textarea } from '@/components/atoms/Textarea';
import { Input } from '@/components/atoms/Input';
import { Dices, Link, Settings2, Save, Lock, Layers, Plus, Trash2, ClipboardPaste } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useGenerationStore } from '@/stores/generation-store';
import { useArtistStore, type FixedArtistItem, parseFixedArtistsString, serializeFixedArtists } from '@/stores/artist-store';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/atoms/Dialog';
import { ArtistGalleryPanel } from './ArtistGalleryPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/Select';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { cn, generateUUID } from '@/lib/utils';
import { Slider } from '@/components/atoms/Slider';
import { ArtistList } from './ArtistCapsule';
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary';

const LottieAnimation = lazy(() => import('@/components/atoms/LottieAnimation').then((module) => ({ default: module.LottieAnimation })));


interface RandomArtistGeneratorProps {
    minimal?: boolean;
}

export const RandomArtistGenerator: React.FC<RandomArtistGeneratorProps> = ({ minimal }) => {
    const { 
        // 结构化数据（直接读写，无需 parse/serialize）
        randomFixedArtists: fixedItems,
        setRandomFixedArtists: setFixedItems,
        addFixedArtist,
        removeFixedArtist,
        updateFixedArtist,
        moveFixedArtist,
        getFixedArtistsString,
        // 池 & 范围
        randomPoolText: poolText, 
        setRandomPoolText: setPoolText,
        randomCountRange: countRange, 
        setRandomCountRange: setCountRange,
        randomUsePrefix: usePrefix, 
        // 格式设置（持久化）
        useV4Format,
        setUseV4Format,
        randomOutputFormat: outputFormat,
        setRandomOutputFormat: setOutputFormat,
        randomGlobalWeight: globalWeight,
        setRandomGlobalWeight: setGlobalWeight,
        // 其他
        setSelectMode,
        addCombo,
        combos,
        deleteCombo
    } = useArtistStore();
    
    // View State
    const [activeTarget, setActiveTarget] = useState<'fixed' | 'pool'>('fixed');
    const [poolViewMode, setPoolViewMode] = useState<'ui' | 'text'>('ui');

    // Combo State
    const [isSaveComboOpen, setIsSaveComboOpen] = useState(false);
    const [isLoadComboOpen, setIsLoadComboOpen] = useState(false);
    const [comboName, setComboName] = useState('');
    const [loadTab, setLoadTab] = useState<'saved' | 'text'>('saved');
    const [importText, setImportText] = useState('');

    const [localGlobalWeight, setLocalGlobalWeight] = useState(globalWeight);
    useEffect(() => setLocalGlobalWeight(globalWeight), [globalWeight]);

    const setPendingTagsToAppend = useGenerationStore((state) => state.setPendingTagsToAppend);

    // --- 直接操作结构化数据，无需 parse/serialize ---

    const handleUpdateArtist = (id: string, newWeight: number) => {
        updateFixedArtist(id, { weight: newWeight });
    };

    const handleUpdateArtistYear = (id: string, year?: string) => {
        updateFixedArtist(id, { year, withYearPrefix: true });
    };

    const handleToggleYearPrefix = (id: string) => {
        const item = fixedItems.find(a => a.id === id);
        if (item) {
            updateFixedArtist(id, { withYearPrefix: !item.withYearPrefix });
        }
    };

    const handleRemoveArtist = (id: string) => {
        removeFixedArtist(id);
    };

    const handleMoveArtist = (id: string, direction: 'up' | 'down') => {
        moveFixedArtist(id, direction);
    };

    // --- Random Pool Structured Actions ---

    const {
        randomPoolItems: poolItems,
        setRandomPoolItems: setPoolItems,
        addPoolItem,
        removePoolItem,
        updatePoolItem,
        movePoolItem
    } = useArtistStore();

    const handleUpdatePoolArtist = (id: string, newWeight: number) => {
        updatePoolItem(id, { weight: newWeight });
    };

    const handleUpdatePoolArtistYear = (id: string, year?: string) => {
        updatePoolItem(id, { year, withYearPrefix: true });
    };

    const handleTogglePoolYearPrefix = (id: string) => {
        const item = poolItems.find(a => a.id === id);
        if (item) {
            updatePoolItem(id, { withYearPrefix: !item.withYearPrefix });
        }
    };

    const handleRemovePoolArtist = (id: string) => {
        removePoolItem(id);
    };

    const handleMovePoolArtist = (id: string, direction: 'up' | 'down') => {
        movePoolItem(id, direction);
    };

    // --- Selection Logic ---

    useEffect(() => {
        setSelectMode(true, (artist) => {
            let tag = artist.tag;
            
            if (outputFormat === 'artist_tag') {
                if (!tag.startsWith('artist:')) tag = `artist:${tag}`;
            } else if (outputFormat === 'name_only') {
                tag = tag.replace(/^artist:/, '');
            }

            if (activeTarget === 'fixed') {
                addFixedArtist({
                    id: generateUUID(),
                    tag,
                    weight: globalWeight,
                    withYearPrefix: true,
                    name: artist.name,
                    memo: artist.memo
                });
                
                toast({
                    title: "Added Artist",
                    description: `${artist.name} (${globalWeight}x)`,
                    duration: 1000,
                });
            } else {
                // Add to Structured Pool
                addPoolItem({
                    id: generateUUID(),
                    tag,
                    weight: globalWeight,
                    withYearPrefix: true,
                    name: artist.name,
                    memo: artist.memo
                });

                // Also append to Text for sync
                let entry = tag;
                if (globalWeight !== 1.0 || useV4Format) {
                    entry = `${globalWeight}::${tag}::`;
                }
                const current = poolText;
                const separator = current.trim() && !current.endsWith('\n') ? '\n' : '';
                setPoolText(current + separator + entry);
                
                toast({
                    title: "Added to Pool",
                    description: `${artist.name}`,
                    duration: 1000,
                });
            }
        });

        return () => {};
    }, [activeTarget, outputFormat, useV4Format, globalWeight, fixedItems, poolText, setPoolText, setSelectMode, addFixedArtist, addPoolItem]);

    // Cleanup on unmount
    useEffect(() => {
        return () => setSelectMode(false);
    }, []);

    const handleSaveCombo = () => {
        if (!comboName.trim()) {
            toast({ title: "请输入组合名称", variant: "destructive" });
            return;
        }
        if (fixedItems.length === 0) {
            toast({ title: "固定画师池为空", variant: "destructive" });
            return;
        }

        addCombo({
            id: generateUUID(),
            name: comboName.trim(),
            prompt: getFixedArtistsString(),
            createdAt: Date.now()
        });

        toast({ title: "组合已保存", description: comboName });
        setIsSaveComboOpen(false);
        setComboName('');
    };

    /**
     * 解析画师文本串为结构化数据
     * 支持格式：
     *   - V4: `1.5::artist:name::` 或 `1.5::artist:name::,2024` 或 `1.5::artist:name::，2024`
     *   - 标准: `(artist:name:1.5)`
     *   - 纯文本: `artist:name`
     */
    const parseArtistTextBlock = (rawText: string): FixedArtistItem[] => {
        // 预处理：将全角逗号统一为半角，按换行拆分
        const normalized = rawText.replace(/，/g, ',');
        const lines = normalized.split(/\n/).filter(l => l.trim());

        return lines.map(line => {
            let fullTag = line.trim();
            // 移除行尾的孤立逗号（如 `1.5::artist:name::,`）
            fullTag = fullTag.replace(/,\s*$/, '').trim();

            // 提取年份（行末 `,2024` 或 `, year 2024`）
            let year: string | undefined;
            let withYearPrefix = true;
            const yearMatch = fullTag.match(/,\s*(?:(year\s+)(\S+)|(20\d{2}|19\d{2}))\s*$/i);
            if (yearMatch) {
                if (yearMatch[1]) { withYearPrefix = true; year = yearMatch[2]; }
                else { withYearPrefix = false; year = yearMatch[3]; }
                fullTag = fullTag.substring(0, yearMatch.index).trim();
            }

            let weight = 1.0, tag = fullTag;

            // V4 格式: 1.2::tag::
            const v4Match = fullTag.match(/^([\d.]+)::(.+)::$/);
            if (v4Match) {
                weight = parseFloat(v4Match[1]);
                tag = v4Match[2];
            } else {
                // 标准格式: (tag:1.2)
                const stdMatch = fullTag.match(/^\((.+):([\d.]+)\)$/);
                if (stdMatch) {
                    tag = stdMatch[1];
                    weight = parseFloat(stdMatch[2]);
                }
            }

            // Fallback: 年份可能在 tag 内部
            if (!year) {
                const inner = tag.match(/,\s*(?:(year\s+)(\S+)|(20\d{2}|19\d{2}))\s*$/i);
                if (inner) {
                    if (inner[1]) { withYearPrefix = true; year = inner[2]; }
                    else { withYearPrefix = false; year = inner[3]; }
                    tag = tag.substring(0, inner.index).trim();
                }
            }

            return { id: generateUUID(), tag, weight, year, withYearPrefix };
        });
    };

    const handleLoadCombo = (combo: any) => {
        const items = parseArtistTextBlock(combo.prompt as string);
        setFixedItems(items);
        setIsLoadComboOpen(false);
        toast({ title: "组合已加载", description: combo.name });
    };

    /** 从文本串直接导入画师到固定列表 */
    const handleImportFromText = () => {
        if (!importText.trim()) {
            toast({ title: "请粘贴画师文本", variant: "destructive" });
            return;
        }

        const items = parseArtistTextBlock(importText);
        if (items.length === 0) {
            toast({ title: "未识别到有效画师", variant: "destructive" });
            return;
        }

        setFixedItems(items);
        setIsLoadComboOpen(false);
        setImportText('');
        toast({ title: "文本导入成功", description: `已加载 ${items.length} 位画师` });
    };

    const handleGenerateAndCopy = () => {
        // Sync text -> items if needed before generating
        let currentPoolItems = poolItems;
        if (poolViewMode === 'text') {
            currentPoolItems = parseFixedArtistsString(poolText);
            setPoolItems(currentPoolItems);
        }

        let selectedRandom: string[] = [];
        if (currentPoolItems.length > 0) {
            const count = Math.floor(Math.random() * (countRange.max - countRange.min + 1)) + countRange.min;
            const poolCopy = [...currentPoolItems];
            for (let i = 0; i < count; i++) {
                if (poolCopy.length === 0) break;
                const idx = Math.floor(Math.random() * poolCopy.length);
                const item = poolCopy[idx];
                
                let text = item.tag;
                if (item.year) {
                    text += item.withYearPrefix ? `, year ${item.year}` : `, ${item.year}`;
                }
                if (item.weight !== 1.0 || useV4Format) {
                    selectedRandom.push(`${item.weight}::${text}::`);
                } else {
                    selectedRandom.push(text);
                }

                poolCopy.splice(idx, 1);
            }
        }

        const fixedString = getFixedArtistsString();
        const fixedParts = fixedString.split('\n').filter(l => l.trim());
        
        const finalParts = [...fixedParts, ...selectedRandom];
        const finalString = finalParts.join(', ');
        
        navigator.clipboard.writeText(finalString);
        toast({ title: "已生成并复制", description: `Fixed: ${fixedParts.length}, Random: ${selectedRandom.length}` });
    };

    const handleAddFixedToPrompt = () => {
        if (fixedItems.length === 0) {
            console.log("Fixed artists list is empty, skipping add.");
            return;
        }
        
        const textToAdd = "<固定画师>";
        setPendingTagsToAppend(textToAdd);
        toast({ title: "已添加到主体", description: "<固定画师> 通配符已追加" });
    };

    return (
        <div className={cn("flex flex-col md:flex-row h-full w-full overflow-hidden transition-all", minimal ? "bg-transparent text-white" : "bg-slate-50 dark:bg-[#030712] text-slate-800 dark:text-slate-200")}>
            {/* Main Panel: Controls */}
            <div className={cn("flex-1 flex flex-col gap-5 overflow-y-auto custom-scrollbar min-w-0", minimal ? "p-0" : "p-6")}>
                
                {/* Header Section */}
                {!minimal && (
                    <div className="flex-none space-y-1">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                            画师库
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            管理固定画师与随机灵感
                        </p>
                    </div>
                )}

                <div className="flex-1 flex flex-col gap-6">
                    {/* Control Group */}
                    <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-1.5 shadow-sm backdrop-blur-xl">
                         <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/5 dark:bg-black/20 rounded-xl shadow-inner">
                            <button
                                onClick={() => setActiveTarget('fixed')}
                                className={cn(
                                    "relative flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-all duration-300",
                                    minimal ? "py-3 text-[13px]" : "py-2.5",
                                    activeTarget === 'fixed' 
                                        ? "text-indigo-600 dark:text-indigo-400 bg-white dark:bg-white/10 shadow-sm ring-1 ring-black/5 dark:ring-white/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                            >
                                <span className="relative z-10 flex items-center gap-2"><Lock className="w-4 h-4" /> 固定画师</span>
                                {activeTarget === 'fixed' && (
                                    <motion.div
                                        layoutId="activeTabFixed"
                                        className="absolute inset-0 bg-white dark:bg-white/5 rounded-lg border border-indigo-500/20 shadow-sm dark:shadow-none"
                                        initial={false}
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTarget('pool')}
                                className={cn(
                                    "relative flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-all duration-300",
                                    minimal ? "py-3 text-[13px]" : "py-2.5",
                                    activeTarget === 'pool' 
                                        ? "text-violet-600 dark:text-violet-400 bg-white dark:bg-white/10 shadow-sm ring-1 ring-black/5 dark:ring-white/10 shadow-[0_0_15px_rgba(139,92,246,0.2)]" 
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                            >
                                <span className="relative z-10 flex items-center gap-2"><Dices className="w-4 h-4" /> 随机池</span>
                                {activeTarget === 'pool' && (
                                    <motion.div
                                        layoutId="activeTabPool"
                                        className="absolute inset-0 bg-white dark:bg-white/5 rounded-lg border border-violet-500/20 shadow-sm dark:shadow-none"
                                        initial={false}
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Format Options & Global Weight */}
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                             <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">输出格式</Label>
                             <Select value={outputFormat} onValueChange={setOutputFormat}>
                                <SelectTrigger className={cn(
                                    "backdrop-blur-sm rounded-xl focus:ring-1 focus:ring-indigo-500/50 text-xs transition-colors shadow-inner",
                                    minimal 
                                        ? "h-11 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-800 dark:text-white" 
                                        : "h-9 bg-black/5 dark:bg-black/20 border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"
                                )}>
                                    <SelectValue placeholder="选择格式" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="artist_tag">Standard (artist:tag)</SelectItem>
                                    <SelectItem value="name_only">Tag Only</SelectItem>
                                    <SelectItem value="highres">Quality (highres + tag)</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            <div className="flex items-center gap-2 px-1 pt-1 opacity-80 hover:opacity-100 transition-opacity">
                                <input
                                    type="checkbox"
                                    id="v4-format"
                                    checked={useV4Format}
                                    onChange={(e) => setUseV4Format(e.target.checked)}
                                    className="w-4 h-4 rounded border-black/20 dark:border-white/20 bg-white dark:bg-black/40 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer accent-indigo-500"
                                />
                                <label htmlFor="v4-format" className="text-xs text-slate-400 cursor-pointer select-none">
                                    使用 V4 格式 (1.0::artist:tag::)
                                </label>
                            </div>
                        </div>
                        <div className="space-y-2">
                             <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">初始权重</Label>
                             <div className="bg-black/5 dark:bg-black/20 shadow-inner rounded-[0.75rem] px-3 h-9 flex items-center gap-2 border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-colors">
                                <span className="text-xs font-mono font-bold text-indigo-400 w-8">{localGlobalWeight.toFixed(1)}x</span>
                                <Slider 
                                    value={[localGlobalWeight]} 
                                    min={0.5} 
                                    max={5.0} 
                                    step={0.1} 
                                    onValueChange={([val]) => setLocalGlobalWeight(val)}
                                    onValueCommit={([val]) => setGlobalWeight(val)}
                                    className="flex-1 touch-none"
                                    style={{ touchAction: 'none' }}
                                />
                             </div>
                        </div>
                    </div>

                    {/* Input Area (Animate Presence) */}
                    <div className={cn(
                        "flex-1 relative min-h-[300px] rounded-2xl border overflow-hidden transition-colors shadow-inner",
                        minimal 
                            ? "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10" 
                            : "bg-black/5 dark:bg-black/20 border-black/10 dark:border-white/10 hover:border-indigo-500/30 shadow-inner dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                    )}>
                        <div className={`absolute inset-0 flex flex-col p-4 transition-all duration-500 ease-out ${activeTarget === 'fixed' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 -translate-x-4 pointer-events-none z-0'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <Label className={cn("text-sm font-semibold flex items-center gap-2", minimal ? "text-slate-800 dark:text-white" : "text-indigo-600 dark:text-indigo-300")}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
                                    固定画师列表
                                </Label>
                                <div className="flex items-center gap-1.5 backdrop-blur-md bg-white dark:bg-white/5 rounded-full p-1 border border-black/10 dark:border-white/10 shadow-sm">
                                    <motion.button 
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setFixedItems([])}
                                        className="h-7 px-2.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-black/5 dark:hover:bg-black/40 transition-colors flex items-center"
                                        title="清空列表"
                                    >
                                        <Trash2 className="w-3 h-3 mr-1.5" /> 清空
                                    </motion.button>
                                    <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10" />
                                    <motion.button 
                                        whileTap={{ scale: 0.9 }}
                                        onClick={handleAddFixedToPrompt}
                                        className="h-7 px-2.5 rounded-full text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:bg-black/5 dark:hover:bg-black/40 transition-colors flex items-center"
                                        title="加入到主体提示词"
                                    >
                                        <Plus className="w-3 h-3 mr-1.5" /> 加入主体
                                    </motion.button>
                                    <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10" />
                                    <motion.button 
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setIsSaveComboOpen(true)}
                                        className="h-7 px-2.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-black/40 transition-colors flex items-center"
                                    >
                                        <Save className="w-3 h-3 mr-1.5" /> 保存
                                    </motion.button>
                                    <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10" />
                                    <motion.button 
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setIsLoadComboOpen(true)}
                                        className="h-7 px-2.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-black/40 transition-colors flex items-center"
                                    >
                                        <Link className="w-3 h-3 mr-1.5" /> 载入
                                    </motion.button>
                                </div>
                            </div>
                            
                            {/* Artist List Component */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-2">
                                {fixedItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-60">
                                        <LazyModuleBoundary mode="inline" className="w-24 h-24" label="Loading animation...">
                                            <LottieAnimation 
                                                src="https://lottie.host/e4740e34-fa6d-4959-bab6-4c2847a9ffec/01yF9XWIdZ.lottie" 
                                                className="w-24 h-24 mix-blend-multiply dark:mix-blend-screen"
                                            />
                                        </LazyModuleBoundary>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">还没固定任何画师</p>
                                    </div>
                                ) : (
                                    <LayoutGroup id="artist-list">
                                        <ArtistList
                                            artists={fixedItems}
                                            onUpdate={handleUpdateArtist}
                                            onRemove={handleRemoveArtist}
                                            onMove={handleMoveArtist}
                                            onYearChange={handleUpdateArtistYear}
                                            onToggleYearPrefix={handleToggleYearPrefix}
                                        />
                                    </LayoutGroup>
                                )}
                            </div>
                        </div>

                        <div className={`absolute inset-0 flex flex-col p-4 transition-all duration-500 ease-out ${activeTarget === 'pool' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-4 pointer-events-none z-0'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <Label className={cn("text-sm font-semibold flex items-center gap-2", minimal ? "text-slate-800 dark:text-white" : "text-violet-700 dark:text-violet-100")}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)] animate-pulse" />
                                    随机池
                                </Label>
                                <div className="flex items-center gap-1.5 backdrop-blur-md bg-white dark:bg-white/5 rounded-full p-1 border border-black/10 dark:border-white/10 shadow-sm">
                                    <motion.button 
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => {
                                            setPoolItems([]);
                                            setPoolText('');
                                        }}
                                        className="h-7 px-2.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-black/5 dark:hover:bg-black/40 transition-colors flex items-center"
                                        title="清空列表"
                                    >
                                        <Trash2 className="w-3 h-3 mr-1.5" /> 清空
                                    </motion.button>
                                    <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10" />
                                    <motion.button 
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => {
                                            if (poolViewMode === 'ui') {
                                                const text = serializeFixedArtists(poolItems, useV4Format);
                                                setPoolText(text);
                                                setPoolViewMode('text');
                                            } else {
                                                const items = parseFixedArtistsString(poolText);
                                                setPoolItems(items);
                                                setPoolViewMode('ui');
                                            }
                                        }}
                                        className="h-7 px-2.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-black/40 transition-colors flex items-center"
                                    >
                                        <Layers className="w-3 h-3 mr-1.5" /> 
                                        {poolViewMode === 'ui' ? '文本模式' : 'UI 模式'}
                                    </motion.button>
                                </div>
                            </div>
                            
                            {/* Pool Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-2">
                                {poolViewMode === 'ui' ? (
                                    poolItems.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-60">
                                            <LazyModuleBoundary mode="inline" className="w-24 h-24" label="Loading animation...">
                                                <LottieAnimation 
                                                    src="https://lottie.host/e4740e34-fa6d-4959-bab6-4c2847a9ffec/01yF9XWIdZ.lottie" 
                                                    className="w-24 h-24 mix-blend-multiply dark:mix-blend-screen"
                                                />
                                            </LazyModuleBoundary>
                                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">备选池空空如也</p>
                                        </div>
                                    ) : (
                                        <LayoutGroup id="pool-list">
                                            <ArtistList
                                                artists={poolItems}
                                                onUpdate={handleUpdatePoolArtist}
                                                onRemove={handleRemovePoolArtist}
                                                onMove={handleMovePoolArtist}
                                                onYearChange={handleUpdatePoolArtistYear}
                                                onToggleYearPrefix={handleTogglePoolYearPrefix}
                                            />
                                        </LayoutGroup>
                                    )
                                ) : (
                                    <Textarea 
                                        value={poolText}
                                        onChange={(e) => {
                                            setPoolText(e.target.value);
                                            setActiveTarget('pool');
                                        }}
                                        placeholder="在此输入备选画师列表，每行一个。支持粘贴..."
                                        className="w-full h-full font-mono text-sm border-none resize-none focus-visible:ring-0 p-2 leading-relaxed bg-black/5 dark:bg-black/20 rounded-xl text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-inner"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Random Settings & Generate Action */}
                    <div className="space-y-4 pt-2">
                        {activeTarget === 'pool' && (
                            <div className={cn(
                                "flex items-center gap-4 p-3 rounded-2xl border shadow-inner transition-colors",
                                minimal 
                                    ? "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10" 
                                    : "bg-black/5 dark:bg-black/20 border-black/10 dark:border-white/10 hover:border-violet-500/30 dark:hover:border-violet-500/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                            )}>
                                <span className={cn("text-xs font-bold uppercase tracking-widest pl-1", minimal ? "text-slate-800 dark:text-white/80" : "text-slate-600 dark:text-slate-500")}>随机数量</span>
                                <div className="flex-1 flex items-center gap-3">
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="10" 
                                        value={countRange.min}
                                        onChange={(e) => setCountRange({ ...countRange, min: parseInt(e.target.value) })}
                                        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-black/10 dark:bg-white/10 accent-violet-500"
                                    />
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm dark:shadow-inner backdrop-blur-sm">
                                        <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">{countRange.min}</span>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">{countRange.max}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex gap-3 flex-row w-full">
                            {activeTarget === 'pool' ? (
                                <>
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleGenerateAndCopy}
                                        className="flex-1 h-12 text-[15px] font-bold text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 transition-all duration-300 border border-black/10 dark:border-white/10 relative overflow-hidden group"
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            <Dices className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                                            一键随机并复制
                                        </span>
                                        <div className="absolute inset-0 bg-white/20 translate-y-[110%] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                                    </motion.button>
                                    
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => {
                                            const wildcardTag = "<随机画师>";
                                            setPendingTagsToAppend(wildcardTag);
                                            toast({ title: "已添加到主体", description: "随机画师通配符已追加" });
                                        }}
                                        className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 border border-black/10 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors"
                                        title="添加 <随机画师> 通配符"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </motion.button>
                                </>
                            ) : (
                                <>
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            if (fixedItems.length === 0) {
                                                toast({ title: "固定画师列表为空", variant: "destructive" });
                                                return;
                                            }
                                            const fixedString = getFixedArtistsString();
                                            const fixedParts = fixedString.split('\n').filter(l => l.trim());
                                            navigator.clipboard.writeText(fixedParts.join(', '));
                                            toast({ title: "已复制固定的画师", description: `复制了 ${fixedParts.length} 个画师` });
                                        }}
                                        className="flex-1 h-12 text-[15px] font-bold text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 transition-all duration-300 border border-black/10 dark:border-white/10 relative overflow-hidden group"
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            <Save className="w-5 h-5 group-hover:scale-110 transition-transform duration-500" />
                                            复制固定画师
                                        </span>
                                        <div className="absolute inset-0 bg-white/20 translate-y-[110%] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                                    </motion.button>

                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={handleAddFixedToPrompt}
                                        className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-black/10 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors"
                                        title="添加到提示词主体"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </motion.button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar: Gallery */}
            <div className="w-full md:w-[420px] flex-none border-l md:border-l border-t md:border-t-0 border-white/5 bg-black/20 backdrop-blur-3xl z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
                <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Library</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <ArtistGalleryPanel minimal compact className="h-full bg-transparent" />
                    </div>
                </div>
            </div>

            {/* Save Combo Dialog */}
            <Dialog open={isSaveComboOpen} onOpenChange={setIsSaveComboOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>保存为画师组合</DialogTitle>
                        <DialogDescription>
                            将当前固定画师列表保存为预设组合。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>组合名称</Label>
                            <Input 
                                value={comboName} 
                                onChange={(e) => setComboName(e.target.value)} 
                                placeholder="例如：赛博朋克风格组合"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveComboOpen(false)}>取消</Button>
                        <Button onClick={handleSaveCombo}>保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Load Combo Dialog */}
            <Dialog open={isLoadComboOpen} onOpenChange={(open) => {
                setIsLoadComboOpen(open);
                if (!open) { setLoadTab('saved'); setImportText(''); }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>载入画师组合</DialogTitle>
                        <DialogDescription>
                            从已保存组合加载，或直接粘贴 V4 格式文本导入。
                        </DialogDescription>
                    </DialogHeader>

                    {/* Tab 切换 */}
                    <div className="flex gap-1 p-1 bg-black/5 dark:bg-black/20 rounded-xl">
                        <button
                            onClick={() => setLoadTab('saved')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all duration-200",
                                loadTab === 'saved'
                                    ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                            )}
                        >
                            <Save className="w-3.5 h-3.5" /> 已保存组合
                        </button>
                        <button
                            onClick={() => setLoadTab('text')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all duration-200",
                                loadTab === 'text'
                                    ? "bg-white dark:bg-white/10 text-violet-600 dark:text-violet-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                            )}
                        >
                            <ClipboardPaste className="w-3.5 h-3.5" /> 文本导入
                        </button>
                    </div>

                    {/* 已保存组合 Tab */}
                    {loadTab === 'saved' && (
                        <div className="max-h-[300px] overflow-y-auto space-y-2 py-2">
                            {combos.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-sm">暂无保存的组合</div>
                            ) : (
                                combos.map(combo => (
                                    <div key={combo.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors group">
                                        <div 
                                            className="flex-1 cursor-pointer"
                                            onClick={() => handleLoadCombo(combo)}
                                        >
                                            <div className="font-medium text-sm text-slate-700 dark:text-slate-200">{combo.name}</div>
                                            <div className="text-xs text-slate-400 mt-1 truncate pr-4">{combo.prompt}</div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteCombo(combo.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 h-8 w-8 text-slate-400 hover:text-red-500 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* 文本导入 Tab */}
                    {loadTab === 'text' && (
                        <div className="space-y-3 py-2">
                            <Textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                placeholder={`粘贴 V4 格式画师文本，每行一个：\n1.5::artist:peter (peter6409)::,\n0.9::artist:jacknife::，2024\n2.5::artist:nishihara isao::`}
                                className="min-h-[200px] font-mono text-xs border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 rounded-xl resize-none focus-visible:ring-indigo-500/50 leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                    支持 V4 (<code className="text-indigo-400">1.5::tag::</code>)、标准 (<code className="text-indigo-400">(tag:1.5)</code>) 和纯文本格式
                                </p>
                                <Button
                                    size="sm"
                                    onClick={handleImportFromText}
                                    disabled={!importText.trim()}
                                    className="rounded-xl"
                                >
                                    <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" />
                                    导入
                                </Button>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLoadComboOpen(false)}>关闭</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
