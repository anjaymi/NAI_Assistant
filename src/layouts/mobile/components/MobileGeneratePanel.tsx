import React from 'react';
import { motion } from 'framer-motion';
import { MobileGenerateHeader } from './generate/MobileGenerateHeader';
import { MobilePreviewCard } from './generate/MobilePreviewCard';
import { MobilePromptControl } from './generate/MobilePromptControl';
import { MobileTagSuggestions } from './generate/MobileTagSuggestions';
import { MobileGenerateFAB } from './generate/MobileGenerateFAB';
import { MobileBatchQueuePanel } from './generate/MobileBatchQueuePanel';
import { MobileInlineGenerateButton } from './generate/MobileInlineGenerateButton';

/** Stagger 入场动画变体 */
const containerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.08, delayChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { 
        opacity: 1, y: 0, 
        transition: { type: "spring" as const, damping: 20, stiffness: 200 } 
    }
};

export function MobileGeneratePanel() {
    return (
        <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-gradient-to-b dark:from-zinc-950 dark:to-black overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
            <MobileGenerateHeader />

            <div className="flex-1 overflow-y-auto pb-28 w-full">
                <motion.div 
                    className="px-5 pt-2 pb-6 flex flex-col items-center gap-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {/* Hero Preview */}
                    <motion.div variants={itemVariants} className="w-full max-w-[400px]">
                        <MobilePreviewCard />
                    </motion.div>
                    
                    {/* Input Area */}
                    <motion.div variants={itemVariants} className="w-full">
                        <MobilePromptControl />
                    </motion.div>
                    
                    {/* Tags Area */}
                    <motion.div variants={itemVariants} className="w-full">
                        <MobileTagSuggestions />
                    </motion.div>

                    {/* Batch Queue Management */}
                    <motion.div variants={itemVariants} className="w-full">
                        <MobileBatchQueuePanel className="mb-4" />
                    </motion.div>

                    {/* Inline Generate Button */}
                    <motion.div variants={itemVariants} className="w-full">
                        <MobileInlineGenerateButton />
                    </motion.div>
                </motion.div>
            </div>

            <MobileGenerateFAB />
        </div>
    );
}
