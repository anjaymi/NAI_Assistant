import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

// Simplified for now since we don't have routing set up exactly the same way yet
// Using tabs instead of links for SPA feel, or just visual pills
// Actually NAI_Assistant is a single page app with MainPage switching tabs internally
// So this Navigation might need to be "Tab Navigation" or stick to URL routing if enabled.
// For now, let's keep it visuals-only or simple links.
// Given MainPage manages 'activeTab', this might be redundant with AnimatedNavBar?
// Wait, SANA used this for Top Level Navigation (Home, Scenes, Tools, Web, Library).
// NAI_Assistant has Center Panel Tabs (Generate, History, Canvas, Tools).
// Let's implement this as Top Level Navigation if we plan to have multiple pages.
// Currently App.tsx only renders MainPage.
// We will assume future expansion and keep it here.

export function Navigation() {
    const { t } = useTranslation()
    const location = useLocation() // Assuming BrowserRouter is wrapping App
    const currentPath = location.pathname

    const navItems = [
        { path: '/', labelKey: 'nav.main' },
        // { path: '/scenes', labelKey: 'nav.scenes' },
        // { path: '/tools', labelKey: 'smartTools.title' },
        // { path: '/library', labelKey: 'nav.library' },
    ]

    return (
        <div className="sticky top-0 z-30 flex justify-center mb-6 pointer-events-none py-4">
            <nav className="pointer-events-auto inline-flex items-center p-1.5 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-lg shadow-indigo-500/5 ring-1 ring-black/5 dark:ring-white/5 transform transition-all hover:scale-[1.01]">
                {navItems.map((item) => {
                    const isActive = currentPath === item.path
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300",
                                isActive 
                                    ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" 
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                            )}
                        >
                            {t(item.labelKey, item.labelKey === 'nav.main' ? 'Main' : item.labelKey)}
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}
