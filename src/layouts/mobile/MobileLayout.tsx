import React, { lazy, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MobileNavBar, MobileTabId } from './components/MobileNavBar';
import { Toaster } from '@/components/organisms/Toaster';
import { useTranslation } from 'react-i18next';
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary';

const MobileGalleryPanel = lazy(() => import('./components/gallery/MobileGalleryPanel').then((module) => ({ default: module.MobileGalleryPanel })));
const MobileGeneratePanel = lazy(() => import('./components/MobileGeneratePanel').then((module) => ({ default: module.MobileGeneratePanel })));
const MobileToolsPanel = lazy(() => import('./components/MobileToolsPanel').then((module) => ({ default: module.MobileToolsPanel })));
const MobileSettingsPanel = lazy(() => import('./components/MobileSettingsPanel').then((module) => ({ default: module.MobileSettingsPanel })));
const MobileInspirationPanel = lazy(() => import('./components/MobileInspirationPanel').then((module) => ({ default: module.MobileInspirationPanel })));
const MobileCanvasPanel = lazy(() => import('./components/canvas/MobileCanvasPanel').then((module) => ({ default: module.MobileCanvasPanel })));

export function MobileLayout() {
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
    const [activeTab, setActiveTabState] = useState<MobileTabId>(() => {
        const hash = window.location.hash.replace('#', '')
        const validTabs = ['gallery', 'generate', 'tools', 'random', 'settings', 'canvas']
        return validTabs.includes(hash) ? (hash as MobileTabId) : 'gallery'
    });
    const { t } = useTranslation();

    // Custom setter that also updates the URL hash for history management
    const setActiveTab = (tab: MobileTabId) => {
        setActiveTabState(tab);
        if (window.location.hash !== `#${tab}`) {
            window.location.hash = tab;
        }
    };

    // Listen to device Back button / URL history changes
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '')
            const validTabs = ['gallery', 'generate', 'tools', 'random', 'settings', 'canvas']
            if (validTabs.includes(hash) && hash !== activeTab) {
                setActiveTabState(hash as MobileTabId)
            } else if (!hash) {
                // Default fallback if hash is empty
                setActiveTabState('gallery')
            }
        };

        // Ensure initial hash is set if missing
        if (!window.location.hash) {
            window.history.replaceState(null, '', '#gallery');
        }

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [activeTab]);

    // Detect virtual keyboard to prevent layout squeezing
    useEffect(() => {
        if (!window.visualViewport) return;
        
        // Use a baseline height that ignores small UI jitter (like address bar hiding)
        const baseHeight = window.innerHeight;
        
        const handleResize = () => {
             const currentHeight = window.visualViewport?.height || window.innerHeight;
             // If height drops significantly (>150px), assume keyboard is up
             if (baseHeight - currentHeight > 150) {
                 setIsKeyboardOpen(true);
             } else {
                 setIsKeyboardOpen(false);
             }
        };

        window.visualViewport.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleNavigate = (e: CustomEvent<MobileTabId>) => {
            setActiveTab(e.detail);
        };
        window.addEventListener('navigate-mobile', handleNavigate as EventListener);
        return () => window.removeEventListener('navigate-mobile', handleNavigate as EventListener);
    }, []);

    const isHarmonyOptimized = import.meta.env.VITE_HARMONY_OPTIMIZED === 'true';

    const renderLazyTab = (label: string, child: React.ReactNode) => (
        <LazyModuleBoundary className="absolute inset-0 h-full w-full" mode="overlay" label={label}>
            {child}
        </LazyModuleBoundary>
    );

    const renderAnimatedTabs = () => (
        <AnimatePresence initial={false}>
            {activeTab === 'gallery' && (
                <motion.div key="gallery" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }} transition={{ type: "spring", damping: 25, stiffness: 350, mass: 0.6 }} style={{ willChange: 'transform, opacity' }} className="absolute inset-0 w-full h-full">
                    {renderLazyTab('Loading gallery...', <MobileGalleryPanel className="h-full" />)}
                </motion.div>
            )}
            {activeTab === 'canvas' && (
                <motion.div key="canvas" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }} transition={{ type: "spring", damping: 25, stiffness: 350, mass: 0.6 }} style={{ willChange: 'transform, opacity' }} className="absolute inset-0 w-full h-full">
                    {renderLazyTab('Loading canvas...', <MobileCanvasPanel />)}
                </motion.div>
            )}
            {activeTab === 'generate' && (
                <motion.div key="generate" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }} transition={{ type: "spring", damping: 25, stiffness: 350, mass: 0.6 }} style={{ willChange: 'transform, opacity' }} className="absolute inset-0 w-full h-full">
                    {renderLazyTab('Loading generator...', <MobileGeneratePanel />)}
                </motion.div>
            )}
            {activeTab === 'tools' && (
                <motion.div key="tools" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }} transition={{ type: "spring", damping: 25, stiffness: 350, mass: 0.6 }} style={{ willChange: 'transform, opacity' }} className="absolute inset-0 w-full h-full">
                    {renderLazyTab('Loading smart tools...', <MobileToolsPanel />)}
                </motion.div>
            )}
            {activeTab === 'random' && (
                <motion.div key="random" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }} transition={{ type: "spring", damping: 25, stiffness: 350, mass: 0.6 }} style={{ willChange: 'transform, opacity' }} className="absolute inset-0 w-full h-full">
                    {renderLazyTab('Loading inspiration studio...', <MobileInspirationPanel />)}
                </motion.div>
            )}
            {activeTab === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }} transition={{ type: "spring", damping: 25, stiffness: 350, mass: 0.6 }} style={{ willChange: 'transform, opacity' }} className="absolute inset-0 w-full h-full">
                    {renderLazyTab('Loading settings...', <MobileSettingsPanel />)}
                </motion.div>
            )}
        </AnimatePresence>
    );

    const renderSimplifiedTabs = () => (
        <>
            {activeTab === 'gallery' && <div className="absolute inset-0 w-full h-full">{renderLazyTab('Loading gallery...', <MobileGalleryPanel className="h-full" />)}</div>}
            {activeTab === 'canvas' && <div className="absolute inset-0 w-full h-full">{renderLazyTab('Loading canvas...', <MobileCanvasPanel />)}</div>}
            {activeTab === 'generate' && <div className="absolute inset-0 w-full h-full">{renderLazyTab('Loading generator...', <MobileGeneratePanel />)}</div>}
            {activeTab === 'tools' && <div className="absolute inset-0 w-full h-full">{renderLazyTab('Loading smart tools...', <MobileToolsPanel />)}</div>}
            {activeTab === 'random' && <div className="absolute inset-0 w-full h-full">{renderLazyTab('Loading inspiration studio...', <MobileInspirationPanel />)}</div>}
            {activeTab === 'settings' && <div className="absolute inset-0 w-full h-full">{renderLazyTab('Loading settings...', <MobileSettingsPanel />)}</div>}
        </>
    );

    return (
        <div 
            className={cn("flex flex-col h-screen h-[100dvh] w-full bg-[#FAFAFA] dark:bg-[#05060A] text-slate-900 dark:text-white overflow-hidden", activeTab !== 'canvas' && !isKeyboardOpen && "pb-[calc(80px+env(safe-area-inset-bottom))]")}
            style={{ minHeight: '100vh', height: '100dvh' }}
        >
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[30%] bg-blue-500/10 dark:bg-blue-500/20 blur-[100px] pointer-events-none rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-pink-500/10 dark:bg-pink-500/15 blur-[120px] pointer-events-none rounded-full" />

            {/* Global Tauri Drag Region for Mobile Layout on Desktop */}
            <div data-tauri-drag-region className="absolute top-0 left-0 w-full h-10 z-[100]" />
            
            {/* Content Area */}
            <div className="flex-1 w-full relative overflow-hidden">
                {isHarmonyOptimized ? renderSimplifiedTabs() : renderAnimatedTabs()}
            </div>

            {/* Bottom Navigation */}
            {activeTab !== 'canvas' && !isKeyboardOpen && (
                <MobileNavBar activeTab={activeTab} onTabChange={setActiveTab} />
            )}
            
            <Toaster />
        </div>
    );
}
