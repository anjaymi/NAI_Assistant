import React, { lazy, useState, useEffect } from 'react';
import { Sparkles, ChevronDown, ChevronUp, ScrollText, Eraser } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generation-store';
import { useSettingsStore } from '@/stores/settings-store';
import { PresetManager } from '@/components/organisms/PresetManager';
import { GlassTextarea } from '@/components/atoms/GlassTextarea';
import { MobileMagicTagDialog } from './MobileMagicTagDialog';
import { Filter, UserCircle2, List } from 'lucide-react';
import { MobileArtistDialog } from './MobileArtistDialog';
import { MobileWildcardPanel } from './MobileWildcardPanel';
import { shallow } from 'zustand/shallow';
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary';

const MobileTagEditorDialog = lazy(() => import('./MobileTagEditorDialog').then((module) => ({ default: module.MobileTagEditorDialog }))); 

function mergePromptTags(current: string, tagsToAdd: string[]) {
    const currentTags = current
        .split(/[,，]/)
        .map(tag => tag.trim())
        .filter(Boolean)

    const normalized = new Set(currentTags.map(tag => tag.toLowerCase()))
    const missingTags = tagsToAdd.filter(tag => !normalized.has(tag.toLowerCase()))

    return missingTags.length > 0
        ? [...missingTags, ...currentTags].join(', ')
        : current
}

