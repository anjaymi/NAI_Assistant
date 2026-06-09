import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Puzzle, Globe, Plus, Download, RefreshCw, Upload, CheckSquare, Save, Trash2, X, ChevronLeft, FileText, User, ArrowDown } from 'lucide-react';

import { Input } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';
import { AutocompleteTextarea } from '@/components/ui/AutocompleteTextarea';
import { useWildcardStore } from '@/stores/wildcard-store';
import { communityService, CommunityWildcard } from '@/services/community-service';
import { useSync } from '@/context/SyncContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


interface MobileWildcardPanelProps {
    onInsert: (tag: string) => void;
    onClose: () => void;
}

export function MobileWildcardPanel({ onInsert, onClose }: MobileWildcardPanelProps) {
    const { t } = useTranslation();
    const { token, isLoggedIn } = useSync();
    const { files, refreshFromDB, readFile, saveFile, createFile, createFileFromContent, deleteFile } = useWildcardStore();

    // Mode: Local vs Community
    const [activeTab, setActiveTab] = useState<'local' | 'community'>('local');
    const [searchQuery, setSearchQuery] = useState('');

    // Local State
    const [isCreating, setIsCreating] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    
    // Community State
    const [communityFiles, setCommunityFiles] = useState<CommunityWildcard[]>([]);
    const [isLoadingCommunity, setIsLoadingCommunity] = useState(false);
    
    // Sheet State (Viewing Details/Editing)
    const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null);
    const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
    
    // Editor State
    const [content, setContent] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    // Initial load
    useEffect(() => {
        refreshFromDB();
    }, []);

    // Load Community Files
    useEffect(() => {
        if (activeTab === 'community') {
            loadCommunityFiles();
        }
    }, [activeTab, searchQuery]);

    const loadCommunityFiles = async () => {
        setIsLoadingCommunity(true);
        try {
            const results = await communityService.listWildcards(50, 0, searchQuery);
            setCommunityFiles(results);
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to load community wildcards", variant: "destructive" });
        } finally {
            setIsLoadingCommunity(false);
        }
    };

    // Actions
    const handleCreate = async () => {
        if (!newFileName.trim()) return;
        try {
            await createFile(newFileName.trim());
            setNewFileName('');
            setIsCreating(false);
            toast({ title: t('common.success'), description: 'Wildcard created successfully' });
        } catch (error) {
            toast({ title: "Error", description: "Failed to create wildcard", variant: "destructive" });
        }
    };

    const handleOpenLocal = async (id: string) => {
        setSelectedLocalId(id);
        const text = await readFile(id);
        setContent(text);
        setHasChanges(false);
    };

    const handleSave = async () => {
        if (!selectedLocalId) return;
        await saveFile(selectedLocalId, content);
        setHasChanges(false);
        toast({ title: t('wildcard.saved', 'Saved'), description: t('wildcard.savedDesc', 'Wildcard file saved successfully.') });
    };

    const handleDelete = async () => {
         if (!selectedLocalId) return;
         await deleteFile(selectedLocalId);
         setSelectedLocalId(null);
         toast({ title: t('common.success'), description: 'Deleted wildcard' });
    };

    const handlePublish = async () => {
        if (!isLoggedIn || !token) {
            toast({ title: t('wildcard.loginRequired'), description: t('wildcard.loginRequiredDesc'), variant: "destructive" });
            return;
        }
        if (!selectedLocalId) return;
        
        const file = files.find(f => f.id === selectedLocalId);
        if (!file) return;

        setIsPublishing(true);
        try {
            await communityService.publishWildcard(token, {
                name: file.name,
                content: content, // use current editor content
                description: `Published by ${file.name}`,
                tags: ""
            });
            toast({ title: t('wildcard.publishSuccess'), description: t('wildcard.publishSuccessDesc') });
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to publish", variant: "destructive" });
        } finally {
            setIsPublishing(false);
        }
    };

    const handleDownload = async (wc: CommunityWildcard) => {
        try {
            const existing = files.find(f => f.name === wc.name);
            if (existing) {
                toast({ title: t('wildcard.exists'), description: t('wildcard.existsDesc') });
                return;
            }

            const fullWc = await communityService.getWildcardDetails(wc.id);
            if (!fullWc || fullWc.content === undefined) throw new Error("Failed to download content");
            
            await createFileFromContent(wc.name, fullWc.content);
            toast({ title: t('wildcard.downloadSuccess'), description: `${t('wildcard.downloadSuccessDesc')}: ${wc.name}` });
            setSelectedCommunityId(null); // close sheet
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to download", variant: "destructive" });
        }
    };

    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden relative">
            {/* Header */}
            <div className="relative z-20 flex-none pb-4 pt-[env(safe-area-inset-top,0px)] bg-zinc-950 border-b border-white/10 rounded-b-3xl">
                <div className="flex items-center justify-between px-4 py-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-white/70" onClick={onClose}>
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <h2 className="text-lg font-bold text-white tracking-tight">{t('wildcard.title', 'Wildcards')}</h2>
                    <Button variant="ghost" size="icon" className="h-10 w-10 opacity-0 pointer-events-none" />
                </div>

                {/* Segmented Control */}
                <div className="px-4 mt-2">
                    <div className="flex p-1 bg-white/10 backdrop-blur-md rounded-full relative">
                        {/* Sliding Indicator */}
                        <motion.div 
                            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-md"
                            animate={{ x: activeTab === 'local' ? 0 : '100%' }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                        <button
                            className={cn("flex-1 py-1.5 text-sm font-semibold rounded-full z-10 transition-colors", activeTab === 'local' ? "text-black" : "text-white/70")}
                            onClick={() => { setActiveTab('local'); setSearchQuery(''); }}
                        >
                            {t('wildcard.local', 'Local')}
                        </button>
                        <button
                            className={cn("flex-1 py-1.5 text-sm font-semibold rounded-full z-10 transition-colors", activeTab === 'community' ? "text-black" : "text-white/70")}
                            onClick={() => { setActiveTab('community'); setSearchQuery(''); }}
                        >
                            {t('wildcard.community', 'Community')}
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="px-4 mt-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                        <Input 
                            className="h-12 pl-10 bg-white/[0.02] border-white/5 text-white rounded-[16px] focus-visible:ring-1 focus-visible:ring-white/30 text-base"
                            placeholder={activeTab === 'local' ? t('wildcard.searchLocal', 'Search Local...') : t('wildcard.searchCommunity', 'Search Community...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto w-full px-4 pt-4 pb-[calc(110px+env(safe-area-inset-bottom,0px))]">
                {activeTab === 'local' && (
                    <div className="space-y-2">
                        {isCreating && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-2 mb-4">
                                <Input 
                                    className="h-12 text-sm bg-white/10 border-white/20 text-white rounded-xl flex-1" 
                                    placeholder="Enter filename..." 
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                                />
                                <Button className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold" onClick={handleCreate}>
                                    {t('common.add', 'Add')}
                                </Button>
                            </motion.div>
                        )}
                        
                        {filteredFiles.length === 0 && !isCreating ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-white/40">
                                <Puzzle className="h-12 w-12 mb-4 opacity-50" />
                                <p className="text-base font-medium">{t('wildcard.noWildcards', 'No wildcards found')}</p>
                            </div>
                        ) : (
                            filteredFiles.map(file => {
                                const displayName = file.name.replace(/\.txt$/i, '');
                                return (
                                    <motion.div 
                                        key={file.id} 
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center justify-between p-4 bg-white/[0.02] rounded-[16px] active:bg-white/5 transition-colors border border-white/5"
                                        onClick={() => handleOpenLocal(file.id)}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="h-10 w-10 flex items-center justify-center bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
                                                <Puzzle className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-semibold text-white truncate text-base">{displayName}</span>
                                                <span className="text-[11px] text-white/40 block mt-0.5 truncate uppercase tracking-wider font-medium">{t('tools.analyzeTags', 'Analyze tags from image')}</span>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="secondary" 
                                            className="h-8 px-3 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 shrink-0 ml-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onInsert(`__${displayName}__`);
                                                onClose();
                                            }}
                                        >
                                            {t('common.use', 'Use')}
                                        </Button>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === 'community' && (
                    <div className="space-y-4">
                        {isLoadingCommunity ? (
                            <div className="flex justify-center py-12">
                                <RefreshCw className="h-8 w-8 text-white/20 animate-spin" />
                            </div>
                        ) : communityFiles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-white/40">
                                <Globe className="h-12 w-12 mb-4 opacity-50" />
                                <p className="text-base font-medium">{t('wildcard.noFiles', 'No files found')}</p>
                            </div>
                        ) : (
                            communityFiles.map(wc => (
                                <motion.div 
                                    key={wc.id} 
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full flex items-center justify-between p-4 bg-white/[0.02] rounded-[16px] active:bg-white/5 transition-colors border border-white/5"
                                    onClick={() => setSelectedCommunityId(wc.id)}
                                >
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="font-bold text-white text-base truncate pr-2">{wc.name}</span>
                                        <div className="flex items-center gap-3 text-xs text-white/50 mt-1">
                                            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {wc.author_name}</span>
                                            <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" /> {wc.downloads}</span>
                                        </div>
                                    </div>
                                    <div className="h-10 w-10 flex items-center justify-center bg-zinc-800 rounded-xl text-white/60 shrink-0">
                                        <ChevronLeft className="h-5 w-5 rotate-180" />
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Local Default FAB */}
            {activeTab === 'local' && !isCreating && (
                <div className="absolute bottom-[calc(20px+env(safe-area-inset-bottom,0px))] right-6 z-30">
                     <motion.button
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        className="h-14 w-14 rounded-full bg-blue-600 text-white shadow-xl shadow-blue-500/30 flex items-center justify-center"
                        onClick={() => setIsCreating(true)}
                     >
                         <Plus className="h-6 w-6" />
                     </motion.button>
                </div>
            )}

            {/* Local Edit Sheet */}
            <AnimatePresence>
                {selectedLocalId && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 z-40"
                            onClick={() => setSelectedLocalId(null)}
                        />
                        <motion.div
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-x-0 bottom-0 h-[85dvh] bg-zinc-950 rounded-t-[32px] border-t border-white/10 z-50 flex flex-col shadow-2xl"
                        >
                            <div className="w-full flex justify-center py-3 shrink-0" onClick={() => setSelectedLocalId(null)}>
                                <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                            </div>
                            
                            <div className="px-5 pb-4 border-b border-white/10 flex items-center justify-between shrink-0">
                                <div className="flex flex-col min-w-0 pr-4">
                                     <h3 className="text-xl font-bold text-white truncate">
                                         {files.find(f => f.id === selectedLocalId)?.name.replace(/\.txt$/i, '')}
                                     </h3>
                                     <p className="text-sm text-white/50">{t('wildcard.editWildcard', 'Edit Wildcard')}</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                     <Button size="icon" variant="ghost" className="h-10 w-10 bg-white/5 text-white/80 rounded-full" onClick={handlePublish}>
                                         <Upload className="h-5 w-5" />
                                     </Button>
                                     <Button size="icon" variant="ghost" className="h-10 w-10 bg-red-500/10 text-red-500 rounded-full" onClick={handleDelete}>
                                         <Trash2 className="h-5 w-5" />
                                     </Button>
                                </div>
                            </div>

                            <div className="flex-1 p-5 overflow-hidden flex flex-col relative w-full">
                                <div className="flex-1 w-full bg-black/40 border border-white/10 rounded-2xl relative overflow-hidden flex flex-col">
                                     <AutocompleteTextarea 
                                         className="flex-1 w-full p-4 resize-none bg-transparent border-0 outline-none text-white font-mono text-sm leading-6 custom-scrollbar"
                                         value={content}
                                         onChange={(e) => {
                                             setContent(e.target.value);
                                             setHasChanges(true);
                                         }}
                                         spellCheck={false}
                                         style={{ boxSizing: 'border-box' }}
                                     />
                                </div>
                            </div>

                            <div className="p-5 pt-0 pb-[calc(20px+env(safe-area-inset-bottom,0px))] mt-2 shrink-0 w-full">
                                <Button 
                                    className="w-full h-14 rounded-2xl font-bold text-lg"
                                    onClick={handleSave}
                                    disabled={!hasChanges}
                                    variant={hasChanges ? "default" : "secondary"}
                                >
                                    {hasChanges ? t('common.save', 'Save Changes') : t('common.saved', 'Saved')}
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Community View Sheet */}
            <AnimatePresence>
                {selectedCommunityId && (() => {
                    const wc = communityFiles.find(f => f.id === selectedCommunityId);
                    if (!wc) return null;
                    return (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/80 z-40"
                                onClick={() => setSelectedCommunityId(null)}
                            />
                            <motion.div
                                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed inset-x-0 bottom-0 max-h-[85dvh] bg-zinc-950 rounded-t-[32px] border-t border-white/10 z-50 flex flex-col shadow-2xl"
                            >
                                <div className="w-full flex justify-center py-3 shrink-0" onClick={() => setSelectedCommunityId(null)}>
                                    <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                                </div>
                                
                                <div className="px-6 pb-2 shrink-0">
                                    <h3 className="text-2xl font-bold text-white mb-2">{wc.name}</h3>
                                    <div className="flex gap-4 text-sm text-white/50 mb-4">
                                        <span className="flex items-center gap-1.5"><User className="h-4 w-4"/> {wc.author_name}</span>
                                        <span className="flex items-center gap-1.5"><Download className="h-4 w-4"/> {wc.downloads}</span>
                                    </div>
                                    {wc.description && (
                                         <p className="text-sm text-white/80 mb-4 leading-relaxed">{wc.description}</p>
                                    )}
                                </div>

                                <div className="px-6 pb-4 flex-1 overflow-auto">
                                    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4">
                                         <h4 className="text-xs font-bold uppercase text-white/40 mb-3">{t('common.preview', 'Preview')}</h4>
                                         <div className="font-mono text-xs text-white/70 whitespace-pre-wrap leading-6">
                                              {(wc.content || '').length > 300 ? (wc.content || '').slice(0, 300) + '...' : (wc.content || 'No preview available')}
                                         </div>
                                    </div>
                                </div>

                                <div className="p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] shrink-0 w-full bg-zinc-950 border-t border-white/5">
                                    <Button 
                                        className="w-full h-14 rounded-2xl font-bold text-lg bg-blue-600 hover:bg-blue-500 text-white"
                                        onClick={() => handleDownload(wc)}
                                    >
                                        <Download className="mr-2 h-5 w-5" /> Import Wildcard
                                    </Button>
                                </div>
                            </motion.div>
                        </>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}
