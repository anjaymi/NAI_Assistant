import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/atoms/Dialog';
import { Button } from '@/components/atoms/Button';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ArtistLite } from '../../../types/artist';
import { communityService } from '../../../services/community-service';
import { useSync } from '../../../context/SyncContext';
import { danbooruService } from '../../../services/danbooru-service';

interface BatchPublishPanelProps {
    isOpen: boolean;
    onClose: () => void;
    selectedArtists: ArtistLite[];
    onComplete: () => void;
}

export const BatchPublishPanel: React.FC<BatchPublishPanelProps> = ({ 
    isOpen, 
    onClose, 
    selectedArtists = [],
    onComplete 
}) => {
    const { token } = useSync();
    const [publishing, setPublishing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentName, setCurrentName] = useState('');
    const [results, setResults] = useState<{name: string, success: boolean, error?: string}[]>([]);

    const handlePublish = async () => {
        if (!token) return;
        setPublishing(true);
        setResults([]);
        
        let successCount = 0;
        const total = selectedArtists.length;

        for (let i = 0; i < total; i++) {
            const artist = selectedArtists[i];
            setCurrentName(artist.name);
            setProgress(((i + 1) / total) * 100);

            try {
                // 1. Resolve Danbooru Image URL (Priority)
                let previewUrl = artist.previewUrl;
                if (!previewUrl) {
                    // Try to generate a valid Danbooru tag
                    let tag = artist.tag;
                    if (!tag || tag.trim() === '') {
                        tag = `artist:${artist.name.trim().replace(/ /g, '_')}`;
                    }
                    
                    console.log(`[BatchPublish] Resolving Danbooru URL for ${artist.name} (Tag: ${tag})...`);
                    const url = await danbooruService.fetchArtistPreview(tag);
                    if (url) {
                         previewUrl = url;
                    }
                }

                // 2. Publish
                // If we still don't have a URL, we attempt to send base64 if it's small enough,
                // OR we can choose to SKIP if no URL found (User requested Danbooru URL usage).
                // Let's try to send URL if found, otherwise undefined (which might fail on server if required)
                
                const result = await communityService.publishArtist(token, {
                    name: artist.name,
                    description: artist.description || `Artist: ${artist.name}`,
                    tag: artist.tag || `artist:${artist.name}`,
                    preview_url: previewUrl, 
                    preview_base64: undefined // Force URL usage only for batch to save bandwidth? Or fallback? User said "community library calls Danbooru first image", so URL is key.
                });

                if (result.success) {
                    successCount++;
                    setResults(prev => [...prev, { name: artist.name, success: true }]);
                } else {
                    setResults(prev => [...prev, { name: artist.name, success: false, error: result.error || 'Unknown Error' }]);
                }

            } catch (e: any) {
                console.error(e);
                setResults(prev => [...prev, { name: artist.name, success: false, error: e.message }]);
            }
            
            // Small delay to prevent flooding
            await new Promise(r => setTimeout(r, 500));
        }

        setPublishing(false);
        if (successCount === total) {
             // Optional: auto close or show success
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && !publishing) onClose();
        }}>
            <DialogContent className="sm:max-w-[600px] bg-[#0a0a0a] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Batch Publish Artists</DialogTitle>
                    <DialogDescription className="sr-only">
                        Review and publish selected artists to the community.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {!publishing && results.length === 0 && (
                        <div className="text-center space-y-4">
                            <p className="text-white/70">
                                Ready to publish <span className="text-white font-bold">{selectedArtists.length}</span> artists to the Community Library.
                            </p>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-sm text-yellow-200 text-left space-y-2">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold">Important:</p>
                                        <p>This process will automatically fetch the latest preview image URL from Danbooru for each artist.</p>
                                        <p>It will NOT upload your local images, ensuring fast processing.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {publishing && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-white/50">
                                <span className="flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Publishing... {Math.round(progress)}%
                                </span>
                                <span>{currentName}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="mt-4 max-h-[300px] overflow-y-auto space-y-1 custom-scrollbar border border-white/5 rounded-lg p-2 bg-black/20">
                            {results.map((r, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded hover:bg-white/10 transition-colors">
                                    <span className="truncate max-w-[70%] font-medium">{r.name}</span>
                                    {r.success ? (
                                        <div className="flex items-center text-green-400 gap-1">
                                            <CheckCircle className="w-3 h-3" />
                                            <span>Success</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center text-red-400 gap-1" title={r.error}>
                                            <AlertCircle className="w-3 h-3" />
                                            <span>{r.error || 'Failed'}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onClose} disabled={publishing}>
                        {results.length > 0 ? 'Close' : 'Cancel'}
                    </Button>
                    {!publishing && results.length === 0 && (
                        <Button onClick={handlePublish} disabled={selectedArtists.length === 0}>
                            Start Publish
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
