import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type TagData } from "./types";
import { motion, AnimatePresence } from "framer-motion";

interface TagSearchProps {
    onAddTag: (tag: string) => void;
    placeholder?: string;
}

export function TagSearch({ onAddTag, placeholder }: TagSearchProps) {
    const [inputValue, setInputValue] = useState("");
    const [suggestions, setSuggestions] = useState<TagData[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    
    const allTagsRef = useRef<TagData[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionRef = useRef<HTMLDivElement>(null);

    // Load data dynamically from CSV
    useEffect(() => {
        if (!isDataLoaded) {
            fetch('/plugins/magic-tag/tags.csv')
                .then(response => response.text())
                .then(text => {
                    const lines = text.split('\n').slice(1); // Skip header: en,cn,count,r18
                    const parsedTags: TagData[] = lines.map(line => {
                        // Handle quoted CSV fields if necessary, but simple split might suffice for this specific file structure
                        // The file format seems to be: value,cn_label,count,r18
                        // We need to be careful about commas inside quotes
                        const parts = line.split(',');
                        if (parts.length >= 2) {
                            return {
                                label: parts[1] || parts[0], // Use CN as label if available
                                value: parts[0],
                                count: Number(parts[2] || 0),
                                type: 'general' // Default type
                            };
                        }
                        return null;
                    }).filter((t): t is TagData => t !== null);
                    
                    allTagsRef.current = parsedTags;
                    setIsDataLoaded(true);
                })
                .catch(err => console.error("Failed to load tags.csv", err));
        }
    }, [isDataLoaded]);

    // Filter suggestions
    useEffect(() => {
        if (!inputValue.trim() || !isDataLoaded) {
            setSuggestions([]);
            return;
        }
        
        const lowerInput = inputValue.toLowerCase().trim();
        const matches = allTagsRef.current
            .filter(t => 
                t.value.toLowerCase().includes(lowerInput) || 
                t.label.includes(lowerInput)
            )
            .slice(0, 50);
            
        setSuggestions(matches);
        setSelectedIndex(0);
    }, [inputValue, isDataLoaded]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestions.length > 0) {
                 handleAdd(suggestions[selectedIndex].value);
            } else {
                 handleAdd();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        }
    };

    const handleAdd = (value?: string) => {
        const tag = value || inputValue.trim();
        if (tag) {
            onAddTag(tag);
            setInputValue("");
            setSuggestions([]);
            inputRef.current?.focus();
        }
    };

    return (
        <div className="relative shrink-0 z-50 px-2 pb-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Input 
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="h-11 rounded-xl text-sm bg-black/60 border-white/10 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary/50 transition-all shadow-sm pl-4"
                    />
                </div>
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                    <Button 
                        size="icon" 
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            const x = e.clientX - rect.left
                            const y = e.clientY - rect.top
                            e.currentTarget.style.setProperty('--mouse-x', `${x}px`)
                            e.currentTarget.style.setProperty('--mouse-y', `${y}px`)
                        }}
                        className="group relative overflow-hidden h-11 w-11 shrink-0 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 transition-all shadow-[0_0_15px_-3px_rgba(var(--primary),0.3)] hover:shadow-[0_0_20px_0_rgba(var(--primary),0.4)]" 
                        onClick={() => handleAdd()}
                    >
                        {/* Spotlight glow on hover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 mix-blend-screen transition-opacity duration-300 pointer-events-none"
                             style={{
                                 background: `radial-gradient(40px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.4), transparent 100%)`
                             }} />
                        <Plus className="relative z-10 h-5 w-5" />
                    </Button>
                </motion.div>
            </div>
            
            {/* Suggestions Popover */}
            <AnimatePresence>
                {suggestions.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="absolute bottom-full mb-2 left-2 right-2 bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-h-[300px] overflow-y-auto z-50"
                    >
                            {suggestions.map((suggestion, index) => (
                                <div 
                                key={suggestion.value}
                                ref={index === selectedIndex ? suggestionRef : null}
                                className={cn(
                                    "px-4 py-2.5 text-sm cursor-pointer flex justify-between items-center border-b border-white/5 last:border-0 transition-all duration-150",
                                    index === selectedIndex 
                                        ? 'bg-primary/20 text-primary pl-6 border-l-2 border-primary' 
                                        : 'hover:bg-white/5 text-muted-foreground hover:text-gray-200 hover:pl-5 border-l-2 border-transparent'
                                )}
                                onClick={() => handleAdd(suggestion.value)}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-200">{suggestion.label}</span>
                                        {suggestion.value !== suggestion.label && (
                                            <span className="text-[10px] text-muted-foreground font-mono">{suggestion.value}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-wider opacity-50 border px-1.5 py-0.5 rounded border-white/10">{suggestion.type}</span>
                                    <span className="text-xs font-mono opacity-40">{Number(suggestion.count).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
