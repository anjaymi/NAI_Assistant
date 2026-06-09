import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Pencil, Check, X, FolderOpen, GripVertical, ClipboardCopy, DownloadCloud, ChevronDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from '@/components/atoms/Dialog'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { usePresetStore } from '@/stores/preset-store'
import { cn } from '@/lib/utils'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'

interface SortablePresetItemProps {
    preset: {
        id: string
        name: string
        isDefault?: boolean
    }
    isActive: boolean
    isEditing: boolean
    editName: string
    onSelect: () => void
    onStartEdit: (e: React.MouseEvent) => void
    onDelete: (e: React.MouseEvent) => void
    onRename: () => void
    onCancelEdit: () => void
    onEditNameChange: (name: string) => void
    onExport: (e: React.MouseEvent) => void
}

function SortablePresetItem({
    preset,
    isActive,
    isEditing,
    editName,
    onSelect,
    onStartEdit,
    onDelete,
    onRename,
    onCancelEdit,
    onEditNameChange,
    onExport,
}: SortablePresetItemProps) {
    const { t } = useTranslation()
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: preset.id,
        disabled: preset.isDefault,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : undefined,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-300 group",
                isActive
                    ? "bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 shadow-none dark:shadow-[0_0_15px_rgba(99,102,241,0.15)] text-indigo-700 dark:text-indigo-100"
                    : "bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white shadow-sm dark:shadow-none",
                isDragging && "shadow-lg dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] bg-slate-50/90 dark:bg-black/80 backdrop-blur-xl border-slate-300 dark:border-white/10 text-slate-900 dark:text-white z-50 scale-105"
            )}
            onClick={onSelect}
        >
            {!preset.isDefault && (
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                >
                    <GripVertical className="h-4 w-4" />
                </div>
            )}

            {isEditing ? (
                <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                    <Input
                        value={editName}
                        onChange={(e) => onEditNameChange(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onRename()
                            if (e.key === 'Escape') onCancelEdit()
                        }}
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={onRename}
                    >
                        <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={onCancelEdit}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : (
                <>
                    <span className="flex-1 text-sm font-medium truncate">
                        {preset.name}
                        {preset.isDefault && t('preset.default')}
                    </span>
                    {isActive && (
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-300 font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-md border border-indigo-200 dark:border-indigo-500/30 shadow-none dark:shadow-inner">
                            {t('preset.current')}
                        </span>
                    )}
                    
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button
                            size="icon"
                            variant="ghost"
                             className="h-7 w-7 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                            onClick={onExport}
                            title={t('preset.export', '复制配置 JSON')}
                        >
                            <ClipboardCopy className="h-3 w-3" />
                        </Button>
                        {!preset.isDefault && (
                            <>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                     className="h-7 w-7 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                                    onClick={onStartEdit}
                                >
                                    <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                     className="h-7 w-7 text-red-500/70 dark:text-red-500/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                                    onClick={onDelete}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

export function PresetManager() {
    const {
        presets,
        activePresetId,
        addPreset,
        deletePreset,
        loadPreset,
        renamePreset,
        reorderPresets,
        exportPreset,
        importPreset
    } = usePresetStore()
    const { t } = useTranslation()
    const { toast } = useToast()

    const [open, setOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [isImporting, setIsImporting] = useState(false)
    const [importJson, setImportJson] = useState('')

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    useEffect(() => {
        if (!open) {
            setIsCreating(false)
            setNewName('')
            setEditingId(null)
            setEditName('')
            setIsImporting(false)
            setImportJson('')
        }
    }, [open])

    const handleCreate = () => {
        if (newName.trim()) {
            addPreset(newName.trim())
            setNewName('')
            setIsCreating(false)
            toast({
                title: t('preset.created', '预设已创建'),
                duration: 2000
            })
        }
    }

    const handleRename = (id: string) => {
        if (editName.trim()) {
            renamePreset(id, editName.trim())
            setEditingId(null)
            setEditName('')
        }
    }

    const handleSelect = (id: string) => {
        loadPreset(id)
        setOpen(false)
        toast({
            title: t('preset.loaded', '预设已应用'),
            duration: 1500
        })
    }

    const startEdit = (id: string, currentName: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingId(id)
        setEditName(currentName)
    }

    const handleExport = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const json = exportPreset(id)
        navigator.clipboard.writeText(json)
        toast({
            title: t('preset.exported', '配置已复制到剪贴板'),
            duration: 2000
        })
    }

    const handleImport = () => {
        const result = importPreset(importJson)
        if (result) {
            setIsImporting(false)
            setImportJson('')
            toast({
                title: t('preset.imported', '预设导入成功'),
                duration: 2000
            })
        } else {
             toast({
                title: t('preset.importFailed', '导入失败：格式无效'),
                variant: 'destructive',
                duration: 2000
            })
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            const oldIndex = presets.findIndex(p => p.id === active.id)
            const newIndex = presets.findIndex(p => p.id === over.id)
            reorderPresets(oldIndex, newIndex)
        }
    }

    const activePreset = presets.find(p => p.id === activePresetId)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="ghost" 
                    className={cn(
                        "w-full justify-between px-4 py-3 h-auto font-normal",
                        "bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl backdrop-blur-3xl shadow-sm dark:shadow-inner",
                        "hover:bg-slate-50 dark:hover:bg-black/60 hover:border-slate-300 dark:hover:border-white/10 hover:text-slate-900 dark:hover:text-white transition-all duration-300",
                        "text-slate-600 dark:text-white/60"
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        <FolderOpen className="h-4 w-4 opacity-70" />
                        <span className={cn("truncate font-medium tracking-wide", activePreset && "text-slate-900 dark:text-white")}>
                            {activePreset ? activePreset.name : t('preset.select')}
                        </span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col bg-slate-50/90 dark:bg-black/60 backdrop-blur-3xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-3xl p-6">
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-md">{t('preset.manage')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('preset.manageDesc', 'Manage your generation presets')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-[300px] pr-2 -mr-2">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    >
                        <SortableContext
                            items={presets.map(p => p.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {presets.map(preset => (
                                    <SortablePresetItem
                                        key={preset.id}
                                        preset={preset}
                                        isActive={activePresetId === preset.id}
                                        isEditing={editingId === preset.id}
                                        editName={editName}
                                        onSelect={() => handleSelect(preset.id)}
                                        onStartEdit={(e) => startEdit(preset.id, preset.name, e)}
                                        onDelete={(e) => {
                                            e.stopPropagation()
                                            deletePreset(preset.id)
                                        }}
                                        onRename={() => handleRename(preset.id)}
                                        onCancelEdit={() => setEditingId(null)}
                                        onEditNameChange={setEditName}
                                        onExport={(e) => handleExport(preset.id, e)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                <div className="pt-5 mt-3 border-t border-slate-200 dark:border-white/10">
                    {isCreating ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={t('preset.namePlaceholder')}
                                className="h-9 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreate()
                                    if (e.key === 'Escape') {
                                        setIsCreating(false)
                                        setNewName('')
                                    }
                                }}
                            />
                            <Button size="sm" onClick={handleCreate}>
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setIsCreating(false)
                                    setNewName('')
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : isImporting ? (
                         <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                            <Input
                                value={importJson}
                                onChange={(e) => setImportJson(e.target.value)}
                                placeholder={t('preset.importPlaceholder', '粘贴预设 JSON...')}
                                className="h-9 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleImport()
                                    if (e.key === 'Escape') {
                                        setIsImporting(false)
                                        setImportJson('')
                                    }
                                }}
                            />
                            <Button size="sm" onClick={handleImport}>
                                <Check className="h-4 w-4" />
                            </Button>
                             <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setIsImporting(false)
                                    setImportJson('')
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                         </div>
                    ) : (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1 border-dashed border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-400 dark:hover:border-white/30 text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white rounded-xl h-11 transition-all duration-300"
                                onClick={() => setIsCreating(true)}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {t('preset.new')}
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="border-dashed border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-400 dark:hover:border-white/30 text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white w-11 h-11 shrink-0 rounded-xl transition-all duration-300"
                                onClick={() => setIsImporting(true)}
                                title={t('preset.import', '导入预设 JSON')}
                            >
                                <DownloadCloud className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
