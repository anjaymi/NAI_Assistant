import { LayoutDashboard, Image as ImageIcon, Wand2, Settings, Dices, MonitorSmartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settings-store';
export type MobileTabId = 'gallery' | 'canvas' | 'generate' | 'random' | 'tools' | 'settings';

interface MobileNavBarProps {
    activeTab: MobileTabId;
    onTabChange: (tab: MobileTabId) => void;
}

export function MobileNavBar({ activeTab, onTabChange }: MobileNavBarProps) {
    const { t } = useTranslation();
    const { } = useSettingsStore();
    const navItems = [
        { id: 'gallery' as const, icon: LayoutDashboard, label: t('nav.gallery', 'Gallery') },
        { id: 'generate' as const, icon: ImageIcon, label: t('nav.generate', 'Generate') },
        { id: 'random' as const, icon: Dices, label: t('nav.random', 'Random') },
        { id: 'tools' as const, icon: Wand2, label: t('nav.tools', 'Tools') },
        { id: 'settings' as const, icon: Settings, label: t('nav.settings', 'Settings') },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50">
            {/* Gradient fade above nav for smoother transition */}
            <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-white/80 dark:from-black/50 to-transparent pointer-events-none" />
            


            <div className="flex flex-row w-full items-center justify-around pb-[max(12px,env(safe-area-inset-bottom))] pt-3 bg-white/70 dark:bg-black/50 backdrop-blur-3xl border-t border-white/20 dark:border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <motion.button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            whileTap={{ scale: 0.9 }}
                            className={cn(
                                "flex flex-col items-center gap-1 px-2 py-1 transition-all duration-300 relative group focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]",
                                isActive ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/70"
                            )}
                            style={{ minWidth: '64px' }}
                        >
                            <div className="relative p-1.5 rounded-2xl transition-all duration-300">
                                {/* 活跃标签滑动追踪指示器 */}
                                {isActive && (
                                    <motion.div
                                        layoutId="activeNavPill"
                                        className="absolute inset-0 bg-white/50 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.05)] rounded-2xl"
                                        transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
                                    />
                                )}
                                <motion.div
                                    animate={isActive ? { scale: [1, 1.25, 1], y: [0, -2, 0] } : { scale: 1, y: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                >
                                    <item.icon className={cn(
                                        "w-6 h-6 transition-all duration-300 relative z-10",
                                        isActive && "stroke-[2.5px]"
                                    )} />
                                </motion.div>
                            </div>
                            
                            <span className={cn(
                                "text-[10px] font-medium tracking-wide transition-all duration-300",
                                isActive ? "opacity-100 translate-y-0" : "opacity-70"
                            )}>
                                {item.label}
                            </span>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
