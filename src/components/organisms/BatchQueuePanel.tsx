import { useTranslation } from 'react-i18next'
import * as React from 'react'

import { Button } from '@/components/atoms/Button'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { cn } from '@/lib/utils'
import { Play, Pause, X, Plus, Layers, Trash2 } from 'lucide-react'

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/atoms/Tooltip'

import { useGenerationStore } from '@/stores/generation-store'
import { shallow } from 'zustand/shallow'

interface BatchQueuePanelProps {
    /** 自定义样式 */
    className?: string
}

/**
 * BatchQueuePanel 有机体组件
 * 
 * 批量生成队列管理面板
 * - 添加多个生成任务到队列
 * - 显示队列状态
 * - 开始/暂停/清除队列
 */
export function BatchQueuePanel({ className }: BatchQueuePanelProps) {
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
        
        // Combine into a display list (sorted by creation time of first item)
        // We'll treat singles as individual groups for easier sorting if needed, 
        // or just put batches first followed by singles? 
        // Better: sort everything by createdAt
        
        const batchKeys = Object.keys(groups)
        const displayItems: Array<{ type: 'batch', items: typeof queue, id: string, createdAt: number } | { type: 'single', item: typeof queue[0], createdAt: number }> = []

        batchKeys.forEach(key => {
            const items = groups[key]
            if (items.length > 0) {
                // If a batch has only 1 item, treat as single? No, keep as batch for consistency if it has batchId
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
        const progress = Math.round(((completed + failed) / total) * 100)
        
        // Latest active item status
        const activeItem = items.find(i => i.status === 'generating') || items.find(i => i.status === 'pending')
        
        const handleDeleteBatch = (e: React.MouseEvent) => {
            e.stopPropagation()
            // Remove all items in this batch
            // Since store only has removeItem(id), we loop. 
            // Ideally store should have removeBatch(batchId) but loop works for now.
            items.forEach(item => removeFromQueue(item.id))
        }

        return (
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-black/5 dark:bg-black/20 overflow-hidden transition-all">
                {/* Batch Header - Click to toggle expand */}
                <div 
                    className="p-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-3 select-none"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {/* Icon & Progress */}
                    <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                         <svg className="w-full h-full transform -rotate-90">
                            <circle cx="20" cy="20" r="16" stroke="currentColor" fill="transparent" strokeWidth="3" className="text-black/5 dark:text-white/5" />
                            <circle 
                                cx="20" cy="20" r="16" 
                                stroke="currentColor" 
                                fill="transparent" 
                                strokeWidth="3" 
                                className="text-indigo-500 transition-all duration-500 ease-out"
                                strokeDasharray={100}
                                strokeDashoffset={100 - progress}
                            />
                        </svg>
                        <span className="absolute text-[10px] font-bold text-slate-600 dark:text-white/70">{progress}%</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-2">
                             <span className="text-sm font-semibold text-slate-800 dark:text-white tracking-wide">{t('batch.batchTask', 'Batch Task')}</span>
                             <span className="text-[10px] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full text-slate-600 dark:text-white/70 font-medium">{total} {t('batch.items', 'items')}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-white/50 truncate flex items-center gap-2 mt-0.5">
                             {generating > 0 ? (
                                 <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                                    Processing #{items.findIndex(i => i.id === activeItem?.id) + 1}
                                 </span>
                             ) : pending > 0 ? (
                                 <span>Waiting... ({pending} left)</span>
                             ) : (
                                 <span className="text-emerald-400 font-medium">All Completed</span>
                             )}
                        </div>
                    </div>

                    {/* Actions */}
                    <Button
                         variant="ghost"
                         size="icon"
                         className="h-8 w-8 text-slate-400 dark:text-white/40 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
                         onClick={handleDeleteBatch}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Expanded List */}
                {isExpanded && (
                    <div className="border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/40 p-2 space-y-1 max-h-[200px] overflow-y-auto">
                        {items.map((item, idx) => (
                             <div 
                                key={item.id} 
                                className={cn(
                                    "flex items-center gap-2 p-1.5 rounded-md text-xs group transition-colors",
                                    item.status === 'generating' ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "hover:bg-black/5 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200"
                                )}
                             >
                                <span className="font-mono text-slate-400 dark:text-white/30 w-6 text-right text-[10px]">#{idx + 1}</span>
                                <span className={cn(
                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                    item.status === 'completed' ? "bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" :
                                    item.status === 'failed' ? "bg-red-500 dark:bg-red-400" :
                                    item.status === 'generating' ? "bg-indigo-500 dark:bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.5)]" : "bg-slate-300 dark:bg-white/20"
                                )} />
                                <span className="flex-1 truncate opacity-80 cursor-help" title={`Seed: ${item.params.seed}\nPrompt: ${item.params.prompt}`}>
                                    {item.params.prompt}
                                </span>
                                <span className="font-mono text-[9px] opacity-50">{item.params.seed}</span>
                                <Button
                                    variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-slate-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                                    onClick={() => removeFromQueue(item.id)}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                             </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className={cn('flex flex-col border border-black/5 dark:border-white/10 rounded-2xl bg-white/40 dark:bg-black/40 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] overflow-hidden', className)}>
                {/* 头部 - Pro Max Unified Header */}
                <div className="flex items-center justify-between p-3 border-b border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20">
                    <div className="flex items-center flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 shadow-inner min-w-0">
                            <Layers className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-semibold text-[10px] tracking-tight whitespace-nowrap">
                                {t('batch.title', 'Batch')}
                            </span>
                            <div className="w-px h-3 bg-indigo-500/30 mx-1 shrink-0" />
                            <span className="text-[10px] font-mono font-bold shrink-0">
                                {queue.length}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* 数量与添加组合胶囊 */}
                        <div className="flex items-center bg-white/50 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-full h-8 shadow-inner overflow-hidden shrink-0">
                            <div className="flex items-center px-1.5 border-r border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 h-full">
                                <span className="text-[9px] scale-90 origin-right text-slate-500 dark:text-white/50 mr-1 select-none font-bold uppercase tracking-widest hidden sm:inline-block">{t('batch.count', 'Count')}</span>
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
                                    className="w-7 bg-transparent text-xs text-center focus:outline-none font-mono font-medium text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-white/20"
                                    placeholder="1"
                                />
                            </div>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-full w-9 rounded-none hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
                                        onClick={() => addToQueue(getValidCount())}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('batch.addToQueue', "Add to Queue")}</TooltipContent>
                            </Tooltip>
                        </div>

                        {/* 动态同步参数开关 - 点击亮起式 */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        "flex items-center justify-center h-8 px-2.5 rounded-full border transition-all duration-300 shrink-0 cursor-pointer text-[10px] font-bold tracking-wide select-none",
                                        useDynamicQueueParams
                                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                            : "bg-white/50 dark:bg-black/40 border-black/10 dark:border-white/10 text-slate-400 dark:text-white/30 hover:bg-white/80 dark:hover:bg-black/60"
                                    )}
                                    onClick={() => setUseDynamicQueueParams(!useDynamicQueueParams)}
                                >
                                    {t('batch.dynamicParamsCmd', '同步')}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="max-w-[200px] text-xs">
                                    {useDynamicQueueParams ? '✅ ' : ''}{t('batch.dynamicParamsDesc')}
                                </p>
                            </TooltipContent>
                        </Tooltip>

                        {/* 控制器组合 */}
                        <div className="flex items-center gap-1 bg-white/50 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-full p-1 h-8 shadow-inner">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            "h-6 w-6 rounded-full transition-colors",
                                            isQueueRunning 
                                                ? 'bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/30' 
                                                : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 dark:text-emerald-400 dark:bg-transparent dark:hover:bg-emerald-500/20 dark:hover:text-emerald-300'
                                        )}
                                        onClick={isQueueRunning ? pauseQueue : startQueue}
                                        disabled={queue.length === 0}
                                    >
                                        {isQueueRunning ? (
                                            <Pause className="h-3 w-3 fill-current" />
                                        ) : (
                                            <Play className="h-3 w-3 fill-current ml-0.5" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {isQueueRunning ? t('batch.pauseQueue', 'Pause Queue') : t('batch.startQueue', 'Start Queue')}
                                </TooltipContent>
                            </Tooltip>

                            <div className="w-px h-3 bg-black/10 dark:bg-white/10 mx-0.5" />

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 rounded-full text-slate-400 dark:text-white/40 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                        onClick={clearQueue}
                                        disabled={queue.length === 0}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('batch.clearQueueDesc', 'Clear Queue')}</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* 队列列表 */}
                <ScrollArea className="flex-1 max-h-[300px]">
                    <div className="p-2 space-y-2">
                        {queue.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                                <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p>{t('batch.empty', 'Queue is empty')}</p>
                                <p className="text-xs opacity-60 mt-1">
                                    {t('batch.emptyDesc', 'Click + to add items')}
                                </p>
                            </div>
                        ) : (
                            displayItems.map((entry) => {
                                if (entry.type === 'batch') {
                                    // BATCH CARD
                                    return <BatchCard key={entry.id} items={entry.items} id={entry.id} />
                                } else {
                                    // SINGLE ITEM (Legacy or single add)
                                    const item = entry.item
                                    return (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                'flex items-center gap-2 p-2.5 rounded-xl border transition-all duration-300',
                                                item.status === 'generating' && 'border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]',
                                                item.status === 'completed' && 'border-emerald-500/30 bg-emerald-500/10',
                                                item.status === 'failed' && 'border-red-500/30 bg-red-500/10',
                                                item.status === 'pending' && 'border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 hover:bg-black/10 dark:hover:bg-white/5 hover:border-black/10 dark:hover:border-white/10'
                                            )}
                                        >
                                            <span className="text-[10px] font-mono text-slate-400 dark:text-white/30 w-5 shrink-0">
                                                #
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs truncate text-slate-800 dark:text-white/80" title={item.params.prompt}>
                                                    {item.params.prompt.slice(0, 50)}...
                                                </p>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-white/40 mt-0.5">
                                                    <span className="font-mono">Seed: {item.params.seed}</span>
                                                    {item.status === 'completed' && <span className="text-emerald-500 dark:text-emerald-400 font-medium">{t('batch.status.completed', 'Completed')}</span>}
                                                    {item.status === 'failed' && <span className="text-red-500 dark:text-red-400 font-medium">{t('batch.status.failed', 'Failed')}</span>}
                                                </div>
                                            </div>
                                            {item.status === 'generating' && (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 dark:border-indigo-400 border-t-transparent shrink-0 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-slate-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                onClick={() => removeFromQueue(item.id)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )
                                }
                            })
                        )}
                    </div>
                </ScrollArea>
            </div>
        </TooltipProvider>
    )
}
