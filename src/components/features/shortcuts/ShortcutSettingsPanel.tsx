import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/atoms/Button'
import { Switch } from '@/components/atoms/Switch'
import { useShortcutStore, eventToKeyString, type ShortcutBinding } from '@/stores/shortcut-store'
import { cn } from '@/lib/utils'
import {
    RotateCcw,
    Keyboard,
    CircleDot,
    Wand2,
    Save,
    PanelLeft,
    History,
    Palette,
    SlidersHorizontal,
    CheckCircle2,
    AlertTriangle,
    Command,
} from 'lucide-react'

const SECTION_META = {
    creation: {
        title: '核心操作',
        eyebrow: '生成与输出',
        description: '',
    },
    workspace: {
        title: '工作区切换',
        eyebrow: '面板与导航',
        description: '',
    },
} as const

const ACTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; section: keyof typeof SECTION_META; chip: string }> = {
    generate: { icon: Wand2, section: 'creation', chip: '生成' },
    saveImage: { icon: Save, section: 'creation', chip: '输出' },
    openSettings: { icon: SlidersHorizontal, section: 'workspace', chip: '设置' },
    toggleHistory: { icon: History, section: 'workspace', chip: '历史' },
    openArtistLibrary: { icon: Palette, section: 'workspace', chip: '素材' },
    toggleSidebar: { icon: PanelLeft, section: 'workspace', chip: '布局' },
}

/**
 * 快捷键设置面板
 * @description 以表格形式展示所有快捷键绑定，支持录制自定义按键组合
 */
