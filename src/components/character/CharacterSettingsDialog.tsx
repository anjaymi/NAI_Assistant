import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { convertFileSrc } from '@tauri-apps/api/core'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/atoms/Dialog' // Changed to use existing atoms/Dialog
import { Button } from '@/components/atoms/Button'
import { Upload, X, Zap, Database, Lock } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/atoms/Tabs' // Assuming atoms/Tabs exists, will check
import { Slider } from '@/components/atoms/Slider'
import { Label } from '@/components/atoms/Label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/atoms/Select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/atoms/Tooltip'
import { useCharacterStore, ReferenceImage } from '@/stores/character-store'
import { parseMetadataFromBase64 } from '@/lib/metadata-parser'

// Helper for tooltip
const Tip = ({ content, children }: { content?: string, children: React.ReactNode }) => {
    if (!content) return <>{children}</>
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent>{content}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

const SafeSlider = ({
    value,
    onValueCommit,
    max = 1,
    step = 0.01,
    label,
}: {
    value: number[]
    onValueCommit: (val: number[]) => void
    max?: number
    step?: number
    label?: string
}) => {
    const [localValue, setLocalValue] = React.useState(value)

    React.useEffect(() => {
        setLocalValue(value)
    }, [value])

    return (
        <div className="space-y-1">
            {label && (
                <div className="flex justify-between">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <span className="text-xs font-mono">{localValue[0].toFixed(2)}</span>
                </div>
            )}
            <Slider
                value={localValue}
                min={0}
                max={max}
                step={step}
                onValueChange={setLocalValue}
                onValueCommit={onValueCommit}
            />
        </div>
    )
}

export function CharacterSettingsDialog({ open, onOpenChange }: { open?: boolean, onOpenChange?: (open: boolean) => void } = {}) {
    const { t } = useTranslation()
    const {
        characterImages,
        vibeImages,
        addCharacterImage,
        removeCharacterImage,
        updateCharacterImage,
        addVibeImage,
        removeVibeImage,
        updateVibeImage
    } = useCharacterStore()

    const charInputRef = useRef<HTMLInputElement>(null)
    const vibeInputRef = useRef<HTMLInputElement>(null)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'character' | 'vibe') => {
        const files = e.target.files
        if (!files || files.length === 0) return

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const base64 = await convertToBase64(file)
            if (mode === 'character') {
                addCharacterImage(base64)
            } else {
                try {
                    const metadata = await parseMetadataFromBase64(base64)
                    if (metadata?.encodedVibes && metadata.encodedVibes.length > 0) {
                        const info = metadata.vibeTransferInfo?.[0]
                        addVibeImage(
                            base64,
                            metadata.encodedVibes[0],
                            info?.informationExtracted ?? 1.0,
                            info?.strength ?? 0.6
                        )
                    } else {
                        addVibeImage(base64)
                    }
                } catch {
                    addVibeImage(base64)
                }
            }
        }
        e.target.value = ''
    }

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => {
                resolve(reader.result as string)
            }
            reader.onerror = error => reject(error)
        })
    }

    const VibeImageList = ({
        images,
        onRemove,
        onUpdate
    }: {
        images: ReferenceImage[],
        onRemove: (id: string) => void,
        onUpdate: (id: string, updates: Partial<ReferenceImage>) => void
    }) => (
        <div className="space-y-4 pt-4">
            {images.length === 0 && (
                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                    {t('characterDialog.noImages', 'No images added')}
                </div>
            )}
            {images.map(img => {
                const previewSrc = img.base64 || (img.filePath ? convertFileSrc(img.filePath) : undefined)

                return (
                <div key={img.id} className="flex gap-4 p-3 border rounded-lg bg-card bg-muted/10">
                    <div className="relative shrink-0 w-24 h-24 bg-muted rounded-md overflow-hidden border flex items-center justify-center group/image">
                        {previewSrc ? (
                            <img src={previewSrc} alt="Reference" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                                <Database className="w-8 h-8 opacity-50 mb-1" />
                                <span className="text-[9px] leading-tight whitespace-pre-line">{t('characterDialog.encodedDataOnly', 'Encoded Data')}</span>
                            </div>
                        )}
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity"
                            onClick={() => onRemove(img.id)}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                        {img.encodedVibe && (
                            <Tip content={t('characterDialog.preEncodedTooltip', 'Pre-encoded Vibe')}>
                                <div className="absolute bottom-1 left-1 bg-green-500/90 text-white text-[9px] font-bold rounded px-1 py-0.5 flex items-center gap-0.5">
                                    <Zap className="w-2.5 h-2.5" />
                                </div>
                            </Tip>
                        )}
                    </div>
                    <div className="flex-1 space-y-3 min-w-0">
                        <SafeSlider
                            label={t('characterDialog.vibeInfoExtracted', 'Information Extracted')}
                            value={[img.informationExtracted]}
                            onValueCommit={([v]) => onUpdate(img.id, { informationExtracted: v })}
                        />
                        <SafeSlider
                            label={t('characterDialog.vibeStrength', 'Reference Strength')}
                            value={[img.strength]}
                            onValueCommit={([v]) => onUpdate(img.id, { strength: v })}
                        />
                    </div>
                </div>
            )})}
        </div>
    )

    const CharacterImageList = ({
        images,
        onRemove,
        onUpdate
    }: {
        images: ReferenceImage[],
        onRemove: (id: string) => void,
        onUpdate: (id: string, updates: Partial<ReferenceImage>) => void
    }) => (
        <div className="space-y-4 pt-4">
            {images.length === 0 && (
                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                    {t('characterDialog.noImages', 'No images added')}
                </div>
            )}
            {images.map(img => {
                const previewSrc = img.base64 || (img.filePath ? convertFileSrc(img.filePath) : undefined)

                return (
                <div key={img.id} className="flex gap-4 p-3 border rounded-lg bg-card bg-muted/10">
                    <div className="relative shrink-0 w-24 h-24 bg-muted rounded-md overflow-hidden border flex items-center justify-center group/image self-start">
                        {previewSrc ? (
                            <img src={previewSrc} alt="Reference" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                                <Database className="w-8 h-8 opacity-50 mb-1" />
                                <span className="text-[9px] leading-tight whitespace-pre-line">{t('characterDialog.noImages', 'No images added')}</span>
                            </div>
                        )}
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity"
                            onClick={() => onRemove(img.id)}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                    <div className="flex-1 space-y-3 min-w-0">
                         <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{t('characterDialog.referenceType', 'Reference Type')}</Label>
                            <Select
                                value={img.referenceType || 'character&style'}
                                onValueChange={(val: any) => onUpdate(img.id, { referenceType: val })}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="character">{t('characterDialog.typeCharacter', 'Character Only')}</SelectItem>
                                    <SelectItem value="style">{t('characterDialog.typeStyle', 'Style Only')}</SelectItem>
                                    <SelectItem value="character&style">{t('characterDialog.typeBoth', 'Character & Style')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <SafeSlider
                            label={t('characterDialog.strength', 'Strength')}
                            value={[img.strength ?? 1.0]}
                            onValueCommit={([v]) => onUpdate(img.id, { strength: v })}
                            max={1}
                            step={0.01}
                        />

                        <SafeSlider
                            label={t('characterDialog.fidelity', 'Fidelity')}
                            value={[img.fidelity ?? 1.0]}
                            onValueCommit={([v]) => onUpdate(img.id, { fidelity: v })}
                            max={1}
                            step={0.01}
                        />
                    </div>
                </div>
            )})}
        </div>
    )

    // If using as controlled dialog
    if (open !== undefined && onOpenChange !== undefined) {
        return (
             <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>{t('characterDialog.title', 'Reference Settings')}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {t('characterDialog.description', 'Customize character reference and vibe transfer settings')}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="character" className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid grid-cols-2 w-full">
                            <TabsTrigger value="character">{t('characterDialog.tabCharacter', 'Character Reference')}</TabsTrigger>
                            <TabsTrigger value="vibe">{t('characterDialog.tabVibe', 'Vibe Transfer')}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="character" className="flex-1 overflow-y-auto min-h-0 pr-1">
                            <div className="py-2">
                                <div
                                    className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                                    onClick={() => charInputRef.current?.click()}
                                >
                                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground font-medium">{t('characterDialog.uploadCharacter', 'Upload Character Images')}</p>
                                </div>
                                <input
                                    type="file"
                                    multiple={false}
                                    accept="image/*"
                                    className="hidden"
                                    ref={charInputRef}
                                    onChange={(e) => handleFileUpload(e, 'character')}
                                />

                                <CharacterImageList
                                    images={characterImages}
                                    onRemove={removeCharacterImage}
                                    onUpdate={updateCharacterImage}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="vibe" className="flex-1 overflow-y-auto min-h-0 pr-1 relative">
                            {characterImages.length > 0 && (
                                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[1px]">
                                    <Lock className="w-8 h-8 text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium text-muted-foreground text-center px-4">
                                        {t('characterDialog.vibeDisabledMsg', 'Vibe Transfer cannot be used with Character Reference')}
                                    </p>
                                </div>
                            )}
                            <div className={characterImages.length > 0 ? "opacity-30 pointer-events-none grayscale filter blur-[1px]" : ""}>
                                <div className="py-2">
                                    <div
                                        className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => vibeInputRef.current?.click()}
                                    >
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground font-medium">{t('characterDialog.uploadVibe', 'Upload Vibe Images')}</p>
                                    </div>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        ref={vibeInputRef}
                                        onChange={(e) => handleFileUpload(e, 'vibe')}
                                    />
                                    <VibeImageList
                                        images={vibeImages}
                                        onRemove={removeVibeImage}
                                        onUpdate={updateVibeImage}
                                    />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        )
    }

    // Default trigger version (if needed, but mostly we use Popover content or controlled dialog)
    return null;
}
