import React, { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, Check, Heart, RefreshCw, Loader2, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MobileArtistDTO } from '@/types/artist';

/**
 * 模块级 Blob URL 缓存：原始 URL → Blob URL。
 * 虚拟滚动中组件频繁 mount/unmount，如果每次都重新 tauriFetch 并 revoke Blob，
 * 就会导致图片一直重复加载。此缓存使 Blob URL 在整个会话中持久存在。
 * 内存占用可控：限制缓存最大数量，超出时主动 revokeObjectURL 释放内存，避免 OOM。
 */
class LRUBlobCache {
    private cache = new Map<string, string>();
    private maxSize: number;

    constructor(maxSize = 150) {
        this.maxSize = maxSize;
    }

    get(key: string) {
        if (!this.cache.has(key)) return undefined;
        // Refresh position
        const val = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, val);
        return val;
    }

    set(key: string, value: string) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Evict oldest
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                const oldestUrl = this.cache.get(oldestKey);
                if (oldestUrl && oldestUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(oldestUrl); // Free memory!
                }
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, value);
    }

    has(key: string) {
        return this.cache.has(key);
    }
}

export const blobCache = new LRUBlobCache(100);

interface MobileArtistCardProps {
    artist: MobileArtistDTO;
    isSelected: boolean;
    onToggle: (id: string) => void;
    onFavorite: (id: string, isFav: boolean) => void;
}

