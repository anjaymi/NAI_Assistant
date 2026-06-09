import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/atoms/ScrollArea";
import { type TagData, type TagCategoryTag } from "./types"; // Define types later
import { motion, AnimatePresence } from "framer-motion";

interface TagGridProps {
    tags: TagCategoryTag[];
    onTagSelect: (tagValue: string) => void;
    isLoading?: boolean;
}

export function TagGrid({ tags, onTagSelect, isLoading }: TagGridProps) {
    if (isLoading) {
        return (
             <div className="flex-1 flex items-center justify-center text-muted-foreground animate-pulse">
                Loading tags...
             </div>
        );
    }

    if (!tags || tags.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground/50 italic">
                Select a category to view tags
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1 h-full w-full bg-transparent absolute inset-0">
            <div className="p-2 md:p-4 grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 pb-20">
                {tags.map((tag, index) => (
                    <motion.button
                        key={`${tag.value}-${index}`}
                        onClick={() => onTagSelect(tag.value)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                            type: "spring", stiffness: 400, damping: 20,
                            opacity: { duration: 0.2, delay: index * 0.015 },
                            y: { duration: 0.3, delay: index * 0.015 }
                        }}
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            const x = e.clientX - rect.left
                            const y = e.clientY - rect.top
                            e.currentTarget.style.setProperty('--mouse-x', `${x}px`)
                            e.currentTarget.style.setProperty('--mouse-y', `${y}px`)
                        }}
                        className="group relative flex flex-col items-start gap-0.5 md:gap-1 p-2.5 md:p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-colors text-left overflow-hidden shadow-sm"
                    >
                        {/* Spotlight Glow Effect */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 mix-blend-screen transition-opacity duration-300 pointer-events-none"
                             style={{
                                 background: `radial-gradient(120px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06), transparent 100%)`
                             }} />
                        
                        <span className="relative z-10 text-xs md:text-sm font-semibold text-gray-200 group-hover:text-primary transition-colors truncate w-full tracking-tight">
                            {tag.cn || tag.label}
                        </span>
                        <span className="relative z-10 text-[9px] md:text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors truncate w-full font-mono select-all">
                            {tag.value}
                        </span>
                    </motion.button>
                ))}
            </div>
        </ScrollArea>
    );
}
