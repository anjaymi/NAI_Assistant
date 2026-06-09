import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface LottieAnimationProps {
    src: string;
    className?: string;
    loop?: boolean;
    autoplay?: boolean;
    speed?: number;
    hoverPlay?: boolean;
}

export function LottieAnimation({
    src,
    className,
    speed = 1,
    hoverPlay = false
}: LottieAnimationProps) {
    const duration = Math.max(1.8 / Math.max(speed, 0.25), 0.8);
    const accentClass = src.includes('825ed996')
        ? 'from-fuchsia-500/35 via-violet-400/20 to-cyan-400/30'
        : 'from-indigo-500/30 via-sky-400/20 to-emerald-400/25';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className={cn('relative flex items-center justify-center overflow-hidden', className)}
        >
            <motion.div
                className={cn(
                    'absolute inset-[12%] rounded-[28%] bg-gradient-to-br blur-xl',
                    accentClass
                )}
                animate={hoverPlay ? undefined : { rotate: [0, 180, 360], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: duration * 3, repeat: Infinity, ease: 'linear' }}
            />

            <motion.div
                className="absolute inset-[22%] rounded-[32%] border border-white/35 dark:border-white/15 bg-white/50 dark:bg-white/5 backdrop-blur-md"
                animate={hoverPlay ? undefined : { rotate: [0, -120, -240, -360] }}
                transition={{ duration: duration * 4, repeat: Infinity, ease: 'linear' }}
            />

            <motion.div
                className="relative z-10 h-[42%] w-[42%] rounded-[24%] border border-white/50 dark:border-white/10 bg-white/75 dark:bg-black/25 shadow-[0_10px_30px_rgba(255,255,255,0.25)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                animate={hoverPlay ? undefined : { y: [0, -4, 0], rotate: [0, 6, -6, 0] }}
                transition={{ duration: duration * 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
                <motion.div
                    className="absolute inset-[24%] rounded-[22%] bg-gradient-to-br from-white/90 via-white/30 to-transparent dark:from-white/20 dark:via-white/5 dark:to-transparent"
                    animate={hoverPlay ? undefined : { opacity: [0.65, 1, 0.65] }}
                    transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
                />
            </motion.div>
        </motion.div>
    );
}