export const MobileArtistCard = memo(({ artist, isSelected, onToggle, onFavorite }: MobileArtistCardProps) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);
    
    // 优先从缓存获取已下载的 Blob URL，避免重复 tauriFetch
    const cachedBlob = artist.previewUrl ? blobCache.get(artist.previewUrl) : undefined;
    const [imgSrc, setImgSrc] = useState<string | null | undefined>(cachedBlob || artist.previewUrl);
    const [fallbackTried, setFallbackTried] = useState(!!cachedBlob); // 已有缓存则跳过 fallback
    const [isRetrying, setIsRetrying] = useState(false);

    // Sync imgSrc if artist url changes
    useEffect(() => {
        const cached = artist.previewUrl ? blobCache.get(artist.previewUrl) : undefined;
        setImgSrc(cached || artist.previewUrl);
        setFallbackTried(!!cached);
        setImageFailed(false);
        setImageLoaded(false);
        // 不再 revoke Blob URL — 由 blobCache 全局管理生命周期
    }, [artist.previewUrl]);

    const handleImageError = async () => {
        if (!artist.previewUrl || fallbackTried) {
            setImageLoaded(false);
            setImageFailed(true);
            return;
        }

        // 先检查缓存（可能其他实例已经下载过）
        const cached = blobCache.get(artist.previewUrl);
        if (cached) {
            setImgSrc(cached);
            setFallbackTried(true);
            setImageFailed(false);
            return;
        }

        console.log(`[MobileArtistCard] Image load failed for ${artist.name}, initiating Tauri HTTP fallback...`);
        setFallbackTried(true);

        try {
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            const response = await tauriFetch(artist.previewUrl, {
                method: 'GET',
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://danbooru.donmai.us/",
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                },
                connectTimeout: 8000
            });

            if (response.ok) {
                const buffer = await response.arrayBuffer();
                const blob = new Blob([buffer]);
                const objectUrl = URL.createObjectURL(blob);
                
                // 写入全局缓存，虚拟滚动再次挂载时直接命中
                blobCache.set(artist.previewUrl, objectUrl);
                
                setImgSrc(objectUrl);
                setImageFailed(false);
            } else {
                setImageLoaded(false);
                setImageFailed(true);
            }
        } catch (e) {
            console.error(`[MobileArtistCard] Tauri fallback failed for ${artist.name}:`, e);
            setImageLoaded(false);
            setImageFailed(true);
        }
    };

    const handleManualRetry = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRetrying) return;
        setIsRetrying(true);
        
        try {
            const { danbooruService } = await import('@/services/danbooru-service');
            const { useArtistStore } = await import('@/stores/artist-store');
            
            const tag = artist.tag || `artist:${artist.name.trim().replace(/ /g, '_')}`;
            const url = await danbooruService.fetchArtistPreview(tag);
            
            if (url) {
                // Save updated URL directly via SQL
                const Database = (await import('@tauri-apps/plugin-sql')).default;
                const db = await Database.load('sqlite:data.db');
                await db.execute('UPDATE artists SET preview_url = $1, preview_image = NULL WHERE id = $2', [url, parseInt(artist.id)]);
                
                // 用 tauriFetch 下载为 Blob URL 并写入缓存
                try {
                    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
                    const imgResp = await tauriFetch(url, {
                        method: 'GET',
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            "Referer": "https://danbooru.donmai.us/",
                            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                        },
                        connectTimeout: 8000
                    });
                    if (imgResp.ok) {
                        const buffer = await imgResp.arrayBuffer();
                        const blob = new Blob([buffer]);
                        const objectUrl = URL.createObjectURL(blob);
                        // 写入缓存
                        blobCache.set(url, objectUrl);
                        setImgSrc(objectUrl);
                    } else {
                        setImgSrc(url);
                    }
                } catch {
                    setImgSrc(url);
                }
                
                setImageFailed(false);
                setFallbackTried(true); // 已经有缓存了
                setImageLoaded(false);
                
                useArtistStore.getState().loadArtists();
            } else {
                setImageFailed(true);
            }
        } catch (e) {
            console.error(`[MobileArtistCard] Manual retry failed for ${artist.name}:`, e);
        } finally {
            setIsRetrying(false);
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            layoutId={artist.id}
            variants={itemVariants}
            initial="hidden"
            animate="show"
            whileTap={{ scale: 0.93 }}
            className={cn(
                "group relative aspect-[3/4] overflow-hidden cursor-pointer",
                "bg-ios-background border border-ios-separator/10",
                "shadow-ios rounded-2xl transition-all duration-200",
                isSelected && "ring-2 ring-ios-blue shadow-ios-lg scale-[1.02]"
            )}
            onClick={() => onToggle(artist.id)}
        >
            {/* Image Layer */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                {imgSrc && !imageFailed ? (
                    <img 
                        src={imgSrc} 
                        alt={artist.name} 
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onLoad={() => setImageLoaded(true)}
                        onError={handleImageError}
                        className={cn(
                            "w-full h-full object-cover transition-opacity duration-300",
                            imageLoaded ? "opacity-100" : "opacity-0"
                        )}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5 opacity-40 mb-10 mx-2 z-10">
                        {isRetrying ? (
                            <Loader2 className="w-6 h-6 animate-spin text-ios-blue" />
                        ) : (
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                        )}
                        <span className="text-[9px] text-slate-400 font-medium text-center leading-tight">
                            {artist.previewUrl && imageFailed ? "Load Failed" : "Awaiting Sync"}
                        </span>
                        {(imageFailed || !artist.previewUrl) && (
                            <button
                                onClick={handleManualRetry}
                                disabled={isRetrying}
                                className="mt-1 p-2 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-full transition-colors backdrop-blur-[2px] cursor-pointer pointer-events-auto shadow-sm"
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5", isRetrying ? "animate-spin text-ios-blue" : "text-slate-500 dark:text-slate-300")} />
                            </button>
                        )}
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
                        className="absolute inset-0 bg-ios-blue/10 z-10 flex items-center justify-center backdrop-blur-[2px]"
                    >
                        <div className="bg-ios-blue rounded-full shadow-ios w-8 h-8 flex items-center justify-center">
                            <Check className="text-white w-5 h-5" strokeWidth={3} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Always visible Badge for favorites (if favorite) */}
            {artist.isFavorite && (
                <div className="absolute top-2 right-2 text-pink-500 drop-shadow-md z-20">
                    <Heart className="w-4 h-4 fill-current" />
                </div>
            )}

            {/* Info Gradient Bottom (Always visible on mobile, since no hover) */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-12">
                <div className="flex justify-between items-end">
                    <div className="text-white min-w-0 flex-1 mr-2">
                        <h3 className="text-sm font-semibold truncate text-slate-50 tracking-tight drop-shadow-md">
                            {artist.name}
                        </h3>
                        <p className="text-[10px] text-ios-blue/80 font-mono truncate mt-0.5 font-medium">
                            {artist.tag}
                        </p>
                        {artist.danbooruCount > 0 && (
                            <p className="text-[9px] text-slate-300/70 mt-0.5">
                                {artist.danbooruCount} works
                            </p>
                        )}
                        {artist.memo && (
                            <div className="flex items-start gap-1 mt-1 opacity-90">
                                <StickyNote className="w-2.5 h-2.5 text-emerald-400 shrink-0 mt-[2px]" />
                                <p className="text-[9px] text-emerald-300/90 leading-tight line-clamp-1" title={artist.memo}>
                                    {artist.memo}
                                </p>
                            </div>
                        )}
                    </div>
                    
                    <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onFavorite(artist.id, !artist.isFavorite);
                        }}
                        className={cn(
                            "p-2 rounded-full backdrop-blur-md transition-colors flex-none border shadow-ios z-20",
                            artist.isFavorite 
                                ? "bg-white/90 text-pink-500 border-white/20" 
                                : "bg-black/40 text-white/80 border-white/10"
                        )}
                    >
                        <Heart className={cn("w-3.5 h-3.5", artist.isFavorite && "fill-current")} />
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
});
MobileArtistCard.displayName = 'MobileArtistCard';
