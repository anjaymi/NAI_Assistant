import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/atoms/ScrollArea';
import { Settings, User, Globe, Download, CheckCircle, Loader2, Monitor, Box, Paintbrush, FolderOpen, CloudLightning } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/atoms/Button';
import { MobileAccountSettings } from './MobileAccountSettings';
// Bento Box Container Component
function BentoCard({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn(
            "p-5 rounded-[28px] border border-slate-200/60 bg-white/60 shadow-sm backdrop-blur-xl",
            "dark:border-white/5 dark:bg-white/[0.03] dark:shadow-none",
            className
        )}>
            {children}
        </div>
    );
}
import { ParameterControl } from '@/components/molecules/ParameterControl';
import { Switch } from '@/components/atoms/Switch';
import { useSettingsStore } from '@/stores/settings-store';
import { useAppStore } from '@/stores/app-store';
import { PresetManager } from '@/components/organisms/PresetManager';
import { checkTaggerExists } from '@/services/tagger-service';
import { cn } from '@/lib/utils';

import { TaggerDownloadDialog } from '@/components/features/TaggerDownloadDialog';
import { MobileSyncSettings } from './MobileSyncSettings';

export function MobileSettingsPanel() {
    const { t, i18n } = useTranslation();
    const { theme, setTheme, forceMobile, toggleForceMobile } = useAppStore();
    const { 
        savePath, setSavePath, 
        imageFormat, setImageFormat,
        generationDelay, setGenerationDelay,
        randomizeDelay, setRandomizeDelay,
        batchDelaySize, setBatchDelaySize,
        batchDelay, setBatchDelay,
        remoteTaggerUrl, setRemoteTaggerUrl,
        novelAiProxyMode, setNovelAiProxyMode,
        novelAiProxyUrl, setNovelAiProxyUrl,
        psBridgePort, setPsBridgePort,
        streamingEnabled, setStreamingEnabled,
        taggerMode, setTaggerMode,
        taggerDownloaded, setTaggerDownloaded,
        cloudSyncToken, setCloudSyncToken
    } = useSettingsStore();

    const [showDownloadDialog, setShowDownloadDialog] = useState(false);
    const [checkingTagger, setCheckingTagger] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ downloaded: 0, total: 0, progress: 0 });
    const [downloadError, setDownloadError] = useState('');
    const [downloadSource, setDownloadSource] = useState('');

    useEffect(() => {
        let unlisten: (() => void) | null = null;
        const setupListener = async () => {
            try {
                const { listen } = await import('@tauri-apps/api/event');
                const unlistenProgress = await listen<{ downloaded: number; total: number; progress: number; source: string }>('tagger-download-progress', (event) => {
                    setDownloadProgress(event.payload);
                    setDownloadSource(event.payload.source || '');
                });
                const unlistenStatus = await listen<{ status: string; source: string }>('tagger-download-status', (event) => {
                    if (event.payload.status === 'connecting') setDownloadSource(event.payload.source);
                });
                unlisten = () => { unlistenProgress(); unlistenStatus(); };
            } catch (e) { console.warn("Not in Tauri", e); }
        };
        if (isDownloading) setupListener();
        return () => { if (unlisten) unlisten(); };
    }, [isDownloading]);

    const handleDownloadTagger = async () => {
        setIsDownloading(true);
        setDownloadError('');
        setDownloadProgress({ downloaded: 0, total: 0, progress: 0 });
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('download_tagger');
            setTaggerDownloaded(true);
        } catch (e) {
            setDownloadError(String(e));
        } finally {
            setIsDownloading(false);
        }
    };

    const handleTaggerModeChange = async (mode: 'online' | 'local') => {
        setTaggerMode(mode);
        if (mode === 'local' && !taggerDownloaded) {
            setCheckingTagger(true);
            try {
                const exists = await checkTaggerExists();
                if (exists) setTaggerDownloaded(true);
            } catch {
                // Ignore
            } finally {
                setCheckingTagger(false);
            }
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    };

    /** 设置页 stagger 入场 */
    const sectionContainer = {
        hidden: {},
        visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } }
    };
    const sectionItem = {
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 22, stiffness: 180 } }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-gradient-to-b dark:from-zinc-950 dark:to-black relative">
             <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
             {/* Header */}
             <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ type: "spring" as const, damping: 20, stiffness: 200 }}
                className="flex items-center justify-between px-6 py-4 pt-12 pb-2 shrink-0"
             >
                <div>
                     <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-white/60">
                        {t('settings.title', 'Generate Settings')}
                     </h1>
                     <p className="text-xs text-slate-500 dark:text-white/40 font-medium tracking-wide uppercase mt-0.5">
                     </p>
                </div>
            </motion.div>

            <ScrollArea className="flex-1">
                <motion.div 
                    className="px-5 pb-[120px] space-y-8 pt-2"
                    variants={sectionContainer}
                    initial="hidden"
                    animate="visible"
                >
                    
                    {/* Account Section */}
                    <motion.div variants={sectionItem}><MobileAccountSettings /></motion.div>

                    {/* Community Sync */}
                    <motion.div variants={sectionItem}><MobileSyncSettings /></motion.div>

                    {/* Cloud Airdrop */}
                    <motion.section variants={sectionItem} className="space-y-3">
                        <div className="flex items-center gap-2 pl-2 text-slate-500 mb-2 dark:text-white/50">
                            <CloudLightning className="w-3.5 h-3.5" />
                            <h3 className="text-[11px] font-extrabold uppercase tracking-widest">
                                Cloud Airdrop
                            </h3>
                        </div>
                        <BentoCard>
                            <div className="space-y-4">
                                <ParameterControl
                                    label="Cloud Sync Token"
                                    type="input"
                                    value={cloudSyncToken || ''}
                                    onChange={(val) => setCloudSyncToken(val as string)}
                                />
                                <p className="text-[11px] text-slate-500 dark:text-white/40 leading-relaxed">
                                    配置由你自行部署的 Worker 指定的连接令牌，用作中继频道的匹配凭据。手机端与电脑端填写保持一致，即可实现跨网络环境的多图一键推送。
                                </p>
                            </div>
                        </BentoCard>
                    </motion.section>

                    <motion.section variants={sectionItem} className="space-y-3">
                        <div className="flex items-center gap-2 pl-2 text-slate-500 dark:text-white/50 mb-2">
                            <Globe className="w-3.5 h-3.5" />
                            <h3 className="text-[11px] font-extrabold uppercase tracking-widest">NovelAI Proxy</h3>
                        </div>
                        <BentoCard>
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-extrabold text-slate-500 dark:text-white/60 uppercase tracking-wider">连接模式</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { value: 'direct', label: '直连' },
                                            { value: 'official', label: '官方 Worker' },
                                            { value: 'custom', label: '自定义 Worker' },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setNovelAiProxyMode(option.value as 'direct' | 'official' | 'custom')}
                                                className={cn(
                                                    'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors font-medium',
                                                    novelAiProxyMode === option.value
                                                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                                                        : 'border-slate-200/60 bg-white text-slate-600 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60'
                                                )}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {novelAiProxyMode === 'custom' && (
                                    <ParameterControl
                                        label="Proxy URL"
                                        type="input"
                                        value={novelAiProxyUrl}
                                        onChange={(val) => setNovelAiProxyUrl(val as string)}
                                    />
                                )}
                            </div>
                        </BentoCard>
                    </motion.section>
                    {/* App Settings */}
                    <motion.section variants={sectionItem} className="space-y-3">
                        <div className="flex items-center gap-2 pl-2 text-slate-500 mb-2 dark:text-white/50">
                            <Settings className="w-3.5 h-3.5" />
                            <h3 className="text-[11px] font-extrabold uppercase tracking-widest">
                                {t('settings.appSettings', 'App Settings')}
                            </h3>
                        </div>
                        <BentoCard>
                            <div className="space-y-6">
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
                                
                                {forceMobile && (
                                    <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-2">
                                        <label className="text-[11px] font-extrabold text-slate-500 dark:text-white/60 uppercase tracking-wider">{t('settings.desktopMode', 'Desktop Mode')}</label>
                                        <Button 
                                            variant="secondary" 
                                            className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white rounded-xl"
                                            onClick={toggleForceMobile}
                                        >
                                            <Monitor className="w-3.5 h-3.5 mr-2" />
                                            {t('settings.exitMobileView', 'Exit Mobile View')}
                                        </Button>
                                    </div>
                                )}
                                
                                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/5">
                                    <label className="text-[11px] font-extrabold text-slate-500 dark:text-white/60 uppercase tracking-wider">{t('settings.presetManager', 'Preset Manager')}</label>
                                    <PresetManager />
                                </div>
                            </div>
                        </BentoCard>
                    </motion.section>
                    
                    {/* Appearance */}
                    <motion.section variants={sectionItem} className="space-y-3">
                        <div className="flex items-center gap-2 pl-2 text-slate-500 mb-2 dark:text-white/50">
                            <Paintbrush className="w-3.5 h-3.5" />
                            <h3 className="text-[11px] font-extrabold uppercase tracking-widest">
                                {t('settings.appearance', 'Appearance')}
                            </h3>
                        </div>
                        <BentoCard>
                            <div className="space-y-3">
                                <label className="text-[11px] font-extrabold text-slate-500 dark:text-white/60 uppercase tracking-wider">{t('settings.themeMode', 'Theme Mode')}</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'light', label: t('settings.themeLight', 'Light'), icon: '☀️' },
                                        { id: 'dark', label: t('settings.themeDark', 'Dark'), icon: '🌙' },
                                        { id: 'system', label: t('settings.themeSystem', 'System'), icon: '🖥️' }
                                    ].map((opt) => (
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            key={opt.id}
                                            onClick={() => setTheme(opt.id as any)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors",
                                                theme === opt.id ? "border-slate-800 bg-slate-100 text-slate-900 dark:border-white dark:bg-white/10 dark:text-white" : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50"
                                            )}
                                        >
                                            <span className="text-lg">{opt.icon}</span>
                                            <span className="text-xs font-medium">{opt.label}</span>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        </BentoCard>
                    </motion.section>

                    {/* Storage & Formats */}
                    <motion.section variants={sectionItem} className="space-y-3">
                        <div className="flex items-center gap-2 pl-2 text-slate-500 mb-2 dark:text-white/50">
                            <Box className="w-3.5 h-3.5" />
                            <h3 className="text-[11px] font-extrabold uppercase tracking-widest">
                                {t('settings.storageFormats', 'Storage & Formats')}
                            </h3>
                        </div>
                        <BentoCard>
                            <div className="space-y-6">
                                <ParameterControl
                                    label={t('settings.imageFormat', 'Image Format')}
                                    type="select"
                                    value={imageFormat}
                                    onChange={(v) => setImageFormat(v as 'png'|'webp')}
                                    options={[
                                        { label: 'PNG (Lossless)', value: 'png' },
                                        { label: 'WEBP (Efficient)', value: 'webp' },
                                    ]}
                                />
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <label className="text-[11px] font-extrabold text-slate-500 dark:text-white/60 uppercase tracking-wider">
                                                {t('settings.savePath', 'Save Path')}
                                            </label>
                                            <p className="text-[10px] text-slate-500 dark:text-white/40 max-w-[200px] leading-tight mt-1">
                                                {t('settings.mobileSavePathDesc', 'Select a custom directory for saved images.')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-600 dark:text-white/60 truncate flex items-center h-10">
                                            {savePath || 'NAIS_Output'}
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="h-10 px-3 shrink-0 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 border-none"
                                            onClick={async () => {
                                                try {
                                                    const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
                                                    const selected = await openDialog({
                                                        directory: true,
                                                        multiple: false,
                                                        title: 'Select Save Directory'
                                                    });
                                                    if (selected && typeof selected === 'string') {
                                                        setSavePath(selected);
                                                        useSettingsStore.getState().setUseAbsoluteLibraryPath(true);
                                                    }
                                                } catch (e) {
                                                    // Ignore or log error
                                                }
                                            }}
                                        >
                                            <FolderOpen className="w-3.5 h-3.5 text-slate-600 dark:text-white/70" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </BentoCard>
                    </motion.section>

                    {/* Generation Settings */}
                    <motion.section variants={sectionItem} className="space-y-3">
                        <div className="flex items-center gap-2 pl-2 text-slate-500 mb-2 dark:text-white/50">
                            <Monitor className="w-3.5 h-3.5" />
                            <h3 className="text-[11px] font-extrabold uppercase tracking-widest">
                                {t('settings.generationBehavior', 'Generation Behavior')}
                            </h3>
                        </div>
                        <BentoCard>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <label className="text-[11px] font-extrabold text-slate-500 dark:text-white/60 uppercase tracking-wider">{t('settings.streamingGeneration', 'Streaming Generation')}</label>
                                        <p className="text-[10px] text-slate-500 dark:text-white/40 max-w-[200px] leading-tight mt-1">{t('settings.streamingDesc', 'Show real-time progress during image generation')}</p>
                                    </div>
                                    <div 
                                        onClick={() => setStreamingEnabled(!streamingEnabled)}
                                        className={cn("w-11 h-6 rounded-full transition-colors relative flex-shrink-0", streamingEnabled ? "bg-green-500" : "bg-slate-200 dark:bg-white/10")}
                                    >
                                        <div className={cn("absolute top-1 left-1 bg-white w-3.5 h-3.5 rounded-full transition-transform shadow-sm", streamingEnabled ? "translate-x-5" : "translate-x-0")} />
                                    </div>
                                </div>
                                
                                <ParameterControl
                                    label={t('settings.genDelay', 'Generation Delay (s)')}
                                    type="slider"
                                    value={generationDelay / 1000}
                                    onChange={(v) => setGenerationDelay(Number(v) * 1000)}
                                    min={0} max={60} step={0.1}
                                />

                                <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase">{t('settings.humanBehavior', 'Human-like Behavior')}</label>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-800 dark:text-white">{t('settings.randomizeDelay', 'Randomize Delay (+/- 20%)')}</span>
                                        <Switch checked={randomizeDelay} onChange={(e) => setRandomizeDelay(e.target.checked)} />
                                    </div>
                                    <ParameterControl
                                        label={t('settings.longPauseFreq', 'Long Pause Frequency (imgs)')}
                                        type="slider"
                                        value={batchDelaySize}
                                        onChange={setBatchDelaySize}
                                        min={1} max={50} step={1}
                                    />
                                    <ParameterControl
                                        label={t('settings.longPauseDur', 'Long Pause Duration (s)')}
                                        type="slider"
                                        value={batchDelay}
                                        onChange={setBatchDelay}
                                        min={0} max={300} step={5}
                                    />
                                </div>
                            </div>
                        </BentoCard>
                    </motion.section>

                    {/* Style Tagger */}
                    <motion.section variants={sectionItem} className="space-y-3">
                        <div className="flex items-center gap-2 pl-2 text-slate-500 mb-2 dark:text-white/50">
                            <Globe className="w-3.5 h-3.5" />
                            <h3 className="text-[11px] font-extrabold uppercase tracking-widest">
                                {t('settings.styleTagger', 'Style Tagger')}
                            </h3>
                        </div>
                        <BentoCard>
                             <div className="space-y-6">
                                 <div className="space-y-3">
                                     <label className="text-[11px] font-extrabold text-slate-500 dark:text-white/60 uppercase tracking-wider">{t('settings.taggerMode', 'Tagger Mode')}</label>
                                     <div className="flex gap-2">
                                         <motion.button
                                             whileTap={{ scale: 0.95 }}
                                             onClick={() => handleTaggerModeChange('online')}
                                             className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-all", taggerMode === 'online' ? 'bg-primary text-white dark:text-black' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/70')}
                                         >
                                             🌐 {t('settings.onlineHF', 'Online (HF)')}
                                         </motion.button>
                                         <motion.button
                                             whileTap={{ scale: 0.95 }}
                                             onClick={() => handleTaggerModeChange('local')}
                                             disabled={checkingTagger}
                                             className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50", taggerMode === 'local' ? 'bg-primary text-white dark:text-black' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/70')}
                                         >
                                             {checkingTagger ? <Loader2 className="inline w-3.5 h-3.5 animate-spin" /> : `💻 ${t('settings.local', 'Local')}`}
                                         </motion.button>
                                     </div>
                                 </div>
                                 
                                 {taggerMode === 'local' && (
                                     <div className="space-y-4 pt-2">
                                         <ParameterControl
                                             label={t('settings.taggerUrl', 'Tagger URL')}
                                             type="input"
                                             value={remoteTaggerUrl}
                                             onChange={setRemoteTaggerUrl}
                                         />
                                         <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-lg space-y-3">
                                             <div className="flex items-center justify-between">
                                                 <div className="flex items-center gap-2">
                                                     {taggerDownloaded ? (
                                                         <><CheckCircle className="w-3.5 h-3.5 text-green-500" /><span className="text-xs text-green-500">{t('settings.taggerReady', 'Tagger Ready')}</span></>
                                                     ) : isDownloading ? (
                                                         <><Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /><span className="text-xs text-primary">{t('settings.downloading', 'Downloading...')}</span></>
                                                     ) : (
                                                         <><Download className="w-3.5 h-3.5 text-yellow-500" /><span className="text-xs text-yellow-500">{t('settings.downloadRequired', 'Download Required (~170MB)')}</span></>
                                                     )}
                                                 </div>
                                                 {!taggerDownloaded && !isDownloading && (
                                                     <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={handleDownloadTagger}>DL Tagger</Button>
                                                 )}
                                             </div>
                                             {isDownloading && (
                                                 <div className="space-y-1">
                                                     <div className="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                         <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${downloadProgress.progress}%` }} />
                                                     </div>
                                                     <div className="flex justify-between text-[10px] text-slate-600 dark:text-white/40">
                                                         <span>{formatSize(downloadProgress.downloaded)} / {formatSize(downloadProgress.total)}</span>
                                                         <span>{downloadProgress.progress}%</span>
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                 )}
                             </div>
                         </BentoCard>
                     </motion.section>
 
                     <TaggerDownloadDialog 
                         open={showDownloadDialog}
                         onOpenChange={setShowDownloadDialog}
                         onUseOnline={() => { setTaggerMode('online'); setShowDownloadDialog(false); }}
                         onDownloadComplete={() => { setTaggerDownloaded(true); setShowDownloadDialog(false); }}
                     />
 
                     <div className="text-center pb-8 opacity-40 hover:opacity-100 transition-opacity">
                         <span className="text-[10px] bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full text-slate-500 dark:text-white/80 font-mono tracking-widest border border-slate-200 dark:border-white/10">
                             NAI V2.0 PRO MAX
                         </span>
                     </div>
                 </motion.div>
             </ScrollArea>
         </div>
     );
 }

