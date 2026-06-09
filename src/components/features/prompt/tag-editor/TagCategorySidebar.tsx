import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/atoms/ScrollArea";
import { type TagCategoryData } from "./types";
import { useTranslation } from 'react-i18next';
import { motion } from "framer-motion";

interface TagCategorySidebarProps {
    categories: TagCategoryData;
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
}

export function TagCategorySidebar({ categories, selectedCategory, onSelectCategory }: TagCategorySidebarProps) {
    const { t } = useTranslation();
    return (
        <div className="w-full h-full flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-md">
             <div className="p-2 md:p-4 pb-2 text-[9px] md:text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest shrink-0 text-center md:text-left">
                {t('prompt.categories', '分类')}
            </div>
            <ScrollArea className="flex-1">
                <div className="p-1 md:p-2 flex flex-col gap-0.5">
                    {Object.keys(categories).map(cat => (
                        <motion.button
                            key={cat}
                            onClick={() => onSelectCategory(cat)}
                            whileHover={{ scale: 1.02, x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const x = e.clientX - rect.left
                                const y = e.clientY - rect.top
                                e.currentTarget.style.setProperty('--mouse-x', `${x}px`)
                                e.currentTarget.style.setProperty('--mouse-y', `${y}px`)
                            }}
                            className={cn(
                                "group relative overflow-hidden text-[11px] md:text-xs text-left px-2 md:px-4 py-2.5 md:py-3 rounded-r-md transition-colors duration-200 truncate font-medium",
                                selectedCategory === cat 
                                    ? "bg-primary/10 text-primary border-l-2 border-primary shadow-[inset_10px_0_20px_-10px_rgba(var(--primary),0.1)]" 
                                    : "text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent"
                            )}
                        >
                            {/* Spotlight glow on hover */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 mix-blend-screen transition-opacity duration-300 pointer-events-none"
                                 style={{
                                     background: `radial-gradient(80px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06), transparent 100%)`
                                 }} />
                                 
                            <span className="relative z-10">{cat}</span>
                            
                            {selectedCategory === cat && (
                                <motion.div 
                                    layoutId="selectedCategoryBg"
                                    className="absolute inset-0 bg-primary/5 -z-10" 
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                />
                            )}
                        </motion.button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
