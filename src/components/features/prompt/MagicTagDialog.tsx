import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/atoms/Dialog";
import { Button } from "@/components/atoms/Button";
import { X } from "lucide-react";
import { useRef, useEffect } from "react";
// import { useTranslation } from "react-i18next";

interface MagicTagDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInject?: (tags: string, target: 'positive' | 'negative') => void;
}

export function MagicTagDialog({ open, onOpenChange, onInject }: MagicTagDialogProps) {
    // const { t } = useTranslation();
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Listen for messages from the plugin
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'inject-tags' && e.data.tags) {
                onInject?.(e.data.tags, e.data.target || 'positive');
            }
            if (e.data?.type === 'open-artist-selector') {
                 // Open Artist Gallery in Select Mode
                 import('@/stores/artist-store').then(({ useArtistStore }) => {
                     const store = useArtistStore.getState();
                     store.setSelectMode(true, (artist) => {
                         // Send back to iframe
                         // Assuming iframe is still mounted and valid
                         if (iframeRef.current?.contentWindow) {
                             iframeRef.current.contentWindow.postMessage({
                                 type: 'inject-artist',
                                 tag: artist.tag
                             }, '*');
                         }
                     });
                     store.setIsOpen(true);
                 });
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onInject, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 flex flex-col bg-background/95 backdrop-blur-xl border-border/50">
                
                <DialogTitle className="sr-only">Magic Tag Generator</DialogTitle>
                <DialogDescription className="sr-only">Generate tags using the Magic Tag tool</DialogDescription>
                
                {/* Header Removed as per user request */}
                {/* <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
                    <DialogTitle className="text-sm font-medium flex items-center gap-2">
                        Magic Tag Generator
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-primary/10 rounded animate-pulse">
                            Beta
                        </span>
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                         <span className="text-[10px] text-muted-foreground mr-2">
                            {t('magicTag.tip', 'Copy tags from inside the tool')}
                         </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOpenChange(false)}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div> */}
                
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 z-50 h-8 w-8 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md" 
                    onClick={() => onOpenChange(false)}
                >
                    <X className="w-4 h-4" />
                </Button>

                {/* Iframe Container */}
                <div className="flex-1 w-full h-full bg-white relative overflow-hidden rounded-b-lg">
                    <iframe 
                        ref={iframeRef}
                        src="/plugins/magic-tag/index.html?v=4"
                        className="w-full h-full border-0 absolute inset-0"
                        title="Magic Tag Plugin"
                        allow="clipboard-read; clipboard-write"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
