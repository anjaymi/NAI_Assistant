import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/atoms/Dialog';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Search, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

interface ArtistWorksDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    artistName: string;
    initialTag: string;
}

export const ArtistWorksDialog: React.FC<ArtistWorksDialogProps> = ({ open, onOpenChange, artistName, initialTag }) => {
    const { t } = useTranslation();
    const [tag, setTag] = useState(initialTag);
    const [isOpening, setIsOpening] = useState(false);

    // Build Danbooru search URL
    const getDanbooruUrl = (searchTag: string) => {
        const cleanTag = searchTag.replace(/^artist:/, '');
        return `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(cleanTag)}`;
    };

    // Initialize when dialog opens
    useEffect(() => {
        if (open) {
            const cleanTag = initialTag.replace(/^artist:/, '');
            setTag(cleanTag);
        }
    }, [open, initialTag]);

    const handleOpenInWebview = async () => {
        if (!tag.trim()) return;
        
        setIsOpening(true);
        try {
            const webviewLabel = `danbooru-${Date.now()}`;
            const webview = new WebviewWindow(webviewLabel, {
                url: getDanbooruUrl(tag),
                title: `${artistName} - Danbooru`,
                width: 1200,
                height: 800,
                center: true,
                resizable: true,
            });
            
            webview.once('tauri://created', () => {
                console.log('[ArtistWorksDialog] Webview created successfully');
                onOpenChange(false); // Close the dialog
            });
            
            webview.once('tauri://error', (e) => {
                console.error('[ArtistWorksDialog] Webview creation failed:', e);
            });
        } catch (e) {
            console.error('[ArtistWorksDialog] Failed to create webview:', e);
        } finally {
            setIsOpening(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleOpenInWebview();
        }
    };

    const handleOpenExternal = () => {
        window.open(getDanbooruUrl(tag), '_blank');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-[#0a0a0a] border-white/10 text-white p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-[#0a0a0a]">
                    <DialogTitle className="text-lg">{artistName}</DialogTitle>
                    <DialogDescription className="sr-only">Artist Works Gallery</DialogDescription>
                    <p className="text-sm text-white/50 mt-2">
                        {t('works.description', 'Open Danbooru in a new window to view artworks.')}
                    </p>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/40" />
                            <Input
                                value={tag}
                                onChange={(e) => setTag(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('works.searchPlaceholder', 'Enter tag (e.g. artist:name)')}
                                className="pl-8 bg-white/5 border-white/10 focus:bg-white/10"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Button 
                            onClick={handleOpenInWebview} 
                            disabled={isOpening || !tag.trim()}
                            className="w-full"
                        >
                            {t('works.openInApp', 'Open in App Window')}
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={handleOpenExternal}
                            className="w-full border-white/10 text-white/70 hover:text-white"
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            {t('works.openExternal', 'Open in Browser')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

