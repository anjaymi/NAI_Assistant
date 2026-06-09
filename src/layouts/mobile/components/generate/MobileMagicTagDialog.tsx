import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface MobileMagicTagDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInject?: (tags: string, target: 'positive' | 'negative') => void;
}

export function MobileMagicTagDialog({ open, onOpenChange, onInject }: MobileMagicTagDialogProps) {
    const { t } = useTranslation();
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Listen for messages from the plugin
    useEffect(() => {
        if (!open) return;
        
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
    }, [open, onInject]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => onOpenChange(false)}
                        className="fixed inset-0 bg-black/80 z-[100]"
                    />
                    
                    {/* Sheet */}
                    <motion.div 
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 h-[95vh] bg-white/70 dark:bg-black/60 backdrop-blur-3xl border-t border-white/20 dark:border-white/10 rounded-t-[32px] z-[101] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
                    >
                        {/* Header & Drag Handle Area */}
                        <div className="relative w-full flex justify-center pt-4 pb-4 shrink-0 items-center bg-transparent border-b border-black/5 dark:border-white/5">
                            <div className="absolute top-2 w-12 h-1 bg-black/20 dark:bg-white/20 rounded-full" onClick={() => onOpenChange(false)} />
                            <h2 className="text-[13px] font-bold text-slate-800 dark:text-white uppercase tracking-widest mt-2">Magic Tag Generator</h2>
                            <button 
                                onClick={() => onOpenChange(false)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 mt-1 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Iframe Container */}
                        <div className="flex-1 w-full relative bg-transparent">
                            <iframe 
                                ref={iframeRef}
                                src="/plugins/magic-tag/index.html?v=4"
                                className="w-full h-full border-0 absolute inset-0 pb-safe"
                                title="Magic Tag Plugin"
                                allow="clipboard-read; clipboard-write; display-capture"
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
