import React from 'react';
import { Tags, Copy, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { cn } from '@/lib/utils';
import type { TagResult } from '@/services/smart-tools';

interface MobileAnalysisPanelProps {
    activeImage: string | null;
    isProcessing: boolean;
    analyzedTags: TagResult[];
    onAnalyze: () => void;
    onCopyAll: () => void;
    onApplyToPrompt: () => void;
}

export function MobileAnalysisPanel({
    activeImage,
    isProcessing,
    analyzedTags,
    onAnalyze,
    onCopyAll,
    onApplyToPrompt
}: MobileAnalysisPanelProps) {
    const { t } = useTranslation();

    return (
        <motion.div whileTap={(!activeImage || isProcessing) ? {} : { scale: 0.97 }} className="w-full cursor-pointer" onClick={(!activeImage || isProcessing) ? undefined : onAnalyze}>
            <GlassSurface 
                className={cn(
                    "p-4 flex flex-col gap-4 transition-all duration-300",
                    (!activeImage || isProcessing) ? "opacity-50" : "hover:bg-slate-50/50 dark:hover:bg-white/5 active:bg-slate-100/50 dark:active:bg-white/10",
                    "border border-slate-200/50 dark:border-transparent"
                )} 
                borderRadius={20}
                backgroundOpacity={0.04}
                brightness={80} // increased brightness for clearer light mode surface
            >
                <div className="flex items-center gap-4">
                    <div className="rounded-[16px] ring-1 shrink-0 flex items-center justify-center p-3 h-[48px] w-[48px] bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 ring-blue-100 dark:ring-blue-500/20 shadow-sm dark:shadow-none">
                        <Tags className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                        <span className="font-semibold text-[15px] leading-tight block text-slate-800 dark:text-white/90 truncate drop-shadow-sm dark:drop-shadow-none">{t('smartTools.styleAnalysis', "Style Analysis")}</span>
                        <span className="text-[11px] text-slate-500 dark:text-white/40 block mt-0.5 truncate uppercase tracking-wider font-medium">{t('tools.analyzeTags', 'Analyze tags from image')}</span>
                    </div>
                    <div className={cn(
                        "h-9 px-4 rounded-full font-bold text-xs flex items-center justify-center shrink-0 transition-colors shadow-sm",
                        "bg-white dark:bg-white/10 text-slate-700 dark:text-white/90 border border-slate-200 dark:border-white/5",
                        (!activeImage || isProcessing) ? "opacity-30" : "hover:bg-slate-50 dark:hover:bg-white/20 active:bg-slate-100 dark:active:bg-white/30"
                    )}>
                        {t('smartTools.analyze', "Analyze")}
                    </div>
                </div>

                {analyzedTags.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 space-y-4 bg-slate-50 dark:bg-black/20 rounded-[20px] p-4 border border-slate-200/60 dark:border-white/5 shadow-inner dark:shadow-none"
                    >
                        <div className="flex flex-wrap gap-2">
                            {analyzedTags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-[11px] py-1 px-2.5 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors font-semibold text-slate-700 dark:text-white/80 shadow-sm dark:shadow-none">
                                    {tag.label}
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <motion.div className="flex-1" whileTap={{ scale: 0.95 }}>
                                <Button size="sm" variant="outline" className="w-full text-sm h-11 rounded-[14px] bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border-slate-200 dark:border-transparent text-slate-700 dark:text-white/90 shadow-sm font-semibold" onClick={onCopyAll}>
                                    <Copy className="h-4 w-4 mr-2" /> {t('common.copy', 'Copy')}
                                </Button>
                            </motion.div>
                            <motion.div className="flex-1" whileTap={{ scale: 0.95 }}>
                                <Button size="sm" variant="default" className="w-full text-sm h-11 rounded-[14px] shadow-sm font-semibold" onClick={onApplyToPrompt}>
                                    <Plus className="h-4 w-4 mr-2" /> {t('common.apply', 'Apply')}
                                </Button>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </GlassSurface>
        </motion.div>
    );
}
