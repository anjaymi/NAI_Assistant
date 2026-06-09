import React, { useState } from 'react';
import { useArtistStore, type FixedArtistItem } from '../../../stores/artist-store';
import { cn, generateUUID } from '@/lib/utils';
import { ScrollArea } from '@/components/atoms/ScrollArea';
import { Button } from '@/components/atoms/Button';
import { Slider } from '@/components/atoms/Slider';
import { X, Copy, Check, AlertCircle, ArrowDownToLine, Plus, Trash2, Library, List, Eye, Save } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/atoms/Tabs";
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

interface ArtistPromptBuilderProps {
    onClose?: () => void;
}

const SafeArtistSlider = ({ id, initialWeight, onWeightChange }: { id: string, initialWeight: number, onWeightChange: (id: string, weight: number) => void }) => {
    const [localWeight, setLocalWeight] = useState(initialWeight);
    React.useEffect(() => setLocalWeight(initialWeight), [initialWeight]);
    return (
        <Slider 
            value={[localWeight]} 
            min={0.5} 
            max={1.5} 
            step={0.1} 
            onValueChange={(vals: number[]) => setLocalWeight(vals[0])}
            onValueCommit={(vals: number[]) => onWeightChange(id, vals[0])}
            className="flex-1 touch-none"
            style={{ touchAction: 'none' }}
        />
    );
};

