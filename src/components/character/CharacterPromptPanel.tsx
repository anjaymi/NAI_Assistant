import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
    X,
    Plus,
    Trash2,
    Users,
    ChevronDown,
    ChevronUp,
    MapPin,
    Eye,
    EyeOff,
    User,
    SlidersHorizontal,
    Pencil,
    Search,
    Folder,
    FolderOpen,
    FolderPlus,
    ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { AutocompleteTextarea } from '@/components/ui/AutocompleteTextarea'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { useCharacterPromptStore, CharacterPrompt, FOLDER_COLORS, CHARACTER_COLORS } from '@/stores/character-prompt-store'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/atoms/Tooltip'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/atoms/Dialog'
import { cn } from '@/lib/utils'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    useDroppable,
} from '@dnd-kit/core'
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'

interface CharacterPromptPanelProps {
    onClose?: () => void
}

const Tip = ({ content, children }: { content?: string, children: React.ReactNode }) => {
    if (!content) return <>{children}</>
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent>{content}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export function CharacterPromptPanel({ onClose }: CharacterPromptPanelProps) {
    const { t } = useTranslation()
    const {
        characters,
        groups,
        addCharacter,
        updateCharacter,
        removeCharacter,
        setPosition,
        toggleEnabled,
        positionEnabled,
        setPositionEnabled,
        addGroup,
        updateGroup,
        deleteGroup,
        toggleGroupCollapsed,
        moveCharacterToGroup,
        reorderCharactersInGroup
    } = useCharacterPromptStore()

    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [positionDialogOpen, setPositionDialogOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
    const [editingGroupName, setEditingGroupName] = useState('')
    const [activeId, setActiveId] = useState<string | null>(null)

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
        setExpandedId(null)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)
        
        if (!over) return
        
        const activeCharId = active.id as string
        const overId = over.id as string
        
        // Drop on folder
        if (overId.startsWith('folder-')) {
            const folderId = overId.replace('folder-', '')
            moveCharacterToGroup(activeCharId, folderId)
            return
        }
        
        // Drop on ungrouped zone
        if (overId === 'ungrouped-zone') {
            moveCharacterToGroup(activeCharId, undefined)
            return
        }
        
        // Drop on character
        const activeChar = characters.find(c => c.id === activeCharId)
        const overChar = characters.find(c => c.id === overId)
        
        if (activeChar && overChar) {
            // Drop on character in different group
            if (activeChar.groupId !== overChar.groupId) {
                moveCharacterToGroup(activeCharId, overChar.groupId)
                return
            }
            
            // Reorder within same group
            if (activeCharId !== overId) {
                reorderCharactersInGroup(activeCharId, overId, activeChar.groupId)
            }
        }
    }

    // Auto-expand first character on open
    useEffect(() => {
        if (characters.length > 0 && !expandedId) {
            setExpandedId(characters[0].id)
        }
    }, [characters.length])

    const handleAddCharacter = () => {
        addCharacter()
        setTimeout(() => {
            const newChar = useCharacterPromptStore.getState().characters.slice(-1)[0]
            if (newChar) {
                setExpandedId(newChar.id)
            }
        }, 0)
    }

    const handleToggleExpand = useCallback((id: string) => {
        setExpandedId(prev => prev === id ? null : id)
    }, [])

    const handleCreateGroup = () => {
        const baseName = t('characterPanel.newFolderName', 'New Folder')
        const existingNames = groups.map(g => g.name)
        
        let newName = baseName
        let counter = 2
        while (existingNames.includes(newName)) {
            newName = `${baseName}(${counter})`
            counter++
        }
        
        addGroup(newName)
    }

    const handleSaveGroupName = (groupId: string) => {
        if (editingGroupName.trim()) {
            updateGroup(groupId, { name: editingGroupName.trim() })
        }
        setEditingGroupId(null)
        setEditingGroupName('')
    }

    const matchesSearch = (char: CharacterPrompt) => {
        if (!searchQuery.trim()) return true
        const query = searchQuery.toLowerCase()
        const name = char.name?.toLowerCase() || ''
        const promptPreview = char.prompt?.split(',')[0]?.trim().toLowerCase() || ''
        return name.includes(query) || promptPreview.includes(query)
    }

    const groupIds = new Set(groups.map(g => g.id))
    const ungroupedCharacters = characters.filter(c => (!c.groupId || !groupIds.has(c.groupId)) && matchesSearch(c))
    const groupedCharacters = groups.map(group => ({
        group,
        chars: characters.filter(c => c.groupId === group.id && matchesSearch(c))
    }))

    return (
        <div className="flex flex-col h-full w-full max-h-[500px]">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{t('characterPanel.title', 'Character Prompts')}</span>
                    {characters.filter(c => c.enabled).length > 0 && (
                        <span className="text-xs text-muted-foreground">
                            ({characters.filter(c => c.enabled).length})
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {positionEnabled && (
                        <Tip content={t('characterPanel.positionTitle', 'Character Position')}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setPositionDialogOpen(true)}
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                            </Button>
                        </Tip>
                    )}
                    <Tip content={t('characterPanel.positionDesc', 'Enable Positioning')}>
                        <Button
                            variant={positionEnabled ? "default" : "ghost"}
                            size="icon"
                            className={cn(
                                "h-7 w-7",
                                positionEnabled && "bg-primary text-primary-foreground"
                            )}
                            onClick={() => setPositionEnabled(!positionEnabled)}
                        >
                            <MapPin className="h-3.5 w-3.5" />
                        </Button>
                    </Tip>
                    <Tip content={t('characterPanel.addDesc', 'Add Character')}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAddCharacter}>
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </Tip>
                    <Tip content={t('characterPanel.addFolderDesc', 'New Folder')}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateGroup}>
                            <FolderPlus className="h-3.5 w-3.5" />
                        </Button>
                    </Tip>
                    {onClose && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-border/30 shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('wildcard.search', 'Search...')}
                        className="h-8 pl-8 text-sm"
                    />
                </div>
            </div>

            {/* Character List */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
            >
                <ScrollArea className="flex-1 min-h-0">
                    <div className="flex flex-col gap-2 p-3">
                        {characters.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm py-12">
                                <div className="text-center">
                                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p>{t('characterPanel.noActiveCharacters', 'No active characters')}</p>
                                    <Button variant="outline" size="sm" className="mt-2" onClick={handleAddCharacter}>
                                        <Plus className="h-3.5 w-3.5 mr-1" />
                                        {t('characterPanel.addDesc', 'Add Character')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {groupedCharacters.map(({ group, chars }) => (
                                    <DroppableFolder 
                                        key={group.id} 
                                        folderId={group.id} 
                                        isActive={activeId !== null} 
                                        isCollapsed={group.collapsed} 
                                        colorClass={FOLDER_COLORS[group.colorIndex].bg}
                                    >
                                        <div className="flex items-center gap-2 group/folder bg-muted/40 rounded-t-lg px-2 py-1.5 cursor-pointer">
                                            <div 
                                                className="flex-1 flex items-center gap-2 overflow-hidden"
                                                onClick={() => toggleGroupCollapsed(group.id)}
                                            >
                                                {group.collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                {group.collapsed ? <Folder className={cn("w-5 h-5", FOLDER_COLORS[group.colorIndex].icon)} /> : <FolderOpen className={cn("w-5 h-5", FOLDER_COLORS[group.colorIndex].icon)} />}
                                                
                                                {editingGroupId === group.id ? (
                                                     <Input
                                                        autoFocus
                                                        value={editingGroupName}
                                                        onChange={(e) => setEditingGroupName(e.target.value)}
                                                        onBlur={() => handleSaveGroupName(group.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveGroupName(group.id)
                                                            if (e.key === 'Escape') {
                                                                setEditingGroupId(null)
                                                                setEditingGroupName('')
                                                            }
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-6 text-sm px-1.5 py-0 w-28"
                                                    />
                                                ) : (
                                                    <span className="font-medium text-sm truncate">{group.name}</span>
                                                )}
                                                <span className="text-xs opacity-50">({chars.length})</span>
                                            </div>
                                            
                                            <div className="opacity-0 group-hover/folder:opacity-100 transition-opacity flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                                    setEditingGroupId(group.id)
                                                    setEditingGroupName(group.name)
                                                }}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteGroup(group.id)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {!group.collapsed && (
                                            <SortableContext items={chars.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                                <div className="pl-4 border-l-2 ml-2 space-y-2 pb-2 mt-1">
                                                    {chars.map((char) => (
                                                        <SortableCharacterCard
                                                            key={char.id}
                                                            character={char}
                                                            index={characters.findIndex(c => c.id === char.id)}
                                                            isExpanded={expandedId === char.id}
                                                            onToggleExpand={() => handleToggleExpand(char.id)}
                                                            onUpdate={(data: Partial<CharacterPrompt>) => updateCharacter(char.id, data)}
                                                            onRemove={() => removeCharacter(char.id)}
                                                            onToggleEnabled={() => toggleEnabled(char.id)}
                                                            dragHandleProps={{}}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        )}
                                    </DroppableFolder>
                                ))}

                                <DroppableUngrouped isActive={activeId !== null} hasGroups={groups.length > 0}>
                                    <SortableContext items={ungroupedCharacters.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-2">
                                            {ungroupedCharacters.map((char) => (
                                                <SortableCharacterCard
                                                    key={char.id}
                                                    character={char}
                                                    index={characters.findIndex(c => c.id === char.id)}
                                                    isExpanded={expandedId === char.id}
                                                    onToggleExpand={() => handleToggleExpand(char.id)}
                                                    onUpdate={(data: Partial<CharacterPrompt>) => updateCharacter(char.id, data)}
                                                    onRemove={() => removeCharacter(char.id)}
                                                    onToggleEnabled={() => toggleEnabled(char.id)}
                                                    dragHandleProps={{}}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DroppableUngrouped>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </DndContext>

            
            <PositionDialog
                open={positionDialogOpen}
                onOpenChange={setPositionDialogOpen}
                characters={characters}
                onPositionChange={setPosition}
            />
        </div>
    )
}

interface PositionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    characters: CharacterPrompt[]
    onPositionChange: (id: string, x: number, y: number) => void
}

function PositionDialog({ open, onOpenChange, characters, onPositionChange }: PositionDialogProps) {
    const { t } = useTranslation()
    const gridDivRef = useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.preventDefault()
        setDragging(id)
        setSelectedId(id)
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragging || !gridDivRef.current) return
        const rect = gridDivRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
        onPositionChange(dragging, x, y)
    }

    const handleMouseUp = () => {
        setDragging(null)
    }

    useEffect(() => {
        const handleGlobalMouseUp = () => setDragging(null)
        window.addEventListener('mouseup', handleGlobalMouseUp)
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }, [])

    const zones = [
        { label: '↖', x: 0.17, y: 0.15 },
        { label: '↑', x: 0.5, y: 0.15 },
        { label: '↗', x: 0.83, y: 0.15 },
        { label: '←', x: 0.17, y: 0.5 },
        { label: '●', x: 0.5, y: 0.5 },
        { label: '→', x: 0.83, y: 0.5 },
        { label: '↙', x: 0.17, y: 0.85 },
        { label: '↓', x: 0.5, y: 0.85 },
        { label: '↘', x: 0.83, y: 0.85 },
    ]

    const enabledCharacters = characters.filter(c => c.enabled)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {t('characterPanel.positionTitle', 'Character Position')}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('characterPanel.positionHelp', 'Drag characters to set their position')}
                    </DialogDescription>
                </DialogHeader>

                <div
                    ref={gridDivRef}
                    className="relative w-full aspect-[3/4] bg-muted/30 rounded-lg border cursor-crosshair select-none overflow-hidden shadow-inner"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Grid lines */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                        {[...Array(9)].map((_, i) => (
                            <div key={i} className="border border-border/20" />
                        ))}
                    </div>

                    {/* Zone labels */}
                    {zones.map((zone, i) => (
                        <div
                            key={i}
                            className="absolute text-lg text-muted-foreground/30 pointer-events-none select-none"
                            style={{
                                left: `${zone.x * 100}%`,
                                top: `${zone.y * 100}%`,
                                transform: 'translate(-50%, -50%)'
                            }}
                        >
                            {zone.label}
                        </div>
                    ))}

                    {/* Character markers */}
                    {enabledCharacters.map((char) => {
                        const colorIndex = characters.findIndex(c => c.id === char.id)
                        return (
                            <div
                                key={char.id}
                                className={cn(
                                    "absolute w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold cursor-grab active:cursor-grabbing shadow-lg transition-transform",
                                    selectedId === char.id && "ring-2 ring-white ring-offset-2 ring-offset-black/50 scale-110 z-10",
                                    dragging === char.id && "scale-125 z-20"
                                )}
                                style={{
                                    left: `${char.position.x * 100}%`,
                                    top: `${char.position.y * 100}%`,
                                    transform: 'translate(-50%, -50%)',
                                    backgroundColor: CHARACTER_COLORS[colorIndex % CHARACTER_COLORS.length],
                                }}
                                onMouseDown={(e) => handleMouseDown(e, char.id)}
                            >
                                {colorIndex + 1}
                            </div>
                        )
                    })}

                    {/* Empty state */}
                    {enabledCharacters.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-muted-foreground text-sm text-center">
                                <Users className="w-8 h-8 opacity-30 mx-auto mb-2" />
                                <p>{t('characterPanel.noActiveCharacters', 'No active characters')}</p>
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                    {t('characterPanel.positionHelp', 'Drag characters to set their position')}
                </p>
            </DialogContent>
        </Dialog>
    )
}

function DroppableFolder({ folderId, isActive, isCollapsed, colorClass, children }: any) {
    const { setNodeRef, isOver } = useDroppable({ id: `folder-${folderId}` })
    return (
        <div ref={setNodeRef} className={cn("transition-all duration-200 rounded-lg", isActive && isCollapsed && "ring-2 ring-dashed ring-current/30", isOver && cn("ring-2 ring-current", colorClass))}>
            {children}
        </div>
    )
}

function DroppableUngrouped({ isActive, hasGroups, children }: any) {
    const { setNodeRef, isOver } = useDroppable({ id: 'ungrouped-zone' })
    if (!hasGroups) return <>{children}</>
    return (
        <div ref={setNodeRef} className={cn("transition-all duration-200 rounded-lg min-h-[40px] mt-2", isActive && "ring-2 ring-dashed ring-primary/30", isOver && "ring-2 ring-primary bg-primary/10")}>
            {children}
        </div>
    )
}

function SortableCharacterCard(props: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.character.id })
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 9999 : 'auto',
        position: isDragging ? 'relative' : undefined,
        opacity: isDragging ? 0.9 : 1,
    }
    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <CharacterCard {...props} dragHandleProps={listeners} />
        </div>
    )
}

function CharacterCard({ character, index, isExpanded, onToggleExpand, onUpdate, onRemove, onToggleEnabled, dragHandleProps }: any) {
    const { positionEnabled } = useCharacterPromptStore()
    const color = CHARACTER_COLORS[index % CHARACTER_COLORS.length]
    return (
        <div className={cn("w-full rounded-xl border border-border/50 bg-background/60 overflow-hidden", !character.enabled && "opacity-50")}>
            <div className="flex items-center gap-2 p-2 cursor-grab hover:bg-muted/50" onClick={onToggleExpand} {...dragHandleProps}>
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <div 
                    className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center text-[10px] shrink-0 transition-colors font-semibold",
                        positionEnabled ? "text-white" : "bg-muted text-muted-foreground"
                    )}
                    style={positionEnabled ? { backgroundColor: color } : undefined}
                >
                    {index + 1}
                </div>
                <span className="flex-1 text-sm font-medium truncate">
                    {character.name || (character.prompt ? character.prompt.split(',')[0].substring(0, 20) : 'Character ' + (index + 1))}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onToggleEnabled(); }}>
                    {character.enabled ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            
            {isExpanded && (
                <div className="p-2 space-y-2 border-t border-border/30 bg-black/10">
                    <Input 
                        placeholder="Character Name" 
                        value={character.name || ''} 
                        onChange={(e) => onUpdate({ name: e.target.value })} 
                        className="h-8 text-xs"
                    />
                    <AutocompleteTextarea 
                        placeholder="Character Prompts (e.g. 1girl, blue eyes...)"
                        value={character.prompt}
                        onChange={(e) => onUpdate({ prompt: e.target.value })}
                        className="min-h-[80px] text-xs"
                    />
                    <Input 
                        placeholder="Negative Prompts" 
                        value={character.negative} 
                        onChange={(e) => onUpdate({ negative: e.target.value })} 
                        className="h-8 text-xs text-red-400 placeholder:text-red-400/50"
                    />
                    <div className="flex justify-end pt-1">
                         <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={onRemove}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
