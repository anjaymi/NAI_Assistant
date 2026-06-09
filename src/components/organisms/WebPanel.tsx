import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/atoms/Button'
import { GlassInput } from '@/components/atoms/GlassInput' 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/atoms/Dialog'
import { invoke } from '@tauri-apps/api/core'
import { Store } from '@tauri-apps/plugin-store'
import {
    Globe,
    Home,
    ExternalLink,
    X,
    RefreshCw,
    Plus,
    Edit,
    ZoomIn,
    ZoomOut,
} from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/atoms/Tooltip'
import { cn } from '@/lib/utils'

interface QuickLink {
    name: string
    url: string
}

const DEFAULT_QUICK_LINKS: QuickLink[] = [
    { name: 'Danbooru', url: 'https://hijiribe.donmai.us' },
    { name: 'novelai.app', url: 'https://novelai.app/' },
    { name: 'Google Translate', url: 'https://translate.google.co.kr/?sl=ko&tl=en&op=translate' },
]

const STORE_KEY = 'webview_quick_links'

interface WebPanelProps {
    isActive?: boolean
    isOverlayVisible?: boolean
}

export function WebPanel({ isActive = false, isOverlayVisible = false }: WebPanelProps) {
    const { t } = useTranslation()
    const [url, setUrl] = useState('https://hijiribe.donmai.us')
    const [inputUrl, setInputUrl] = useState(url)
    const [isLoading, setIsLoading] = useState(false)
    const [isBrowserOpen, setIsBrowserOpen] = useState(false)
    const [quickLinks, setQuickLinks] = useState<QuickLink[]>(DEFAULT_QUICK_LINKS)
    const [isEditMode, setIsEditMode] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newLinkName, setNewLinkName] = useState('')
    const [newLinkUrl, setNewLinkUrl] = useState('')
    const browserAreaRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number | null>(null)
    const storeRef = useRef<Store | null>(null)
    const shouldRestoreBrowserRef = useRef(false)
    const [zoomLevel, setZoomLevel] = useState(1.0)

    const closeBrowser = useCallback(async (preserveRestore = false) => {
        shouldRestoreBrowserRef.current = preserveRestore
        try {
            await invoke('close_embedded_browser')
        } catch (error) {
            console.error('Failed to close browser:', error)
        } finally {
            setIsBrowserOpen(false)
        }
    }, [])

    const openBrowserWindow = useCallback(async (targetUrl: string) => {
        setIsLoading(true)
        try {
            const browserArea = browserAreaRef.current
            if (!browserArea) return

            const rect = browserArea.getBoundingClientRect()

            await invoke('open_embedded_browser', {
                url: targetUrl,
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
            })
            setIsBrowserOpen(true)
        } catch (error) {
            console.error('Failed to open browser:', error)
            toast({ 
                title: t('common.error', "Error"), 
                description: "Failed to open browser: " + String(error),
                variant: "destructive" 
            })
        } finally {
            setIsLoading(false)
        }
    }, [t])

    // Zoom function for buttons
    const handleZoom = useCallback(async (delta: number) => {
        if (!isBrowserOpen) return
        const newZoom = Math.max(0.25, Math.min(3.0, zoomLevel + delta))
        setZoomLevel(newZoom)
        try {
            await invoke('zoom_embedded_browser', { zoomLevel: newZoom })
        } catch (error) {
            console.error('Zoom failed:', error)
        }
    }, [isBrowserOpen, zoomLevel])

    const handleZoomReset = useCallback(async () => {
        setZoomLevel(1.0)
        try {
            await invoke('zoom_embedded_browser', { zoomLevel: 1.0 })
        } catch (error) {
            console.error('Zoom reset failed:', error)
        }
    }, [])

    // Handle visibility based on isActive prop and dialog state
    useEffect(() => {
        if (!isActive) {
            // Release WebView2 when leaving the tab to avoid persistent idle memory usage
            if (isBrowserOpen) {
                 void closeBrowser(true)
            }
            return
        }

        // Determine if we should hide based on internal or external overlays
        const shouldHide = isAddDialogOpen || isOverlayVisible

        if (shouldHide && isBrowserOpen) {
            invoke('hide_embedded_browser').catch(() => { })
        } else if (!shouldHide && isBrowserOpen) {
            invoke('show_embedded_browser').catch(() => { })
            // Trigger resize to ensure correct position
            requestAnimationFrame(() => {
                if (browserAreaRef.current) {
                    const rect = browserAreaRef.current.getBoundingClientRect()
                    invoke('resize_embedded_browser', {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    }).catch(() => {})
                }
            })
        }
    }, [closeBrowser, isActive, isAddDialogOpen, isOverlayVisible, isBrowserOpen])

    // Initialize store and load quick links
    useEffect(() => {
        const initStore = async () => {
            try {
                storeRef.current = await Store.load('webview-settings.json')
                const savedLinks = await storeRef.current.get<QuickLink[]>(STORE_KEY)
                if (savedLinks && savedLinks.length > 0) {
                    setQuickLinks(savedLinks)
                }
            } catch (error) {
                console.error('Failed to load quick links:', error)
            }
        }
        initStore()
    }, [])

    // Save quick links when changed
    const saveQuickLinks = useCallback(async (links: QuickLink[]) => {
        try {
            if (storeRef.current) {
                await storeRef.current.set(STORE_KEY, links)
                await storeRef.current.save()
            }
        } catch (error) {
            console.error('Failed to save quick links:', error)
        }
    }, [])

    const addQuickLink = () => {
        if (!newLinkName.trim() || !newLinkUrl.trim()) return

        let urlToAdd = newLinkUrl.trim()
        if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
            urlToAdd = 'https://' + urlToAdd
        }

        const newLinks = [...quickLinks, { name: newLinkName.trim(), url: urlToAdd }]
        setQuickLinks(newLinks)
        saveQuickLinks(newLinks)

        setNewLinkName('')
        setNewLinkUrl('')
        setIsAddDialogOpen(false)
    }

    const removeQuickLink = (index: number) => {
        const newLinks = quickLinks.filter((_, i) => i !== index)
        setQuickLinks(newLinks)
        saveQuickLinks(newLinks)
    }

    // Resize WebView immediately using requestAnimationFrame
    const updateWebViewSize = useCallback(() => {
        if (!isBrowserOpen || !browserAreaRef.current || !isActive) return

        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
        }

        rafRef.current = requestAnimationFrame(async () => {
            const rect = browserAreaRef.current?.getBoundingClientRect()
            if (!rect) return

            try {
                await invoke('resize_embedded_browser', {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                })
            } catch (error) {
                // Ignore resize errors
            }
        })
    }, [isBrowserOpen, isActive])

    // Restore an existing browser on mount, or recreate it after tab/visibility driven close
    useEffect(() => {
        const checkAndRestoreBrowser = async () => {
            if (!isActive || isAddDialogOpen || isOverlayVisible) return

            try {
                const isOpen = await invoke<boolean>('is_browser_open')
                if (isOpen) {
                    await invoke('show_embedded_browser')
                    setIsBrowserOpen(true)
                    setTimeout(() => {
                        if (browserAreaRef.current) {
                            const rect = browserAreaRef.current.getBoundingClientRect()
                            invoke('resize_embedded_browser', {
                                x: rect.left,
                                y: rect.top,
                                width: rect.width,
                                height: rect.height
                            })
                        }
                    }, 50)
                    return
                }

                if (shouldRestoreBrowserRef.current) {
                    shouldRestoreBrowserRef.current = false
                    await openBrowserWindow(url)
                }
            } catch (error) {
                console.error('Failed to check browser state:', error)
            }
        }
        checkAndRestoreBrowser()
    }, [isActive, isAddDialogOpen, isOverlayVisible, openBrowserWindow, url])

    // Listen to resize events
    useEffect(() => {
        if (!isBrowserOpen || !isActive) return

        window.addEventListener('resize', updateWebViewSize)

        const resizeObserver = new ResizeObserver(updateWebViewSize)
        if (browserAreaRef.current) {
            resizeObserver.observe(browserAreaRef.current)
        }

        return () => {
            window.removeEventListener('resize', updateWebViewSize)
            resizeObserver.disconnect()
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [isBrowserOpen, updateWebViewSize, isActive])

    // Hide browser when visibility changes
    useEffect(() => {
        if (!isActive) return

        const handleVisibilityChange = () => {
            if (document.hidden && isBrowserOpen) {
                void closeBrowser(true)
            } else if (!document.hidden && shouldRestoreBrowserRef.current && !isOverlayVisible && !isAddDialogOpen) {
                shouldRestoreBrowserRef.current = false
                void openBrowserWindow(url)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [closeBrowser, isAddDialogOpen, isActive, isBrowserOpen, isOverlayVisible, openBrowserWindow, url])

    // Inject Custom Scrollbar CSS
    // Inject Custom Scrollbar CSS
    useEffect(() => {
        return; // TEMPORARILY DISABLED due to potential stability issues on Windows

        /*
        if (!isBrowserOpen) return

        const injectScrollbarStyle = async () => {
             const css = `
                // ... css content ...
            `
            // ... invoke ...
        }
        
        injectScrollbarStyle()
        */
    }, [isBrowserOpen, url])

    // Hide browser when leaving the page (Component Unmount)
    useEffect(() => {
        return () => {
            void closeBrowser(false)
        }
    }, [closeBrowser])

    const handleNavigate = async (e: React.FormEvent) => {
        e.preventDefault()
        let newUrl = inputUrl
        if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            newUrl = 'https://' + newUrl
        }
        setUrl(newUrl)

        if (isBrowserOpen) {
            try {
                await invoke('navigate_embedded_browser', { url: newUrl })
            } catch (error) {
                await openBrowserWindow(newUrl)
            }
        } else {
            await openBrowserWindow(newUrl)
        }
    }

    const handleQuickLink = async (linkUrl: string) => {
        if (isEditMode) return

        setUrl(linkUrl)
        setInputUrl(linkUrl)

        if (isBrowserOpen) {
            try {
                await invoke('navigate_embedded_browser', { url: linkUrl })
            } catch (error) {
                await openBrowserWindow(linkUrl)
            }
        } else {
            await openBrowserWindow(linkUrl)
        }
    }

    return (
        <div className="flex flex-col h-full gap-3 p-4">
            {/* Browser Controls - Pro Max Style */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-2xl">
                <div className="flex items-center p-0.5 bg-slate-100 dark:bg-black/20 rounded-full border border-slate-200 dark:border-white/5">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95"
                                    onClick={() => {
                                        setUrl('https://hijiribe.donmai.us')
                                        setInputUrl('https://hijiribe.donmai.us')
                                    }}
                                >
                                    <Home className="h-4 w-4 text-primary" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Home</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="w-px h-3 bg-slate-300 dark:bg-white/10 mx-0.5" />

                    {isBrowserOpen && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/20 hover:text-destructive transition-all active:scale-95"
                            onClick={() => void closeBrowser(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <form onSubmit={handleNavigate} className="flex-1 relative group">
                    <div className="absolute inset-0 bg-white/5 rounded-full blur transition-opacity opacity-0 group-hover:opacity-100" />
                    <div className="relative flex items-center bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-full px-3 h-9 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all">
                        <Globe className="h-3.5 w-3.5 text-slate-400 dark:text-muted-foreground mr-2 shrink-0" />
                        <input
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder={t('web.urlPlaceholder', "Enter URL...")}
                            className="flex-1 bg-transparent border-none outline-none text-xs h-full w-full text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-muted-foreground/50"
                        />
                        {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary ml-2" />}
                    </div>
                </form>

                <Button
                    onClick={(e) => handleNavigate(e as any)}
                    disabled={isLoading}
                    className="h-9 px-4 rounded-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 shadow-none transition-all active:scale-95"
                >
                    {isLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            <span className="text-xs font-semibold">{t('web.open', "Open")}</span>
                        </>
                    )}
                </Button>
            </div>

            {/* Quick Links & Tools Bar */}
            <div className="flex flex-wrap gap-2 items-center px-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {quickLinks.map((link, index) => (
                        <div key={`${link.name}-${index}`} className="relative group">
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "h-7 text-xs rounded-full border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/10 text-slate-600 dark:text-white transition-all",
                                    isEditMode && "pr-7 border-destructive/30 bg-destructive/5"
                                )}
                                onClick={() => handleQuickLink(link.url)}
                                disabled={isLoading}
                            >
                                <Globe className="h-3 w-3 mr-1.5 opacity-50" />
                                {link.name}
                            </Button>
                            {isEditMode && (
                                <button
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center bg-destructive text-white rounded-full hover:scale-110 transition-transform"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        removeQuickLink(index)
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-full border border-dashed border-slate-300 dark:border-white/20 hover:border-primary/50 hover:text-primary p-0 text-slate-500 dark:text-white/70"
                        onClick={() => setIsAddDialogOpen(true)}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-2">
                     {/* Edit Toggle */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 text-xs rounded-full px-3 transition-colors",
                             isEditMode ? "bg-destructive/20 text-destructive hover:bg-destructive/30" : "text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/5"
                        )}
                        onClick={() => setIsEditMode(!isEditMode)}
                    >
                        <Edit className="h-3 w-3 mr-1.5" />
                        {isEditMode ? t('web.done', "Done") : t('web.editLinks', "Edit")}
                    </Button>

                    {isBrowserOpen && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-black/20 rounded-full p-0.5 border border-slate-200 dark:border-white/5">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-white"
                                onClick={() => handleZoom(-0.1)}
                                title="Zoom Out"
                            >
                                <ZoomOut className="h-3 w-3" />
                            </Button>
                            <span className="text-[10px] font-mono min-w-[2.5rem] text-center text-muted-foreground select-none">
                                {Math.round(zoomLevel * 100)}%
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-white"
                                onClick={() => handleZoom(0.1)}
                                title="Zoom In"
                            >
                                <ZoomIn className="h-3 w-3" />
                            </Button>
                             <div className="w-px h-3 bg-slate-300 dark:bg-white/10 mx-0.5" />
                             <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-white"
                                onClick={handleZoomReset}
                                title="Reset"
                            >
                                <RefreshCw className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Browser Area Container - The "Glass Slab" Bezel */}
            <div className="flex-1 relative rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 shadow-sm dark:shadow-2xl dark:shadow-black/50 overflow-hidden backdrop-blur-2xl p-1 flex flex-col ring-1 ring-slate-100 dark:ring-white/5">
                {/* The "Screen" - Inset look */}
                <div
                    ref={browserAreaRef}
                    className="flex-1 rounded-[20px] overflow-hidden relative min-h-[400px] bg-white dark:bg-black shadow-none border-none"
                    style={{ backgroundColor: isBrowserOpen ? 'transparent' : undefined }}
                >
                    {!isBrowserOpen && (
                        <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 bg-[url('/grid-pattern.svg')] bg-center bg-repeat opacity-50 dark:opacity-50 opacity-[0.1]">
                            <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6 shadow-md dark:shadow-2xl border border-slate-200 dark:border-white/10 backdrop-blur-sm">
                                <Globe className="h-10 w-10 text-slate-300 dark:text-white/20" />
                            </div>
                            <h2 className="text-2xl font-bold mb-3 text-slate-500 dark:text-white/40 tracking-tight">
                                {t('web.title', "Web Browser")}
                            </h2>
                            <p className="text-slate-400 dark:text-white/20 max-w-sm text-sm leading-relaxed">
                                {t('web.description', "Integrated web view for resources and references.")}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Quick Link Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-white/10">
                    <DialogHeader>
                        <DialogTitle>{t('web.addLink', "Add Quick Link")}</DialogTitle>
                        <DialogDescription className="sr-only">
                            {t('web.addLinkDesc', "Enter the name and URL for the new quick link.")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('web.linkName', "Name")}</label>
                            <GlassInput
                                value={newLinkName}
                                onChange={(e) => setNewLinkName(e.target.value)}
                                placeholder={t('web.linkNamePlaceholder', "Site Name")}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('web.linkUrl', "URL")}</label>
                            <GlassInput
                                value={newLinkUrl}
                                onChange={(e) => setNewLinkUrl(e.target.value)}
                                placeholder={t('web.linkUrlPlaceholder', "https://example.com")}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl">
                            {t('common.cancel', "Cancel")}
                        </Button>
                        <Button onClick={addQuickLink} className="rounded-xl" disabled={!newLinkName.trim() || !newLinkUrl.trim()}>
                            {t('web.add', "Add")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
