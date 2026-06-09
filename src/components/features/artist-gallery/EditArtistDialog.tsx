import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/atoms/Dialog';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Textarea } from '@/components/atoms/Textarea';
import { Label } from '@/components/atoms/Label';
import { Switch } from '@/components/atoms/Switch';
import { useArtistStore } from '../../../stores/artist-store';
import { Artist } from '../../../types/artist';
import { Image as ImageIcon } from 'lucide-react';
import { generateUUID } from '@/lib/utils';

interface EditArtistDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: Artist | null;
}

export const EditArtistDialog: React.FC<EditArtistDialogProps> = ({ open, onOpenChange, initialData }) => {
    const { addArtist } = useArtistStore(); 
    const { t } = useTranslation();

    const [name, setName] = useState('');
    const [tag, setTag] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [memo, setMemo] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open) {
            if (initialData) {
                setName(initialData.name);
                setTag(initialData.tag);
                setImageUrl(initialData.imageUrl);
                setMemo(initialData.memo || '');
                setIsFavorite(initialData.isFavorite || false);
            } else {
                setName('');
                setTag('');
                setImageUrl('');
                setMemo('');
                setIsFavorite(false);
            }
        }
    }, [open, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const artist: Artist = {
                id: initialData?.id || generateUUID(),
                name,
                tag,
                imageUrl,
                previewUrl: imageUrl.startsWith('http') ? imageUrl : undefined,
                createdAt: initialData?.createdAt || Date.now(),
                isFavorite,
                memo,
                danbooruCount: initialData?.danbooruCount || 0
            };
            await addArtist(artist);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save artist", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] glass-panel bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/20">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {initialData ? t('editArtist.editTitle', 'Edit Artist') : t('editArtist.addTitle', 'Add New Artist')}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {initialData ? t('editArtist.editDesc', 'Edit artist details.') : t('editArtist.addDesc', 'Add a new artist.')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="grid grid-cols-[120px_1fr] gap-6">
                        {/* 图片预览 */}
                        <div className="space-y-2">
                            <Label>{t('editArtist.preview', 'Preview')}</Label>
                            <div className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center relative group">
                                {imageUrl ? (
                                    <img src={imageUrl} alt={t('editArtist.preview', 'Preview')} className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                )}
                            </div>
                        </div>

                        {/* 表单字段 */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">{t('editArtist.artistName', 'Artist Name')}</Label>
                                <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder={t('editArtist.artistNamePlaceholder', 'e.g. Wlop')} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tag">{t('editArtist.tag', 'Tag / Trigger')}</Label>
                                <Input id="tag" value={tag} onChange={e => setTag(e.target.value)} required placeholder={t('editArtist.tagPlaceholder', 'e.g. artist:wlop')} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image-url">{t('editArtist.imageUrl', 'Image URL / Base64')}</Label>
                        <Input 
                            id="image-url" 
                            value={imageUrl} 
                            onChange={e => setImageUrl(e.target.value)} 
                            placeholder={t('editArtist.imageUrlPlaceholder', 'https://... or data:image/...')} 
                        />
                        <p className="text-[10px] text-slate-500">{t('editArtist.imageUrlHint', 'Supports direct URLs or Base64 strings.')}</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="memo">{t('editArtist.memo', 'Private Notes / Memo')}</Label>
                        <Textarea 
                            id="memo" 
                            value={memo} 
                            onChange={e => setMemo(e.target.value)} 
                            placeholder={t('editArtist.memoPlaceholder', 'Personal notes about this artist (e.g. good prompts, art style description)...')} 
                            className="h-20 resize-none rounded-xl"
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <Label htmlFor="favorite" className="cursor-pointer">{t('editArtist.addToFavorites', 'Add to Favorites')}</Label>
                        <Switch id="favorite" checked={isFavorite} onCheckedChange={setIsFavorite} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('editArtist.cancel', 'Cancel')}</Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isLoading ? t('editArtist.saving', 'Saving...') : t('editArtist.save', 'Save Artist')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
