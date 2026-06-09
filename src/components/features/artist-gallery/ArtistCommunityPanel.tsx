import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useArtistStore } from '@/stores/artist-store'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { communityService, CommunityArtist } from '@/services/community-service'
import { useSync } from '@/context/SyncContext'
import {
    Download,
    Search,
    Globe,
    User,
    ArrowDown,
    Loader2,
    ImageIcon
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ArtistDB, artistDB } from '@/services/artist-db'
import { danbooruService } from '@/services/danbooru-service'

interface ArtistCommunityPanelProps {
    onClose?: () => void
}

export function ArtistCommunityPanel({ onClose }: ArtistCommunityPanelProps) {
    const { t } = useTranslation()
    const { token, isLoggedIn } = useSync()

    const [artists, setArtists] = useState<CommunityArtist[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [downloadingId, setDownloadingId] = useState<string | null>(null)

    const loadArtists = async () => {
        setIsLoading(true)
        try {
            const data = await communityService.listArtists(50, 0, searchQuery);
            setArtists(data);

            // Background fetch for missing previews
            // Filter artists that have NO preview image/url but have a tag or name from which we can search
            const missingPreviews = data.filter(a => !a.preview_base64 && !a.preview_url);
            
            if (missingPreviews.length > 0) {
                console.log(`[Community] Fetching previews for ${missingPreviews.length} artists...`);
                
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
                        console.warn(`[Community] Failed to fetch preview for ${artist.name}`, e);
                    }
                });
            }

        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to load community artists", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadArtists();
    }, [searchQuery])

    const handleDownload = async (artist: CommunityArtist) => {
        if (downloadingId) return;
        setDownloadingId(artist.id);
        try {
            // Check if exists by fetching all and matching name
            const allArtists = await artistDB.getAllArtistsLite();
            const existing = allArtists.find(a => a.name === artist.name);
            if (existing) {
                toast({ title: t('common.info'), description: `${artist.name} already exists` });
                return;
            }

            // 1. Get Details (increment download count)
            const fullArtist = await communityService.getArtistDetails(artist.id);
            if (!fullArtist) throw new Error("Artist details not found");

            // 2. Save to Local DB
           // Let's create an Artist object
           const newArtist: any = {
               id: String(Date.now()),
               name: fullArtist.name,
               count: 0, 
               imageUrl: fullArtist.preview_base64 
                  ? `data:image/png;base64,${fullArtist.preview_base64}` 
                  : (fullArtist.preview_url || ''),
               // Store URL too if available
               previewUrl: fullArtist.preview_url,
               tag: fullArtist.tag,
               description: fullArtist.description,
               isFavorite: 0
           };

           await artistDB.addArtist(newArtist);
           
           // Update global store so the UI refreshes
           useArtistStore.getState().loadArtists();

           toast({ title: t('common.success'), description: `Imported ${artist.name}` });

        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to download artist", variant: "destructive" });
        } finally {
            setDownloadingId(null);
        }
    }

    return (
        <div className="flex flex-col h-full bg-transparent">
             {/* Search Header */}
             <div className="p-6 pb-2 flex items-center justify-between gap-4 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                 <div className="relative flex-1 max-w-2xl mx-auto flex gap-3">
                     <div className="relative flex-1 group">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                         <input 
                             className="w-full h-12 pl-11 pr-4 bg-black/40 border border-white/10 rounded-2xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-inner"
                             placeholder={t('common.search', 'Search community...')}
                             value={searchQuery}
                             onChange={e => setSearchQuery(e.target.value)}
                         />
                     </div>
                     <motion.button 
                         whileTap={{ scale: 0.95 }}
                         className="h-12 w-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl flex items-center justify-center transition-colors disabled:opacity-50"
                         onClick={loadArtists} 
                         title="Refresh"
                         disabled={isLoading}
                     >
                         <Loader2 className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                     </motion.button>
                 </div>
             </div>

             {/* Grid */}
             <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                 {artists.length === 0 && !isLoading ? (
                     <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500 py-20 gap-4">
                         <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                             <Globe className="h-8 w-8 opacity-40" />
                         </div>
                         <p className="text-sm font-medium">{t('gallery.noCommunityResults', 'No artists found in community')}</p>
                     </div>
                 ) : (
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                         {artists.map((artist, i) => (
                             <motion.div 
                                 initial={{ opacity: 0, y: 10 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 transition={{ delay: i * 0.05 }}
                                 key={artist.id} 
                                 className="flex flex-col gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all duration-300 group shadow-lg"
                             >
                                 {/* Image */}
                                 <div className="aspect-[3/4] bg-black/40 rounded-xl overflow-hidden relative border border-white/5 shadow-inner">
                                     {artist.preview_base64 || artist.preview_url ? (
                                         <img 
                                            src={artist.preview_base64 ? `data:image/jpeg;base64,${artist.preview_base64}` : artist.preview_url} 
                                            alt={artist.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            loading="lazy"
                                         />
                                     ) : (
                                         <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                                             <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                                 <ImageIcon className="w-6 h-6 opacity-50" />
                                             </div>
                                         </div>
                                     )}
                                     
                                     {/* Overlay */}
                                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                                         <motion.button 
                                            whileTap={{ scale: 0.95 }}
                                            className="h-9 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-medium flex items-center transition-colors disabled:opacity-50 shadow-xl"
                                            onClick={() => handleDownload(artist)}
                                            disabled={downloadingId === artist.id}
                                         >
                                            {downloadingId === artist.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                                            {t('common.import', 'Import')}
                                         </motion.button>
                                     </div>
                                 </div>

                                 {/* Info */}
                                 <div className="flex flex-col gap-0.5 px-1 pb-1">
                                     <div className="font-semibold text-sm text-slate-100 truncate pr-2" title={artist.name}>{artist.name}</div>
                                     <div className="flex items-center justify-between mt-1 text-xs text-slate-400 font-medium">
                                         <span className="flex items-center gap-1"><User className="h-3 w-3"/> {artist.author_name}</span>
                                         <span className="flex items-center gap-1 text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded-md"><Download className="h-3 w-3"/> {artist.downloads}</span>
                                     </div>
                                     {artist.tag && (
                                         <div className="mt-2 flex flex-wrap gap-1">
                                             <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] text-slate-300 border border-white/5 truncate max-w-full">
                                                 {artist.tag}
                                             </span>
                                         </div>
                                     )}
                                 </div>
                             </motion.div>
                         ))}
                     </div>
                 )}
             </div>
        </div>
    )
}
