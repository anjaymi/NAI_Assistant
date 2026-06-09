import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGenerationStore, AVAILABLE_MODELS, SAMPLERS, SCHEDULERS } from '@/stores/generation-store';
import { useCharacterStore } from '@/stores/character-store';
import { ParameterControl } from '@/components/molecules/ParameterControl';
import { ResolutionSelector, Resolution } from '@/components/molecules/ResolutionSelector';
import { PresetManager } from '@/components/organisms/PresetManager';
import { Switch } from '@/components/atoms/Switch';
import { Label } from '@/components/atoms/Label';
import { Button } from '@/components/atoms/Button';
import { ImageUpload } from '@/components/atoms/ImageUpload';
import { Separator } from '@/components/atoms/Separator';
import { VibePanel } from '@/components/organisms/VibePanel';
import { CharacterPanel } from '@/components/organisms/CharacterPanel';
import { Dice5, Image as ImageIcon, Sparkles, Box, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shallow } from 'zustand/shallow';

// Bento Box Container Component
function BentoCard({ children, className, colSpan = 1 }: { children: React.ReactNode, className?: string, colSpan?: 1 | 2 }) {
    return (
        <div className={cn(
            "p-4 rounded-[28px] border border-slate-200/60 bg-white/60 shadow-sm backdrop-blur-xl",
            "dark:border-white/5 dark:bg-white/[0.03] dark:shadow-none",
            colSpan === 2 ? "col-span-2" : "col-span-1",
            className
        )}>
            {children}
        </div>
    );
}

