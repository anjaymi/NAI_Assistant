import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function MobileToolsHeader() {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-between px-6 py-4 pt-12 pb-2">
            <div>
                 <motion.h1 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-white/60"
                 >
                    {t('smartTools.title', 'Smart Tools')}
                 </motion.h1>
                 <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-xs text-slate-500 dark:text-white/40 font-medium tracking-wide uppercase mt-0.5"
                 >
                    AI Enhancement
                 </motion.p>
            </div>
            <motion.button 
                whileTap={{ scale: 0.9 }}
                className="p-2.5 text-slate-500 hover:text-slate-800 bg-white/50 border border-slate-200 active:bg-slate-100 dark:text-white/40 dark:hover:text-white rounded-full dark:bg-white/5 dark:border-transparent dark:active:bg-white/15 transition-all outline-none shadow-sm"
            >
                <Wand2 className="w-5 h-5" />
            </motion.button>
        </div>
    );
}