export function MobilePromptControl() {
    const { t } = useTranslation();
    const [isFocused, setIsFocused] = useState(false);
    const [negExpanded, setNegExpanded] = useState(false);
    const [magicTagOpen, setMagicTagOpen] = useState(false);
    const [tagEditorOpen, setTagEditorOpen] = useState(false);
    const [artistDialogOpen, setArtistDialogOpen] = useState(false);
    const [wildcardDialogOpen, setWildcardDialogOpen] = useState(false);
    const qualityTagsSetting = useSettingsStore((state) => state.qualityTags);
    
    // We bind directly to the global generation store prompt
    const { prompt, setPrompt, negativePrompt, setNegativePrompt, pendingTagsToAppend, clearPendingTagsToAppend } = useGenerationStore(
        (state) => ({
            prompt: state.prompt,
            setPrompt: state.setPrompt,
            negativePrompt: state.negativePrompt,
            setNegativePrompt: state.setNegativePrompt,
            pendingTagsToAppend: state.pendingTagsToAppend,
            clearPendingTagsToAppend: state.clearPendingTagsToAppend,
        }),
        shallow
    );

    // Local State for Debouncing Inputs
    const [localPrompt, setLocalPrompt] = useState(prompt);
    const [localNegative, setLocalNegative] = useState(negativePrompt);
    const isEditingPrompt = React.useRef(false);
    const isEditingNeg = React.useRef(false);
    const promptTimeout = React.useRef<NodeJS.Timeout>();
    const negTimeout = React.useRef<NodeJS.Timeout>();

    // Sync external changes (e.g. pre-fills, undo, etc) into the local inputs when user is not typing
    useEffect(() => {
        if (!isEditingPrompt.current) setLocalPrompt(prompt);
    }, [prompt]);

    useEffect(() => {
        if (!isEditingNeg.current) setLocalNegative(negativePrompt);
    }, [negativePrompt]);

    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLocalPrompt(val);
        if (promptTimeout.current) clearTimeout(promptTimeout.current);
        promptTimeout.current = setTimeout(() => {
            setPrompt(val);
        }, 500);
    };

    const handleNegativeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLocalNegative(val);
        if (negTimeout.current) clearTimeout(negTimeout.current);
        negTimeout.current = setTimeout(() => {
            setNegativePrompt(val);
        }, 500);
    };

    // 监听 pendingTagsToAppend，将外部注入的标签（如 <固定画师>）追加到提示词末尾
    useEffect(() => {
        if (pendingTagsToAppend) {
            setPrompt(prompt ? `${prompt}, ${pendingTagsToAppend}` : pendingTagsToAppend);
            clearPendingTagsToAppend();
        }
    }, [pendingTagsToAppend, clearPendingTagsToAppend]);

    const addQualityTags = () => {
        const qualityTags = qualityTagsSetting
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean)
        setPrompt(mergePromptTags(prompt, qualityTags))
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col gap-4"
        >
             {/* Header Row */}
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 pl-1">
                    <Sparkles className={cn("w-4 h-4 transition-colors", isFocused ? "text-primary" : "text-slate-400 dark:text-white/40")} />
                    <label className="text-sm font-semibold tracking-wide text-slate-800 dark:text-white/90">
                        {t('common.prompt', 'Prompt')}
                    </label>
                </div>
                
                {/* Preset Manager: scaled down slightly for mobile header styling */}
                <div className="scale-90 origin-right">
                    <PresetManager />
                </div>
            </div>
            
            {/* Main Prompt Input */}
            <div 
                className="relative flex flex-col"
            >
                <GlassSurface 
                    className={cn(
                        "rounded-[16px] overflow-hidden transition-all duration-300 border border-slate-200 dark:border-white/5",
                        isFocused ? "ring-1 ring-primary/50 shadow-[0_0_20px_-5px_rgba(var(--primary),0.3)] bg-white/60 dark:bg-white/10" : "bg-transparent"
                    )}
                    brightness={isFocused ? 80 : 60}
                    backgroundOpacity={isFocused ? 0.1 : 0.02}
                    borderRadius={16}
                >
                    <div className="flex flex-col">
                        <GlassTextarea 
                            value={localPrompt}
                            onChange={handlePromptChange}
                            onFocus={() => { isEditingPrompt.current = true; setIsFocused(true); }}
                            onBlur={() => { 
                                isEditingPrompt.current = false; 
                                setIsFocused(false);
                                if (promptTimeout.current) clearTimeout(promptTimeout.current);
                                setPrompt(localPrompt); // Flush immediately on blur
                            }}
                            placeholder={t('generate.promptPlaceholder', 'What do you want to imagine?')}
                            className="bg-transparent border-none text-[15px] leading-relaxed p-4 min-h-[120px] resize-none focus-visible:ring-0"
                        />
                        
                        {/* Action Bar inside the prompt box */}
                        <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-slate-200 dark:border-white/5">
                            <div className="flex items-center gap-1">
                                <motion.button whileTap={{ scale: 0.85 }} className="p-2 text-slate-400 hover:text-slate-800 active:bg-slate-100 dark:text-white/40 dark:hover:text-white dark:active:bg-white/5 rounded-full transition-colors" onClick={() => setTagEditorOpen(true)}>
                                    <List className="w-4 h-4" />
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.85 }} className="p-2 text-slate-400 hover:text-indigo-600 active:bg-slate-100 dark:text-white/40 dark:hover:text-indigo-400 dark:active:bg-white/5 rounded-full transition-colors" onClick={() => setMagicTagOpen(true)}>
                                    <ScrollText className="w-4 h-4" />
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.85 }} className="p-2 text-slate-400 hover:text-purple-600 active:bg-slate-100 dark:text-white/40 dark:hover:text-purple-400 dark:active:bg-white/5 rounded-full transition-colors" onClick={() => setWildcardDialogOpen(true)}>
                                    <Filter className="w-4 h-4" />
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.85 }} className="p-2 text-slate-400 hover:text-pink-600 active:bg-slate-100 dark:text-white/40 dark:hover:text-pink-400 dark:active:bg-white/5 rounded-full transition-colors" onClick={() => setArtistDialogOpen(true)}>
                                    <UserCircle2 className="w-4 h-4" />
                                </motion.button>
                                <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10 mx-1" />
                                <motion.button whileTap={{ scale: 0.85 }} className="p-2 text-slate-400 hover:text-primary active:bg-slate-100 dark:text-white/40 dark:hover:text-primary dark:active:bg-white/5 rounded-full transition-colors" onClick={addQualityTags}>
                                    <Sparkles className="w-4 h-4" />
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.85 }} className="p-2 text-slate-400 hover:text-slate-800 active:bg-slate-100 dark:text-white/40 dark:hover:text-white dark:active:bg-white/5 rounded-full transition-colors" onClick={() => setPrompt('')}>
                                    <Eraser className="w-4 h-4" />
                                </motion.button>
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-white/30 font-medium px-2 normal-nums">
                                {prompt.length} chars
                            </div>
                        </div>
                    </div>
                </GlassSurface>
            </div>

            {/* Negative Prompt Toggler */}
            <div className="flex flex-col gap-2">
                <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setNegExpanded(!negExpanded)}
                    className="flex justify-between items-center px-4 py-3 bg-white/50 hover:bg-slate-100 border border-slate-200 dark:bg-white/[0.02] dark:hover:bg-white/5 dark:border-white/5 rounded-[16px] transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-destructive/80">{t('common.negativePrompt', 'Negative Prompt')}</span>
                    </div>
                    {negExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-white/40" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-white/40" />}
                </motion.button>
                
                <AnimatePresence>
                    {negExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-1">
                                <GlassTextarea 
                                    value={localNegative}
                                    onChange={handleNegativeChange}
                                    onFocus={() => { isEditingNeg.current = true; }}
                                    onBlur={() => {
                                        isEditingNeg.current = false;
                                        if (negTimeout.current) clearTimeout(negTimeout.current);
                                        setNegativePrompt(localNegative);
                                    }}
                                    placeholder={t('generate.negativePlaceholder', 'Lowres, bad anatomy, bad hands...')}
                                    className="bg-destructive/5 border-destructive/20 focus-visible:ring-destructive/30 text-sm p-4 min-h-[100px] resize-none rounded-2xl"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <MobileMagicTagDialog 
                open={magicTagOpen} 
                onOpenChange={setMagicTagOpen}
                onInject={(tags, target) => {
                    if (target === 'positive') setPrompt(prompt ? `${prompt}, ${tags}` : tags);
                    if (target === 'negative') setNegativePrompt(negativePrompt ? `${negativePrompt}, ${tags}` : tags);
                }}
            />

            {tagEditorOpen && (
                <LazyModuleBoundary mode="overlay" label="Loading mobile tag editor...">
                    <MobileTagEditorDialog
                        open={tagEditorOpen}
                        onOpenChange={setTagEditorOpen}
                        initialTags={prompt.split(/[,，]/).map(t => t.trim()).filter(Boolean)}
                        onUpdate={(tags) => setPrompt(tags.join(', '))}
                    />
                </LazyModuleBoundary>
            )}
            
            <MobileArtistDialog 
                open={artistDialogOpen} 
                onOpenChange={setArtistDialogOpen} 
                onInsert={(tag) => {
                    setPrompt(prompt ? `${prompt}, ${tag}` : tag);
                }}
            />
            
            <AnimatePresence>
                {wildcardDialogOpen && (
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-0 z-[100] bg-slate-50 dark:bg-black"
                    >
                        <MobileWildcardPanel 
                            onClose={() => setWildcardDialogOpen(false)}
                            onInsert={(tag) => {
                                setPrompt(prompt ? `${prompt}, ${tag}` : tag);
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
