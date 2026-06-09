import React, { useEffect, useState, useRef } from 'react';
import { ArtistLite } from '../../../types/artist';
import { artistDB } from '../../../services/artist-db';
import { danbooruService } from '../../../services/danbooru-service';
import { cn } from '@/lib/utils';
import { Heart, Image as ImageIcon, Check, Trash2, CloudUpload, Globe, Loader2, User, RefreshCw, StickyNote, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

interface ArtistCardProps {
    artist: ArtistLite;
    isSelected: boolean;
    onToggle: (id: string) => void;
    onFavorite: (id: string, isFavorite: boolean) => void;
    onDelete?: () => void;
    onEdit?: () => void;
    onPublish?: (id: string, artist: ArtistLite) => void;
    compact?: boolean;
}

export const ArtistCard = React.forwardRef<HTMLDivElement, ArtistCardProps>(({ artist, isSelected, onToggle, onFavorite, onDelete, onEdit, onPublish, compact }, ref) => {
    // Prioritize Danbooru preview URL to skip DB load and save memory
    const initialImage = artist.previewUrl || (artist.hasImage ? null : artist.imageUrl) || null;
    const [imageUrl, setImageUrl] = useState<string | null>(initialImage);
    const [isHovered, setIsHovered] = useState(false);
    const [isFetchingFallback, setIsFetchingFallback] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const fallbackAttemptedRef = useRef(false);

    // Open Danbooru in a new WebviewWindow
    const openDanbooruWorks = async () => {
        const cleanTag = artist.tag.replace(/^artist:/, '');
        const url = `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(cleanTag)}`;
        
        try {
            const webviewLabel = `danbooru-${Date.now()}`;
            const webview = new WebviewWindow(webviewLabel, {
                url,
                title: `${artist.name} - Danbooru`,
                width: 1200,
                height: 800,
                center: true,
                resizable: true,
            });
            
            webview.once('tauri://error', (e) => {
                console.error('[ArtistCard] Webview creation failed:', e);
            });
        } catch (e) {
            console.error('[ArtistCard] Failed to create webview:', e);
        }
    };

    /**
     * Danbooru 在线回退：当本地图片加载失败时自动从 Danbooru 获取替代图片
     */
    const fetchDanbooruFallback = async () => {
        if (fallbackAttemptedRef.current || isFetchingFallback) return;
        fallbackAttemptedRef.current = true;
        setIsFetchingFallback(true);

        try {
            const searchTag = artist.tag || `artist:${artist.name.trim().replace(/ /g, '_')}`;
            console.log(`[ArtistCard] 🔄 图片加载失败，从 Danbooru 回退: ${artist.name} (${searchTag})`);
            
            const url = await danbooruService.fetchArtistPreview(searchTag);
            
            if (url) {
                console.log(`[ArtistCard] ✅ Danbooru 回退成功: ${artist.name} -> ${url}`);
                setImageUrl(url);
                
                // 持久化到 DB，后续不用再请求
                try {
                    const fullArtist = await artistDB.getArtist(artist.id);
                    if (fullArtist) {
                        await artistDB.addArtist({ ...fullArtist, previewUrl: url });
                    }
                } catch (dbErr) {
                    console.warn('[ArtistCard] DB 更新失败（非致命）:', dbErr);
                }
            } else {
                console.log(`[ArtistCard] ❌ Danbooru 无结果: ${artist.name}`);
                setImageUrl(null); // 显示占位图标
            }
        } catch (e) {
            console.error(`[ArtistCard] Danbooru 回退失败:`, e);
            setImageUrl(null);
        } finally {
            setIsFetchingFallback(false);
        }
    };

    const handleManualRetry = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFetchingFallback) return;
        fallbackAttemptedRef.current = false;
        fetchDanbooruFallback();
    };

    useEffect(() => {
        let mounted = true;
        
        // 重置 fallback 标志（artist 变化时）
        fallbackAttemptedRef.current = false;
        setImageLoaded(false);

        const isAndroid = /android/i.test(navigator.userAgent);
        
        // 1. If we already have a previewUrl (https://), use it directly
        if (artist.previewUrl) {
            setImageUrl(artist.previewUrl);
            return;
        }

        // 2. If we have an imageUrl from getAllArtistsLite, use it
        if (artist.imageUrl) {
            setImageUrl(artist.imageUrl);
            // On Desktop only: also try loading full blob from DB for higher quality
            if (!isAndroid && artist.hasImage) {
                const loadImage = async () => {
                    try {
                        const fullArtist = await artistDB.getArtist(artist.id);
                        if (mounted && fullArtist?.imageUrl) {
                            setImageUrl(fullArtist.imageUrl);
                        }
                    } catch (err) {
                        console.error("Failed to load full image for artist", artist.id, err);
                    }
                };
                loadImage();
            }
            return;
        }

        // 3. No image at all. 
        if (isAndroid) {
            // On Android: show placeholder. User should run batch repair.
            setImageUrl(null);
        } else {
            // On Desktop: try loading from DB blob, then Danbooru fallback
            const loadImage = async () => {
                try {
                    const fullArtist = await artistDB.getArtist(artist.id);
                    if (mounted && fullArtist?.imageUrl) {
                        setImageUrl(fullArtist.imageUrl);
                    } else if (mounted) {
                        fetchDanbooruFallback();
                    }
                } catch (err) {
                    console.error("Failed to load image for artist", artist.id, err);
                    if (mounted) fetchDanbooruFallback();
                }
            };
            loadImage();
        }
        
        return () => { mounted = false; };
    }, [artist.id, artist.imageUrl, artist.hasImage, artist.previewUrl]);

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    const finalImageUrl = imageUrl || artist.previewUrl || null;

    return (
        <motion.div
            ref={ref}
            layoutId={artist.id}
            variants={itemVariants}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
                "group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300",
                "bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 shadow-lg",
                isSelected && "ring-3 ring-indigo-500 shadow-xl scale-[1.02]",
                compact && "rounded-xl" 
            )}
            onClick={() => onToggle(artist.id)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Image Layer */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center shadow-inner">
                {finalImageUrl ? (
                    <img 
                        src={finalImageUrl} 
                        alt={artist.name} 
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onLoad={() => setImageLoaded(true)}
                        className={cn(
                            "w-full h-full object-cover transition-opacity duration-500",
                            imageLoaded ? "opacity-100" : "opacity-0",
                            isHovered && "scale-110 transition-transform duration-300"
                        )}
                        onError={() => {
                            setImageLoaded(false);
                            fetchDanbooruFallback();
                        }}
                    />
                ) : isFetchingFallback ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className={cn("animate-spin text-indigo-400", compact ? "w-5 h-5" : "w-8 h-8")} />
                        {!compact && <span className="text-[10px] text-white/40 font-medium">Loading...</span>}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 z-10">
                        <ImageIcon className={cn("text-slate-300 dark:text-slate-600", compact ? "w-6 h-6" : "w-10 h-10")} />
                        <button
                            onClick={handleManualRetry}
                            className="mt-1 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors backdrop-blur-[2px] cursor-pointer pointer-events-auto"
                            title="重新获取封面 (Retry Sync)"
                        >
                            <RefreshCw className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4", "text-white/80 hover:text-white")} />
                        </button>
                    </div>
                )}
            </div>

            {/* Selection Overlay */}
            <AnimatePresence>
                {isSelected && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-indigo-500/20 z-10 flex items-center justify-center backdrop-blur-[2px]"
                    >
                        <div className={cn("bg-indigo-500 rounded-full shadow-lg scale-110 flex items-center justify-center", compact ? "w-6 h-6" : "w-8 h-8")}>
                            <Check className={cn("text-white", compact ? "w-3.5 h-3.5" : "w-5 h-5")} strokeWidth={3} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

             {/* Top Right Action Buttons (Delete) - Hidden in compact mode unless specifically enabled, but here hidden */}
            {!compact && (
                <div className={cn(
                    "absolute top-3 right-3 flex flex-col gap-2 z-20 transition-all duration-300 translate-x-2",
                    isHovered ? "opacity-100 translate-x-0" : "opacity-0"
                )}>
                    {onEdit && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            className="p-2 rounded-xl bg-black/40 text-white/70 hover:bg-emerald-500/90 hover:text-white backdrop-blur-md transition-colors border border-white/10 shadow-lg"
                            title="编辑备注与详情 (Edit Memo / Details)"
                        >
                            <PenTool className="w-3.5 h-3.5" />
                        </motion.button>
                    )}
                     {onDelete && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleDelete}
                            className="p-2 rounded-xl bg-black/40 text-white/70 hover:bg-red-500/90 hover:text-white backdrop-blur-md transition-colors border border-white/10 shadow-lg"
                            title="删除画师"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                    )}
                    {onPublish && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onPublish(artist.id, artist);
                            }}
                            className="p-2 rounded-xl bg-black/40 text-white/70 hover:bg-indigo-500/90 hover:text-white backdrop-blur-md transition-colors border border-white/10 shadow-lg"
                            title="发布到社区"
                        >
                            <CloudUpload className="w-3.5 h-3.5" />
                        </motion.button>
                    )}
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            openDanbooruWorks();
                        }}
                        className="p-2 rounded-xl bg-black/40 text-white/70 hover:bg-blue-500/90 hover:text-white backdrop-blur-md transition-colors flex items-center justify-center border border-white/10 shadow-lg"
                        title="查看作品 (View Works)"
                    >
                        <Globe className="w-3.5 h-3.5" />
                    </motion.button>
                </div>
            )}

            {/* Info Gradient - Simpler in compact mode */}
            <div className={cn(
                "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-all duration-300 translate-y-2",
                compact ? "p-3 pt-8" : "p-4 pt-12",
                 (isHovered || isSelected) ? "opacity-100 translate-y-0" : "opacity-0"
            )}>
                <div className="flex justify-between items-end">
                    <div className="text-white min-w-0 flex-1 mr-2">
                        <h3 className={cn("font-bold truncate drop-shadow-md text-slate-100", compact ? "text-xs" : "text-sm")}>{artist.name}</h3>
                        {!compact && <p className="text-[10px] text-indigo-300 font-mono truncate mt-0.5">{artist.tag}</p>}
                        {(artist as any).memo && (
                            <div className={cn("flex items-start gap-1 opacity-80", compact ? "mt-0.5" : "mt-1.5")}>
                                <StickyNote className={cn("text-emerald-400 shrink-0", compact ? "w-2.5 h-2.5 mt-[1px]" : "w-3 h-3 mt-[2px]")} />
                                <p className={cn("text-emerald-300/90 leading-tight", compact ? "text-[9px] line-clamp-1" : "text-[10px] line-clamp-2")} title={(artist as any).memo}>
                                    {(artist as any).memo}
                                </p>
                            </div>
                        )}
                    </div>
                    {!compact && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onFavorite(artist.id, !artist.isFavorite);
                            }}
                            className={cn(
                                "p-2 rounded-xl backdrop-blur-md transition-colors flex-none border shadow-lg z-20",
                                artist.isFavorite ? "bg-pink-500/20 text-pink-400 border-pink-500/30" : "bg-black/40 text-white/60 hover:text-white hover:bg-white/20 border-white/10"
                            )}
                        >
                            <Heart className={cn("w-3.5 h-3.5", artist.isFavorite && "fill-current")} />
                        </motion.button>
                    )}
                </div>
            </div>
            
            {/* Always visible Badge for favorites if not hovered, hide in compact to reduce clutter */}
            {!compact && !isHovered && !isSelected && artist.isFavorite && (
                <div className="absolute top-2 right-2 text-pink-500 drop-shadow-md">
                    <Heart className="w-4 h-4 fill-current" />
                </div>
            )}


        </motion.div>
    );
});
ArtistCard.displayName = 'ArtistCard';
