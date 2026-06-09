import { useTranslation } from 'react-i18next'
import * as React from 'react'

import { Button } from '@/components/atoms/Button'
import { GlassSurface } from '@/components/atoms/GlassSurface'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { cn } from '@/lib/utils'
import { Play, Pause, X, Plus, Layers, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { useGenerationStore } from '@/stores/generation-store'
import { shallow } from 'zustand/shallow'

interface MobileBatchQueuePanelProps {
    className?: string
}

export function MobileBatchQueuePanel({ className }: MobileBatchQueuePanelProps) {
    const { t } = useTranslation()
    const { 
        queue,
        isQueueRunning,
        addToQueue,
        removeFromQueue,
        startQueue,
        pauseQueue,
        clearQueue,
        useDynamicQueueParams,
        setUseDynamicQueueParams
    } = useGenerationStore(
        (state) => ({
            queue: state.queue,
            isQueueRunning: state.isQueueRunning,
            addToQueue: state.addToQueue,
            removeFromQueue: state.removeFromQueue,
            startQueue: state.startQueue,
            pauseQueue: state.pauseQueue,
            clearQueue: state.clearQueue,
            useDynamicQueueParams: state.useDynamicQueueParams,
            setUseDynamicQueueParams: state.setUseDynamicQueueParams,
        }),
        shallow
    )

    const [countStr, setCountStr] = React.useState('1')
    
    // Ensure numeric count is valid for submission
    const getValidCount = () => {
        const num = parseInt(countStr)
        if (isNaN(num) || num < 1) return 1
        if (num > 100) return 100
        return num
    }

    const handleBlur = () => {
        setCountStr(getValidCount().toString())
    }

    // --- Grouping Logic ---
    const displayItems = React.useMemo(() => {
        const groups: Record<string, typeof queue> = {}
        const singles: typeof queue = []

        queue.forEach(item => {
            if (item.batchId) {
                if (!groups[item.batchId]) groups[item.batchId] = []
                groups[item.batchId].push(item)
            } else {
                singles.push(item)
            }
        })
        
        const batchKeys = Object.keys(groups)
        const displayItems: Array<{ type: 'batch', items: typeof queue, id: string, createdAt: number } | { type: 'single', item: typeof queue[0], createdAt: number }> = []

        batchKeys.forEach(key => {
            const items = groups[key]
            if (items.length > 0) {
                displayItems.push({ type: 'batch', items, id: key, createdAt: items[0].createdAt })
            }
        })

        singles.forEach(item => {
            displayItems.push({ type: 'single', item, createdAt: item.createdAt })
        })

        // Sort by createdAt desc (newest first)
        return displayItems.sort((a, b) => b.createdAt - a.createdAt)
    }, [queue])

    // --- Batch Item Component ---
    const BatchCard = ({ items, id }: { items: typeof queue, id: string }) => {
        const [isExpanded, setIsExpanded] = React.useState(false)
        const { t } = useTranslation()
        const removeFromQueue = useGenerationStore((state) => state.removeFromQueue)
        
        const total = items.length
        const completed = items.filter(i => i.status === 'completed').length
        const failed = items.filter(i => i.status === 'failed').length
        const pending = items.filter(i => i.status === 'pending').length
        const generating = items.filter(i => i.status === 'generating').length
        
        // Progress percentage
        const progress = total === 0 ? 0 : Math.round(((completed + failed) / total) * 100)
        
        // Latest active item status
        const activeItem = items.find(i => i.status === 'generating') || items.find(i => i.status === 'pending')
        
        const handleDeleteBatch = (e: React.MouseEvent) => {
            e.stopPropagation()
            items.forEach(item => removeFromQueue(item.id))
        }

        return (
            <motion.div 
                layout
                className="rounded-[16px] border border-slate-200 bg-white/80 dark:border-white/5 dark:bg-white/[0.02] overflow-hidden transition-all shadow-sm mb-2"
            >
                {/* Batch Header - Click to toggle expand */}
                <motion.div 
                    whileTap={{ scale: 0.98 }}
                    className="p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3 select-none"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {/* Icon & Progress */}
                    <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                         <svg className="w-full h-full transform -rotate-90">
                            <circle cx="20" cy="20" r="16" stroke="currentColor" fill="transparent" strokeWidth="4" className="text-slate-200 dark:text-white/10" />
                            <circle 
                                cx="20" cy="20" r="16" 
                                stroke="currentColor" 
                                fill="transparent" 
                                strokeWidth="4" 
                                className="text-primary transition-all duration-500 ease-out"
                                strokeDasharray={100}
                                strokeDashoffset={100 - progress}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute text-[9px] font-bold text-slate-500 dark:text-white/50">{progress}%</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                             <span className="text-[13px] font-semibold text-slate-800 dark:text-white/90 tracking-tight">{t('batch.batchTask', 'Batch Task')}</span>
                             <span className="text-[9px] bg-slate-100 text-slate-600 dark:bg-white/10 px-1.5 py-0.5 rounded-full font-medium dark:text-white/60">{total} {t('batch.items', 'items')}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-white/50 truncate flex items-center gap-1.5 mt-0.5 font-medium">
                             {generating > 0 ? (
                                 <span className="text-yellow-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                                    Processing #{items.findIndex(i => i.id === activeItem?.id) + 1}
                                 </span>
                             ) : pending > 0 ? (
                                 <span>Waiting... ({pending} left)</span>
                             ) : (
                                 <span className="text-green-400 font-medium">All Completed</span>
                             )}
                        </div>
                    </div>

                <motion.div whileTap={{ scale: 0.9 }}>
                    <Button variant="ghost" className="h-8 w-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center justify-center shrink-0 transition-colors" onClick={handleDeleteBatch}>
                        <X className="w-4 h-4 text-red-400" />
                    </Button>
                </motion.div>
                </motion.div>

                {/* Expanded List */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-black/40 overflow-hidden"
                        >
                            <div className="p-2 space-y-1 max-h-[180px] overflow-y-auto no-scrollbar">
                                {items.map((item, idx) => (
                                    <motion.div 
                                        key={item.id} 
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, x: -100 }}
                                        drag="x"
                                        dragDirectionLock
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={{ left: 0.5, right: 0.1 }}
                                        onDragEnd={(e, { offset, velocity }) => {
                                            if (offset.x + velocity.x * 0.2 < -50) {
                                                removeFromQueue(item.id);
                                            }
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 p-2 rounded-xl text-xs transition-colors touch-pan-y z-10 relative bg-slate-100 dark:bg-black/20",
                                            item.status === 'generating' && "bg-white shadow-sm ring-1 ring-primary/20 dark:bg-white/5 dark:ring-white/10 dark:shadow-none"
                                        )}
                                    >
                                        <span className="font-mono text-slate-400 dark:text-white/40 w-5 text-right font-medium">{idx + 1}</span>
                                        <span className={cn(
                                            "w-2 h-2 rounded-full shrink-0 shadow-sm",
                                            item.status === 'completed' ? "bg-green-400 shadow-green-400/50" :
                                            item.status === 'failed' ? "bg-red-400 shadow-red-400/50" :
                                            item.status === 'generating' ? "bg-yellow-400 animate-pulse shadow-yellow-400/50" : "bg-slate-300 dark:bg-white/20"
                                        )} />
                                        <div className="flex-1 flex gap-2 items-center min-w-0">
                                            <span className="truncate text-slate-700 dark:text-white/60 font-medium text-[11px]" title={item.params.prompt}>
                                                {item.params.prompt || "No prompt"}
                                            </span>
                                            <span className="font-mono text-[9px] text-slate-400 dark:text-white/30 truncate shrink-0 max-w-[60px]">{item.params.seed}</span>
                                        </div>
                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center opacity-50 hover:opacity-100 shrink-0"
                                            onClick={() => removeFromQueue(item.id)}
                                        >
                                            <X className="w-3 h-3" />
                                        </motion.button>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        )
    }

    return (
        <GlassSurface 
            className={cn('flex flex-col w-full rounded-[16px] overflow-hidden shadow-sm ring-1 ring-slate-200 bg-white/60 dark:ring-white/5 dark:bg-white/[0.02]', className)}
            borderRadius={16}
            brightness={80}
            backgroundOpacity={0.02}
        >
            {/* 头部 - Pro Max Unified Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white/60 dark:border-white/5 dark:bg-white/5 backdrop-blur-md">
                <div className="flex items-center flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-center shrink-0 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-primary shadow-inner">
                        <Layers className="h-4 w-4 shrink-0 drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        <span className="font-semibold text-[11px] sm:text-xs tracking-tight ml-1.5 whitespace-nowrap">
                            {t('batch.title', 'Batch')}
                        </span>
                        <div className="w-px h-3 bg-primary/30 mx-2 shrink-0" />
                        <span className="text-[11px] font-mono font-bold shrink-0">
                            {queue.length}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* 数量与添加组合胶囊 */}
                    <div className="flex items-center bg-white/80 border border-slate-200 dark:bg-black/40 dark:border-white/10 rounded-full h-8 shadow-inner shrink-0">
                        <div className="flex items-center px-2.5 border-r border-slate-200 dark:border-white/10 h-full">
                            <span className="text-[10px] text-slate-500 dark:text-white/40 mr-1.5 select-none font-medium truncate max-w-[40px] hidden xs:inline-block">{t('common.quantity', 'QTY')}</span>
                            <input 
                                type="text"
                                inputMode="numeric"
                                value={countStr} 
                                onChange={(e) => {
                                    const val = e.target.value
                                    if (val === '' || /^\d+$/.test(val)) {
                                        setCountStr(val.slice(0, 3))
                                    }
                                }}
                                onBlur={handleBlur}
                                className="w-5 sm:w-6 bg-transparent text-[13px] text-center focus:outline-none font-mono text-slate-900 placeholder-slate-300 dark:text-white/90 dark:placeholder-white/20 font-medium p-0"
                                placeholder="1"
                            />
                        </div>

                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            className="h-full px-2.5 rounded-r-full hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-white/10 dark:active:bg-white/20 transition-colors flex items-center justify-center shrink-0"
                            onClick={() => addToQueue(getValidCount())}
                        >
                            <Plus className="h-3.5 w-3.5 text-slate-600 dark:text-white/80" />
                        </motion.button>
                    </div>

                    {/* 动态同步开关 - 点击亮起式 */}
                    <button
                        type="button"
                        className={cn(
                            "flex items-center justify-center h-8 px-2.5 rounded-full border transition-all duration-300 shrink-0 cursor-pointer text-[10px] font-bold tracking-wide select-none",
                            useDynamicQueueParams
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                : "bg-white/80 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/30"
                        )}
                        onClick={() => setUseDynamicQueueParams(!useDynamicQueueParams)}
                        title={t('batch.dynamicParamsDesc')}
                    >
                        {t('batch.dynamicParamsCmd', '同步')}
                    </button>

                    {/* 控制器组合 */}
                    <div className="flex items-center gap-1 bg-white/80 border border-slate-200 dark:bg-black/40 dark:border-white/10 rounded-full p-1 h-8 shadow-inner shrink-0">
                        <motion.button
                            whileTap={queue.length > 0 ? { scale: 0.9 } : {}}
                            className={cn(
                                "h-6 w-6 rounded-full transition-colors flex items-center justify-center shrink-0",
                                queue.length === 0 ? "opacity-40 cursor-not-allowed text-slate-400 dark:text-white/40" :
                                isQueueRunning 
                                    ? 'bg-yellow-500/20 text-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.2)]' 
                                    : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            )}
                            onClick={isQueueRunning ? pauseQueue : startQueue}
                            disabled={queue.length === 0}
                        >
                            {isQueueRunning ? (
                                <Pause className="h-3 w-3 fill-current shrink-0" />
                            ) : (
                                <Play className="h-3 w-3 fill-current ml-0.5 shrink-0" />
                            )}
                        </motion.button>
                        
                        <div className="w-px h-3 bg-slate-200 dark:bg-white/10 shrink-0" />

                        <motion.button
                            whileTap={queue.length > 0 ? { scale: 0.9 } : {}}
                            className={cn(
                                "h-6 w-6 rounded-full transition-colors flex items-center justify-center shrink-0",
                                queue.length === 0 ? "opacity-40 cursor-not-allowed text-white/40" : "text-white/60 hover:bg-red-500/20 hover:text-red-400"
                            )}
                            onClick={clearQueue}
                            disabled={queue.length === 0}
                        >
                            <Trash2 className="h-3 w-3 shrink-0" />
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* 队列列表 */}
            <ScrollArea className="flex-1 max-h-[360px]">
                <div className="p-3">
                    {queue.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-6 text-slate-400 dark:text-white/30 text-center">
                            <div className="p-5 rounded-full bg-slate-100 border border-slate-200 dark:bg-white/5 dark:border-white/5 mb-3">
                                <Layers className="h-8 w-8 text-slate-300 dark:text-white/20" />
                            </div>
                            <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-white/50">{t('batch.empty', 'Queue is empty')}</p>
                            <p className="text-[11px] opacity-60 mt-1 uppercase tracking-widest font-medium">
                                {t('batch.emptyDesc', 'Tap + to add items')}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <AnimatePresence>
                                {displayItems.map((entry) => {
                                    if (entry.type === 'batch') {
                                        return <BatchCard key={entry.id} items={entry.items} id={entry.id} />
                                    } else {
                                        const item = entry.item
                                        return (
                                            <motion.div
                                                key={item.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className={cn(
                                                    'flex items-center gap-3 p-3 rounded-2xl border transition-colors backdrop-blur-md',
                                                    item.status === 'generating' ? 'border-primary/30 bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.1)]' :
                                                    item.status === 'completed' ? 'border-green-500/20 bg-green-500/10' :
                                                    item.status === 'failed' ? 'border-red-500/20 bg-red-500/10' :
                                                    'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10'
                                                )}
                                            >
                                                <div className="h-6 w-6 rounded-full bg-slate-100 border border-slate-200 dark:bg-black/40 dark:border-white/5 flex items-center justify-center shrink-0">
                                                    {item.status === 'generating' ? (
                                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                    ) : (
                                                        <span className="text-[10px] font-mono text-slate-400 dark:text-white/40">#</span>
                                                    )}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <p className="text-xs truncate text-slate-800 dark:text-white/80 font-medium" title={item.params.prompt}>
                                                        {item.params.prompt || "No prompt"}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-white/40 mt-0.5 font-medium">
                                                        <span>Seed: {item.params.seed}</span>
                                                        {item.status === 'completed' && <span className="text-green-400">{t('batch.status.completed', 'Completed')}</span>}
                                                        {item.status === 'failed' && <span className="text-red-400">{t('batch.status.failed', 'Failed')}</span>}
                                                    </div>
                                                </div>
                                                
                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    className="h-8 w-8 shrink-0 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center opacity-50 hover:opacity-100"
                                                    onClick={() => removeFromQueue(item.id)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </motion.button>
                                            </motion.div>
                                        )
                                    }
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </GlassSurface>
    )
}
