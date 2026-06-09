import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/atoms/Dialog";
import { Button } from "@/components/atoms/Button";
import { X, ChevronLeft } from "lucide-react";
import { MobileArtistGallery } from '@/components/features/artist-gallery/MobileArtistGallery';

interface MobileArtistDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsert?: (tag: string) => void;
}

export function MobileArtistDialog({ open, onOpenChange, onInsert }: MobileArtistDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[100vw] w-[100vw] h-[100dvh] m-0 p-0 flex flex-col bg-background border-none rounded-none overflow-hidden sm:max-w-none">
                <DialogTitle className="sr-only">Artist Gallery</DialogTitle>
                <DialogDescription className="sr-only">Browse and select artists</DialogDescription>
                
                {/* Mobile Header */}
                <div className="flex items-center gap-2 px-2 py-2 border-b border-white/10 bg-black/20 pt-[env(safe-area-inset-top,0px)] shrink-0 shadow-sm z-10">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 shrink-0 text-white/70 hover:text-white"
                        onClick={() => onOpenChange(false)}
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <h2 className="text-sm font-semibold text-white/90 truncate flex-1">Artist Gallery</h2>
                </div>

                {/* Content */}
                <div className="flex-1 w-full relative overflow-hidden bg-white/50 dark:bg-zinc-950/50">
                    <div className="absolute inset-0 pb-[10px]">
                         <MobileArtistGallery 
                            className="h-full" 
                            onSelectArtist={(artist) => {
                                if (onInsert) {
                                    onInsert(artist.tag);
                                    onOpenChange(false);
                                }
                            }}
                         />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
