import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/atoms/Dialog";
import { Button } from "@/components/atoms/Button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Crop, Check, X } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface ImageCropperDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageUrl: string;
    onCropComplete: (croppedImageBase64: string) => void; 
    title?: string;
}

// Fixed destructuring to match interface
export function ImageCropperDialog({ open, onOpenChange, imageUrl, onCropComplete, title }: ImageCropperDialogProps) {
    const { t } = useTranslation();
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onCropCompleteHandler = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous'); 
            image.src = url;
        });

    const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            image.src = '' // 释放 Image 内存
            throw new Error('No 2d context');
        }

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        const result = canvas.toDataURL('image/png');
        
        // CRITICAL: 释放 canvas 和 image 内存
        canvas.width = 0;
        canvas.height = 0;
        image.src = '';
        
        return result;
    };

    const handleConfirm = async () => {
        if (!croppedAreaPixels) return;
        setIsProcessing(true);
        try {
            const croppedImage = await getCroppedImg(imageUrl, croppedAreaPixels);
            onCropComplete(croppedImage);
            onOpenChange(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl h-[600px] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-xl z-[200]">
                <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                        <Crop className="w-5 h-5 text-indigo-500" />
                        {title || t('artistDiscovery.crop.title', 'Crop Image')}
                    </DialogTitle>
                </div>
                
                <DialogDescription className="sr-only">
                    Crop audio visual artwork
                </DialogDescription>

                <div className="relative flex-1 bg-black/50 overflow-hidden w-full h-[400px]">
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteHandler}
                        onZoomChange={onZoomChange}
                    />
                </div>

                <div className="p-6 bg-background space-y-4">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium w-12">{t('artistDiscovery.crop.zoom', 'Zoom')}</span>
                        <Slider
                            value={[zoom]}
                            min={1}
                            max={3}
                            step={0.1}
                            onValueChange={(vals: number[]) => setZoom(vals[0])}
                            className="flex-1"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                            <X className="w-4 h-4 mr-2" />
                            {t('artistDiscovery.crop.cancel', 'Cancel')}
                        </Button>
                        <Button onClick={handleConfirm} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            {t('artistDiscovery.crop.confirm', 'Confirm Crop')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
