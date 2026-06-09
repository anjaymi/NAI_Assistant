import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/Dialog'
import SystemSettingsPanel from '@/components/organisms/SystemSettingsPanel'
import SyncSettingsPanel from '@/components/organisms/SyncSettingsPanel'
import { ShortcutSettingsPanel } from '@/components/features/shortcuts/ShortcutSettingsPanel'
import { useTranslation } from 'react-i18next'
import { Settings, Files, Network, Palette, X, Cloud, Keyboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as React from 'react'
import { Button } from '@/components/atoms/Button'

interface SettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = React.useState<'general' | 'appearance' | 'api' | 'storage' | 'sync' | 'shortcuts'>('general')

    const tabs = [
        { id: 'general', label: t('settings.tabs.general', '系统'), icon: Settings, eyebrow: '基础设置' },
        { id: 'storage', label: t('settings.tabs.storage', '存储'), icon: Files, eyebrow: '文件路径' },
        { id: 'sync', label: t('settings.tabs.sync', '云同步'), icon: Cloud, eyebrow: '账户与中继' },
        { id: 'api', label: t('settings.tabs.api', '集成'), icon: Network, eyebrow: '外部服务' },
        { id: 'appearance', label: t('settings.tabs.appearance', '外观'), icon: Palette, eyebrow: '界面视觉' },
        { id: 'shortcuts', label: t('settings.tabs.shortcuts', '快捷键'), icon: Keyboard, eyebrow: '操作层' },
    ] as const

    const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]
    const CurrentTabIcon = currentTab.icon

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent hideClose className={cn(
                "max-w-[1120px] w-full p-0 overflow-hidden z-[100] relative",
                "bg-[#eef2f6] dark:bg-[#05060a] backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-[0_32px_90px_rgba(15,23,42,0.18)] dark:shadow-[0_26px_90px_rgba(0,0,0,0.58)]",
                "rounded-[2rem] md:h-[680px] h-[82vh] flex flex-row"
            )}>
                 <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.45),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.28),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_18%)]" />

                 <div className="w-[260px] bg-[#d4d7da] dark:bg-[#020206] border-r border-black/5 dark:border-[#0d0e12] flex flex-col p-4 gap-4 relative z-10 shrink-0 shadow-[inset_-1px_0_0_rgba(255,255,255,0.28)] dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.015)]">
                    <div className="px-3 pt-2">
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-white/35 uppercase tracking-[0.24em]">
                            {t('settings.headers.settings', '设置')}
                        </div>
                    </div>

                    <div className="space-y-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "group flex w-full items-start gap-3 rounded-[1.1rem] border px-3 py-3 text-left transition-all duration-200",
                                 activeTab === tab.id 
                                    ? "border-black/5 bg-white text-slate-950 shadow-[0_10px_28px_rgba(15,23,42,0.08)] dark:border-[#14161a] dark:bg-[#0e0f12] dark:text-white"
                                    : "border-transparent text-slate-500 hover:border-black/5 hover:bg-white/72 hover:text-slate-900 dark:text-white/42 dark:hover:border-[#101116] dark:hover:bg-[#07080b] dark:hover:text-white/80"
                            )}
                        >
                            <div className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                                activeTab === tab.id
                                     ? "border-black/5 bg-slate-100 text-slate-900 dark:border-[#14161a] dark:bg-[#15171b] dark:text-white"
                                     : "border-black/5 bg-white/85 text-slate-500 dark:border-[#0d0e12] dark:bg-[#0a0b0f] dark:text-white/45"
                            )}>
                                <tab.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-white/22">
                                    {tab.eyebrow}
                                </div>
                                <div className="mt-1 text-sm font-semibold tracking-[-0.01em]">
                                    {tab.label}
                                </div>
                            </div>
                        </button>
                    ))}
                    </div>

                    <div className="mt-auto h-2" />
                 </div>

                 <div className="flex-1 flex flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(250,252,255,0.68))] dark:bg-[linear-gradient(180deg,rgba(10,11,16,0.88),rgba(7,8,12,0.94))] relative z-10 backdrop-blur-sm">
                     <div className="border-b border-black/5 dark:border-white/8 px-8 py-7 bg-white/40 dark:bg-white/[0.02]">
                        <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-6 pr-10">
                            <div className="flex items-start gap-4">
                                 <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-black/5 bg-white/82 text-slate-900 shadow-sm dark:border-white/10 dark:bg-[#0e0f12] dark:text-white">
                                     <CurrentTabIcon className="h-5 w-5" />
                                 </div>
                                <div className="space-y-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-white/35">
                                        {currentTab.eyebrow}
                                    </div>
                                    <DialogTitle className="text-[1.3rem] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                                        {currentTab.label}
                                    </DialogTitle>
                                </div>
                            </div>
                        </div>
                        <DialogDescription className="sr-only">
                            {currentTab.label} 设置
                        </DialogDescription>
                     </div>

                     <div className="absolute top-5 right-5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-2xl border border-black/5 bg-white/82 text-slate-500 shadow-sm transition-all hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-[#0e0f12] dark:text-white/45 dark:hover:bg-[#15171b] dark:hover:text-white"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                     </div>

                    <div className="flex-1 overflow-y-auto px-8 py-7 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),transparent_18%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_16%)]">
                        <div className="mx-auto w-full max-w-3xl space-y-8 rounded-[1.75rem] border border-black/5 bg-[#fcfdff] px-6 py-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-white/8 dark:bg-[#08090d] dark:shadow-none">
                             {activeTab === 'sync' ? (
                                 <SyncSettingsPanel />
                              ) : activeTab === 'shortcuts' ? (
                                 <ShortcutSettingsPanel />
                             ) : (
                                 <SystemSettingsPanel activeTab={activeTab} />
                             )}
                         </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
