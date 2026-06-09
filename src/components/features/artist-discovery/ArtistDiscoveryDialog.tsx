import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/atoms/Dialog";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Search, Loader2, User, ExternalLink, Plus, Wand2, Tag, Palette, Globe, ImageIcon } from "lucide-react";
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { generateUUID } from "@/lib/utils";
import { useAuthStore } from '@/stores/auth-store';
import { useArtistStore } from '@/stores/artist-store';
import { generateImage, GenerationParams } from '@/services/novelai-service';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from "@/components/atoms/Tabs";
import { ImageCropperDialog } from './ImageCropperDialog';
import { ArtistCommunityPanel } from '../artist-gallery/ArtistCommunityPanel';

// Types
interface Artist {
    name: string;
    postCount: number;
    previewUrl?: string; // Generated preview or sample
    danbooruUrl: string;
    isGenerating?: boolean;
}

interface ArtistDiscoveryDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
    initialTab?: 'discovery' | 'community';
}

export function ArtistDiscoveryDialog({ open, onOpenChange, trigger, initialTab = 'discovery' }: ArtistDiscoveryDialogProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab);

    // Reset tab when reopened
    React.useEffect(() => {
        if (open) setActiveTab(initialTab);
    }, [open, initialTab]);
    const [searchQuery, setSearchQuery] = useState("1girl solo");
    const [isLoading, setIsLoading] = useState(false);
    const [artists, setArtists] = useState<Artist[]>([]);
    const [searchMode, setSearchMode] = useState<'tags' | 'artist'>('tags');
    
    // Cropper State
    const [cropperOpen, setCropperOpen] = useState(false);
    const [artistToCrop, setArtistToCrop] = useState<Artist | null>(null);

    const { token } = useAuthStore();
    const { importArtists } = useArtistStore();

    const handleSearch = async () => {
        setIsLoading(true);
        setArtists([]);
        
        try {
            if (searchMode === 'tags') {
                // Method 1: Search Posts by Tags (Existing Logic)
                const limit = 100; 
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

                const foundArtists: Artist[] = Array.from(artistCounts.entries())
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
                // Method 2: Search Artists Directly
                const limit = 50;
                
                // Fuzzy search logic:
                let term = searchQuery.trim().replace(/\s+/g, '_');
                if (!term.includes('*')) {
                    term = `*${term}*`;
                }

                const url = `https://danbooru.donmai.us/artists.json?search[any_name_matches]=${encodeURIComponent(term)}&search[order]=post_count&limit=${limit}`;

                console.log(`[Artist Discovery] Searching URL: ${url}`);

                const response = await window.fetch(url, { method: 'GET' });
                if (!response.ok) throw new Error(`Danbooru API Error: ${response.statusText}`);
                const artistData: any[] = await response.json();

                console.log("[Discovery] Raw Artist Data:", artistData);

                const foundArtists: Artist[] = artistData.map(a => ({
                    name: a.name.replace(/_/g, ' '),
                    postCount: a.post_count || 0, // Fallback if undefined
                    danbooruUrl: `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(a.name)}`,
                    previewUrl: undefined 
                }));

                setArtists(foundArtists);

                // Asynchronously fetch previews for top 20
                foundArtists.slice(0, 20).forEach(async (artist) => {
                    try {
                        const artistTag = artist.name.trim().replace(/\s+/g, '_');
                        // Try searching without 'artist:' prefix first, as the name IS the tag
                        const postsUrl = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(artistTag)}&limit=1`;
                        
                        console.log(`[Discovery] Fetching preview for ${artist.name} -> ${postsUrl}`);
                        
                        const res = await window.fetch(postsUrl);
                        if (!res.ok) {
                            console.warn(`[Discovery] Preview fetch failed for ${artist.name}: ${res.status}`);
                            return;
                        }
                        const posts = await res.json();
                        console.log(`[Discovery] Posts for ${artist.name}:`, posts);
                        
                        if (posts && posts.length > 0) {
                             const post = posts[0];
                             const preview = post.media_asset?.variants?.[2]?.url || post.file_url;
                             
                             if (preview) {
                                 setArtists(current => current.map(a => 
                                     a.name === artist.name ? { ...a, previewUrl: preview } : a
                                 ));
                             } else {
                                 console.log(`[Discovery] No preview URL found in post for ${artist.name}`);
                             }
                        } else {
                             console.log(`[Discovery] No posts found for ${artist.name}`);
                        }
                    } catch (e) {
                         console.warn(`Failed to fetch preview for ${artist.name}`, e);
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

    const handleGeneratePreview = async (artist: Artist) => {
        if (!token) {
            toast({ title: "Login Required", description: "Please login to NAI first", variant: "destructive" });
            return;
        }

        // Toggle generating state for this artist
        setArtists(prev => prev.map(a => a.name === artist.name ? { ...a, isGenerating: true } : a));

        try {
            // Escape parenthesis in artist name to prevent prompt weighting issues
            const safeName = artist.name.replace(/[()]/g, '\\$&');

            const params: GenerationParams = {
                prompt: `masterpiece, best quality, ${safeName}, 1girl, solo`,
                negative_prompt: "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
                width: 512, // Small for preview
                height: 768,
                steps: 28,
                cfg_scale: 5,
                cfg_rescale: 0,
                sampler: "k_euler_ancestral",
                scheduler: "native",
                model: "nai-diffusion-3", // Or 4 if available, keep it safe
                smea: false,
                smea_dyn: false,
                variety: false,
                seed: -1
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

    const handleAddClick = (artist: Artist) => {
        if (artist.previewUrl) {
            setArtistToCrop(artist);
            setCropperOpen(true);
        } else {
            // No preview, add directly (with placeholder logic or empty)
            importArtistWithImage(artist, '');
        }
    };

    const handleCropComplete = (base64Image: string) => {
        if (artistToCrop) {
            importArtistWithImage(artistToCrop, base64Image);
            setArtistToCrop(null); 
            // Don't close immediately? 
            // Actually ImageCropperDialog calls this then we should close it.
            // But ImageCropperDialog onConfirm calls onCropComplete then we close it there?
            // Wait, ImageCropperDialog implementation calls onOpenChange(false) AFTER onCropComplete.
            // So we are good.
        }
    };

    const importArtistWithImage = async (artist: Artist, imageUrl: string) => {
        try {
            await importArtists([{
                id: generateUUID(),
                name: artist.name,
                tag: artist.name.replace(/ /g, '_'), // Ensure tag is underscore formatted
                imageUrl: imageUrl, 
                // Store previewUrl if available (from Danbooru or generated)
                // If it's a data URI (generated), it's already in imageUrl, so we can skip previewUrl or dup it?
                // best to store it if it's a remote URL.
                previewUrl: artist.previewUrl?.startsWith('http') ? artist.previewUrl : undefined,
                createdAt: Date.now(),
                danbooruCount: artist.postCount,
                description: "Imported from Discovery"
            }]);
            toast({ title: "Added to Library", description: `${artist.name} has been added.` });
        } catch (error) {
            toast({ title: "Import Failed", description: String(error), variant: "destructive" });
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
                {/* 
                  PRO MAX SHELL:
                  Extremely blurred backdrop with a very dark tint.
                  Container has large border radius and subtle inner border stroke.
                */}
                <DialogContent className="max-w-[1000px] w-[95vw] h-[85vh] flex flex-col p-0 gap-0 bg-slate-900/60 dark:bg-black/40 backdrop-blur-3xl border border-white/10 dark:border-white/5 rounded-3xl overflow-hidden shadow-2xl z-[150]">
                    
                    {/* Header: Segmented Control Style Tabs */}
                    <div className="flex items-center justify-between p-4 px-6 border-b border-white/5 bg-white/5 relative">
                        <DialogTitle className="text-lg font-semibold flex items-center gap-2 m-0 p-0">
                            <div className="bg-black/20 backdrop-blur-md p-1 rounded-2xl border border-white/5 flex shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
                                <button
                                    className={`relative z-10 flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                                        activeTab === 'discovery' 
                                            ? 'text-white shadow-sm' 
                                            : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                                    }`}
                                    onClick={() => setActiveTab('discovery')}
                                >
                                    {activeTab === 'discovery' && (
                                        <motion.div
                                            layoutId="discoveryTabHighlight"
                                            className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl -z-10"
                                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                        />
                                    )}
                                    <Wand2 className="w-4 h-4" /> 
                                    {t('artistDiscovery.title')}
                                </button>
                                <button
                                    className={`relative z-10 flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                                        activeTab === 'community' 
                                            ? 'text-white shadow-sm' 
                                            : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                                    }`}
                                    onClick={() => setActiveTab('community')}
                                >
                                    {activeTab === 'community' && (
                                        <motion.div
                                            layoutId="discoveryTabHighlight"
                                            className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl -z-10"
                                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                        />
                                    )}
                                    <Globe className="w-4 h-4" /> 
                                    {t('gallery.communityLibrary', 'Community')}
                                </button>
                            </div>
                        </DialogTitle>
                    </div>
                    
                    <DialogDescription className="sr-only">
                        {t('artistDiscovery.description')}
                    </DialogDescription>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {activeTab === 'discovery' ? (
                            <>
                                {/* Search Interaction */}
                                <div className="p-6 pb-2 flex flex-col gap-5 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                                    
                                    {/* Sub-modes: Tags vs Artist Name */}
                                    <div className="flex justify-center">
                                        <div className="inline-flex bg-black/30 p-1 rounded-full border border-white/5">
                                            <button
                                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                                    searchMode === 'tags' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                                onClick={() => setSearchMode('tags')}
                                            >
                                                <Tag className="w-3.5 h-3.5" /> 
                                                {t('artistDiscovery.tagSearch')}
                                            </button>
                                            <button
                                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                                    searchMode === 'artist' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                                onClick={() => setSearchMode('artist')}
                                            >
                                                <Palette className="w-3.5 h-3.5" /> 
                                                {t('artistDiscovery.artistSearch')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 max-w-2xl mx-auto w-full">
                                        <div className="relative flex-1 group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                                            <input 
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder={searchMode === 'tags' ? t('artistDiscovery.searchTagsPlaceholder') : t('artistDiscovery.searchArtistPlaceholder')}
                                                className="w-full h-12 pl-11 pr-4 bg-black/40 border border-white/10 rounded-2xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-inner"
                                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            />
                                        </div>
                                        <motion.button 
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleSearch} 
                                            disabled={isLoading}
                                            className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                                        >
                                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            {t('common.search', 'Search')}
                                        </motion.button>
                                    </div>
                                </div>

                                {/* Results Grid */}
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                    {artists.length === 0 && !isLoading ? (
                                        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500 py-20 gap-4">
                                            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                                                <Search className="w-8 h-8 opacity-40" />
                                            </div>
                                            <p className="text-sm font-medium">
                                                {searchMode === 'tags' 
                                                    ? t('artistDiscovery.emptyTags')
                                                    : t('artistDiscovery.emptyArtist')}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                                            {artists.map((artist) => (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    key={artist.name} 
                                                    className="flex flex-col gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all duration-300 group shadow-lg"
                                                >
                                                    {/* Preview Image Area */}
                                                    <div className="aspect-[3/4] bg-black/40 rounded-xl overflow-hidden relative border border-white/5 shadow-inner">
                                                         {artist.previewUrl ? (
                                                             <img 
                                                                src={artist.previewUrl} 
                                                                alt={artist.name} 
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                             />
                                                         ) : (
                                                             <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                                                                 <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                                                     <User className="w-6 h-6 opacity-50" />
                                                                 </div>
                                                                 <span className="text-xs font-medium">{t('artistDiscovery.noPreview')}</span>
                                                             </div>
                                                         )}
                                                         
                                                         {/* Generate Button Overlay */}
                                                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                                                             <motion.button 
                                                                whileTap={{ scale: 0.95 }}
                                                                className="h-9 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-medium flex items-center transition-colors disabled:opacity-50 shadow-xl"
                                                                onClick={() => handleGeneratePreview(artist)}
                                                                disabled={artist.isGenerating}
                                                             >
                                                                {artist.isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                                                                    <>
                                                                        <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                                                                        {t('artistDiscovery.generatePreview')}
                                                                    </>
                                                                )}
                                                             </motion.button>
                                                         </div>
                                                    </div>

                                                    <div className="flex flex-col gap-0.5 px-1">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="font-semibold text-sm text-slate-100 truncate pr-2" title={artist.name}>
                                                                {artist.name}
                                                            </h3>
                                                            <a 
                                                                href={artist.danbooruUrl} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-slate-500 hover:text-indigo-400 transition-colors p-1"
                                                                title="View on Danbooru"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                        </div>
                                                        <p className="text-xs text-slate-400 font-medium">
                                                            {artist.postCount.toLocaleString()} {t('artistDiscovery.posts')}
                                                        </p>
                                                    </div>
                                                    
                                                    <motion.button 
                                                        whileTap={{ scale: 0.96 }}
                                                        className="w-full mt-auto h-9 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors group/btn" 
                                                        onClick={() => handleAddClick(artist)}
                                                    >
                                                        <Plus className="w-3.5 h-3.5 mr-1.5 group-hover/btn:rotate-90 transition-transform duration-300" />
                                                        {t('artistDiscovery.addToLibrary')}
                                                    </motion.button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <ArtistCommunityPanel onClose={() => onOpenChange?.(false)} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cropper Dialog */}
            {artistToCrop && artistToCrop.previewUrl && (
                <ImageCropperDialog 
                    open={cropperOpen} 
                    onOpenChange={setCropperOpen}
                    imageUrl={artistToCrop.previewUrl}
                    onCropComplete={handleCropComplete}
                    title={`${t('artistDiscovery.crop.title')} - ${artistToCrop.name}`}
                />
            )}
        </>
    );
}
