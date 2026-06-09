import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { Button } from '@/components/atoms/Button';
import { Label } from '@/components/atoms/Label';
import { Textarea } from '@/components/atoms/Textarea';
import { Slider } from '@/components/atoms/Slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/Select';
import { Dices, Lock, Trash2, Plus, Save, FolderOpen, UserPlus, Settings2, Library, X, Globe } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn, generateUUID } from '@/lib/utils';
import { useArtistStore, type FixedArtistItem, parseFixedArtistsString, serializeFixedArtists } from '@/stores/artist-store';
import { useGenerationStore } from '@/stores/generation-store';
import { ArtistList } from '@/components/features/artist-gallery/ArtistCapsule';
import { MobileArtistGallery } from '@/components/features/artist-gallery/MobileArtistGallery';
import { MobileCommunityLibrary } from './generate/MobileCommunityLibrary';
import { ArtistLite } from '@/types/artist';
import { ImageIcon, Wand2 } from 'lucide-react';
import { ArtistDiscoveryDialog } from '@/components/features/artist-discovery/ArtistDiscoveryDialog';
import { blobCache } from '@/components/features/artist-gallery/MobileArtistCard';

/**
 * 内联头像组件：先尝试普通 img，失败后用 tauriFetch 绕过 Danbooru 防盗链。
 * 共享 MobileArtistCard 的 blobCache，避免重复下载。
 */
function AvatarImage({ src, alt }: { src: string; alt: string }) {
    const cached = blobCache.get(src);
    const [displaySrc, setDisplaySrc] = React.useState(cached || src);
    const [failed, setFailed] = React.useState(false);
    const triedFallback = React.useRef(!!cached);

    React.useEffect(() => {
        const c = blobCache.get(src);
        setDisplaySrc(c || src);
        setFailed(false);
        triedFallback.current = !!c;
    }, [src]);

    const handleError = async () => {
        if (triedFallback.current) { setFailed(true); return; }
        triedFallback.current = true;

        // 先检查缓存
        const c = blobCache.get(src);
        if (c) { setDisplaySrc(c); return; }

        try {
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            const resp = await tauriFetch(src, {
                method: 'GET',
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://danbooru.donmai.us/",
                    "Accept": "image/*,*/*;q=0.8"
                },
                connectTimeout: 8000
            });
            if (resp.ok) {
                const buf = await resp.arrayBuffer();
                const blobUrl = URL.createObjectURL(new Blob([buf]));
                blobCache.set(src, blobUrl); // 写入全局缓存
                setDisplaySrc(blobUrl);
            } else { setFailed(true); }
        } catch { setFailed(true); }
    };

    if (failed) return <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-slate-300 dark:text-white/30" /></div>;
    return <img src={displaySrc} alt={alt} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={handleError} />;
}

