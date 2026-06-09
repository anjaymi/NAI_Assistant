import React from 'react';
import { motion } from 'framer-motion';

export function MobileTagSuggestions() {
    const tags = ['Masterpiece', 'Best Quality', '8k', 'Cinematic', 'Beautiful Lighting', 'Detailed Anime'];
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-2 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pl-1 pr-6"
        >
            {tags.map((tag, idx) => (
                <motion.button 
                    key={tag}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + idx * 0.05 }}
                    className="px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 whitespace-nowrap active:bg-slate-100 transition-all hover:text-slate-900 shadow-sm dark:shadow-none dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:active:bg-white/10 dark:hover:text-white"
                >
                    + {tag}
                </motion.button>
            ))}
        </motion.div>
    );
}
