import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Copy, Search, AlignLeft, Tags } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { ScrollArea } from '@/components/atoms/ScrollArea';
import { toast } from '@/hooks/use-toast';
import { type TagCategoryData } from '@/components/features/prompt/tag-editor/types';

// Let's bring in the same category logic but adapt the UI for mobile sliding views
import { TagCategorySidebar } from '@/components/features/prompt/tag-editor/TagCategorySidebar';
import { TagGrid } from '@/components/features/prompt/tag-editor/TagGrid';

interface MobileTagEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialTags: string[];
    onUpdate: (tags: string[]) => void;
    title?: string;
}

export function MobileTagEditorDialog({ open, onOpenChange, initialTags, onUpdate, title }: MobileTagEditorDialogProps) {
    const { t } = useTranslation();
    const [tags, setTags] = useState<string[]>([]);
    
    // Category Browsing State
    const [categories, setCategories] = useState<TagCategoryData>({});
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Text Mode State
    const [isTextMode, setIsTextMode] = useState(false);
    const [textValue, setTextValue] = useState("");

    // Initialize state from props
    useEffect(() => {
        if (open) {
            setTags(initialTags);
        }
    }, [initialTags, open]);

    // Load data dynamically
    useEffect(() => {
        if (open && !isDataLoaded) {
            import('@/assets/tag_categories.json').then((module) => {
                // @ts-ignore
                const cats = module.default as TagCategoryData;
                setCategories(cats);
                const firstCat = Object.keys(cats)[0];
                if (firstCat) setSelectedCategory(firstCat);
                setIsDataLoaded(true);
            }).catch(err => console.error("Failed to load categories", err));
        }
    }, [open, isDataLoaded]);

    const handleAddTag = (value: string) => {
        if (!value) return;
        
        // Handle comma separation
        const newTags = value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        const updatedTags = [...tags];
        
        newTags.forEach(tag => {
            if (!updatedTags.includes(tag)) {
                updatedTags.push(tag);
            }
        });

        setTags(updatedTags);
        onUpdate(updatedTags);
    };

    const removeTag = (tToRemove: string) => {
        const updatedTags = tags.filter(t => t !== tToRemove);
        setTags(updatedTags);
        onUpdate(updatedTags);
    };

    const clearAll = () => {
        setTags([]);
        onUpdate([]);
    };

    const copyAll = () => {
        navigator.clipboard.writeText(tags.join(', '));
        toast({ title: t('common.copied', 'Copied to clipboard') });
    };

    const toggleTextMode = () => {
        if (!isTextMode) {
            setTextValue(tags.join(', '));
            setIsTextMode(true);
        } else {
            handleParseTextValue();
        }
    };

    const handleParseTextValue = () => {
        const newTags = textValue.split(/[,，\n]/).map(t => t.trim()).filter(Boolean);
        const uniqueTags = Array.from(new Set(newTags));
        setTags(uniqueTags);
        onUpdate(uniqueTags);
        setIsTextMode(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            handleAddTag(searchQuery.trim());
            setSearchQuery("");
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => onOpenChange(false)}
                        className="fixed inset-0 bg-black/80 z-[100]"
                    />
                    
                    {/* Sheet */}
                    <motion.div 
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 h-[90vh] bg-zinc-950 border-t border-white/10 rounded-t-3xl z-[101] flex flex-col overflow-hidden shadow-2xl"
                    >
                        {/* Handle */}
                        <div className="w-full flex justify-center pt-3 pb-1 shrink-0" onClick={() => onOpenChange(false)}>
                            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                        </div>
                        
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-2 shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-wide">{title || t('prompt.editTags', '编辑标签')}</h2>
                                <p className="text-xs text-white/40 font-medium">
                                    {t('prompt.selected', '{{count}} 个已选', { count: tags.length })}
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    className={`p-2 rounded-full transition-colors ${isTextMode ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/60 hover:text-white bg-white/5 active:bg-white/10'}`} 
                                    onClick={toggleTextMode}
                                >
                                    {isTextMode ? <Tags className="w-4 h-4" /> : <AlignLeft className="w-4 h-4" />}
                                </button>
                                <button className="p-2 text-white/60 hover:text-white rounded-full bg-white/5 active:bg-white/10 transition-colors" onClick={copyAll}>
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-destructive/80 hover:text-destructive rounded-full bg-destructive/10 active:bg-destructive/20 transition-colors" onClick={clearAll}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Selected Tags Area */}
                        <div className="shrink-0 px-5 pt-2 pb-4">
                            <div className="min-h-[80px] max-h-[140px] flex flex-col border border-white/10 rounded-2xl bg-white/[0.02] p-3 shadow-inner overflow-hidden">
                                {isTextMode ? (
                                    <textarea
                                        value={textValue}
                                        onChange={(e) => setTextValue(e.target.value)}
                                        onBlur={handleParseTextValue}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleParseTextValue();
                                            }
                                        }}
                                        autoFocus
                                        placeholder={t('prompt.textModePlaceholder', 'Enter tags separated by commas...')}
                                        className="w-full h-full min-h-[50px] bg-transparent text-sm text-gray-200 resize-none outline-none placeholder:text-white/30"
                                    />
                                ) : (
                                    <div className="flex flex-wrap gap-2 overflow-y-auto w-full h-full">
                                        {tags.map((tag, index) => (
                                            <Badge key={`${tag}-${index}`} variant="secondary" className="pl-3 pr-1.5 h-8 flex items-center gap-1.5 bg-white/10 text-gray-200 border-white/5 text-sm animate-in fade-in zoom-in duration-200">
                                                <span className="max-w-[200px] truncate" title={tag}>{tag}</span>
                                                <button 
                                                    onClick={() => removeTag(tag)}
                                                    className="h-full px-1 hover:text-red-400 transition-colors opacity-50 hover:opacity-100"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </Badge>
                                        ))}
                                        {tags.length === 0 && (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-white/30 gap-2 min-h-[40px]">
                                                <span className="text-sm italic">{t('prompt.noTags', '暂无标签')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Main Content Area (Categories + Tags) */}
                        <div className="flex-1 flex flex-col min-h-0 border-t border-white/5">
                            <div className="flex flex-1 min-h-0">
                                {/* Sidebar for Categories */}
                                <div className="w-[100px] sm:w-[120px] border-r border-white/5 bg-white/[0.01]">
                                    <TagCategorySidebar 
                                        categories={categories} 
                                        selectedCategory={selectedCategory} 
                                        onSelectCategory={setSelectedCategory} 
                                    />
                                </div>
                                
                                {/* Tags Grid */}
                                <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-transparent overflow-hidden relative">
                                    <TagGrid 
                                        tags={selectedCategory ? categories[selectedCategory] : []} 
                                        onTagSelect={handleAddTag}
                                        isLoading={!isDataLoaded}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Search / Add input fixed at bottom */}
                        <div className="shrink-0 p-4 border-t border-white/5 bg-zinc-950 pb-safe">
                            <form onSubmit={handleSearch} className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('prompt.addTagPlaceholder', '搜索或添加自定义标签...')}
                                    className="w-full h-12 pl-11 pr-12 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-white/10 transition-all placeholder:text-white/30"
                                />
                                {searchQuery && (
                                    <button 
                                        type="submit"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                                    >
                                        添加
                                    </button>
                                )}
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