export const ArtistPromptBuilder: React.FC<ArtistPromptBuilderProps> = ({ onClose }) => {
    const { 
        artists, 
        selectedArtists, 
        updateWeight, 
        toggleSelection, 
        clearSelection,
        getPrompt,
        useV4Format,
        setUseV4Format,
        randomFixedArtists,
        setRandomFixedArtists,
        randomPoolText,
        setRandomPoolText,
        combos,
        deleteCombo,
        addCombo,
        setPreviewIds,
    } = useArtistStore();
    
    // ... (keep existing) ...
    const [activeTab, setActiveTab] = useState("builder");
    
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    // ... (keep existing selectedList) ...
    const selectedList = Object.entries(selectedArtists).map(([id, weight]) => {
        const artist = artists.find(a => a.id === id);
        return { id, weight, artist };
    }).filter(item => item.artist);

    const fullPrompt = getPrompt();
    
    // Helper to find artist IDs from a combo prompt string
    const extractArtistsFromCombo = (prompt: string) => {
         // Normalized tag matching
         const parts = prompt.split(',').map(p => {
             // Remove weights (1.0::...:: or (...:1.0))
             let tag = p.trim();
             // V4 format: 1.0::tag::
             if (tag.includes('::')) {
                 const match = tag.match(/::(.+)::/);
                 if (match) tag = match[1];
             }
             // V3 format: (tag:1.0) or (tag)
             else if (tag.startsWith('(') && tag.endsWith(')')) {
                 tag = tag.slice(1, -1); // remove outer parens
                 // check for :weight
                 const lastColon = tag.lastIndexOf(':');
                 if (lastColon > -1) {
                      // Check if the part after colon is a number
                      const weight = parseFloat(tag.substring(lastColon + 1));
                      if (!isNaN(weight)) {
                          tag = tag.substring(0, lastColon);
                      }
                 }
             }
             
             // Remove artist: prefix if exists
             if (tag.startsWith('artist:')) {
                 tag = tag.substring(7);
             }
             return tag.toLowerCase().trim();
         });

         // Find matching IDs
         return artists.filter(a => {
             const cleanTag = a.tag.replace(/^artist:/, '').toLowerCase();
             return parts.includes(cleanTag) || parts.includes(a.tag.toLowerCase()) || parts.some(p => a.tag.toLowerCase().includes(p)); // Loose matching for now
         });
    };

    const handleViewCombo = (prompt: string) => {
        const matched = extractArtistsFromCombo(prompt);
        if (matched.length > 0) {
            setPreviewIds(matched.map(a => a.id));
            toast({ title: "已进入预览模式", description: `在左侧画廊中显示 ${matched.length} 位画师` });
        } else {
             toast({ title: "无法识别画师", description: "未找到匹配的画师数据", variant: "destructive" });
        }
    };

    const handleAddComboToSelection = (prompt: string) => {
        const matched = extractArtistsFromCombo(prompt);
        if (matched.length > 0) {
            let addedCount = 0;
            matched.forEach(a => {
                if (!selectedArtists[a.id]) {
                    toggleSelection(a.id);
                    addedCount++;
                }
            });
            if (addedCount > 0) {
                toast({ title: "已添加到选择", description: `新增 ${addedCount} 位画师` });
                setActiveTab("builder"); // Auto switch to builder to see them
            } else {
                toast({ title: "画师已存在", description: "所有画师已在选择列表中" });
            }
        } else {
             toast({ title: "无法识别画师", description: "未找到匹配的画师数据", variant: "destructive" });
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(fullPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sendToFixed = () => {
        if (!fullPrompt) return;
        // 将 prompt 字符串解析为结构化 FixedArtistItem 追加到列表
        const parts = fullPrompt.split(',').map(p => p.trim()).filter(Boolean);
        const newItems: FixedArtistItem[] = parts.map(part => {
            let tag = part;
            let weight = 1.0;
            // V4: "1.0::tag::"
            const v4 = part.match(/^([\d.]+)::(.+)::$/);
            if (v4) { weight = parseFloat(v4[1]); tag = v4[2]; }
            // V3: "(tag:1.0)"
            else {
                const v3 = part.match(/^\((.+):([\d.]+)\)$/);
                if (v3) { tag = v3[1]; weight = parseFloat(v3[2]); }
            }
            return { id: generateUUID(), tag, weight, withYearPrefix: true };
        });
        setRandomFixedArtists([...randomFixedArtists, ...newItems]);
        toast({ title: "已添加到固定画师", description: `追加了 ${newItems.length} 位画师` });
    };
    
    // ... (rest is largely same)

    const sendToPool = () => {
        if (!fullPrompt) return;
        const current = randomPoolText;
        const next = current ? `${current}\n${fullPrompt}` : fullPrompt;
        setRandomPoolText(next);
        toast({ title: "已添加到画师池", description: "内容已追加到随机生成器的随机池" });
    };

    // Unified render logic
    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center h-full py-10 text-center text-slate-500">
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-inner"
            >
                <AlertCircle className="w-8 h-8 opacity-50" />
            </motion.div>
            <h3 className="font-semibold text-lg mb-2 text-slate-300">未选择画师</h3>
            <p className="text-sm border-t border-transparent pt-0">请从画廊选择画师，或切换到“收藏”加载预设。</p>
        </div>
    );

    // Standard Render with conditional content
    return (
        <div className="flex flex-col h-full bg-[#030712] text-slate-200">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mr-2">
                    <TabsList className="w-full grid grid-cols-2 h-9 bg-black/20 p-1 border border-white/10 rounded-xl shadow-inner">
                        <TabsTrigger value="builder" className="text-xs h-full rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm">构建 (Builder)</TabsTrigger>
                        <TabsTrigger value="presets" className="text-xs h-full rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm">收藏 (Presets)</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex items-center gap-1">
                    {activeTab === 'builder' && selectedList.length > 0 && (
                        <Button variant="ghost" size="icon" onClick={clearSelection} className="text-slate-400 hover:text-red-400 hover:bg-black/40 h-8 w-8 rounded-full" title="清空选择">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-black/40 h-8 w-8 rounded-full" title="关闭面板">
                            <X className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                {activeTab === 'builder' ? (
                    selectedList.length === 0 ? (
                        renderEmptyState()
                    ) : (
                        <div className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {selectedList.map(({ id, weight, artist }) => (
                                    <motion.div 
                                        key={id} 
                                        layout
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-black/20 rounded-2xl p-3 border border-white/5 shadow-inner hover:border-white/10 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-semibold text-sm text-slate-200 tracking-tight">{artist!.name}</h4>
                                                <code className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 mt-0.5 inline-block rounded-md border border-white/5 shadow-inner">
                                                    {artist!.tag}
                                                </code>
                                            </div>
                                            <button 
                                                onClick={() => toggleSelection(id)}
                                                className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-full transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-mono font-medium text-indigo-400 w-8 text-right">{weight.toFixed(1)}</span>
                                            <SafeArtistSlider 
                                                id={id}
                                                initialWeight={weight}
                                                onWeightChange={updateWeight}
                                            />
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )
                ) : (
                    <div className="space-y-3">
                        {combos.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm">
                                <Library className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>暂无收藏组合</p>
                                <p className="text-xs mt-1">在随机生成器中保存组合</p>
                            </div>
                        ) : (
                            combos.map((combo) => (
                                <div key={combo.id} className="bg-black/20 p-3 rounded-2xl border border-white/5 shadow-inner hover:border-white/10 transition-colors group">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-sm text-slate-200 tracking-tight">{combo.name}</h4>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                                                onClick={() => deleteCombo(combo.id)}
                                                title="删除"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 shadow-inner p-2 rounded-xl text-[10px] font-mono mb-3 line-clamp-3 break-all text-slate-500 border border-white/5">
                                        {combo.prompt}
                                    </div>
                                    
                                    <div className="flex gap-2 mb-2">
                                         <Button 
                                            size="sm" 
                                            className="flex-1 h-8 text-xs bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10 rounded-xl"
                                            onClick={() => handleViewCombo(combo.prompt)}
                                            title="在画廊中查看"
                                        >
                                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                                            查看
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            className="flex-1 h-8 text-xs bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-indigo-200 border border-indigo-500/30 rounded-xl"
                                            onClick={() => handleAddComboToSelection(combo.prompt)}
                                            title="添加到当前构建列表"
                                        >
                                            <List className="w-3.5 h-3.5 mr-1.5" />
                                            添加
                                        </Button>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button 
                                            size="sm" 
                                            className="flex-1 h-8 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 border border-emerald-500/20 rounded-xl"
                                            onClick={() => {
                                                // 解析 combo.prompt 为结构化数据
                                                const lines = combo.prompt.split(/\n/).filter((l: string) => l.trim());
                                                const items: FixedArtistItem[] = lines.map((line: string) => {
                                                    let tag = line.trim(), weight = 1.0;
                                                    const v4 = tag.match(/^([\d.]+)::(.+)::$/);
                                                    if (v4) { weight = parseFloat(v4[1]); tag = v4[2]; }
                                                    return { id: generateUUID(), tag, weight, withYearPrefix: true };
                                                });
                                                setRandomFixedArtists(items);
                                                toast({ title: "已加载到固定画师", description: combo.name });
                                            }}
                                        >
                                            <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
                                            载入 (固定)
                                        </Button>
                                         <Button 
                                            size="icon" 
                                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors"
                                            onClick={() => {
                                                navigator.clipboard.writeText(combo.prompt);
                                                toast({ title: "已复制组合", description: combo.name });
                                            }}
                                            title="复制文本"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </ScrollArea>

            <div className="p-4 bg-[#030712] border-t border-white/5 space-y-3 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                 <div className="flex items-center gap-2 pb-2 opacity-80 hover:opacity-100 transition-opacity">
                    <input 
                        type="checkbox" 
                        id="v4Format" 
                        checked={useV4Format} 
                        onChange={(e) => setUseV4Format(e.target.checked)}
                        className="rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer accent-indigo-500"
                    />
                    <label htmlFor="v4Format" className="text-xs text-slate-400 font-medium cursor-pointer select-none">
                        使用 V4 格式 (1.0::artist:tag::)
                    </label>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">最终提示词</label>
                         <div className="flex gap-1 bg-white/5 rounded-full p-0.5 border border-white/5">
                             <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full hover:bg-black/40 text-slate-400 hover:text-indigo-400" onClick={sendToFixed} title="添加到固定画师">
                                 <ArrowDownToLine className="w-3 h-3" />
                             </Button>
                             <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full hover:bg-black/40 text-slate-400 hover:text-violet-400" onClick={sendToPool} title="添加到随机池">
                                 <Plus className="w-3 h-3" />
                             </Button>
                             <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 rounded-full hover:bg-black/40 text-slate-400 hover:text-white" 
                                onClick={() => {
                                    if (!fullPrompt) return;
                                    const name = window.prompt("请输入组合名称", "我的画师组合");
                                    if (name) {
                                        addCombo({
                                            id: generateUUID(),
                                            name,
                                            prompt: fullPrompt,
                                            createdAt: Date.now()
                                        });
                                        toast({ title: "已保存组合", description: name });
                                    }
                                }} 
                                title="保存为收藏组合"
                            >
                                 <Save className="w-3 h-3" />
                             </Button>
                         </div>
                    </div>
                    <div className="min-h-[80px] p-3 bg-black/20 rounded-xl border border-white/10 shadow-inner text-sm font-mono break-all text-slate-300">
                        {fullPrompt}
                    </div>
                </div>
                
                <motion.button 
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                        "w-full h-12 flex items-center justify-center gap-2 font-bold transition-all relative overflow-hidden group rounded-2xl border",
                        copied 
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                            : "bg-indigo-600/20 text-indigo-400 border-indigo-500/50 hover:bg-indigo-500/30 hover:text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                    )}
                    onClick={handleCopy}
                >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {copied ? (
                            <>
                                <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                已复制!
                            </>
                        ) : (
                            <>
                                <Copy className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                复制组合
                            </>
                        )}
                    </span>
                    {!copied && <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />}
                </motion.button>
            </div>
        </div>
    );
};
