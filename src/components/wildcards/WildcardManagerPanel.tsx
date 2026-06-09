import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { AutocompleteTextarea } from '@/components/ui/AutocompleteTextarea'
import { useWildcardStore } from '@/stores/wildcard-store'
import { communityService, CommunityWildcard } from '@/services/community-service'
import { useSync } from '@/context/SyncContext'
import {
    FolderOpen,
    FileText,
    Save,
    Plus,
    RefreshCw,
    Search,
    Puzzle,
    Download,
    Globe,
    Upload,
    User,
    Clock,
    ArrowDown,
    CheckSquare,
    Square
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface WildcardManagerPanelProps {
    open?: boolean 
    onClose?: () => void 
    onInsert?: (tag: string) => void
    minimal?: boolean
}

export function WildcardManagerPanel({ onInsert, minimal }: WildcardManagerPanelProps) {
    const { t } = useTranslation()
    const { token, isLoggedIn } = useSync()
    const { 
        rootPath, 
        files, 
        importFromFolder, 
        refreshFromDB, 
        readFile, 
        saveFile, 
        createFile,
        createFileFromContent // Need to add this to Store or replicate
    } = useWildcardStore()

    const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
    const [content, setContent] = useState('')
    const [hasChanges, setHasChanges] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [newFileName, setNewFileName] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    
    // Community State
    const [activeTab, setActiveTab] = useState("local")
    const [communityFiles, setCommunityFiles] = useState<CommunityWildcard[]>([])
    const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null)
    const [communitySearch, setCommunitySearch] = useState('')
    const [isLoadingCommunity, setIsLoadingCommunity] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishProgress, setPublishProgress] = useState({ current: 0, total: 0 })

    // Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const [selectedFileIdsSet, setSelectedFileIdsSet] = useState<Set<string>>(new Set())

    // Initial load
    useEffect(() => {
        refreshFromDB()
    }, [])

    // Load file content when selected (Local)
    useEffect(() => {
        if (activeTab === 'local' && selectedFileId) {
            readFile(selectedFileId).then(text => {
                setContent(text)
                setHasChanges(false)
            })
        } else if (activeTab === 'local') {
            setContent('')
        }
    }, [selectedFileId, activeTab])

    // Load Community Files
    useEffect(() => {
        if (activeTab === 'community') {
            loadCommunityFiles()
        }
    }, [activeTab, communitySearch]) // Reload on tab switch or search

    const loadCommunityFiles = async () => {
        setIsLoadingCommunity(true)
        try {
            const results = await communityService.listWildcards(50, 0, communitySearch)
            setCommunityFiles(results)
        } catch (e) {
            console.error(e)
            toast({ title: "Error", description: "Failed to load community wildcards", variant: "destructive" })
        } finally {
            setIsLoadingCommunity(false)
        }
    }

    const handleSave = async () => {
        if (!selectedFileId) return
        await saveFile(selectedFileId, content)
        setHasChanges(false)
        toast({
            title: t('wildcard.saved', 'Saved'),
            description: t('wildcard.savedDesc', 'Wildcard file saved successfully.')
        })
    }

    const handleCreate = async () => {
        if (!newFileName.trim()) return
        await createFile(newFileName.trim())
        setNewFileName('')
        setIsCreating(false)
    }

    const handlePublish = async () => {
        if (!isLoggedIn || !token) {
            toast({ title: t('wildcard.loginRequired'), description: t('wildcard.loginRequiredDesc'), variant: "destructive" })
            return
        }
        if (!selectedFileId) return
        
        const file = files.find(f => f.id === selectedFileId)
        if (!file) return

        setIsPublishing(true)
        try {
            const remoteFiles = await communityService.listWildcards(1, 0, file.name) // Simple check? No, author check better but API doesn't support yet.
            // Just publish
            const fileContent = await readFile(file.id);
            await communityService.publishWildcard(token, {
                name: file.name,
                content: fileContent,
                description: `Published by ${file.name}`,
                tags: ""
            })
            toast({ title: t('wildcard.publishSuccess'), description: t('wildcard.publishSuccessDesc') })
        } catch (e) {
            console.error(e)
            toast({ title: "Error", description: "Failed to publish", variant: "destructive" })
        } finally {
            setIsPublishing(false)
        }
    }

    const handleBatchPublish = async () => {
        if (!isLoggedIn || !token) {
            toast({ title: t('wildcard.loginRequired'), description: t('wildcard.loginRequiredDesc'), variant: "destructive" })
            return
        }
        
        const filesToPublish = files.filter(f => selectedFileIdsSet.has(f.id))
        if (filesToPublish.length === 0) return

        setIsPublishing(true)
        setPublishProgress({ current: 0, total: filesToPublish.length })
        
        let successCount = 0
        let failCount = 0

        for (let i = 0; i < filesToPublish.length; i++) {
            const file = filesToPublish[i]
            setPublishProgress({ current: i + 1, total: filesToPublish.length })
            
            try {
                const fileContent = await readFile(file.id);
                await communityService.publishWildcard(token, {
                    name: file.name,
                    content: fileContent,
                    description: `Published by ${file.name}`,
                    tags: ""
                })
                successCount++
            } catch (e) {
                console.error(`Failed to publish ${file.name}:`, e)
                failCount++
            }
        }

        setIsPublishing(false)
        setIsSelectionMode(false)
        setSelectedFileIdsSet(new Set())
        
        if (failCount === 0) {
            toast({ title: t('wildcard.publishSuccess'), description: `${t('wildcard.publishSuccessDesc')} (${successCount} files)` })
        } else {
             toast({ 
                title: "Batch Publish Completed", 
                description: `Success: ${successCount}, Failed: ${failCount}`, 
                variant: "default" 
            })
        }
    }

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedFileIdsSet)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedFileIdsSet(newSet)
    }

    const selectAll = () => {
        if (selectedFileIdsSet.size === filteredFiles.length) {
            setSelectedFileIdsSet(new Set())
        } else {
            setSelectedFileIdsSet(new Set(filteredFiles.map(f => f.id)))
        }
    }

    const handleDownload = async (wc: CommunityWildcard) => {
        try {
            // Check if exists
            const existing = files.find(f => f.name === wc.name) // Simple name check
            if (existing) {
                toast({ title: t('wildcard.exists'), description: t('wildcard.existsDesc') })
                // Optional: ask to overwrite?
                return
            }

            // Get content (increment download)
            const fullWc = await communityService.getWildcardDetails(wc.id)
            if (!fullWc || fullWc.content === undefined) throw new Error("Failed to download content")
            
            // Save locally using atomic create
            await createFileFromContent(wc.name, fullWc.content)
            
            toast({ title: t('wildcard.downloadSuccess'), description: `${t('wildcard.downloadSuccessDesc')}: ${wc.name}` })

        } catch (e) {
            console.error(e)
            toast({ title: "Error", description: "Failed to download", variant: "destructive" })
        }
    }

    const filteredFiles = files.filter(f => 
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className={cn("flex w-full overflow-hidden transition-all", minimal ? "h-full flex-col bg-transparent rounded-none border-none shadow-none" : "bg-zinc-50 dark:bg-zinc-950/50 h-[600px] flex-row rounded-xl border border-zinc-200 dark:border-white/10 shadow-2xl backdrop-blur-2xl")}>
            {/* Sidebar */}
            <div className={cn("flex flex-col border-zinc-200 dark:border-white/5", minimal ? "w-full border-b" : "w-72 border-r bg-zinc-50/50 dark:bg-black/20 backdrop-blur-xl")}>
                <div className="p-4 border-b border-zinc-200 dark:border-white/5 gap-4 flex flex-col">
                    <div className={cn("flex items-center gap-2.5 px-1 font-bold tracking-tight text-base", minimal ? "text-white" : "text-zinc-800 dark:text-zinc-100")}>
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
                            <Puzzle className="h-4 w-4 text-white" />
                        </div>
                        <span>{t('wildcard.title')}</span>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className={cn("grid w-full grid-cols-2 h-9 p-1 rounded-lg", minimal ? "bg-white/10" : "bg-zinc-200/50 dark:bg-white/5")}>
                            <TabsTrigger value="local" className={cn("text-xs transition-all", minimal ? "text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-none" : "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm")}>{t('wildcard.local')}</TabsTrigger>
                            <TabsTrigger value="community" className={cn("text-xs transition-all", minimal ? "text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-none" : "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm")}>{t('wildcard.community')}</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="relative group">
                        <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300", minimal ? "text-white/40 group-focus-within:text-white" : "text-zinc-400 group-focus-within:text-blue-500")} />
                        <Input 
                            className={cn(
                                "h-10 pl-9 text-sm rounded-xl transition-all duration-300",
                                minimal 
                                    ? "bg-white/5 border-white/10 text-white focus-visible:ring-1 focus-visible:ring-white/30 placeholder:text-white/30" 
                                    : "bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 focus-visible:ring-blue-500/50 hover:bg-white dark:hover:bg-white/10"
                            )} 
                            placeholder={activeTab === 'local' ? t('wildcard.searchLocal') : t('wildcard.searchCommunity')}
                            value={activeTab === 'local' ? searchQuery : communitySearch}
                            onChange={(e) => activeTab === 'local' ? setSearchQuery(e.target.value) : setCommunitySearch(e.target.value)}
                        />
                    </div>

                    {activeTab === 'local' && (
                        isCreating ? (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Input 
                                    className="h-9 text-xs bg-white dark:bg-zinc-800 border-blue-500/50 focus-visible:ring-blue-500/30 rounded-lg shadow-lg shadow-blue-500/10" 
                                    placeholder="Filename..." 
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreate()
                                        if (e.key === 'Escape') setIsCreating(false)
                                    }}
                                />
                                <Button size="icon" className="h-9 w-9 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 rounded-lg shrink-0 transition-all active:scale-95" onClick={handleCreate}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <Button 
                                variant="ghost" 
                                className="w-full justify-start h-9 text-xs font-medium border border-dashed border-zinc-300 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all duration-300" 
                                onClick={() => setIsCreating(true)}
                            >
                                <Plus className="h-3.5 w-3.5 mr-2" /> {t('wildcard.newFile')}
                            </Button>
                        )
                    )}
                </div>
                
                <ScrollArea className={cn("px-2 py-2", minimal ? "h-[200px]" : "flex-1")}>
                    <div className="space-y-1">
                        {activeTab === 'local' ? (
                            filteredFiles.map(file => {
                                const displayName = file.name.replace(/\.txt$/i, '');
                                const isSelected = selectedFileId === file.id;
                                return (
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        key={file.id}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-300 group relative overflow-hidden",
                                            isSelected && !isSelectionMode
                                                ? minimal 
                                                    ? "bg-white/10 text-white font-medium shadow-md shadow-black/5 ring-1 ring-white/10"
                                                    : "bg-white dark:bg-white/10 text-zinc-900 dark:text-white font-medium shadow-md shadow-black/5 ring-1 ring-black/5 dark:ring-white/10" 
                                                : minimal
                                                    ? "hover:bg-white/5 text-white/60 hover:text-white"
                                                    : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                                        )}
                                        onClick={() => {
                                            if (isSelectionMode) {
                                                toggleSelection(file.id)
                                            } else {
                                                setSelectedFileId(file.id)
                                            }
                                        }}
                                        onDoubleClick={() => {
                                            if (onInsert) {
                                                onInsert(`__${displayName}__`)
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (onInsert) {
                                                    onInsert(`__${displayName}__`)
                                                }
                                            }
                                        }}
                                    >
                                        {isSelectionMode ? (
                                            <div className={cn("h-4 w-4 shrink-0 transition-all", selectedFileIdsSet.has(file.id) ? "text-blue-500" : "text-zinc-300")}>
                                                {selectedFileIdsSet.has(file.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                            </div>
                                        ) : (
                                            isSelected && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]" />
                                            )
                                        )}
                                        {!isSelectionMode && <FileText className={cn("h-4 w-4 shrink-0 transition-all duration-300", isSelected ? "text-blue-500 scale-110" : minimal ? "text-white/40 group-hover:text-white/60" : "text-zinc-400 group-hover:text-zinc-500")} />}
                                        <div className="flex flex-col overflow-hidden text-left flex-1 min-w-0">
                                            <span className="truncate tracking-tight">{displayName}</span>
                                            {file.collection && <span className="text-[9px] text-zinc-400 truncate">{file.collection}</span>}
                                        </div>
                                    </motion.button>
                                );
                            })
                        ) : (
                            // Community List
                            isLoadingCommunity ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <RefreshCw className="h-5 w-5 text-zinc-400 animate-spin" />
                                </div>
                            ) : communityFiles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                    <Globe className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
                                    <span className="text-xs text-zinc-400 font-medium">{t('wildcard.noResults')}</span>
                                </div>
                            ) : (
                                communityFiles.map(wc => (
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        key={wc.id}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-300 group relative overflow-hidden",
                                            selectedCommunityId === wc.id 
                                                ? minimal
                                                    ? "bg-white/10 text-white font-medium shadow-md shadow-black/5 ring-1 ring-white/10"
                                                    : "bg-white dark:bg-white/10 text-zinc-900 dark:text-white font-medium shadow-md shadow-black/5 ring-1 ring-black/5 dark:ring-white/10" 
                                                : minimal
                                                    ? "hover:bg-white/5 text-white/60 hover:text-white"
                                                    : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                                        )}
                                        onClick={() => setSelectedCommunityId(wc.id)}
                                    >
                                        <Globe className={cn("h-4 w-4 shrink-0 transition-all duration-300", selectedCommunityId === wc.id ? "text-blue-500" : "text-zinc-400")} />
                                        <div className="flex flex-col overflow-hidden text-left flex-1 min-w-0">
                                            <span className="truncate tracking-tight font-medium">{wc.name}</span>
                                            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                                <span className="flex items-center"><User className="h-2.5 w-2.5 mr-0.5"/> {wc.author_name}</span>
                                                <span className="flex items-center gap-1"><ArrowDown className="h-2.5 w-2.5 mr-0.5"/> {wc.downloads}</span>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))
                            )
                        )}
                    </div>
                </ScrollArea>
                
                {activeTab === 'local' && (
                    <div className={cn("p-3 backdrop-blur-md", minimal ? "border-t border-white/10 bg-black/20" : "border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-black/40")}>
                         <div className="flex items-center justify-between">
                             <div className="flex gap-1 w-full">
                                {isSelectionMode ? (
                                    <>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 flex-1 text-xs"
                                            onClick={selectAll}
                                        >
                                            {selectedFileIdsSet.size === filteredFiles.length ? "None" : "All"}
                                        </Button>
                                        <Button 
                                            variant="default" 
                                            size="sm" 
                                            className="h-8 flex-[2] text-xs bg-blue-600 hover:bg-blue-500 text-white"
                                            onClick={handleBatchPublish}
                                            disabled={isPublishing || selectedFileIdsSet.size === 0}
                                        >
                                            {isPublishing 
                                                ? `${publishProgress.current}/${publishProgress.total}` 
                                                : `${t('wildcard.publish')} (${selectedFileIdsSet.size})`}
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 p-0"
                                            onClick={() => {
                                                setIsSelectionMode(false)
                                                setSelectedFileIdsSet(new Set())
                                            }}
                                        >
                                            <Plus className="h-4 w-4 rotate-45" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className={cn("h-8 w-8 p-0 rounded-lg transition-colors", minimal ? "text-white/40 hover:text-white hover:bg-white/10" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-white/10")}
                                            onClick={() => refreshFromDB()}
                                            title="Refresh List"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 p-0 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-colors"
                                            onClick={importFromFolder}
                                            title={t('wildcard.importFolder', 'Import from Folder')}
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 p-0 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-colors ml-auto"
                                            onClick={() => setIsSelectionMode(true)}
                                            title="Select Multiple"
                                        >
                                            <CheckSquare className="h-3.5 w-3.5" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Main: Editor or Details */}
            <div className={cn("flex-1 flex flex-col min-w-0 relative", minimal ? "bg-transparent" : "bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl")}>
                <div className={cn("absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none mix-blend-overlay", minimal ? "opacity-10" : "opacity-20")}></div>
                
                {activeTab === 'local' ? (
                    selectedFileId ? (
                        <>
                            <div className={cn("flex items-center justify-between py-4 relative z-10 shrink-0", minimal ? "px-4 border-b border-white/5" : "px-6 border-b border-zinc-200/50 dark:border-white/5")}>
                                <div className="flex flex-col gap-0.5">
                                    <span className={cn("text-lg font-bold tracking-tight", minimal ? "text-white" : "text-zinc-800 dark:text-zinc-100")}>
                                        {files.find(f => f.id === selectedFileId)?.name.replace(/\.txt$/i, '')}
                                    </span>
                                    <span className={cn("text-xs", minimal ? "text-white/40" : "text-zinc-400")}>{t('wildcard.local')}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        size="sm"
                                        variant="outline"
                                        className="h-9 gap-2"
                                        onClick={handlePublish}
                                        disabled={isPublishing}
                                    >
                                        {isPublishing ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4"/>}
                                        {t('wildcard.publish')}
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        onClick={handleSave}
                                        disabled={!hasChanges}
                                        className={cn(
                                            "h-9 px-5 rounded-full font-semibold shadow-lg transition-all duration-300 transform active:scale-95", 
                                            hasChanges 
                                                ? "bg-blue-600 hover:bg-blue-500 text-white" 
                                                : minimal ? "bg-white/10 text-white/40" : "bg-white/80 dark:bg-white/5 text-zinc-400"
                                        )}
                                    >
                                        <Save className={cn("h-4 w-4 mr-2", hasChanges && "rotate-12")} />
                                        {hasChanges ? t('common.save') : t('wildcard.saved')}
                                    </Button>
                                </div>
                            </div>
                            <div className={cn("flex-1 relative z-10", minimal ? "p-3" : "p-6")}>
                                <div className={cn("absolute overflow-hidden backdrop-blur-md", minimal ? "inset-3 rounded-xl border border-white/5 bg-white/5" : "inset-6 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-xl bg-white dark:bg-black/40")}>
                                    <AutocompleteTextarea  
                                        className="absolute inset-0 w-full h-full p-6 resize-none bg-transparent border-0 outline-none font-mono text-sm leading-7"
                                        value={content}
                                        onChange={(e) => {
                                            setContent(e.target.value)
                                            setHasChanges(true)
                                        }}
                                        spellCheck={false}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 z-10">
                             <Puzzle className="h-10 w-10 mb-4 opacity-50"/>
                             <p>{t('wildcard.selectToEdit')}</p>
                        </div>
                    )
                ) : (
                    // Community Details
                    selectedCommunityId ? (() => {
                        const wc = communityFiles.find(f => f.id === selectedCommunityId)
                        if (!wc) return null
                        return (
                            <div className={cn("flex flex-col h-full z-10", minimal ? "p-4" : "p-8")}>
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className={cn("text-2xl font-bold mb-2", minimal ? "text-white" : "text-zinc-800 dark:text-zinc-100")}>{wc.name}</h2>
                                        <div className={cn("flex gap-4 text-sm", minimal ? "text-white/50" : "text-zinc-500")}>
                                            <span className="flex items-center gap-1"><User className="h-4 w-4"/> {wc.author_name}</span>
                                            <span className="flex items-center gap-1"><Clock className="h-4 w-4"/> {new Date(wc.created_at).toLocaleDateString()}</span>
                                            <span className="flex items-center gap-1"><ArrowDown className="h-4 w-4"/> {wc.downloads}</span>
                                        </div>
                                    </div>
                                    <Button onClick={() => handleDownload(wc)} className="gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 rounded-full h-10 px-5 transition-all">
                                        <Download className="h-4 w-4"/> {t('wildcard.download')}
                                    </Button>
                                </div>
                                
                                {wc.description && (
                                    <div className={cn("mb-6 p-4 rounded-xl border", minimal ? "bg-white/5 border-white/5" : "bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/10")}>
                                        <h3 className={cn("text-xs font-bold uppercase mb-2", minimal ? "text-white/40" : "text-zinc-400")}>{t('wildcard.description')}</h3>
                                        <p className={cn("text-sm", minimal ? "text-white/80" : "text-zinc-600 dark:text-zinc-300")}>{wc.description}</p>
                                    </div>
                                )}

                                <div className={cn("flex-1 overflow-hidden flex flex-col p-4 border rounded-xl backdrop-blur-md", minimal ? "bg-white/5 border-white/5" : "bg-white dark:bg-black/40 border-zinc-200 dark:border-white/10")}>
                                     <h3 className={cn("text-xs font-bold uppercase mb-2", minimal ? "text-white/40" : "text-zinc-400")}>{t('wildcard.preview')}</h3>
                                     <div className={cn("flex-1 overflow-auto font-mono text-xs whitespace-pre-wrap custom-scrollbar pr-2", minimal ? "text-white/60" : "text-zinc-500")}>
                                         {(wc.content || '').length > 500 ? (wc.content || '').slice(0, 500) + t('wildcard.truncated', '... (truncated)') : (wc.content || t('wildcard.noContent', 'No preview available'))}
                                     </div>
                                </div>
                            </div>
                        )
                    })() : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 z-10">
                             <Globe className="h-10 w-10 mb-4 opacity-50"/>
                             <p>{t('wildcard.noSelection')}</p>
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
