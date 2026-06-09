import React, { useState } from 'react';
import { Wand2, MonitorUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useGenerationStore } from '@/stores/generation-store';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { cn } from '@/lib/utils';
import { Button } from '@/components/atoms/Button';
import { MobilePushToPCDialog } from './MobilePushToPCDialog';
import { shallow } from 'zustand/shallow';

export function MobileGenerateFAB() {
    const { t } = useTranslation();
    const { generate, isGenerating } = useGenerationStore(
        (state) => ({
            generate: state.generate,
            isGenerating: state.isGenerating,
        }),
        shallow
    );
    const [pushDialogOpen, setPushDialogOpen] = useState(false);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
            className="absolute bottom-6 left-6 right-6 z-20"
        >
            <GlassSurface
                className="p-1.5 rounded-full bg-white/98 dark:bg-zinc-900/98 border border-slate-200 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                borderRadius={9999}
            >
                <div className="flex gap-1.5 w-full">
                    <motion.div whileTap={!isGenerating ? { scale: 0.97 } : {}} className="flex-1">
                        <Button
                            variant="default"
                            className={cn(
                                "w-full h-[56px] text-lg font-bold rounded-full shadow-[0_0_30px_-5px_rgba(var(--primary),0.6)]",
                                "bg-gradient-to-r from-primary to-amber-500 hover:opacity-90 transition-all duration-300",
                                isGenerating && "opacity-80 cursor-wait sepia-[.2]"
                            )}
                            onClick={() => !isGenerating && generate()}
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                                    <span className="animate-pulse tracking-wide font-semibold text-white/90">
                                        {t('common.generating', 'Generating...')}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    <Wand2 className="h-5 w-5 fill-white/20 text-white" />
                                    <span className="tracking-wide text-shadow-sm font-semibold text-white">
                                        {t('common.generate', 'Generate Art')}
                                    </span>
                                </div>
                            )}
                        </Button>
                    </motion.div>

                    <motion.div whileTap={{ scale: 0.9 }}>
                        <Button
                            variant="outline"
                            className="h-[56px] w-[56px] rounded-full border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 p-0 flex items-center justify-center transition-colors"
                            onClick={() => setPushDialogOpen(true)}
                        >
                            <MonitorUp className="w-5 h-5" />
                        </Button>
                    </motion.div>
                </div>
            </GlassSurface>
            
            <MobilePushToPCDialog 
                open={pushDialogOpen} 
                onOpenChange={setPushDialogOpen} 
            />
        </motion.div>
    );
}
