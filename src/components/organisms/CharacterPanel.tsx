import { Button } from '@/components/atoms/Button'
import { Label } from '@/components/atoms/Label'
import { ImageUpload } from '@/components/atoms/ImageUpload'
import { ParameterControl } from '@/components/molecules/ParameterControl'
import { Switch } from '@/components/atoms/Switch'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '@/stores/character-store'
import { convertFileSrc } from '@tauri-apps/api/core'

export function CharacterPanel() {
    const { t } = useTranslation()
    const { characterImages, addCharacterImage, updateCharacterImage, removeCharacterImage } = useCharacterStore()

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">{t('settings.characterReference')}</Label>
                 <Button variant="ghost" size="sm" onClick={() => addCharacterImage('')} className="h-6 w-6 p-0 hover:bg-muted"><Plus className="h-3 w-3" /></Button>
            </div>
             {characterImages.map((img) => (
                <div key={img.id} className="relative border rounded-xl p-2 bg-muted/20 flex gap-2">
                    {(() => {
                        const previewSrc = img.base64 || (img.filePath ? convertFileSrc(img.filePath) : undefined)
                        return (
                            <>
                    <Button 
                        variant="ghost" size="icon" 
                        className="absolute top-1 right-1 h-5 w-5 text-destructive hover:bg-destructive/10 z-10"
                        onClick={() => removeCharacterImage(img.id)}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                    <ImageUpload
                        value={previewSrc}
                        onChange={(val) => updateCharacterImage(img.id, { base64: val || '' })}
                        className="w-16 h-16 shrink-0 rounded-lg"
                    />
                     <div className="flex-1 space-y-2 min-w-0">
                         <ParameterControl
                            label={t('settings.fidelity')}
                            type="slider"
                            value={img.strength}
                            onChange={(val) => updateCharacterImage(img.id, { strength: val })}
                            min={0} max={1} step={0.05}
                            className="scale-90 origin-left"
                        />
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px]">{t('settings.styleAware')}</Label>
                            <Switch
                                checked={img.informationExtracted > 0.5}
                                onChange={(e) => updateCharacterImage(img.id, { informationExtracted: e.target.checked ? 1 : 0 })}
                                className="scale-75 origin-right"
                            />
                        </div>
                     </div>
                            </>
                        )
                    })()}
                </div>
             ))}
             {characterImages.length === 0 && <div className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-xl">{t('settings.addCharacter')}</div>}
         </div>
    )
}
