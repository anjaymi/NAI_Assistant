import { useGenerationStore, AVAILABLE_MODELS, SAMPLERS, SCHEDULERS } from '@/stores/generation-store'
import { useCharacterStore } from '@/stores/character-store'
import { ParameterControl } from '@/components/molecules/ParameterControl'
import { ResolutionSelector, Resolution } from '@/components/molecules/ResolutionSelector'
import { Button } from '@/components/atoms/Button'
import { Label } from '@/components/atoms/Label'
import { ImageUpload } from '@/components/atoms/ImageUpload'
import { Separator } from '@/components/atoms/Separator'
import { Switch } from '@/components/atoms/Switch'
import { Accordion } from '@/components/atoms/Accordion'
import { Dice5, X } from 'lucide-react'
import { PresetManager } from '@/components/organisms/PresetManager'
import { VibePanel } from '@/components/organisms/VibePanel'
import { CharacterPanel } from '@/components/organisms/CharacterPanel'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { shallow } from 'zustand/shallow'


import { useSettingsStore } from '@/stores/settings-store'

export function SettingsPanel() {
  const { t, i18n } = useTranslation()
  const { 
      savePath, setSavePath, 
      imageFormat, setImageFormat,
      generationDelay, setGenerationDelay
  } = useSettingsStore()
  
  const {
    steps, setSteps,
    cfgScale, setCfgScale,
    seed, setSeed,
    model, setModel,
    width, height, setDimensions,
    // Advanced
    sampler, setSampler,
    scheduler, setScheduler,
    smea, setSmea,
    smeaDyn, setSmeaDyn,
    variety, setVariety,
    cfgRescale, setCfgRescale,
    ucPreset, setUcPreset,
    // Img2Img
    sourceImage, setSourceImage,
    strength, setStrength,
    noise, setNoise,
    mask, setMask
  } = useGenerationStore(
    (state) => ({
      steps: state.steps,
      setSteps: state.setSteps,
      cfgScale: state.cfgScale,
      setCfgScale: state.setCfgScale,
      seed: state.seed,
      setSeed: state.setSeed,
      model: state.model,
      setModel: state.setModel,
      width: state.width,
      height: state.height,
      setDimensions: state.setDimensions,
      sampler: state.sampler,
      setSampler: state.setSampler,
      scheduler: state.scheduler,
      setScheduler: state.setScheduler,
      smea: state.smea,
      setSmea: state.setSmea,
      smeaDyn: state.smeaDyn,
      setSmeaDyn: state.setSmeaDyn,
      variety: state.variety,
      setVariety: state.setVariety,
      cfgRescale: state.cfgRescale,
      setCfgRescale: state.setCfgRescale,
      ucPreset: state.ucPreset,
      setUcPreset: state.setUcPreset,
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

  // 当前分辨率对象
  const currentResolution: Resolution = {
    label: `${width} × ${height}`,
    width,
    height,
  }

  // 处理分辨率变更
  const handleResolutionChange = (resolution: Resolution) => {
    setDimensions(resolution.width, resolution.height)
  }

  // 随机种子
  const handleRandomSeed = () => setSeed(-1)

  return (
    <div className="space-y-4 p-2 relative">
         {/* 语言与预设 - Fixed at top */}
         <div className="space-y-3 sticky top-0 bg-black/40 backdrop-blur-xl z-10 p-2 -mx-2 -mt-2 rounded-b-2xl border-b border-white/5 shadow-sm">
             <div className="flex gap-2">
                 <div className="flex-1">
                     <ParameterControl
                        label={t('settings.language')}
                        type="select"
                        value={i18n.language}
                        onChange={(val) => i18n.changeLanguage(val as string)}
                        options={[
                            { label: '中文', value: 'zh-CN' },
                            { label: 'English', value: 'en-US' },
                        ]}
                    />
                 </div>
             </div>
             <PresetManager />
         </div>

         <Separator className="bg-white/10" />
         
         {/* General Settings */}
         <Accordion title={t('settings.title')} defaultOpen>
            <div className="space-y-4 pt-1">
                 <ParameterControl
                    label={t('settings.model')}
                    type="select"
                    value={model}
                    onChange={setModel}
                    options={AVAILABLE_MODELS.map(m => ({ label: m.name, value: m.id }))}
                />
                
                <div className="space-y-1.5">
                    <Label className="text-xs">{t('settings.resolution')}</Label>
                    <ResolutionSelector
                        value={currentResolution}
                        onChange={handleResolutionChange}
                    />
                </div>

                <ParameterControl
                    label={t('settings.steps')}
                    type="slider"
                    value={steps}
                    onChange={setSteps}
                    min={1} max={50} step={1}
                />

                <ParameterControl
                    label={t('settings.scale')}
                    type="slider"
                    value={cfgScale}
                    onChange={setCfgScale}
                    min={1} max={10} step={0.1}
                />
                <ParameterControl
                    label={t('settings.scale')}
                    type="slider"
                    value={cfgScale}
                    onChange={setCfgScale}
                    min={1} max={10} step={0.1}
                />
            </div>
         </Accordion>
         
         {/* System Settings (New) */}
         <Accordion title={t('settings.system')} defaultOpen={false}>
             <div className="space-y-4 pt-1">
                <ParameterControl
                    label={t('settings.imageFormat')}
                    type="select"
                    value={imageFormat}
                    onChange={(v) => setImageFormat(v as 'png'|'webp')}
                    options={[
                        { label: 'PNG (Lossless)', value: 'png' },
                        { label: 'WEBP (Efficient)', value: 'webp' },
                    ]}
                />
                
                <ParameterControl
                     label={t('settings.generationDelay')}
                     type="slider"
                     value={generationDelay}
                     onChange={setGenerationDelay}
                     min={0} max={5000} step={100}
                     // unit="ms"
                />

                <ParameterControl
                    label={t('settings.savePath')}
                    type="input"
                    value={savePath}
                    onChange={(v) => setSavePath(v)}
                />
             </div>
         </Accordion>

         {/* Advanced Settings */}
         <Accordion title={t('settings.advancedSettings')} defaultOpen={false}>
            <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-3">
                    <ParameterControl
                        label={t('settings.sampler')}
                        type="select"
                        value={sampler}
                        onChange={(v) => setSampler(v as any)}
                        options={SAMPLERS.map(s => ({ label: s, value: s }))}
                    />
                    <ParameterControl
                        label={t('settings.scheduler')}
                        type="select"
                        value={scheduler}
                        onChange={(v) => setScheduler(v as any)}
                        options={SCHEDULERS.map(s => ({ label: s, value: s }))}
                    />
                </div>
                
                 <ParameterControl
                     label={t('settings.ucPreset')}
                     type="select"
                     value={String(ucPreset)}
                     onChange={(v) => setUcPreset(Number(v))}
                     options={[
                         { label: t('ucPreset.0'), value: '0' },
                         { label: t('ucPreset.1'), value: '1' },
                         { label: t('ucPreset.2'), value: '2' },
                         { label: t('ucPreset.3'), value: '3' },
                         { label: t('ucPreset.4'), value: '4' },
                     ]}
                />

                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">{t('settings.modelSmea')}</Label>
                        <Switch checked={smea} onChange={(e) => setSmea(e.target.checked)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className={cn("text-xs", !smea && "opacity-50")}>{t('settings.modelSmeaDyn')}</Label>
                        <Switch checked={smeaDyn} disabled={!smea} onChange={(e) => setSmeaDyn(e.target.checked)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">{t('settings.variety')}</Label>
                        <Switch checked={variety} onChange={(e) => setVariety(e.target.checked)} />
                    </div>
                </div>

                <ParameterControl
                    label={t('settings.cfgRescale')}
                    type="slider"
                    value={cfgRescale}
                    onChange={setCfgRescale}
                    min={0} max={1} step={0.01}
                />

                 <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">{t('settings.seed')}</Label>
                        <span className="text-[10px] text-muted-foreground font-mono">{seed === -1 ? t('settings.random') : seed}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleRandomSeed} className="flex-1 h-8 text-xs bg-white/5 border-white/10 hover:bg-white/10 text-white/80 transition-colors">
                            <Dice5 className="h-3 w-3 mr-1.5" />
                            {t('settings.randomGenerate')}
                        </Button>
                        {seed !== -1 && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSeed(-1)} 
                                className="h-8 w-8 p-0 text-white/40 hover:text-white hover:bg-white/10 transition-colors rounded-lg"
                                title={t('settings.resetSeed', 'Reset to Random')}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
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
                <Separator className="bg-white/10" />
                <CharacterPanel />
             </div>
         </Accordion>
    </div>
  )
}
