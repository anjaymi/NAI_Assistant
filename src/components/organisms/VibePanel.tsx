import { Button } from '@/components/atoms/Button'
import { Label } from '@/components/atoms/Label'
import { ImageUpload } from '@/components/atoms/ImageUpload'
import { ParameterControl } from '@/components/molecules/ParameterControl'
import { Plus, Download, X, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '@/stores/character-store'
import { save, open } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { useToast } from '@/hooks/use-toast'
import { convertFileSrc } from '@tauri-apps/api/core'
import { loadEncodedVibe, loadReferenceImage } from '@/lib/image-utils'

export function VibePanel() {
    const { t } = useTranslation()
    const { toast } = useToast()
    const { vibeImages, addVibeImage, updateVibeImage, removeVibeImage } = useCharacterStore()

    const handleSaveVibe = async (vibeId: string) => {
        try {
            const vibe = vibeImages.find(v => v.id === vibeId)
            if (!vibe) return

            const exportVibe = {
                ...vibe,
                base64: vibe.base64 || (vibe.filePath ? await loadReferenceImage(vibe.filePath) || undefined : undefined),
                encodedVibe: vibe.encodedVibe || (vibe.encodedVibePath ? await loadEncodedVibe(vibe.encodedVibePath) || undefined : undefined),
            }

            const filePath = await save({
                filters: [{
                    name: 'Vibe Preset',
                    extensions: ['json']
                }],
                defaultPath: `vibe_preset_${Date.now()}.json`
            })

            if (!filePath) return

            await writeTextFile(filePath, JSON.stringify(exportVibe, null, 2))
            
            toast({
                title: "预设已保存",
                description: "Vibe 及其特征数据已保存",
            })
        } catch (e) {
            console.error(e)
            toast({
                title: "保存失败",
                description: String(e),
                variant: "destructive"
            })
        }
    }

    const handleImportVibe = async () => {
        try {
            const filePath = await open({
                multiple: false,
                filters: [{
                    name: 'Vibe Preset',
                    extensions: ['json']
                }]
            })

            if (!filePath || typeof filePath !== 'string') return

            const content = await readTextFile(filePath)
            let data = JSON.parse(content)

            if (!Array.isArray(data)) {
                data = [data]
            }

            for (const item of data) {
                if (item.base64) {
                    addVibeImage(
                        item.base64,
                        item.encodedVibe, // Pass encodedVibe if available
                        item.informationExtracted ?? 1.0,
                        item.strength ?? 0.6
                    )
                }
            }
            
            toast({
                title: "导入成功",
                description: "Vibe 预设已加载",
            })

        } catch (e) {
            toast({
                 title: "导入失败",
                 description: String(e),
                 variant: "destructive"
            })
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">{t('settings.vibeTransfer')}</Label>
                <div className="flex gap-1">
                     <Button variant="ghost" size="sm" onClick={handleImportVibe} title="导入 Vibe" className="h-6 w-6 p-0 hover:bg-muted">
                        <Upload className="h-3 w-3" />
                     </Button>
                     <Button variant="ghost" size="sm" onClick={() => addVibeImage('')} className="h-6 w-6 p-0 hover:bg-muted">
                        <Plus className="h-3 w-3" />
                     </Button>
                </div>
            </div>
            {vibeImages.map((vibe) => {
                const previewSrc = vibe.base64 || (vibe.filePath ? convertFileSrc(vibe.filePath) : undefined)

                return (
                    <div key={vibe.id} className="relative border rounded-xl p-2 bg-muted/20 flex gap-2">
                        <div className="absolute top-1 right-1 flex gap-1 z-10">
                            <Button 
                                variant="ghost" size="icon" 
                                className="h-5 w-5 hover:bg-muted"
                                onClick={() => handleSaveVibe(vibe.id)}
                                title="保存预设"
                            >
                                <Download className="h-3 w-3" />
                            </Button>
                            <Button 
                                variant="ghost" size="icon" 
                                className="h-5 w-5 text-destructive hover:bg-destructive/10"
                                onClick={() => removeVibeImage(vibe.id)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                         </div>
                        <ImageUpload
                            value={previewSrc}
                            onChange={(val) => updateVibeImage(vibe.id, { base64: val || '' })}
                            className="w-16 h-16 shrink-0 rounded-lg"
                        />
                        <div className="flex-1 space-y-2 min-w-0">
                            <ParameterControl
                                label={t('settings.vibeInfo')}
                                type="slider"
                                value={vibe.informationExtracted}
                                onChange={(v) => updateVibeImage(vibe.id, { informationExtracted: v })}
                                min={0} max={1} step={0.01}
                                className="scale-90 origin-left"
                            />
                            <ParameterControl
                                label={t('settings.vibeStrength')}
                                type="slider"
                                value={vibe.strength}
                                onChange={(v) => updateVibeImage(vibe.id, { strength: v })}
                                min={0} max={1} step={0.01}
                                className="scale-90 origin-left"
                            />
                        </div>
                    </div>
                )
            })}
            {vibeImages.length === 0 && <div className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-xl">{t('settings.addVibe')}</div>}
         </div>
    )
}
