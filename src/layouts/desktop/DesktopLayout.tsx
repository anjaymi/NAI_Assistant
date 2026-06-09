
import { lazy, useState, useEffect, useRef, useMemo } from 'react'
import { open, Command } from '@tauri-apps/plugin-shell'
import { useTranslation } from 'react-i18next'
import { 
    LayoutDashboard, 
    History, 
    Image as ImageIcon, 
    Wand2, 
    Globe, 
    Sparkles, 
    Puzzle, 
    SlidersHorizontal, 
    Smile,
    RefreshCw,
    Palette,
    Dices,
    Save,
    Copy,
    Layers,
    User,
    RotateCcw
} from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { ContextMenu } from '@/components/atoms/ContextMenu'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/atoms/Popover'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/atoms/Tooltip'
import { useGenerationStore } from '@/stores/generation-store'
import { useCharacterStore } from '@/stores/character-store'
import { useCharacterPromptStore } from '@/stores/character-prompt-store'
import { Header } from '@/components/organisms/Header'
import { GlassLayout } from '@/components/templates/GlassLayout'
import { CharacterPromptPanel } from '@/components/character/CharacterPromptPanel'
import { Toaster } from '@/components/organisms/Toaster'
import { toast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { Separator } from '@/components/atoms/Separator'
import { AnimatedNavBar, NavItem } from '@/components/molecules/AnimatedNavBar'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/atoms/Sheet'
import { usePSIntegration } from '@/hooks/usePSIntegration'
import { BatchQueuePanel } from '@/components/organisms/BatchQueuePanel'
import { PromptArea } from '@/components/organisms/PromptArea'
import { GlassSurface } from '@/components/atoms/GlassSurface'
import { useSettingsStore } from '@/stores/settings-store'
import { useArtistStore } from '@/stores/artist-store'
import { ImageInfoOverlay } from '@/components/molecules/ImageInfoOverlay'
import { MagicTagPanel } from '@/components/features/magic-tag/MagicTagPanel'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAppStore } from '@/stores/app-store'
import { shallow } from 'zustand/shallow'
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary'

const LoginPanel = lazy(() => import('@/components/organisms/LoginPanel').then((module) => ({ default: module.LoginPanel })))
const SettingsDialog = lazy(() => import('@/components/organisms/SettingsDialog').then((module) => ({ default: module.SettingsDialog })))
const CharacterSettingsDialog = lazy(() => import('@/components/character/CharacterSettingsDialog').then((module) => ({ default: module.CharacterSettingsDialog })))
const GalleryPanel = lazy(() => import('@/components/organisms/GalleryPanel').then((module) => ({ default: module.GalleryPanel })))
const InpaintingEditor = lazy(() => import('@/components/organisms/InpaintingEditor').then((module) => ({ default: module.InpaintingEditor })))
const ImagePreview = lazy(() => import('@/components/organisms/ImagePreview').then((module) => ({ default: module.ImagePreview })))
const RandomArtistGenerator = lazy(() => import('@/components/features/artist-gallery/RandomArtistGenerator').then((module) => ({ default: module.RandomArtistGenerator })))
const ToolsPanel = lazy(() => import('@/components/organisms/ToolsPanel').then((module) => ({ default: module.ToolsPanel })))
const GenerationSettingsPanel = lazy(() => import('@/components/organisms/GenerationSettingsPanel').then((module) => ({ default: module.GenerationSettingsPanel })))
const WebPanel = lazy(() => import('@/components/organisms/WebPanel').then((module) => ({ default: module.WebPanel })))
const AdvancedSettingsPanel = lazy(() => import('@/components/organisms/AdvancedSettingsPanel').then((module) => ({ default: module.AdvancedSettingsPanel })))
const WildcardManagerPanel = lazy(() => import('@/components/wildcards/WildcardManagerPanel').then((module) => ({ default: module.WildcardManagerPanel })))
const ArtistGalleryPanel = lazy(() => import('@/components/features/artist-gallery/ArtistGalleryPanel').then((module) => ({ default: module.ArtistGalleryPanel })))

