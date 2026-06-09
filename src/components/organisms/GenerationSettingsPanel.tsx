import { useGenerationStore } from '@/stores/generation-store'
import { useCharacterStore } from '@/stores/character-store'
import { ParameterControl } from '@/components/molecules/ParameterControl'
import { ImageUpload } from '@/components/atoms/ImageUpload'
import { Label } from '@/components/atoms/Label'
import { Accordion } from '@/components/atoms/Accordion'
import { PresetManager } from '@/components/organisms/PresetManager'
import { useTranslation } from 'react-i18next'
import { AdvancedSettingsPanel } from '@/components/organisms/AdvancedSettingsPanel'
import { VibePanel } from '@/components/organisms/VibePanel'
import { CharacterPanel } from '@/components/organisms/CharacterPanel'
import { Separator } from '@/components/atoms/Separator'
import { shallow } from 'zustand/shallow'

export function GenerationSettingsPanel() {
  const { t } = useTranslation()
  
  const {
    sourceImage, setSourceImage,
    strength, setStrength,
    noise, setNoise,
    mask, setMask
  } = useGenerationStore(
    (state) => ({
      sourceImage: state.sourceImage,
      setSourceImage: state.setSourceImage,
      strength: state.strength,
      setStrength: state.setStrength,
      noise: state.noise,
      setNoise: state.setNoise,
      mask: state.mask,
      setMask: state.setMask,
    }),
    shallow
  )

  const { vibeImages, charImages } = useCharacterStore(
    (state) => ({
      vibeImages: state.vibeImages,
      charImages: state.characterImages,
    }),
    shallow
  )

  return (
    <div className="space-y-4 p-2">
          {/* 预设管理 */}
          <div className="space-y-3">
              <PresetManager />
          </div>

         {/* General + Advanced Settings (Combined for now, or just use AdvancedSettingsPanel) */}
         <Accordion title={t('settings.title')} defaultOpen>
            <AdvancedSettingsPanel />
         </Accordion>
         
         {/* Img2Img */}
         <Accordion title={t('settings.img2img')} defaultOpen={!!sourceImage}>
            <div className="space-y-4 pt-1">
                <ImageUpload
                    value={sourceImage}
                    onChange={setSourceImage}
                    placeholder={t('settings.uploadSource')}
                    className="h-28"
                />
                 {sourceImage && (
                    <>
                        <ParameterControl
                            label={t('settings.strength')}
                            type="slider"
                            value={strength}
                            onChange={setStrength}
                            min={0.01} max={0.99} step={0.01}
                        />
                        <ParameterControl
                            label={t('settings.noise')}
                            type="slider"
                            value={noise}
                            onChange={setNoise}
                            min={0} max={1} step={0.01}
                        />
                         <div className="space-y-1">
                            <Label className="text-xs">{t('settings.mask')}</Label>
                             <ImageUpload
                                value={mask}
                                onChange={setMask}
                                placeholder={t('settings.uploadMask')}
                                className="h-20"
                            />
                        </div>
                    </>
                )}
            </div>
         </Accordion>

         {/* Reference (Vibe & Character) */}
         <Accordion title={t('settings.reference')} defaultOpen={vibeImages.length > 0 || charImages.length > 0}>
             <div className="space-y-4 pt-1">
                <VibePanel />
                <Separator className="bg-border/30" />
                <CharacterPanel />
             </div>
         </Accordion>
    </div>
  )
}