export function MobileInspirationPanel() {
    const { t } = useTranslation();
    const { 
        randomFixedArtists: fixedItems,
        setRandomFixedArtists: setFixedItems,
        addFixedArtist,
        removeFixedArtist,
        updateFixedArtist,
        moveFixedArtist,
        getFixedArtistsString,
        randomPoolText: poolText, 
        setRandomPoolText: setPoolText,
        randomCountRange: countRange, 
        setRandomCountRange: setCountRange,
        randomPoolItems: poolItems,
        setRandomPoolItems: setPoolItems,
        addPoolItem,
        removePoolItem,
        updatePoolItem,
        movePoolItem,
        useV4Format,
        setUseV4Format,
        randomOutputFormat: outputFormat,
        setRandomOutputFormat: setOutputFormat,
        randomGlobalWeight: globalWeight,
        setRandomGlobalWeight: setGlobalWeight,
    } = useArtistStore();
    
    const setPendingTagsToAppend = useGenerationStore((state) => state.setPendingTagsToAppend);

    const [activeTab, setActiveTab] = useState<'fixed' | 'pool' | 'local' | 'community'>('fixed');
    const [selectedGalleryArtist, setSelectedGalleryArtist] = useState<ArtistLite | null>(null);
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);

    const [localGlobalWeight, setLocalGlobalWeight] = useState(globalWeight);
    useEffect(() => setLocalGlobalWeight(globalWeight), [globalWeight]);

    // Fixed List Handlers
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

    // Insert artist from library tab or bottom sheet
    const handleInsertArtist = (tag: string, targetList: 'fixed' | 'pool') => {
        let finalTag = tag;
        if (outputFormat === 'artist_tag' && !finalTag.startsWith('artist:')) finalTag = `artist:${finalTag}`;
        else if (outputFormat === 'name_only') finalTag = finalTag.replace(/^artist:/, '');
        
        if (targetList === 'fixed') {
            addFixedArtist({
                id: generateUUID(),
                tag: finalTag,
                weight: globalWeight,
                withYearPrefix: true
            });
            toast({ title: t('toast.added', "Added to Fixed"), description: `${finalTag} (${globalWeight}x)`, duration: 1500 });
        } else {
            addPoolItem({
                id: generateUUID(),
                tag: finalTag,
                weight: globalWeight,
                withYearPrefix: true
            });
            toast({ title: t('toast.added', "Added to Pool"), description: finalTag, duration: 1500 });
        }
    };

    const handleGenerateAndCopy = () => {
        let currentPoolItems = poolItems;

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
        toast({ title: t('smartTools.copied', "Generated & Copied"), description: `Fixed: ${fixedParts.length}, Random: ${selectedRandom.length}` });
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-gradient-to-b dark:from-zinc-950 dark:to-black overflow-hidden relative">
             <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
             
             {/* Header */}
             <div className="px-6 pt-12 pb-2 shrink-0 flex flex-col gap-1 z-10 relative">
                 <div className="flex items-center justify-between">
                     <div>
                          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-white/60">
                             {t('inspiration.title', 'Randomizer')}
                          </h1>
                          <p className="text-xs text-slate-500 dark:text-white/40 font-medium tracking-wide uppercase mt-0.5">
                             {t('inspiration.subtitle', 'Discover & Roll Artists')}
                          </p>
                     </div>
                     <motion.button
                         whileTap={{ scale: 0.9 }}
                         onClick={() => setIsDiscoveryOpen(true)}
                         className="h-10 px-4 rounded-[14px] bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm"
                     >
                         <Wand2 className="w-4 h-4 text-pink-500" />
                         <span>发现画师</span>
                     </motion.button>
                 </div>
             </div>

             <div className="flex-1 overflow-y-auto w-full pb-32 no-scrollbar px-5 space-y-6 flex flex-col pb-[calc(110px+env(safe-area-inset-bottom,0px))] z-10">
                
                {/* Segmented Control */}
                <GlassSurface borderRadius={16} backgroundOpacity={0.02} brightness={60} className="p-1 shrink-0 border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]">
                     <div className="flex overflow-x-auto no-scrollbar gap-1 rounded-[12px] snap-x w-full">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setActiveTab('fixed')}
                            className={cn(
                                "relative flex-1 min-w-[68px] flex flex-col items-center justify-center gap-1 text-[11px] font-medium rounded-[12px] py-2 transition-colors duration-200 snap-start",
                                activeTab === 'fixed' ? "text-indigo-600 dark:text-indigo-300" : "text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white/80"
                            )}
                        >
                            <span className="relative z-10 flex flex-col items-center gap-1"><Lock className="w-4 h-4" /> {t('inspiration.fixed', 'Fixed')}</span>
                            {activeTab === 'fixed' && (
                                <motion.div layoutId="mobileTabRandom" className="absolute inset-0 bg-white dark:bg-white/10 rounded-[12px] shadow-sm dark:shadow-none" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                            )}
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setActiveTab('pool')}
                            className={cn(
                                "relative flex-1 min-w-[68px] flex flex-col items-center justify-center gap-1 text-[11px] font-medium rounded-[12px] py-2 transition-colors duration-200 snap-start",
                                activeTab === 'pool' ? "text-cyan-600 dark:text-cyan-300" : "text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white/80"
                            )}
                        >
                            <span className="relative z-10 flex flex-col items-center gap-1"><Dices className="w-4 h-4" /> {t('inspiration.pool', 'Pool')}</span>
                            {activeTab === 'pool' && (
                                <motion.div layoutId="mobileTabRandom" className="absolute inset-0 bg-white dark:bg-white/10 rounded-[12px] shadow-sm dark:shadow-none" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                            )}
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setActiveTab('local')}
                            className={cn(
                                "relative flex-1 min-w-[68px] flex flex-col items-center justify-center gap-1 text-[11px] font-medium rounded-[12px] py-2 transition-colors duration-200 snap-start",
                                activeTab === 'local' ? "text-purple-600 dark:text-purple-300" : "text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white/80"
                            )}
                        >
                            <span className="relative z-10 flex flex-col items-center gap-1"><Library className="w-4 h-4" /> {t('wildcard.local', 'Local')}</span>
                            {activeTab === 'local' && (
                                <motion.div layoutId="mobileTabRandom" className="absolute inset-0 bg-white dark:bg-white/10 rounded-[12px] shadow-sm dark:shadow-none" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                            )}
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setActiveTab('community')}
                            className={cn(
                                "relative flex-1 min-w-[68px] flex flex-col items-center justify-center gap-1 text-[11px] font-medium rounded-[12px] py-2 transition-colors duration-200 snap-start",
                                activeTab === 'community' ? "text-emerald-600 dark:text-emerald-300" : "text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white/80"
                            )}
                        >
                            <span className="relative z-10 flex flex-col items-center gap-1"><Globe className="w-4 h-4" /> {t('wildcard.community', 'Comm')}</span>
                            {activeTab === 'community' && (
                                <motion.div layoutId="mobileTabRandom" className="absolute inset-0 bg-white dark:bg-white/10 rounded-[12px] shadow-sm dark:shadow-none" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                            )}
                        </motion.button>
                    </div>
                </GlassSurface>

                {/* Main Interaction Area */}
                <GlassSurface borderRadius={16} backgroundOpacity={0.02} brightness={60} className={cn("flex flex-col relative overflow-hidden transition-all border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]", (activeTab === 'local' || activeTab === 'community') ? "flex-1 min-h-[500px]" : "min-h-[360px] shrink-0")}>
                     {activeTab === 'fixed' && (
                         <div className="p-4 flex flex-col h-full gap-4">
                             <div className="flex items-center justify-between shrink-0">
                                 <Label className="text-sm font-semibold flex items-center gap-2 text-indigo-400">
                                     <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                     {t('inspiration.alwaysInclude', 'Always Include')}
                                 </Label>
                                 <div className="flex items-center gap-2">
                                     <motion.div whileTap={{ scale: 0.85 }}>
                                         <Button variant="ghost" size="sm" onClick={() => setFixedItems([])} className="h-8 text-xs text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 dark:text-white/40 dark:hover:text-red-400 dark:bg-white/5 dark:hover:bg-red-500/10 rounded-xl px-3">
                                             <Trash2 className="w-3.5 h-3.5 mr-1.5" /> {t('common.clear', 'Clear')}
                                         </Button>
                                     </motion.div>
                                     <motion.div whileTap={{ scale: 0.85 }}>
                                         <Button variant="ghost" size="sm" onClick={() => setActiveTab('local')} className="h-8 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 rounded-xl px-3 font-medium">
                                             <Plus className="w-3.5 h-3.5 mr-1" /> {t('common.add', 'Add')}
                                         </Button>
                                     </motion.div>
                                 </div>
                             </div>
                             <div className="flex-1 overflow-y-auto no-scrollbar -mx-2 px-2 pb-2">
                                 {fixedItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50 mt-12">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                                            <UserPlus className="w-5 h-5 text-slate-400 dark:text-white/40" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-slate-700 dark:text-white/70">{t('inspiration.noArtists', 'No artists added')}</p>
                                            <p className="text-xs text-slate-500 dark:text-white/40">{t('inspiration.switchToAdd', 'Switch to Library tab to add artists')}</p>
                                        </div>
                                    </div>
                                 ) : (
                                    <LayoutGroup id="mobile-artist-list">
                                        <ArtistList
                                            artists={fixedItems}
                                            onUpdate={handleUpdateArtist}
                                            onRemove={removeFixedArtist}
                                            onMove={moveFixedArtist}
                                            onYearChange={handleUpdateArtistYear}
                                            onToggleYearPrefix={handleToggleYearPrefix}
                                        />
                                    </LayoutGroup>
                                 )}
                             </div>
                         </div>
                     )}
                     
                     {activeTab === 'pool' && (
                         <div className="p-4 flex flex-col h-full gap-4">
                             <div className="flex items-center justify-between shrink-0">
                                 <Label className="text-sm font-semibold flex items-center gap-2 text-cyan-400">
                                     <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                     {t('inspiration.candidatePool', 'Candidate Pool')}
                                 </Label>
                                 <div className="flex items-center gap-2">
                                     <motion.div whileTap={{ scale: 0.85 }}>
                                         <Button variant="ghost" size="sm" onClick={() => setPoolItems([])} className="h-8 text-xs text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 dark:text-white/40 dark:hover:text-red-400 dark:bg-white/5 dark:hover:bg-red-500/10 rounded-xl px-3">
                                             <Trash2 className="w-3.5 h-3.5 mr-1.5" /> {t('common.clear', 'Clear')}
                                         </Button>
                                     </motion.div>
                                     <motion.div whileTap={{ scale: 0.85 }}>
                                         <Button variant="ghost" size="sm" onClick={() => setActiveTab('local')} className="h-8 text-xs text-cyan-700 bg-cyan-50 hover:bg-cyan-100 dark:text-cyan-300 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 rounded-xl px-3 font-medium">
                                             <Plus className="w-3.5 h-3.5 mr-1" /> {t('common.add', 'Add')}
                                         </Button>
                                     </motion.div>
                                 </div>
                             </div>
                             <div className="flex-1 overflow-y-auto no-scrollbar -mx-2 px-2 pb-2">
                                 {poolItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50 mt-12">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                                            <Dices className="w-5 h-5 text-slate-400 dark:text-white/40" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-slate-700 dark:text-white/70">{t('inspiration.noArtists', 'No artists added')}</p>
                                            <p className="text-xs text-slate-500 dark:text-white/40">{t('inspiration.switchToAdd', 'Switch to Library tab to add artists')}</p>
                                        </div>
                                    </div>
                                 ) : (
                                    <LayoutGroup id="mobile-artist-pool-list">
                                        <ArtistList
                                            artists={poolItems}
                                            onUpdate={handleUpdatePoolArtist}
                                            onRemove={removePoolItem}
                                            onMove={movePoolItem}
                                            onYearChange={handleUpdatePoolArtistYear}
                                            onToggleYearPrefix={handleTogglePoolYearPrefix}
                                        />
                                    </LayoutGroup>
                                 )}
                             </div>
                         </div>
                     )}

                     {(activeTab === 'local' || activeTab === 'community') && (
                         <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-white/50 dark:bg-zinc-950/50">
                             <div className="flex-1 overflow-y-auto no-scrollbar pb-10 relative">
                                 {activeTab === 'local' ? (
                                     <MobileArtistGallery 
                                         className="min-h-full" 
                                         onSelectArtist={(artist) => {
                                             setSelectedGalleryArtist(artist as unknown as ArtistLite);
                                         }}
                                     />
                                 ) : (
                                     <MobileCommunityLibrary />
                                 )}
                             </div>
                         </div>
                     )}
                </GlassSurface>

                {/* Configuration Options - Only show if not in Library tab */}
                {(activeTab === 'fixed' || activeTab === 'pool') && (
                    <GlassSurface borderRadius={16} backgroundOpacity={0.02} brightness={60} className="p-5 flex flex-col gap-5 shrink-0 border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]">
                        {activeTab === 'pool' && (
                            <div className="flex items-center gap-4">
                                <Label className="text-sm font-medium text-slate-800 dark:text-white/80 shrink-0">{t('inspiration.rollAmount', 'Roll Amount')}</Label>
                                <div className="flex-1 flex items-center gap-3">
                                    <input 
                                        type="range" min="1" max="10" 
                                        value={countRange.min}
                                        onChange={(e) => setCountRange({ ...countRange, min: parseInt(e.target.value) })}
                                        className="flex-1 h-1.5 rounded-full appearance-none bg-slate-200 dark:bg-white/20 accent-indigo-500 dark:accent-indigo-400"
                                    />
                                    <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/5 flex items-center gap-1 font-mono text-[13px]">
                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{countRange.min}</span>
                                        <span className="text-slate-400 dark:text-white/30">-</span>
                                        <span className="text-cyan-600 dark:text-cyan-400 font-bold">{countRange.max}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-5">
                            <div className="space-y-2">
                                 <Label className="text-[11px] font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider pl-1">{t('inspiration.startingWeight', 'Starting Weight')}</Label>
                                 <div className="bg-slate-100 dark:bg-black/20 rounded-xl px-3 h-11 flex items-center gap-3 border border-slate-200 dark:border-white/5">
                                    <span className="text-[13px] font-mono font-bold text-indigo-600 dark:text-indigo-400 w-8">{localGlobalWeight.toFixed(1)}x</span>
                                    <Slider 
                                        value={[localGlobalWeight]} min={0.5} max={5.0} step={0.1} 
                                        onValueChange={([val]) => setLocalGlobalWeight(val)}
                                        onValueCommit={([val]) => setGlobalWeight(val)}
                                        className="flex-1 touch-none"
                                    />
                                 </div>
                            </div>
                            <div className="space-y-2">
                                 <Label className="text-[11px] font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider pl-1">{t('inspiration.tagFormat', 'Tag Format')}</Label>
                                 <Select value={outputFormat} onValueChange={setOutputFormat}>
                                    <SelectTrigger className="h-11 bg-slate-100 text-slate-800 border-slate-200 dark:bg-black/20 dark:border-white/5 dark:text-white/90 rounded-xl text-[13px]">
                                        <SelectValue placeholder={t('inspiration.formatPlaceholder', 'Format')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="artist_tag" className="focus:bg-slate-200 dark:focus:bg-white/10">artist:tag</SelectItem>
                                        <SelectItem value="name_only" className="focus:bg-slate-200 dark:focus:bg-white/10">{t('inspiration.justName', 'Just Name')}</SelectItem>
                                        <SelectItem value="highres" className="focus:bg-slate-200 dark:focus:bg-white/10">{t('inspiration.highresCombo', 'Highres Combo')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </GlassSurface>
                )}

                {/* Sticky Action Button inside ScrollArea - Only show if not in Library tab */}
                {(activeTab === 'fixed' || activeTab === 'pool') && (
                    <div className="pt-2 shrink-0 flex gap-3 pb-4">
                        {activeTab === 'pool' ? (
                            <>
                                <motion.div whileTap={{ scale: 0.95 }} className="flex-1">
                                    <Button
                                        onClick={handleGenerateAndCopy}
                                        className="w-full h-14 text-[15px] font-semibold text-white shadow-xl shadow-indigo-500/20 dark:shadow-indigo-500/10 rounded-[16px] bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 dark:hover:from-indigo-400 dark:hover:to-cyan-400 transition-all border-none relative overflow-hidden group"
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            <Dices className="w-5 h-5 drop-shadow-md" />
                                            <span className="drop-shadow-md">{t('inspiration.generateCopy', 'Generate & Copy Roll')}</span>
                                        </span>
                                    </Button>
                                </motion.div>
                                <motion.div whileTap={{ scale: 0.9 }} className="shrink-0">
                                    <Button
                                        onClick={() => {
                                            const wildcardTag = "<随机画师>";
                                            setPendingTagsToAppend(wildcardTag);
                                            toast({ title: t('toast.added', 'Added to Main Prompt'), description: t('inspiration.wildcardAdded', 'Random artist wildcard appended') });
                                        }}
                                        className="w-14 h-14 p-0 flex items-center justify-center rounded-[16px] bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 shadow-sm"
                                        title={t('inspiration.addWildcard', 'Add Wildcard')}
                                    >
                                        <Plus className="w-6 h-6" />
                                    </Button>
                                </motion.div>
                            </>
                        ) : (
                            <>
                                <motion.div whileTap={{ scale: 0.95 }} className="flex-1">
                                    <Button
                                        onClick={() => {
                                            if (fixedItems.length === 0) {
                                                toast({ title: t('toast.empty', 'Fixed artist list is empty'), variant: "destructive" });
                                                return;
                                            }
                                            const fixedString = getFixedArtistsString();
                                            const fixedParts = fixedString.split('\n').filter(l => l.trim());
                                            navigator.clipboard.writeText(fixedParts.join(', '));
                                            toast({ title: t('toast.copied', 'Copied Fixed Artists'), description: `Copied ${fixedParts.length} artists` });
                                        }}
                                        className="w-full h-14 text-[15px] font-semibold text-white shadow-xl shadow-indigo-500/20 dark:shadow-indigo-500/10 rounded-[16px] bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-600 dark:hover:from-indigo-400 dark:hover:to-blue-400 transition-all border-none relative overflow-hidden group"
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            <Save className="w-5 h-5 drop-shadow-md" />
                                            <span className="drop-shadow-md">{t('inspiration.copyFixed', 'Copy Fixed Artists')}</span>
                                        </span>
                                    </Button>
                                </motion.div>
                                <motion.div whileTap={{ scale: 0.9 }} className="shrink-0">
                                    <Button
                                        onClick={() => {
                                            if (fixedItems.length === 0) {
                                                toast({ title: t('toast.empty', 'Fixed artist list is empty'), variant: "destructive" });
                                                return;
                                            }
                                            const textToAdd = "<固定画师>";
                                            // 直接写入提示词，不经过通配符
                                            const currentPrompt = useGenerationStore.getState().prompt;
                                            useGenerationStore.getState().setPrompt(
                                                currentPrompt ? `${currentPrompt}, ${textToAdd}` : textToAdd
                                            );
                                            toast({ title: t('toast.added', '已添加到提示词'), description: `<固定画师> 已追加到提示词末尾` });
                                        }}
                                        className="w-14 h-14 p-0 flex items-center justify-center rounded-[16px] bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 shadow-sm"
                                        title={t('inspiration.addToPrompt', 'Add to Prompt')}
                                    >
                                        <Plus className="w-6 h-6" />
                                    </Button>
                                </motion.div>
                            </>
                        )}
                    </div>
                )}

             </div>

             {/* Artist Action Bottom Sheet */}
             <AnimatePresence>
                {selectedGalleryArtist && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedGalleryArtist(null)}
                            className="fixed inset-0 bg-black/80 z-[100]"
                        />

                        {/* Sheet Container */}
                        <motion.div
                            initial={{ y: "100%", opacity: 0.5 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed inset-x-0 bottom-0 z-[101] flex flex-col items-center bg-slate-50 dark:bg-zinc-900 rounded-t-[32px] border-t border-slate-200 dark:border-white/10 shadow-2xl pb-[env(safe-area-inset-bottom,0px)]"
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.2}
                            onDragEnd={(e, info) => {
                                if (info.offset.y > 50) {
                                    setSelectedGalleryArtist(null);
                                }
                            }}
                        >
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full my-3" />
                            
                            <div className="w-full px-6 pt-2 pb-8 flex flex-col gap-6">
                                {/* Artist Info */}
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-20 rounded-2xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 overflow-hidden shrink-0 relative">
                                        {selectedGalleryArtist.previewUrl ? (
                                            <AvatarImage 
                                                src={selectedGalleryArtist.previewUrl}
                                                alt={selectedGalleryArtist.name}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <UserPlus className="w-6 h-6 text-slate-300 dark:text-white/30" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 ring-1 ring-inset ring-slate-900/10 dark:ring-white/10 rounded-2xl pointer-events-none" />
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{selectedGalleryArtist.name}</h3>
                                        <p className="text-sm text-slate-500 dark:text-white/50 truncate font-mono">{selectedGalleryArtist.tag}</p>
                                    </div>
                                    <motion.div whileTap={{ scale: 0.85 }}>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/50" 
                                            onClick={() => setSelectedGalleryArtist(null)}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </motion.div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-3">
                                    <motion.div whileTap={{ scale: 0.95 }}>
                                        <Button
                                            onClick={() => {
                                                handleInsertArtist(selectedGalleryArtist.tag, 'fixed');
                                                setSelectedGalleryArtist(null);
                                            }}
                                            className="w-full h-14 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/20 font-medium text-[15px] flex items-center justify-center gap-2"
                                        >
                                            <Lock className="w-5 h-5" />
                                            {t('inspiration.addToFixed', 'Add to Fixed Artists')}
                                        </Button>
                                    </motion.div>
                                    
                                    <motion.div whileTap={{ scale: 0.95 }}>
                                        <Button
                                            onClick={() => {
                                                handleInsertArtist(selectedGalleryArtist.tag, 'pool');
                                                setSelectedGalleryArtist(null);
                                            }}
                                            className="w-full h-14 rounded-2xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/20 font-medium text-[15px] flex items-center justify-center gap-2"
                                        >
                                            <Dices className="w-5 h-5" />
                                            {t('inspiration.addToPool', 'Add to Random Pool')}
                                        </Button>
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                 )}
             </AnimatePresence>

             <ArtistDiscoveryDialog
                 open={isDiscoveryOpen}
                 onOpenChange={setIsDiscoveryOpen}
                 initialTab="discovery"
             />
        </div>
    );
}