export function ShortcutSettingsPanel() {
    const { t } = useTranslation()
    const { bindings, updateBinding, toggleBinding, resetToDefaults } = useShortcutStore()
    const [recordingId, setRecordingId] = useState<string | null>(null)
    const [conflict, setConflict] = useState<string | null>(null)
    const recordingRef = useRef<string | null>(null)
    const groupedBindings = useMemo(() => {
        return bindings.reduce<Record<keyof typeof SECTION_META, ShortcutBinding[]>>(
            (acc, binding) => {
                const section = ACTION_META[binding.actionId]?.section ?? 'workspace'
                acc[section].push(binding)
                return acc
            },
            { creation: [], workspace: [] }
        )
    }, [bindings])
    const activeCount = bindings.filter((binding) => binding.enabled).length
    const disabledCount = bindings.length - activeCount
    const recordingBinding = bindings.find((binding) => binding.actionId === recordingId) ?? null

    // 同步 ref
    useEffect(() => {
        recordingRef.current = recordingId
    }, [recordingId])

    /** 录制快捷键 */
    const handleRecord = useCallback(
        (e: KeyboardEvent) => {
            if (!recordingRef.current) return

            // 忽略单独的修饰键
            const ignoredKeys = ['Control', 'Alt', 'Shift', 'Meta']
            if (ignoredKeys.includes(e.key)) return

            e.preventDefault()
            e.stopPropagation()

            const keyStr = eventToKeyString(e)
            const actionId = recordingRef.current

            // Escape 取消录制
            if (e.key === 'Escape') {
                setRecordingId(null)
                setConflict(null)
                return
            }

            // 检测冲突
            const conflictBinding = bindings.find(
                (b) => b.keys === keyStr && b.actionId !== actionId && b.enabled
            )
            if (conflictBinding) {
                setConflict(`与「${conflictBinding.label}」冲突`)
                // 3 秒后清除冲突提示
                setTimeout(() => setConflict(null), 3000)
                return
            }

            updateBinding(actionId, keyStr)
            setRecordingId(null)
            setConflict(null)
        },
        [bindings, updateBinding]
    )

    useEffect(() => {
        if (recordingId) {
            window.addEventListener('keydown', handleRecord, true)
            return () => window.removeEventListener('keydown', handleRecord, true)
        }
    }, [recordingId, handleRecord])

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <section className="space-y-3">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-800 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                            <Keyboard className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-white/40">
                                {t('settings.shortcuts.title', '快捷键设置')}
                            </p>
                            <h3 className="text-base font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                                键盘绑定
                            </h3>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 rounded-xl border border-black/5 bg-white/60 px-4 text-xs font-medium text-slate-600 shadow-sm transition-all hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={resetToDefaults}
                    >
                        <RotateCcw className="mr-2 h-3.5 w-3.5" />
                        {t('settings.shortcuts.reset', '恢复默认')}
                    </Button>
                </div>
            </section>

            <section className="rounded-[1.5rem] border border-black/5 bg-white/95 p-4 shadow-sm dark:border-white/10 dark:bg-[#08090d] dark:shadow-none">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                        <StatusChip icon={Command} label={`${activeCount} 已启用`} tone="default" />
                        <StatusChip icon={Keyboard} label={`${disabledCount} 已静默`} tone="muted" />
                        {recordingBinding && <StatusChip icon={CircleDot} label={`正在录制 ${recordingBinding.label}`} tone="recording" />}
                    </div>
                </div>
            </section>

            <AnimatePresence>
                {recordingBinding && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex flex-col gap-3 rounded-[1.25rem] border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm dark:border-indigo-400/20 dark:bg-indigo-500/10 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-[0_10px_28px_rgba(99,102,241,0.22)]">
                                <CircleDot className="h-4 w-4 animate-pulse" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    正在录制：{recordingBinding.label}
                                </p>
                                <p className="text-xs text-slate-600 dark:text-white/55">
                                    现在按下新的组合键，或按 <span className="font-semibold">Escape</span> 取消。
                                </p>
                            </div>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-[11px] font-medium text-indigo-700 dark:border-indigo-400/20 dark:bg-white/5 dark:text-indigo-200">
                            等待新的按键组合
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {conflict && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-start gap-3 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100"
                    >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                            <p className="font-semibold">快捷键冲突</p>
                            <p className="text-xs text-amber-800/80 dark:text-amber-100/70">{conflict}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-5">
                {(Object.keys(SECTION_META) as Array<keyof typeof SECTION_META>).map((sectionKey) => {
                    const sectionBindings = groupedBindings[sectionKey]
                    if (sectionBindings.length === 0) return null

                    const section = SECTION_META[sectionKey]

                    return (
                        <section key={sectionKey} className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/40">
                                        {section.eyebrow}
                                    </p>
                                    <h4 className="mt-1 text-base font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">
                                        {section.title}
                                    </h4>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-[1.35rem] border border-black/5 bg-white/95 shadow-sm dark:border-white/10 dark:bg-[#08090d] dark:shadow-none">
                                <div className="grid grid-cols-[minmax(0,1.2fr)_150px_88px] gap-3 border-b border-black/5 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-white/8 dark:text-white/35">
                                    <span>{t('settings.shortcuts.action', '动作')}</span>
                                    <span className="text-center">{t('settings.shortcuts.keybinding', '快捷键')}</span>
                                    <span className="text-center">{t('settings.shortcuts.enabled', '启用')}</span>
                                </div>

                                {sectionBindings.map((binding, index) => (
                                    <ShortcutRow
                                        key={binding.actionId}
                                        binding={binding}
                                        isRecording={recordingId === binding.actionId}
                                        isLast={index === sectionBindings.length - 1}
                                        onStartRecording={() => {
                                            setRecordingId(binding.actionId)
                                            setConflict(null)
                                        }}
                                        onToggle={() => toggleBinding(binding.actionId)}
                                    />
                                ))}
                            </div>
                        </section>
                    )
                })}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <HintCard
                    icon={CheckCircle2}
                    title={t('settings.shortcuts.hint1', '点击快捷键区域后按下新的按键组合即可修改')}
                    detail="组合尽量短。"
                />
                <HintCard
                    icon={Keyboard}
                    title={t('settings.shortcuts.hint2', '按 Escape 取消录制')}
                    detail="关闭后可随时恢复。"
                />
            </div>
        </div>
    )
}

/** 单行快捷键绑定 */
function ShortcutRow({
    binding,
    isRecording,
    isLast,
    onStartRecording,
    onToggle,
}: {
    binding: ShortcutBinding
    isRecording: boolean
    isLast: boolean
    onStartRecording: () => void
    onToggle: () => void
}) {
    const meta = ACTION_META[binding.actionId] ?? { icon: Keyboard, chip: '快捷键', section: 'workspace' as const }
    const Icon = meta.icon

    return (
        <div className={cn(
            "grid grid-cols-[minmax(0,1.2fr)_150px_88px] gap-3 px-5 py-4 items-center transition-colors",
            !isLast && "border-b border-black/5 dark:border-white/8",
            isRecording && "bg-indigo-50/70 dark:bg-indigo-500/10",
            !binding.enabled && "opacity-75"
        )}>
            <div className="flex min-w-0 items-start gap-3">
                <div className={cn(
                    "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
                    isRecording
                        ? "border-indigo-200 bg-indigo-500 text-white shadow-[0_10px_24px_rgba(99,102,241,0.18)] dark:border-indigo-400/20 dark:bg-indigo-500"
                        : "border-black/5 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-[#0e0f12] dark:text-white/80"
                )}>
                    <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className={cn(
                            "truncate text-sm font-semibold tracking-[-0.01em]",
                            binding.enabled ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-white/35"
                        )}>
                            {binding.label}
                        </span>
                        <span className="rounded-full border border-black/5 bg-black/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-[#0e0f12] dark:text-white/35">
                            {meta.chip}
                        </span>
                    </div>
                    <span className="block text-[12px] leading-5 text-slate-500 dark:text-white/45">
                        {binding.description}
                    </span>
                </div>
            </div>

            <button
                onClick={onStartRecording}
                className={cn(
                    "group flex min-h-[52px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-mono transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300/70 dark:focus:ring-white/15",
                    isRecording
                        ? "border-indigo-300 bg-indigo-500 text-white shadow-[0_10px_24px_rgba(99,102,241,0.2)] dark:border-indigo-400/20 dark:bg-indigo-500"
                        : "border-black/5 bg-white/75 text-slate-700 shadow-sm hover:border-black/10 hover:bg-white dark:border-white/10 dark:bg-[#0e0f12] dark:text-white/80 dark:hover:border-white/20 dark:hover:bg-[#15171b]"
                )}
            >
                {isRecording ? (
                    <span className="flex items-center gap-2">
                        <CircleDot className="h-3.5 w-3.5 animate-pulse" />
                        录制中...
                    </span>
                ) : (
                    <KeyDisplay keys={binding.keys} />
                )}
            </button>

            <div className="flex items-center justify-center">
                <Switch checked={binding.enabled} onCheckedChange={onToggle} />
            </div>
        </div>
    )
}

/** 按键名称美化显示 */
function KeyDisplay({ keys }: { keys: string }) {
    const parts = keys.split('+')
    return (
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {parts.map((part, i) => (
                <React.Fragment key={i}>
                    <kbd className="inline-flex min-w-[32px] items-center justify-center rounded-lg border border-black/5 bg-white px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-[#0e0f12] dark:text-slate-100">
                        {part}
                    </kbd>
                    {i < parts.length - 1 && <span className="text-slate-300 dark:text-white/15 text-[10px] font-semibold">+</span>}
                </React.Fragment>
            ))}
        </div>
    )
}

function StatusChip({
    icon: Icon,
    label,
    tone,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    tone: 'default' | 'muted' | 'recording'
}) {
    return (
        <div className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm",
            tone === 'recording'
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200"
                : tone === 'muted'
                    ? "border-black/5 bg-black/[0.03] text-slate-500 dark:border-white/10 dark:bg-[#0e0f12] dark:text-white/45"
                    : "border-black/5 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-[#08090d] dark:text-white/60"
        )}>
            <Icon className="h-3.5 w-3.5" />
            {label}
        </div>
    )
}

function HintCard({
    icon: Icon,
    title,
    detail,
}: {
    icon: React.ComponentType<{ className?: string }>
    title: string
    detail: string
}) {
    return (
        <div className="rounded-[1.25rem] border border-black/5 bg-white/95 px-4 py-4 shadow-sm dark:border-white/10 dark:bg-[#08090d] dark:shadow-none">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-black/5 bg-white text-slate-800 shadow-sm dark:border-white/10 dark:bg-[#0e0f12] dark:text-white">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <div className="text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-white/45">{detail}</div>
                </div>
            </div>
        </div>
    )
}
