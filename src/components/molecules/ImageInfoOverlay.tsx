import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ImageInfoOverlayProps {
    width: number
    height: number
    seed: number
    className?: string
}

export function ImageInfoOverlay({ width, height, seed, className }: ImageInfoOverlayProps) {
    if (!seed || seed < 0) return null
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 10, x: "-50%" }}
            className={cn(
                "absolute bottom-6 left-1/2",
                "bg-black/60 backdrop-blur-md text-white",
                "px-5 py-2 rounded-full",
                "flex items-center gap-4",
                "text-xs font-mono",
                "border border-white/10 shadow-2xl",
                "pointer-events-none z-20 select-none",
                className
            )}
        >
            <span className="opacity-70 tracking-wider">
                RESOLUTION 
                <span className="text-white opacity-100 font-bold ml-1.5">{width} × {height}</span>
            </span>
            <div className="w-px h-3 bg-white/20" />
            <span className="opacity-70 tracking-wider">
                SEED 
                <span className="text-[#F5C544] opacity-100 font-bold ml-1.5">{seed}</span>
            </span>
        </motion.div>
    )
}