export function MobileGenerationSettingsPanel() {
    const { t } = useTranslation();
    
    // Core settings
    const {
        model, setModel,
        width, height, setDimensions,
        steps, setSteps,
        cfgScale, setCfgScale,
        sampler, setSampler,
        scheduler, setScheduler,
        ucPreset, setUcPreset,
        smea, setSmea,
        smeaDyn, setSmeaDyn,
        variety, setVariety,
        cfgRescale, setCfgRescale,
        seed, setSeed,
        sourceImage, setSourceImage,
        strength, setStrength,
        noise, setNoise,
        mask, setMask
    } = useGenerationStore(
        (state) => ({
            model: state.model,
            setModel: state.setModel,
            width: state.width,
            height: state.height,
            setDimensions: state.setDimensions,
            steps: state.steps,
            setSteps: state.setSteps,
            cfgScale: state.cfgScale,
            setCfgScale: state.setCfgScale,
            sampler: state.sampler,
            setSampler: state.setSampler,
            scheduler: state.scheduler,
            setScheduler: state.setScheduler,
            ucPreset: state.ucPreset,
            setUcPreset: state.setUcPreset,
            smea: state.smea,
            setSmea: state.setSmea,
            smeaDyn: state.smeaDyn,
            setSmeaDyn: state.setSmeaDyn,
            variety: state.variety,
            setVariety: state.setVariety,
            cfgRescale: state.cfgRescale,
            setCfgRescale: state.setCfgRescale,
            seed: state.seed,
            setSeed: state.setSeed,
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
    );

    const currentResolution: Resolution = {
        label: `${width} × ${height}`,
        width, height,
    };

    const sectionTitleClass = "flex items-center gap-2 pl-2 mb-3 mt-6 text-slate-500 dark:text-white/50 text-[11px] font-extrabold uppercase tracking-widest";

    return (
        <div className="space-y-6 pb-20 px-2">
            
            {/* Presets */}
            <div className={sectionTitleClass}>
                <Box className="w-3.5 h-3.5" />
                <span>预设管理</span>
            </div>
            <BentoCard colSpan={2}>
                <PresetManager />
            </BentoCard>

            {/* Core Settings */}
            <div className={sectionTitleClass}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{t('settings.title', 'Generate Settings')}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                {/* Model & Resolution */}
                <BentoCard colSpan={2} className="space-y-5">
                    <ParameterControl
                        label={t('settings.model')}
                        type="select"
                        value={model}
                        onChange={setModel}
                        options={AVAILABLE_MODELS.map(m => ({ label: m.name, value: m.id }))}
                    />
                    <div className="space-y-2">
                        <Label className="text-[11px] font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">{t('settings.resolution')}</Label>
                        <ResolutionSelector
                            value={currentResolution}
                            onChange={(res) => setDimensions(res.width, res.height)}
                        />
                    </div>
                </BentoCard>

                {/* Steps & CFG */}
                <BentoCard>
                    <ParameterControl
                        label={t('settings.steps')}
                        type="slider"
                        value={steps}
                        onChange={setSteps}
                        min={1} max={50} step={1}
                    />
                </BentoCard>
                <BentoCard>
                    <ParameterControl
                        label={t('settings.scale')}
                        type="slider"
                        value={cfgScale}
                        onChange={setCfgScale}
                        min={1} max={10} step={0.1}
                    />
                </BentoCard>

                {/* Sampler & Scheduler */}
                <BentoCard colSpan={2} className="grid grid-cols-2 gap-3">
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
                </BentoCard>

                {/* UC Preset */}
                <BentoCard colSpan={2}>
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
                </BentoCard>

                {/* SMEA / DYN / Variety */}
                <BentoCard colSpan={2}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-[12px] font-bold text-slate-700 dark:text-white/80">{t('settings.modelSmea', 'SMEA')}</Label>
                                <Switch checked={smea} onChange={(e) => setSmea(e.target.checked)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className={cn("text-[12px] font-bold", smea ? "text-slate-700 dark:text-white/80" : "text-slate-400 dark:text-white/40")}>{t('settings.modelSmeaDyn', 'SMEA DYN')}</Label>
                                <Switch checked={smeaDyn} disabled={!smea} onChange={(e) => setSmeaDyn(e.target.checked)} />
                            </div>
                        </div>
                        <div className="border-l border-slate-200 dark:border-white/10 pl-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-[12px] font-bold text-slate-700 dark:text-white/80">{t('settings.variety', 'Variety')}</Label>
                                <Switch checked={variety} onChange={(e) => setVariety(e.target.checked)} />
                            </div>
                        </div>
                    </div>
                </BentoCard>

                {/* CFG Rescale */}
                <BentoCard colSpan={2}>
                    <ParameterControl
                        label={t('settings.cfgRescale')}
                        type="slider"
                        value={cfgRescale}
                        onChange={setCfgRescale}
                        min={0} max={1} step={0.01}
                    />
                </BentoCard>

                {/* Seed */}
                <BentoCard colSpan={2} className="flex items-center justify-between bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-500/5 dark:to-purple-500/5">
                     <div className="flex flex-col">
                         <Label className="text-[11px] font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">{t('settings.seed')}</Label>
                         <span className="text-sm text-indigo-600 dark:text-indigo-400 font-mono font-bold tracking-widest mt-1">{seed === -1 ? t('settings.random') : seed}</span>
                     </div>
                     <div className="flex gap-2">
                         {seed !== -1 && (
                             <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl bg-red-100/50 text-red-500 hover:bg-red-100 hover:text-red-600 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20" onClick={() => setSeed(-1)} title="Reset Seed">
                                 <RefreshCw className="h-4 w-4" />
                             </Button>
                         )}
                         <Button variant="secondary" className="h-10 px-4 rounded-xl text-xs font-bold bg-white text-slate-700 shadow-sm hover:bg-slate-50 border border-slate-200/60 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:border-white/10" onClick={() => setSeed(-1)}>
                             <Dice5 className="h-4 w-4 mr-2" />
                             {t('settings.randomGenerate', 'Random')}
                         </Button>
                     </div>
                </BentoCard>
            </div>

            {/* Img2Img Section */}
            <div className={sectionTitleClass}>
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{t('settings.img2img', 'Img2Img & Inpaint')}</span>
            </div>
            <BentoCard colSpan={2}>
                <div className="space-y-5">
                    <ImageUpload
                        value={sourceImage}
                        onChange={setSourceImage}
                        placeholder={t('settings.uploadSource')}
                        className="h-32 rounded-2xl border-dashed border-2 border-slate-300 dark:border-white/20"
                    />
                    {sourceImage && (
                        <div className="space-y-5 pt-2 animate-in fade-in slide-in-from-top-2">
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
                            <div className="space-y-2 pt-2">
                                <Label className="text-[11px] font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">{t('settings.mask')}</Label>
                                <ImageUpload
                                    value={mask}
                                    onChange={setMask}
                                    placeholder={t('settings.uploadMask')}
                                    className="h-24 rounded-2xl border-dashed border-2 border-slate-300 dark:border-white/20"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </BentoCard>

            {/* Reference (Vibe & Character) */}
            <div className={sectionTitleClass}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('settings.reference', 'References')}</span>
            </div>
            <BentoCard colSpan={2} className="space-y-6">
                <VibePanel />
                <Separator className="bg-slate-200/60 dark:bg-white/10" />
                <CharacterPanel />
            </BentoCard>
        </div>
    );
}
