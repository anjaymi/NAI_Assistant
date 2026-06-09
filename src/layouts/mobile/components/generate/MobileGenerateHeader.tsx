import React, { lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/atoms/ScrollArea';
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary';

const MobileGenerationSettingsPanel = lazy(() => import('./MobileGenerationSettingsPanel').then((module) => ({ default: module.MobileGenerationSettingsPanel })));

export function MobileGenerateHeader() {
    const { t } = useTranslation();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <>
            <div className="flex items-center justify-between px-6 py-4 pt-12 pb-2 z-10 w-full">
                <div className="flex items-center gap-3">
                    {/* App Logo */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-white/10 shrink-0"
                    >
                        <img src="/app-icon.png" alt="Logo" className="w-full h-full object-cover" />
                    </motion.div>
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-white/60"
                        >
                            {t('common.generate', 'Generate')}
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-xs text-slate-500 dark:text-white/40 font-medium tracking-wide uppercase mt-0.5"
                        >
                            Creative Studio
                        </motion.p>
                    </div>
                </div>
                <motion.button
                    whileTap={{ scale: 0.92 }}
                    className="p-3 text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white rounded-[18px] bg-white/50 backdrop-blur-md border border-white/40 dark:bg-white/10 dark:border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all outline-none"
                    onClick={() => setIsSettingsOpen(true)}
                >
                    <Settings2 className="w-5 h-5" />
                </motion.button>
            </div>

            {/* Generate Settings Bottom Sheet */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSettingsOpen(false)}
                            className="fixed inset-0 bg-black/80 z-[100]"
                        />

                        {/* Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-white/70 dark:bg-black/60 backdrop-blur-3xl border-t border-white/20 dark:border-white/10 rounded-t-[32px] z-[101] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
                        >
                            {/* Handle */}
                            <div className="w-full flex justify-center pt-4 pb-2 shrink-0" onClick={() => setIsSettingsOpen(false)}>
                                <div className="w-12 h-1 bg-black/20 dark:bg-white/20 rounded-full" />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-2 shrink-0">
                                <h2 className="text-[13px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">Generate Settings</h2>
                                <motion.button
                                    onClick={() => setIsSettingsOpen(false)}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </motion.button>
                            </div>

                            {/* Content */}
                            <ScrollArea className="flex-1">
                                <div className="p-6 space-y-6 pb-safe">
                                    <section>
                                        <LazyModuleBoundary className="min-h-[280px]" label="Loading generation settings...">
                                            <MobileGenerationSettingsPanel />
                                        </LazyModuleBoundary>
                                    </section>
                                </div>
                            </ScrollArea>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
