import React, { lazy, useState } from 'react';
import { LayoutDashboard, Image as ImageIcon, Wand2, Settings, History, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { GalleryPanel } from '@/components/organisms/GalleryPanel';
import { Toaster } from '@/components/organisms/Toaster';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/atoms/ScrollArea';
import { PromptArea } from '@/components/organisms/PromptArea';
import { useGenerationStore } from '@/stores/generation-store';
import { Button } from '@/components/atoms/Button';
import { shallow } from 'zustand/shallow';
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary';

const MobileSettingsPanel = lazy(() => import('@/layouts/mobile/components/MobileSettingsPanel').then((module) => ({ default: module.MobileSettingsPanel })));
const ImagePreview = lazy(() => import('@/components/organisms/ImagePreview').then((module) => ({ default: module.ImagePreview })));
const ToolsPanel = lazy(() => import('@/components/organisms/ToolsPanel').then((module) => ({ default: module.ToolsPanel })));

type TabletTabId = 'generate' | 'gallery' | 'history' | 'tools' | 'settings';

export function TabletLayout() {
    const [activeTab, setActiveTab] = useState<TabletTabId>('generate');
    const { t } = useTranslation();
    const {
        generate,
        isGenerating,
        previewImage,
        width,
        height,
        generationProgress
    } = useGenerationStore(
        (state) => ({
            generate: state.generate,
            isGenerating: state.isGenerating,
            previewImage: state.previewImage,
            width: state.width,
            height: state.height,
            generationProgress: state.generationProgress,
        }),
        shallow
    );

    const navItems = [
        { id: 'generate', icon: ImageIcon, label: 'Generate' },
        { id: 'gallery', icon: LayoutDashboard, label: 'Gallery' },
        { id: 'history', icon: History, label: 'History' },
        { id: 'tools', icon: Wand2, label: 'Tools' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="flex h-screen w-full bg-black text-white overflow-hidden">
            {/* Sidebar Navigation (Rail) */}
            <div className="w-20 shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl flex flex-col items-center py-6 gap-6 z-20">
                <div className="text-xl font-bold text-primary tracking-tighter mb-4">NAI</div>
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as TabletTabId)}
                            className={cn(
                                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 relative group",
                                isActive ? "bg-primary/20 text-primary" : "text-white/40 hover:text-white/80 hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn("w-6 h-6", isActive && "stroke-[2.5px]")} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-md -ml-2" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative overflow-hidden bg-black/95">
                
                {/* Generate View: Master-Detail / Split View */}
                {activeTab === 'generate' && (
                    <div className="flex h-full w-full">
                        {/* Left: Image Preview (Master) */}
                        <div className="flex-1 relative border-r border-white/10 bg-black/20 p-4 flex flex-col">
                             <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 shadow-2xl">
                                <LazyModuleBoundary className="h-full min-h-0" label="Loading preview canvas...">
                                    <ImagePreview
                                        imageSrc={previewImage}
                                        isGenerating={isGenerating}
                                        progress={generationProgress}
                                        className="w-full h-full object-contain"
                                        originalWidth={width}
                                        originalHeight={height}
                                    />
                                </LazyModuleBoundary>
                             </div>
                        </div>

                        {/* Right: Controls (Detail) */}
                        <div className="w-[380px] shrink-0 bg-black/40 backdrop-blur-md flex flex-col border-l border-white/5">
                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-6">
                                     <PromptArea />
                                </div>
                            </ScrollArea>
                            <div className="p-4 border-t border-white/10 bg-black/60">
                                <Button
                                    variant="default"
                                    className="w-full h-14 text-lg font-bold shadow-2xl shadow-primary/30 rounded-xl"
                                    onClick={() => generate()}
                                    disabled={isGenerating}
                                >
                                    {isGenerating ? t('common.generating', 'Generating...') : t('common.generate', 'Generate')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Gallery View */}
                {activeTab === 'gallery' && (
                    <div className="w-full h-full p-4">
                        <GalleryPanel className="h-full border-none" />
                    </div>
                )}

                {/* History View */}
                {activeTab === 'history' && (
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                        {t('common.history', 'History')} - Tablet View
                    </div>
                )}

                 {/* Tools View */}
                 {activeTab === 'tools' && (
                    <div className="w-full h-full relative">
                        <LazyModuleBoundary className="h-full min-h-0" label="Loading smart tools...">
                            <ToolsPanel />
                        </LazyModuleBoundary>
                    </div>
                )}

                {/* Settings View */}
                {activeTab === 'settings' && (
                    <div className="w-full h-full relative">
                        <LazyModuleBoundary className="h-full min-h-0" label="Loading settings...">
                            <MobileSettingsPanel />
                        </LazyModuleBoundary>
                    </div>
                )}
            </div>
            
            <Toaster />
        </div>
    );
}
