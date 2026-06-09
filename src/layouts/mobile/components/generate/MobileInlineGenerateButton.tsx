import React, { useState } from 'react';
import { Wand2, MonitorUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useGenerationStore } from '@/stores/generation-store';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/lib/utils';
import { MobilePushToPCDialog } from './MobilePushToPCDialog';
import { shallow } from 'zustand/shallow';

export function MobileInlineGenerateButton() {
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
        <div className="flex items-center gap-3 w-full">
            <motion.div 
                whileTap={!isGenerating ? { scale: 0.92 } : {}}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex-1"
            >
                <Button
                    variant="premium"
                    className={cn(
                        "w-full h-[60px] text-lg font-bold rounded-2xl shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)]",
                        "transition-all duration-300 relative overflow-hidden group",
                        isGenerating && "opacity-80 cursor-wait sepia-[.2]"
                    )}
                    onClick={() => !isGenerating && generate()}
                    disabled={isGenerating}
                >
                    {isGenerating ? (
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="animate-pulse tracking-wide font-semibold text-white/90">
                                {t('common.generating', '正在生成...')}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5 fill-white/20 text-white z-10 animate-pulse" />
                            <span className="tracking-wide text-shadow-sm font-semibold text-white z-10">
                                {t('common.generate', '开始生成')}
                            </span>
                        </div>
                    )}
                    
                    {/* Shimmer Effect */}
                    {!isGenerating && (
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
                    )}
                </Button>
            </motion.div>

            <motion.div 
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
                <Button
                    variant="outline"
                    className="h-[60px] w-[60px] rounded-2xl border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 shadow-[0_0_15px_-5px_rgba(99,102,241,0.3)] transition-all duration-300 flex-shrink-0"
                    onClick={() => setPushDialogOpen(true)}
                >
                    <MonitorUp className="w-6 h-6 text-indigo-500" />
                </Button>
            </motion.div>

            <MobilePushToPCDialog 
                open={pushDialogOpen} 
                onOpenChange={setPushDialogOpen} 
            />
        </div>
    );
}
