import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { X, Trash2, Copy, AlignLeft, Tags } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { TagCategorySidebar } from './tag-editor/TagCategorySidebar';
import { TagGrid } from './tag-editor/TagGrid';
import { TagSearch } from './tag-editor/TagSearch';
import { type TagCategoryData } from './tag-editor/types';
import { DialogClose } from '@/components/atoms/Dialog';

interface SimpleTagEditorProps {
    initialTags: string[];
    onUpdate: (tags: string[]) => void;
}

export function SimpleTagEditor({ initialTags, onUpdate }: SimpleTagEditorProps) {
    const { t } = useTranslation();
    const [tags, setTags] = useState<string[]>([]);
    
    // Category Browsing State
    const [categories, setCategories] = useState<TagCategoryData>({});
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // Text Mode State
    const [isTextMode, setIsTextMode] = useState(false);
    const [textValue, setTextValue] = useState("");
    
    // Initialize state from props
    useEffect(() => {
        setTags(initialTags);
    }, [initialTags]);

    // Load data dynamically
    useEffect(() => {
        if (!isDataLoaded) {
            import('@/assets/tag_categories.json').then((module) => {
                // @ts-ignore
                const cats = module.default as TagCategoryData;
                setCategories(cats);
                const firstCat = Object.keys(cats)[0];
                if (firstCat) setSelectedCategory(firstCat);
                setIsDataLoaded(true);
            }).catch(err => console.error("Failed to load categories", err));
        }
    }, [isDataLoaded]);

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
            // Switch to text mode: sync current tags to text value
            setTextValue(tags.join(', '));
            setIsTextMode(true);
        } else {
            // Switch back to tag mode: parse text value
            handleParseTextValue();
        }
    };

    const handleParseTextValue = () => {
        const newTags = textValue.split(/[,，\n]/).map(t => t.trim()).filter(Boolean);
        // Only keep unique tags
        const uniqueTags = Array.from(new Set(newTags));
        setTags(uniqueTags);
        onUpdate(uniqueTags);
        setIsTextMode(false);
    };

    return (
        <div className="flex flex-col gap-4 w-[1000px] h-[650px] max-h-[85vh] p-2 border border-white/10 rounded-2xl bg-[#0a0a0a]/95 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/5 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">

            {/* Header */}
            <div className="flex items-center justify-between shrink-0 px-2 pt-1">
                <div className="flex items-center gap-3">
                    <h4 className="font-bold text-lg tracking-tight text-white/90">{t('prompt.editTags', '编辑标签')}</h4>
                    <span className="text-xs font-medium text-muted-foreground bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full">
                        {t('prompt.selected', '{{count}} 个已选', { count: tags.length })}
                    </span>
                </div>
                <div className="flex gap-1">
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`h-9 w-9 rounded-full ${isTextMode ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-white/5'}`} 
                        onClick={toggleTextMode} 
                        title={isTextMode ? t('prompt.badgeMode', 'Switch to Badge Mode') : t('prompt.textMode', 'Edit as Text')}
                    >
                        {isTextMode ? <Tags className="h-4.5 w-4.5" /> : <AlignLeft className="h-4.5 w-4.5" />}
                    </Button>
                     <Button variant="ghost" size="sm" className="h-9 w-9 hover:bg-white/5 rounded-full" onClick={copyAll} title={t('common.copy', 'Copy')}>
                        <Copy className="h-4.5 w-4.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 w-9 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={clearAll} title={t('common.clear', 'Clear')}>
                        <Trash2 className="h-4.5 w-4.5" />
                    </Button>
                    <DialogClose asChild>
                        <Button variant="ghost" size="sm" className="h-9 w-9 hover:bg-white/10 hover:text-white rounded-full" title={t('common.close', 'Close')}>
                            <X className="h-4.5 w-4.5" />
                        </Button>
                    </DialogClose>
                </div>
            </div>

            {/* Selected Tags Area */}
            <div className="shrink-0 min-h-[80px] max-h-[140px] border border-white/5 rounded-xl bg-black/20 p-4 shadow-inner mx-2 overflow-hidden flex flex-col">
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
                        placeholder={t('prompt.textModePlaceholder', 'Enter tags separated by commas. Press Enter to apply.')}
                        className="w-full h-full min-h-[50px] bg-transparent text-sm text-gray-200 resize-none outline-none placeholder:text-muted-foreground/40 custom-scrollbar"
                    />
                ) : (
                    <div className="flex flex-wrap gap-2 overflow-y-auto custom-scrollbar h-full">
                        {tags.map((tag, index) => (
                            <Badge key={`${tag}-${index}`} variant="secondary" className="pl-3 pr-1.5 h-8 flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-gray-200 border-white/5 transition-all text-sm shadow-sm select-none animate-in fade-in zoom-in duration-200">
                                <span className="max-w-[200px] truncate select-all font-medium" title={tag}>{tag}</span>
                                <button 
                                    onClick={() => removeTag(tag)}
                                    className="h-full px-1.5 hover:text-red-400 transition-colors opacity-50 hover:opacity-100"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </Badge>
                        ))}
                        {tags.length === 0 && (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                                <span className="text-sm italic">{t('prompt.noTags', '暂无标签')}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 flex border border-white/5 rounded-xl overflow-hidden bg-black/40 shadow-inner mx-2 mb-1">
                {/* 固定宽度容器，防止 sidebar 的 w-full 挤掉 TagGrid */}
                <div className="w-[160px] shrink-0">
                    <TagCategorySidebar 
                        categories={categories} 
                        selectedCategory={selectedCategory} 
                        onSelectCategory={setSelectedCategory} 
                    />
                </div>

                <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-transparent overflow-hidden relative">
                    <TagGrid 
                        tags={selectedCategory ? categories[selectedCategory] : []} 
                        onTagSelect={handleAddTag}
                        isLoading={!isDataLoaded}
                    />
                </div>
            </div>

            {/* Footer / Search */}
            <TagSearch 
                onAddTag={handleAddTag} 
                placeholder={t('prompt.addTagPlaceholder', '搜索或添加自定义标签...')}
            />
        </div>
    );
}
