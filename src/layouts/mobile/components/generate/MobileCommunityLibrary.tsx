import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Globe, Download, RefreshCw, User, ChevronLeft } from 'lucide-react';

import { Input } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';
import { communityService, CommunityArtist } from '@/services/community-service';
import { danbooruService } from '@/services/danbooru-service';
import { artistDB } from '@/services/artist-db';
import { useArtistStore } from '@/stores/artist-store';
import { toast } from '@/hooks/use-toast';

export function MobileCommunityLibrary() {
    const { t } = useTranslation();
    const [artists, setArtists] = useState<CommunityArtist[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArtist, setSelectedArtist] = useState<CommunityArtist | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const loadArtists = async () => {
        setIsLoading(true);
        try {
            const data = await communityService.listArtists(50, 0, searchQuery);
            setArtists(data);

            const missingPreviews = data.filter(a => !a.preview_base64 && !a.preview_url);
            if (missingPreviews.length > 0) {
                missingPreviews.forEach(async (artist) => {
                    try {
                        const tag = artist.tag || `artist:${artist.name.replace(/ /g, '_')}`;
                        const url = await danbooruService.fetchArtistPreview(tag);
                        if (url) {
                            setArtists(prev => prev.map(a => 
                                a.id === artist.id ? { ...a, preview_url: url } : a
                            ));
                        }
                    } catch (e) {
                        console.warn(`[Community] Failed to fetch preview for ${artist.name}`);
                    }
                });
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to load community artists", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadArtists();
    }, [searchQuery]);

    const handleDownload = async (artist: CommunityArtist) => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const allArtists = await artistDB.getAllArtistsLite();
            const existing = allArtists.find(a => a.name === artist.name);
            if (existing) {
                toast({ title: t('common.info'), description: `${artist.name} already exists` });
                return;
            }

            const fullArtist = await communityService.getArtistDetails(artist.id);
            if (!fullArtist) throw new Error("Artist details not found");

            const newArtist: any = {
               id: String(Date.now()),
               name: fullArtist.name,
               count: 0, 
               imageUrl: fullArtist.preview_base64 
                  ? `data:image/png;base64,${fullArtist.preview_base64}` 
                  : (fullArtist.preview_url || ''),
               previewUrl: fullArtist.preview_url,
               tag: fullArtist.tag,
               description: fullArtist.description,
               isFavorite: 0
            };

            await artistDB.addArtist(newArtist);
            useArtistStore.getState().loadArtists();
            toast({ title: t('common.success'), description: `Imported ${artist.name}` });
            setSelectedArtist(null); // Close sheet
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to download artist", variant: "destructive" });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full relative">
            {/* Search Bar */}
            <div className="px-4 py-3 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-white/40" />
                    <Input 
                        className="h-12 pl-10 bg-slate-100 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-[16px] focus-visible:ring-1 focus-visible:ring-primary/50 text-base placeholder:text-slate-400 dark:placeholder:text-white/40"
                        placeholder="Search Community..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 custom-scrollbar">
                {isLoading && artists.length === 0 ? (
                    <div className="grid grid-cols-2 gap-3 pb-6 mt-2">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="aspect-[4/5] rounded-[16px] bg-slate-200/50 dark:bg-white/[0.03] animate-pulse overflow-hidden relative border border-slate-200/50 dark:border-white/5">
                                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
                                <div className="absolute left-3 bottom-3 right-3 h-4 bg-white/20 dark:bg-black/20 rounded-md" />
                            </div>
                        ))}
                    </div>
                ) : artists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 dark:text-white/40 mt-10">
                        <Globe className="h-12 w-12 mb-4 opacity-30" />
                        <p className="text-base font-medium">No community artists found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {artists.map(artist => (
                            <motion.div 
                                key={artist.id}
                                whileTap={{ scale: 0.93 }}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-[16px] overflow-hidden flex flex-col relative aspect-[4/5] shadow-sm active:bg-slate-200 dark:active:bg-white/5 transition-colors"
                                onClick={() => setSelectedArtist(artist)}
                            >
                                {/* Background Image */}
                                <div className="absolute inset-0 bg-slate-200 dark:bg-zinc-900">
                                    {(artist.preview_base64 || artist.preview_url) ? (
                                        <img 
                                            src={artist.preview_base64 ? `data:image/png;base64,${artist.preview_base64}` : artist.preview_url} 
                                            alt={artist.name}
                                            className="w-full h-full object-cover opacity-60"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center opacity-20">
                                            <User className="h-10 w-10 text-slate-800 dark:text-white" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 dark:from-black dark:via-black/40 to-transparent" />
                                </div>
                                
                                {/* Content */}
                                <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col z-10">
                                    <h3 className="text-sm font-bold text-white tracking-tight leading-tight truncate drop-shadow-md">
                                        {artist.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/90 dark:text-white/70 font-medium">
                                        <span className="flex items-center gap-1 bg-black/50 dark:bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-md border border-white/10 dark:border-white/5">
                                            <User className="h-3 w-3" /> {artist.author_name}
                                        </span>
                                        <span className="flex items-center gap-1 bg-black/50 dark:bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-md border border-white/10 dark:border-white/5">
                                            <Download className="h-3 w-3" /> {artist.downloads}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Sheet */}
            <AnimatePresence>
                {selectedArtist && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 z-[100]"
                            onClick={() => setSelectedArtist(null)}
                        />
                        <motion.div
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-x-0 bottom-0 max-h-[90dvh] bg-slate-50 dark:bg-zinc-950 rounded-t-[32px] border-t border-slate-200 dark:border-white/10 z-[110] flex flex-col shadow-2xl overflow-hidden"
                        >
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/50 dark:bg-white/20 rounded-full z-10 shadow-sm" />

                            <div className="w-full h-64 relative bg-slate-200 dark:bg-zinc-900 shrink-0">
                                {(selectedArtist.preview_base64 || selectedArtist.preview_url) ? (
                                    <img 
                                        src={selectedArtist.preview_base64 ? `data:image/png;base64,${selectedArtist.preview_base64}` : selectedArtist.preview_url} 
                                        className="w-full h-full object-cover opacity-80"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="h-16 w-16 text-slate-400 dark:text-white/20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-50/90 via-slate-50/20 dark:from-zinc-950 dark:via-zinc-950/40 to-transparent" />
                                
                                <div className="absolute bottom-4 left-6 right-6">
                                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-lg mb-2">
                                        {selectedArtist.name}
                                    </h2>
                                    <div className="flex gap-3 text-sm text-slate-700 dark:text-white/80 font-medium">
                                        <span className="flex items-center gap-1.5 bg-white/60 dark:bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-md border border-slate-200 dark:border-transparent shadow-sm dark:shadow-none">
                                            <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400"/> {selectedArtist.author_name}
                                        </span>
                                        <span className="flex items-center gap-1.5 bg-white/60 dark:bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-md border border-slate-200 dark:border-transparent shadow-sm dark:shadow-none">
                                            <Download className="h-4 w-4 text-cyan-600 dark:text-cyan-400"/> {selectedArtist.downloads}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 text-slate-700 dark:text-white/80 text-sm leading-relaxed custom-scrollbar">
                                {selectedArtist.description ? (
                                    <div className="mb-6">
                                        <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40 mb-2 font-bold">Description</h4>
                                        <p>{selectedArtist.description}</p>
                                    </div>
                                ) : (
                                    <p className="italic text-slate-400 dark:text-white/30 mb-6">No description provided.</p>
                                )}
                                
                                {selectedArtist.tag && (
                                    <div>
                                        <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40 mb-2 font-bold">Danbooru Tag</h4>
                                        <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3 rounded-xl font-mono text-xs text-indigo-600 dark:text-indigo-300 break-all">
                                            {selectedArtist.tag}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 pb-[calc(80px+env(safe-area-inset-bottom,0px))] bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-white/5 shrink-0">
                                <motion.div whileTap={{ scale: 0.95 }}>
                                    <Button 
                                        className="w-full h-14 rounded-2xl font-bold text-lg bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                        onClick={() => handleDownload(selectedArtist)}
                                        disabled={isDownloading}
                                    >
                                        {isDownloading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
                                        {isDownloading ? 'Importing...' : 'Import Artist'}
                                    </Button>
                                </motion.div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
