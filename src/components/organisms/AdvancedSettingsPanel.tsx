import { Button } from '@/components/atoms/Button'
import { Label } from '@/components/atoms/Label'
import { Switch } from '@/components/atoms/Switch'
import { ParameterControl } from '@/components/molecules/ParameterControl'
import { ResolutionSelector, Resolution } from '@/components/molecules/ResolutionSelector'
import { Dice5, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGenerationStore, AVAILABLE_MODELS, SAMPLERS, SCHEDULERS } from '@/stores/generation-store'
import { cn } from '@/lib/utils'
import { shallow } from 'zustand/shallow'
import { useSettingsStore } from '@/stores/settings-store'

export function AdvancedSettingsPanel() {
    const { t } = useTranslation()
    const {
        steps, setSteps,
        cfgScale, setCfgScale,
        seed, setSeed,
        model, setModel,
        width, height, setDimensions,
        sampler, setSampler,
        scheduler, setScheduler,
        smea, setSmea,
        smeaDyn, setSmeaDyn,
        variety, setVariety,
        cfgRescale, setCfgRescale,
        ucPreset, setUcPreset
    } = useGenerationStore((state) => ({
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
    }), shallow)

    const currentResolution: Resolution = {
        label: `${width} × ${height}`,
        width,
        height,
    }

    const handleResolutionChange = (resolution: Resolution) => {
        setDimensions(resolution.width, resolution.height)
    }

    const handleRandomSeed = () => setSeed(-1)
    const { streamingEnabled, setStreamingEnabled } = useSettingsStore((state) => ({
        streamingEnabled: state.streamingEnabled,
        setStreamingEnabled: state.setStreamingEnabled,
    }), shallow)

    return (
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
                <div className="col-span-2 flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2.5">
                    <div className="space-y-0.5 pr-4">
                        <Label className="text-xs">优先流式生成</Label>
                        <p className="text-[10px] text-slate-500 dark:text-white/45">开启后优先显示生成进度和预览，失败时会自动回退普通生成</p>
                    </div>
                    <Switch checked={streamingEnabled} onChange={(e) => setStreamingEnabled(e.target.checked)} />
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
                    <Button variant="outline" size="sm" onClick={handleRandomSeed} className="flex-1 h-9 text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-all text-slate-700 dark:text-white">
                        <Dice5 className="h-3 w-3 mr-1.5" />
                        {t('settings.randomGenerate')}
                    </Button>
                    {seed !== -1 && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setSeed(-1)} 
                            className="h-9 w-9 p-0 text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                            title={t('settings.resetSeed', 'Reset to Random')}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
