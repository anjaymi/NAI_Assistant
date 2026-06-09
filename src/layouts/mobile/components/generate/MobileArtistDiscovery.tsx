import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Loader2, User, ExternalLink, Plus, Tag, Palette, ImageIcon, Wand2 } from 'lucide-react';

import { Input } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';
import { useArtistStore } from '@/stores/artist-store';
import { useAuthStore } from '@/stores/auth-store';
import { generateImage, GenerationParams } from '@/services/novelai-service';
import { toast } from '@/hooks/use-toast';
import { generateUUID } from '@/lib/utils';
import { artistDB as db } from '@/services/artist-db';

interface ArtistDiscoveryItem {
    name: string;
    postCount: number;
    previewUrl?: string; 
    danbooruUrl: string;
    isGenerating?: boolean;
}

export function MobileArtistDiscovery() {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("1girl solo");
    const [isLoading, setIsLoading] = useState(false);
    const [artists, setArtists] = useState<ArtistDiscoveryItem[]>([]);
    const [searchMode, setSearchMode] = useState<'tags' | 'artist'>('tags');

    const { token } = useAuthStore();

    const handleSearch = async () => {
        setIsLoading(true);
        setArtists([]);
        
        try {
            if (searchMode === 'tags') {
                const limit = 50; 
                const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(searchQuery)}&limit=${limit}`;

                const response = await window.fetch(url, { method: 'GET' });
                if (!response.ok) throw new Error(`Danbooru API Error: ${response.statusText}`);
                const posts: any[] = await response.json();
                
                const artistCounts = new Map<string, number>();
                const artistSamples = new Map<string, string>(); 

                posts.forEach(post => {
                    if (!post.tag_string_artist) return;
                    
                    const artistsList = post.tag_string_artist.split(' ').filter((a: string) => a);
                    artistsList.forEach((artist: string) => {
                        artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
                        
                        if (!artistSamples.has(artist) && post.media_asset?.variants?.[2]?.url) {
                            artistSamples.set(artist, post.media_asset.variants[2].url);
                        } else if (!artistSamples.has(artist) && post.file_url) {
                            artistSamples.set(artist, post.file_url);
                        }
                    });
                });

                const foundArtists: ArtistDiscoveryItem[] = Array.from(artistCounts.entries())
                    .map(([name, count]) => ({
                        name: name.replace(/_/g, ' '), 
                        postCount: count, 
                        danbooruUrl: `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(name)}`,
                        previewUrl: artistSamples.get(name)
                    }))
                    .sort((a, b) => b.postCount - a.postCount)
                    .slice(0, 50); 

                setArtists(foundArtists);

            } else {
                const limit = 30;
                let term = searchQuery.trim().replace(/\s+/g, '_');
                if (!term.includes('*')) {
                    term = `*${term}*`;
                }

                const url = `https://danbooru.donmai.us/artists.json?search[any_name_matches]=${encodeURIComponent(term)}&search[order]=post_count&limit=${limit}`;
                const response = await window.fetch(url, { method: 'GET' });
                if (!response.ok) throw new Error(`Danbooru API Error: ${response.statusText}`);
                const artistData: any[] = await response.json();

                const foundArtists: ArtistDiscoveryItem[] = artistData.map(a => ({
                    name: a.name.replace(/_/g, ' '),
                    postCount: a.post_count || 0,
                    danbooruUrl: `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(a.name)}`,
                    previewUrl: undefined 
                }));

                setArtists(foundArtists);

                // Fetch previews for top results async
                foundArtists.slice(0, 15).forEach(async (artist) => {
                    try {
                        const artistTag = artist.name.trim().replace(/\s+/g, '_');
                        const postsUrl = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(artistTag)}&limit=1`;
                        const res = await window.fetch(postsUrl);
                        if (!res.ok) return;
                        
                        const posts = await res.json();
                        if (posts && posts.length > 0) {
                             const post = posts[0];
                             const preview = post.media_asset?.variants?.[2]?.url || post.file_url;
                             if (preview) {
                                 setArtists(current => current.map(a => 
                                     a.name === artist.name ? { ...a, previewUrl: preview } : a
                                 ));
                             }
                        }
                    } catch (e) {
                         console.warn(`Failed to fetch preview for ${artist.name}`);
                    }
                });
            }

        } catch (error) {
            console.error("Discovery failed", error);
            toast({ title: "Discovery Failed", description: String(error), variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGeneratePreview = async (artist: ArtistDiscoveryItem) => {
        if (!token) {
            toast({ title: "Login Required", description: "Please login to NAI first", variant: "destructive" });
            return;
        }

        setArtists(prev => prev.map(a => a.name === artist.name ? { ...a, isGenerating: true } : a));

        try {
            const safeName = artist.name.replace(/[()]/g, '\\$&');
            const params: GenerationParams = {
                prompt: `masterpiece, best quality, ${safeName}, 1girl, solo`,
                negative_prompt: "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
                width: 512, height: 768, steps: 28, cfg_scale: 5, cfg_rescale: 0,
                sampler: "k_euler_ancestral", scheduler: "native", model: "nai-diffusion-3",
                smea: false, smea_dyn: false, variety: false, seed: -1
            };

            const result = await generateImage(token, params);
            
            if (result.success && result.imageData) {
                const base64Url = `data:image/png;base64,${result.imageData}`;
                setArtists(prev => prev.map(a => a.name === artist.name ? { ...a, previewUrl: base64Url } : a));
                toast({ title: "Preview Generated", description: `Generated preview for ${artist.name}` });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            toast({ title: "Generation Failed", description: String(error), variant: "destructive" });
        } finally {
            setArtists(prev => prev.map(a => a.name === artist.name ? { ...a, isGenerating: false } : a));
        }
    };

    const importArtistWithImage = async (artist: ArtistDiscoveryItem) => {
        try {
            const allArtists = await db.getAllArtistsLite();
            if (allArtists.some(a => a.name === artist.name)) {
                toast({ title: "Info", description: `${artist.name} already exists in local library` });
                return;
            }

            const newArtist = {
                id: String(Date.now()),
                name: artist.name,
                tag: artist.name.replace(/ /g, '_'),
                imageUrl: '', 
                previewUrl: artist.previewUrl?.startsWith('http') || artist.previewUrl?.startsWith('data:') ? artist.previewUrl : undefined,
                createdAt: Date.now(),
                danbooruCount: artist.postCount,
                description: "Imported from Discovery",
                isFavorite: 0,
                count: 0
            };
            
            await db.addArtist(newArtist as any);
            useArtistStore.getState().loadArtists();
            toast({ title: "Added to Library", description: `${artist.name} has been added.` });
        } catch (error) {
            toast({ title: "Import Failed", description: String(error), variant: "destructive" });
        }
    };

    return (
        <div className="flex flex-col h-full w-full relative">
            {/* Search Header */}
            <div className="px-4 py-3 shrink-0 flex flex-col gap-3">
                
                {/* Mode Toggle */}
                <div className="flex justify-center">
                    <div className="flex bg-slate-200/50 dark:bg-zinc-900/50 p-1 rounded-full border border-slate-200 dark:border-white/5">
                        <button
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                                searchMode === 'tags' 
                                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                            onClick={() => setSearchMode('tags')}
                        >
                            <Tag className="w-3 h-3" /> 
                            {t('artistDiscovery.tagSearch', 'By Tag')}
                        </button>
                        <button
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                                searchMode === 'artist' 
                                    ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                            onClick={() => setSearchMode('artist')}
                        >
                            <Palette className="w-3 h-3" /> 
                            {t('artistDiscovery.artistSearch', 'By Name')}
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-white/40" />
                        <Input 
                            className="h-12 pl-10 pr-4 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-[16px] focus-visible:ring-1 focus-visible:ring-indigo-500/50 text-sm placeholder:text-slate-400 dark:placeholder:text-white/40 shadow-inner"
                            placeholder={searchMode === 'tags' ? "e.g. 1girl, solo" : "e.g. wlop"}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={handleSearch} 
                        disabled={isLoading}
                        className="h-12 px-5 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[16px] font-semibold flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    </motion.button>
                </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 custom-scrollbar">
                {isLoading && artists.length === 0 ? (
                    <div className="grid grid-cols-2 gap-3 pb-6 mt-2">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="aspect-[3/4] rounded-[16px] bg-slate-200/50 dark:bg-white/[0.03] animate-pulse overflow-hidden relative border border-slate-200/50 dark:border-white/5">
                                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
                                <div className="absolute left-3 bottom-3 right-3 h-4 bg-white/20 dark:bg-black/20 rounded-md" />
                            </div>
                        ))}
                    </div>
                ) : artists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 dark:text-white/40 mt-10">
                        <Wand2 className="h-12 w-12 mb-4 opacity-30" />
                        <p className="text-sm font-medium">
                            {searchMode === 'tags' ? "Search tags to discover artists" : "Search artist names on Danbooru"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 pb-6">
                        {artists.map(artist => (
                            <motion.div 
                                key={artist.name}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-[16px] overflow-hidden flex flex-col relative aspect-[3/4] shadow-sm transform-gpu"
                            >
                                {/* Preview Background */}
                                <div className="absolute inset-0 bg-slate-200 dark:bg-black/50 group">
                                    {artist.previewUrl ? (
                                        <img 
                                            src={artist.previewUrl} 
                                            alt={artist.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 dark:bg-white/5 opacity-50 z-0">
                                            <User className="h-10 w-10 text-slate-400 dark:text-white/30 mb-2" />
                                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">No Preview</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 dark:from-black dark:via-black/40 to-transparent z-10" />
                                    
                                    {/* Generate Preview Button overlay on touch/hover */}
                                    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 bg-black/60 transition-opacity">
                                        <motion.button 
                                           whileTap={{ scale: 0.9 }}
                                           className="h-10 px-4 bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold flex items-center shadow-lg backdrop-blur-md disabled:opacity-50"
                                           onClick={() => handleGeneratePreview(artist)}
                                           disabled={artist.isGenerating}
                                        >
                                           {artist.isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                               <><ImageIcon className="w-4 h-4 mr-2" /> Generate</>
                                           )}
                                        </motion.button>
                                    </div>
                                </div>
                                
                                <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col z-30 pointer-events-none">
                                    <h3 className="text-sm font-extrabold text-white tracking-tight leading-tight truncate drop-shadow-md">
                                        {artist.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 pointer-events-auto">
                                        <a href={artist.danbooruUrl} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-400 p-1 -ml-1">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                        <span className="text-[10px] text-white/80 font-mono tracking-tighter bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-md">
                                            {artist.postCount.toLocaleString()} posts
                                        </span>
                                    </div>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.85 }}
                                    onClick={() => importArtistWithImage(artist)}
                                    className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-black/60 text-white border border-white/20 backdrop-blur-md rounded-full shadow-md z-40 transition-colors pointer-events-auto"
                                >
                                    <Plus className="w-4 h-4" />
                                </motion.button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

