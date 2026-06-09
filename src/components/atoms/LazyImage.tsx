import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { ImageOff } from 'lucide-react';

interface LazyImageProps extends HTMLMotionProps<'img'> {
    src: string;
    alt: string;
    className?: string;
    placeholderColor?: string;
    threshold?: number;
}

export function LazyImage({ 
    src, 
    alt, 
    className, 
    placeholderColor = "bg-slate-100 dark:bg-slate-800",
    threshold = 0.1,
    ...props 
}: LazyImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, [threshold]);

    return (
        <div 
            ref={imgRef} 
            className={cn("relative overflow-hidden", placeholderColor, className)}
        >
            <AnimatePresence>
                {/* Optimized Loading Placeholder / Error State */}
                {(!isLoaded || hasError) && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 flex items-center justify-center z-10"
                    >
                        {hasError ? (
                            <ImageOff className="w-6 h-6 text-slate-400 opacity-50" />
                        ) : (
                            <div className="w-full h-full animate-pulse bg-slate-200 dark:bg-slate-700" />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {isInView && !hasError && (
                <motion.img
                    src={src}
                    alt={alt}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ 
                        opacity: isLoaded ? 1 : 0,
                        scale: isLoaded ? 1 : 1.05
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setHasError(true)}
                    className={cn("w-full h-full object-cover", className)}
                    {...props}
                />
            )}
        </div>
    );
}
