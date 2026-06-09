import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/atoms/Dialog';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
// Textarea removed
import { communityService } from '@/services/community-service';
import { useSync } from '@/context/SyncContext';
import { Artist } from '../../../types/artist';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CloudUpload, Image as ImageIcon, Globe } from 'lucide-react';
import { artistDB } from '@/services/artist-db';
import { danbooruService } from '@/services/danbooru-service';

interface PublishArtistDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    artist: { id: string, name: string, tag: string, description?: string } | null;
}

export const PublishArtistDialog: React.FC<PublishArtistDialogProps> = ({ open, onOpenChange, artist }) => {
    const { token, isLoggedIn } = useSync();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [description, setDescription] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null); // Danbooru URL

    // Load full artist details (image) when opening
    useEffect(() => {
        if (open && artist) {
            setDescription(artist.description || '');
            // Load full image from DB - prioritize previewUrl (Danbooru URL)
            artistDB.getArtist(artist.id).then(full => {
                if (full?.previewUrl) {
                    setPreviewUrl(full.previewUrl);
                    setPreviewImage(full.previewUrl); // Show URL in preview
                } else if (full?.imageUrl) {
                    setPreviewImage(full.imageUrl); // Fallback to local
                    setPreviewUrl(null);
                }
            });
        }
    }, [open, artist]);

    const handlePublish = async () => {
        if (!artist || !token) {
            toast({ title: "Error", description: "Please login first", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            // Priority: Use previewUrl, else fetch from Danbooru, else skip image
            let finalPreviewUrl = previewUrl;
            
            if (!finalPreviewUrl) {
                // Try to fetch from Danbooru
                toast({ title: "获取预览图...", description: "正在从 Danbooru 获取预览图 URL..." });
                const tag = artist.tag || `artist:${artist.name}`;
                const fetchedUrl = await danbooruService.fetchArtistPreview(tag);
                if (fetchedUrl) {
                    finalPreviewUrl = fetchedUrl;
                }
            }

            const result = await communityService.publishArtist(token, {
                name: artist.name,
                description: description,
                tag: artist.tag,
                preview_base64: undefined, // Never send base64, too large!
                preview_url: finalPreviewUrl || undefined
            });

            if (result.success) {
                toast({ title: "发布成功", description: `${artist.name} 已发布到社区!` });
                onOpenChange(false);
            } else {
                toast({ title: "发布失败", description: result.error || "未知错误", variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to publish artist", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    if (!artist) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <CloudUpload className="w-5 h-5 text-indigo-500" />
                        <DialogTitle>发布画师到社区</DialogTitle>
                    </div>
                    <DialogDescription>
                        分享 <strong>{artist.name}</strong> 给其他用户。
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex justify-center">
                        <div className="w-32 h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative group">
                            {previewImage ? (
                                <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="w-8 h-8 text-slate-400" />
                            )}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>名称 (Name)</Label>
                        <Input value={artist.name} readOnly className="bg-slate-50 dark:bg-slate-800/50" />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label>触发词 (Tag)</Label>
                        <div className="flex gap-2">
                            <Input value={artist.tag} readOnly className="bg-slate-50 dark:bg-slate-800/50 flex-1" />
                            <Button variant="outline" size="icon" asChild title="Open in Danbooru">
                                <a href={`https://danbooru.donmai.us/posts?tags=${encodeURIComponent(artist.name)}`} target="_blank" rel="noopener noreferrer">
                                    <Globe className="w-4 h-4" />
                                </a>
                            </Button>
                        </div>
                    </div>


                    <div className="grid gap-2">
                        <Label>描述 (Description)</Label>
                        <textarea 
                            placeholder="添加描述 (可选)..." 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-50"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>预览链接 (Preview URL)</Label>
                        <div className="flex gap-2">
                            <Input 
                                value={previewUrl || (previewImage?.startsWith('http') ? previewImage : 'Local Image (Base64)')} 
                                readOnly 
                                className="bg-slate-50 dark:bg-slate-800/50 flex-1 text-xs text-muted-foreground" 
                            />
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={async () => {
                                    setIsLoading(true);
                                    try {
                                        toast({ title: "Fetching...", description: `Searching for ${artist.name}...` });
                                        // Try tag first, then name
                                        let url = await danbooruService.fetchArtistPreview(artist.tag);
                                        if (!url) {
                                             url = await danbooruService.fetchArtistPreview(artist.name);
                                        }

                                        if (url) {
                                            setPreviewUrl(url);
                                            setPreviewImage(url);
                                            
                                            // Update DB
                                            const full = await artistDB.getArtist(artist.id);
                                            if (full) {
                                                await artistDB.updateArtist({ ...full, previewUrl: url });
                                            }
                                            
                                            toast({ title: "Success", description: "Found preview URL!" });
                                        } else {
                                            toast({ title: "Not Found", description: "Could not find preview on Danbooru", variant: "destructive" });
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading}
                                title="Fetch from Danbooru"
                            >
                                <Globe className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button onClick={handlePublish} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        发布
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
