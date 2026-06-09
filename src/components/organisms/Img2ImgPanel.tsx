import { Label } from '@/components/atoms/Label'
import { ImageUpload } from '@/components/atoms/ImageUpload'
import { ParameterControl } from '@/components/molecules/ParameterControl'
import { useTranslation } from 'react-i18next'
import { useGenerationStore } from '@/stores/generation-store'
import { shallow } from 'zustand/shallow'


export function Img2ImgPanel() {
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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                 <Label className="text-xs font-semibold">{t('settings.img2img')}</Label>
            </div>
            <ImageUpload
                value={sourceImage}
                onChange={setSourceImage}
                placeholder={t('settings.uploadSource')}
                className="h-48 w-full"
            />
             {sourceImage && (
                <div className="space-y-3">
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
                            className="h-20 w-full"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
