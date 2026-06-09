import { useRef, useEffect } from "react";
import { Button } from "@/components/atoms/Button";
import { Copy, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from '@/hooks/use-toast';
import { useGenerationStore } from '@/stores/generation-store';

export function MagicTagPanel() {
    const { t } = useTranslation();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const setPendingTagsToAppend = useGenerationStore((state) => state.setPendingTagsToAppend);

    // Listen for messages from the plugin
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'inject-tags' && e.data.tags) {
                const newTags = e.data.tags;
                
                // Use pendingTagsToAppend to target Subject/Base prompt
                setPendingTagsToAppend(newTags);
                
                toast({ 
                    title: t('common.success', "Tags Added"),
                    description: newTags
                });
            }
            if (e.data?.type === 'copy-tags' && e.data.tags) {
                 navigator.clipboard.writeText(e.data.tags);
                 toast({ title: t('common.copied', "Copied to clipboard") });
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [setPendingTagsToAppend, t]);

    const handleReload = () => {
        if (iframeRef.current) {
            iframeRef.current.src = iframeRef.current.src;
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-black/20 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
            {/* Header Removed to avoid duplication with Tabs */}
            {/* <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Magic Tag Generator
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-mono">
                        v4.0
                    </span>
                </div>
                <div className="flex items-center gap-1">
                     <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white" onClick={handleReload}>
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div> */}
            
            {/* Minimal Toolbar */}
            <div className="flex items-center justify-end px-2 py-1 border-b border-white/10 bg-white/5">
                 <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white" onClick={handleReload} title="Reload Generator">
                    <RefreshCw className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Iframe */}
            <div className="flex-1 relative bg-white">
                <iframe 
                    ref={iframeRef}
                    src="/plugins/magic-tag/index.html?v=4"
                    className="absolute inset-0 w-full h-full border-0"
                    title="Magic Tag Plugin"
                    allow="clipboard-read; clipboard-write"
                />
            </div>
        </div>
    );
}