export function DesktopLayout() {
    const { t } = useTranslation()
    const {
        generate,
        isGenerating,
        previewImage,
        sourceImage,
        setMask,
        setSourceImage,
        width,
        height,
        generationProgress
    } = useGenerationStore(
        (state) => ({
            generate: state.generate,
            isGenerating: state.isGenerating,
            previewImage: state.previewImage,
            sourceImage: state.sourceImage,
            setMask: state.setMask,
            setSourceImage: state.setSourceImage,
            width: state.width,
            height: state.height,
            generationProgress: state.generationProgress,
        }),
        shallow
    )
    
    // Settings Store (Auto-Open Gallery)
    const autoOpenGallery = useSettingsStore((state) => state.autoOpenGallery)

    // Auto-Open Gallery Effect — only trigger on rising edge of isGenerating
    const wasGenerating = useRef(false)
    useEffect(() => {
        if (isGenerating && !wasGenerating.current && autoOpenGallery) {
            setHistoryOpen(true)
        }
        wasGenerating.current = isGenerating
    }, [isGenerating, autoOpenGallery])


    // New Stores
    const { characterImages, vibeImages } = useCharacterStore(
        (state) => ({
            characterImages: state.characterImages,
            vibeImages: state.vibeImages,
        }),
        shallow
    )
    const characterPrompts = useCharacterPromptStore((state) => state.characters)
    const artistLibraryOpen = useArtistStore((state) => state.isOpen)
    const artistSidebarOpen = useArtistStore((state) => state.isSidebarOpen)

    const [settingsOpen, setSettingsOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [genSettingsOpen, setGenSettingsOpen] = useState(false)
    const [refDialogOpen, setRefDialogOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('generate')

    // Enable PS Integration
    usePSIntegration()

    // Keyboard Shortcuts
    const shortcutHandlers = useMemo(() => ({
        generate: () => { if (!isGenerating) generate() },
        openSettings: () => setSettingsOpen(true),
        toggleHistory: () => setHistoryOpen(prev => !prev),
        openArtistLibrary: () => useArtistStore.getState().setIsOpen(true),
        saveImage: () => {
            if (previewImage) {
                useGenerationStore.getState().saveImage(previewImage)
            }
        },
        toggleSidebar: () => useAppStore.getState().toggleSidebar(),
    }), [isGenerating, generate, previewImage])
    useKeyboardShortcuts(shortcutHandlers)

    const navItems: NavItem[] = [
        { id: 'generate', icon: LayoutDashboard, labelKey: 'tabs.generate' },
        { id: 'history', icon: History, labelKey: 'tabs.history' },
        { id: 'canvas', icon: ImageIcon, labelKey: 'tabs.canvas' },
        { id: 'tools', icon: Wand2, labelKey: 'tabs.tools' },
        { id: 'web', icon: Globe, labelKey: 'tabs.web' },
    ]

    const activeCharCount = characterPrompts.filter(c => c.enabled).length

    return (
        <>
            <GlassLayout
                header={
                    <Header
                        onSettingsClick={() => setSettingsOpen(true)}
                        onHistoryClick={() => setHistoryOpen((prev) => !prev)}
                        onMenuClick={() => setGenSettingsOpen(true)}
                    />
                }
                leftPanel={
                    <div className="flex flex-col h-full bg-white/0">
                        {/* Header Area */}
                        <div className="p-4 shrink-0 border-b border-black/5 dark:border-[#101116] bg-white/40 dark:bg-[#05060a] z-10 shadow-[0_10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                            <LazyModuleBoundary className="min-h-[52px]" label="Loading account panel...">
                                <LoginPanel onOpenSettings={() => setGenSettingsOpen(true)} />
                            </LazyModuleBoundary>
                        </div>

                        {/* Scrollable Content Area */}
                        <ScrollArea className="flex-1">
                            <div className="p-4 pr-8 space-y-6">
                                {/* Prompt Area */}
                                <div className="space-y-4">
                                    <PromptArea />
                                </div>

                                <Separator className="bg-black/5 dark:bg-white/10" />

                                {/* Batch Queue */}
                                <div className="space-y-4">
                                    <BatchQueuePanel />
                                </div>
                            </div>
                        </ScrollArea>

                        {/* Footer / Generate Button Area */}
                        <div className="p-5 border-t border-black/5 dark:border-[#101116] bg-white/40 dark:bg-[#05060a] z-10 flex flex-col gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.24)]">
                            {/* Control Bar */}
                            <TooltipProvider>
                            <div className="flex items-center gap-2">
                                {/* Image Reference & Vibe */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "h-9 w-9 p-0 border-black/5 dark:border-[#14161a] bg-white/50 dark:bg-[#0e0f12] hover:bg-black/5 dark:hover:bg-[#15171b] transition-colors relative text-slate-700 dark:text-white",
                                                (characterImages.length > 0 || vibeImages.length > 0) && "bg-primary/10 dark:bg-primary/20 border-primary/30 dark:border-primary/50 text-primary dark:text-primary"
                                            )}
                                            onClick={() => setRefDialogOpen(true)}
                                        >
                                            <ImageIcon className="w-4 h-4" />
                                            {(characterImages.length + vibeImages.length) > 0 && (
                                                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('characterDialog.title', 'Reference Settings')}</TooltipContent>
                                </Tooltip>

                                {/* Character Prompts */}
                                <Popover>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className={cn(
                                                        "h-9 w-9 p-0 border-black/5 dark:border-[#14161a] bg-white/50 dark:bg-[#0e0f12] hover:bg-black/5 dark:hover:bg-[#15171b] transition-colors relative text-slate-700 dark:text-white",
                                                        activeCharCount > 0 && "bg-green-500/10 dark:bg-green-500/20 border-green-500/30 dark:border-green-500/50 text-green-600 dark:text-green-500"
                                                    )}
                                                >
                                                    <Smile className="w-4 h-4" />
                                                    {activeCharCount > 0 && (
                                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] text-white ring-2 ring-black">
                                                            {activeCharCount}
                                                        </span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('character.title', 'Character Prompts')}</TooltipContent>
                                    </Tooltip>
                                    <PopoverContent side="top" className="w-[340px] p-0 border-black/5 dark:border-[#14161a] bg-white/90 dark:bg-[#08090d]" align="center">
                                        <CharacterPromptPanel />
                                    </PopoverContent>
                                </Popover>

                                {/* Artist Library Shortcut */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "h-9 w-9 p-0 border-black/5 dark:border-[#14161a] bg-white/50 dark:bg-[#0e0f12] hover:bg-black/5 dark:hover:bg-[#15171b] transition-colors relative text-slate-700 dark:text-white",
                                                 artistLibraryOpen && "bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/30 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-500"
                                            )}
                                            onClick={() => useArtistStore.getState().setIsOpen(true)}
                                        >
                                            <Palette className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('gallery.galleryTitle', 'Artist Library')}</TooltipContent>
                                </Tooltip>

                                {/* Random Artist Generator */}
                                <Popover>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 w-9 p-0 border-black/5 dark:border-[#14161a] bg-white/50 dark:bg-[#0e0f12] hover:bg-black/5 dark:hover:bg-[#15171b] transition-colors text-slate-700 dark:text-white"
                                                >
                                                    <Dices className="w-4 h-4" />
                                                </Button>
                                            </PopoverTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('settings.randomGenerate', 'Random Artist')}</TooltipContent>
                                    </Tooltip>
                                    <PopoverContent side="top" className="w-[1000px] max-w-[95vw] h-[85vh] p-4 border-black/5 dark:border-[#14161a] bg-white/90 dark:bg-[#08090d] z-50 flex flex-col">
                                        <LazyModuleBoundary className="h-full min-h-0" label="Loading artist generator...">
                                            <RandomArtistGenerator />
                                        </LazyModuleBoundary>
                                    </PopoverContent>
                                </Popover>



                                {/* Wildcard / Puzzle */}
                                <Popover>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 w-9 p-0 border-black/5 dark:border-[#14161a] bg-white/50 dark:bg-[#0e0f12] hover:bg-black/5 dark:hover:bg-[#15171b] transition-colors text-slate-700 dark:text-white"
                                                    // title prop removed
                                                >
                                                    <Puzzle className="w-4 h-4" />
                                                </Button>
                                            </PopoverTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('preset.manage', 'Wildcard Manager')}</TooltipContent>
                                    </Tooltip>
                                    <PopoverContent side="right" align="end" sideOffset={10} className="w-[800px] p-0 border-black/5 dark:border-[#14161a] bg-white/90 dark:bg-[#08090d]">
                                        <LazyModuleBoundary className="min-h-[280px]" label="Loading wildcard library...">
                                            <WildcardManagerPanel onInsert={(tag) => {
                                                useGenerationStore.getState().setPendingTagsToAppend(tag)
                                                toast({
                                                    title: t('common.success', "Tag Inserted"),
                                                    description: `Inserted ${tag}`
                                                })
                                            }} />
                                        </LazyModuleBoundary>
                                    </PopoverContent>
                                </Popover>

                                {/* Advanced Settings */}
                                <Popover>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 w-9 p-0 border-black/5 dark:border-[#14161a] bg-white/50 dark:bg-[#0e0f12] hover:bg-black/5 dark:hover:bg-[#15171b] transition-colors text-slate-700 dark:text-white"
                                                >
                                                    <SlidersHorizontal className="w-4 h-4" />
                                                </Button>
                                            </PopoverTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('settings.advanced', 'Advanced Settings')}</TooltipContent>
                                    </Tooltip>
                                    <PopoverContent className="w-96 p-4 bg-white/90 dark:bg-[#08090d] border-black/5 dark:border-[#14161a] text-slate-800 dark:text-white max-h-[80vh] overflow-y-auto" side="top" align="end">
                                        <div className="mb-2 font-semibold text-sm text-slate-500 dark:text-white/50">{t('settings.advanced', 'Advanced Settings')}</div>
                                        <LazyModuleBoundary className="min-h-[220px]" label="Loading advanced settings...">
                                            <AdvancedSettingsPanel />
                                        </LazyModuleBoundary>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            </TooltipProvider>

                            {/* Generate Button */}
                            <div>
                                <Button
                                    variant="default"
                                    className={cn(
                                        "w-full h-14 text-lg font-bold rounded-xl capitalize",
                                        "bg-primary text-primary-foreground hover:opacity-90",
                                        isGenerating && "opacity-80 cursor-wait sepia-[.2]"
                                    )}
                                    onClick={() => generate()}
                                    disabled={isGenerating}
                                >
                                    {isGenerating ? (
                                        <>
                                            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                                            {t('common.generating', 'Generating...')}
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="h-5 w-5 mr-2" />
                                            {t('common.generate', 'Generate')}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                }
                centerPanel={
                    <div className="flex flex-col h-full relative w-full">
                        {/* Floating Tab Bar */}
                        <div className="absolute top-0 left-0 right-0 flex justify-center z-20 pointer-events-none pt-4">
                            <div className="pointer-events-auto">
                                <GlassSurface
                                    width="fit-content"
                                    height={52}
                                    borderRadius={30}
                                    opacity={0.8}
                                    blur={20}
                                    borderWidth={1}
                                    className="flex items-center px-2 shadow-2xl bg-white/40 dark:bg-black/20"
                                >
                                    <AnimatedNavBar
                                        items={navItems}
                                        activeTab={activeTab}
                                        onTabChange={setActiveTab}
                                    />
                                </GlassSurface>
                            </div>
                        </div>

                        {/* Tab Content Area */}
                        <div className="flex-1 pt-12 h-full w-full">
                            {activeTab === 'generate' && (
                                <div className="absolute inset-0 pt-16 px-4 pb-4 z-10">
                                    <LazyModuleBoundary className="h-full min-h-0" label="Loading preview canvas...">
                                        <ImagePreview
                                            imageSrc={previewImage}
                                            isGenerating={isGenerating}
                                            progress={generationProgress}
                                            className="w-full h-full"
                                            originalWidth={width}
                                            originalHeight={height}
                                            onRegenerate={() => generate()}
                                            onInpaint={() => {
                                                if (!previewImage) return
                                                setMask(null)
                                                setSourceImage(previewImage)
                                                setActiveTab('canvas')
                                            }}
                                            onI2I={() => {
                                                if (!previewImage) return
                                                setSourceImage(previewImage)
                                                setActiveTab('tools')
                                            }}
                                            onAddRef={() => {
                                                if (!previewImage) return
                                                void useCharacterStore.getState().addCharacterImage(previewImage)
                                                toast({ title: t('common.addedReference', "Added to Reference") })
                                            }}
                                            onOpenFolder={async () => {
                                                try {
                                                    const { savePath, useAbsolutePath } = useSettingsStore.getState()
                                                    const outputDir = savePath || 'NAIS_Output'

                                                    let dirToOpen = ''
                                                    if (useAbsolutePath) {
                                                        dirToOpen = outputDir
                                                    } else {
                                                        const { pictureDir, join } = await import('@tauri-apps/api/path')
                                                        const picDir = await pictureDir()
                                                        dirToOpen = await join(picDir, outputDir)
                                                    }

                                                    try {
                                                        const command = Command.create('explorer', [dirToOpen])
                                                        await command.spawn()
                                                        toast({ title: "已打开输出文件夹" })
                                                    } catch (cmdErr) {
                                                        console.warn("Explorer command failed, trying open:", cmdErr)
                                                        await open(dirToOpen)
                                                    }
                                                } catch (e) {
                                                    toast({ title: "打开文件夹失败", description: String(e), variant: "destructive" })
                                                }
                                            }}
                                            onLoadMetadata={() => {
                                                toast({ title: "功能开发中..." })
                                            }}
                                            onDelete={() => {
                                                if (!previewImage) return
                                                useGenerationStore.getState().setPreviewImage(null)
                                                toast({ title: t('actions.deleted', "已删除") })
                                            }}
                                        />
                                    </LazyModuleBoundary>
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="absolute inset-0 pt-16 px-4 pb-4 z-10">
                                    <div className="flex items-center justify-center h-full text-slate-500 dark:text-white/30">{t('common.history', 'History View')}</div>
                                </div>
                            )}

                            {activeTab === 'canvas' && (
                                <div className="absolute inset-0 pt-16 px-4 pb-4 z-10">
                                    <LazyModuleBoundary className="h-full min-h-0" label="Loading canvas editor...">
                                        <InpaintingEditor
                                            sourceImage={sourceImage || ""}
                                            onSaveMask={setMask}
                                            onClose={() => {
                                                setSourceImage(null)
                                                setActiveTab('generate')
                                            }}
                                        />
                                    </LazyModuleBoundary>
                                </div>
                            )}

                            {activeTab === 'tools' && (
                                <div className="absolute inset-0 pt-16 px-4 pb-4 z-10">
                                    <LazyModuleBoundary className="h-full min-h-0" label="Loading smart tools...">
                                        <ToolsPanel />
                                    </LazyModuleBoundary>
                                </div>
                            )}

                            {activeTab === 'web' && (
                                <div className="absolute inset-0 pt-16 px-4 pb-4 z-10">
                                    <LazyModuleBoundary className="h-full min-h-0" label="Loading web workspace...">
                                        <WebPanel 
                                            isActive={true} 
                                            isOverlayVisible={
                                                settingsOpen || 
                                                genSettingsOpen || 
                                                refDialogOpen || 
                                                 artistLibraryOpen
                                            }
                                        />
                                    </LazyModuleBoundary>
                                </div>
                            )}
                        </div>
                    </div>
                }
                rightPanel={

                    <div className="flex flex-col h-full w-full">
                        {/* Content Area */}
                        <div className="flex-1 overflow-hidden relative">
                            <div className="h-full overflow-y-auto p-2">
                                {historyOpen && (
                                    <LazyModuleBoundary className="h-full min-h-0" label="Loading gallery...">
                                        <GalleryPanel className="h-full border-none" onNavigate={setActiveTab} />
                                    </LazyModuleBoundary>
                                )}
                            </div>
                        </div>
                    </div>
                }
                rightPanelVisible={historyOpen}
                rightDrawer={
                    <>
                        {settingsOpen && (
                            <LazyModuleBoundary mode="overlay" label="Loading settings dialog...">
                                <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
                            </LazyModuleBoundary>
                        )}
                        {/* Settings Dialog - now handled by sheet or separate dialog */}
                        {refDialogOpen && (
                            <LazyModuleBoundary mode="overlay" label="Loading reference settings...">
                                <CharacterSettingsDialog open={refDialogOpen} onOpenChange={setRefDialogOpen} />
                            </LazyModuleBoundary>
                        )}
                        
                        <Sheet open={genSettingsOpen} onOpenChange={setGenSettingsOpen}>
                            <SheetContent side="left" className="w-[360px] p-0 border-r border-black/5 dark:border-white/10 bg-white/95 dark:bg-black/40 backdrop-blur-xl z-50">
                                <SheetTitle className="sr-only">Generation Settings</SheetTitle>
                                <SheetDescription className="sr-only">Adjust generation parameters.</SheetDescription>
                                <div className="h-full overflow-y-auto p-4 space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                                        {t('settings.title', 'Settings')}
                                    </h3>
                                    <LazyModuleBoundary className="min-h-[320px]" label="Loading generation settings...">
                                        <GenerationSettingsPanel />
                                    </LazyModuleBoundary>
                                </div>
                            </SheetContent>
                        </Sheet>
                        
                        {/* Artist Gallery Overlay */}
                        <Sheet open={artistLibraryOpen} onOpenChange={(open) => useArtistStore.getState().setIsOpen(open)}>
                            <SheetContent 
                                side="bottom" 
                                className="w-[95vw] h-[92vh] mx-auto rounded-t-xl overflow-hidden p-0 border-none bg-slate-50/95 dark:bg-black/95 text-slate-800 dark:text-white z-[60]"
                                hideClose={artistSidebarOpen}
                            >
                                <SheetTitle className="sr-only">Artist Library</SheetTitle>
                                <SheetDescription className="sr-only">Browse and manage artist styles.</SheetDescription>
                                <div className="w-full h-full">
                                     <LazyModuleBoundary className="h-full min-h-0" label="Loading artist library...">
                                         <ArtistGalleryPanel />
                                     </LazyModuleBoundary>
                                 </div>
                             </SheetContent>
                         </Sheet>
                    </>
                }
            />
            <Toaster />
        </>
    )
}
