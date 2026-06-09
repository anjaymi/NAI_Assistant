import { useState } from 'react'
import { useSceneStore } from '@/stores/scene-store'
import { SceneCard } from '@/components/molecules/SceneCard'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { ScrollArea } from '@/components/atoms/ScrollArea'
import { Separator } from '@/components/atoms/Separator'
import { Plus, Trash2, Folder, FolderPlus, Play, Square, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/atoms/Popover'
import { useSceneGeneration } from '@/hooks/use-scene-generation'
import { useTranslation } from 'react-i18next'
import { shallow } from 'zustand/shallow'

export function ScenePanel() {
    const { t } = useTranslation()
    const { 
        projects, 
        activeProjectId, 
        addProject, 
        deleteProject,
        setActiveProject, 
        getActiveProject,
        addScene,
        deleteScene,
        incrementQueue, 
        setQueueCount,
        clearQueue
    } = useSceneStore((state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        addProject: state.addProject,
        deleteProject: state.deleteProject,
        setActiveProject: state.setActiveProject,
        getActiveProject: state.getActiveProject,
        addScene: state.addScene,
        deleteScene: state.deleteScene,
        incrementQueue: state.incrementQueue,
        setQueueCount: state.setQueueCount,
        clearQueue: state.clearQueue,
    }), shallow)
    
    const { startQueue, stopQueue, isGenerating } = useSceneGeneration()
    
    const activeProject = getActiveProject()
    const [newProjectName, setNewProjectName] = useState('')
    const [isCreatingProject, setIsCreatingProject] = useState(false)
    

    const handleCreateProject = () => {
        if (newProjectName.trim()) {
            addProject(newProjectName.trim())
            setNewProjectName('')
            setIsCreatingProject(false)
        }
    }

    const handleDeleteProject = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (confirm(t('scene.deleteProjectConfirm'))) {
             deleteProject(id)
        }
    }

    return (
        <div className="flex h-full bg-background">
            {/* Sidebar: Projects */}
            <div className="w-64 border-r flex flex-col bg-muted/10">
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Folder className="h-4 w-4" />
                        {t('scene.projects')}
                    </h2>
                    <Popover open={isCreatingProject} onOpenChange={setIsCreatingProject}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">{t('scene.newProject')}</h4>
                                <div className="flex gap-2">
                                    <Input 
                                        value={newProjectName} 
                                        onChange={(e) => setNewProjectName(e.target.value)} 
                                        placeholder={t('scene.projectName')} 
                                        className="h-8"
                                    />
                                    <Button size="sm" onClick={handleCreateProject} disabled={!newProjectName.trim()}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {projects.map(project => (
                            <div
                                key={project.id}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors group",
                                    activeProjectId === project.id 
                                        ? "bg-primary/10 text-primary font-medium" 
                                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                )}
                                onClick={() => setActiveProject(project.id)}
                            >
                                <span className="truncate flex-1">{project.name}</span>
                                <span className="text-xs opacity-50 ml-2">{project.scenes.length}</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:text-destructive"
                                    onClick={(e) => handleDeleteProject(e, project.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Main Area: Scenes */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {activeProject ? (
                    <>
                        {/* Header */}
                        <div className="h-14 border-b flex items-center justify-between px-4 bg-background/50 backdrop-blur">
                            <div className="flex items-center gap-4">
                                <h2 className="text-lg font-semibold">{activeProject.name}</h2>
                                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addScene(activeProject.id)}>
                                        <Plus className="h-3 w-3 mr-1" />
                                        {t('scene.addScene')}
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => clearQueue(activeProject.id)}>
                                    <Square className="h-3 w-3 mr-1" />
                                    {t('scene.clearQueue')}
                                </Button>
                                <Separator orientation="vertical" className="h-6" />
                                <Button size="sm" onClick={isGenerating ? stopQueue : startQueue} variant={isGenerating ? "destructive" : "default"}>
                                    {isGenerating ? (
                                        <>
                                            <Pause className="h-3 w-3 mr-1" />
                                            {t('common.stopGenerate')}
                                        </>
                                    ) : (
                                        <>
                                            <Play className="h-3 w-3 mr-1" />
                                            {t('common.startGenerate')}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Grid */}
                        <ScrollArea className="flex-1 p-4">
                            {activeProject.scenes.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                    <FolderPlus className="h-16 w-16 mb-4" />
                                    <p>{t('scene.empty')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                                    {activeProject.scenes.map(scene => (
                                        <SceneCard 
                                            key={scene.id}
                                            scene={scene}
                                            onIncrement={() => incrementQueue(activeProject.id, scene.id, 1)}
                                            onDecrement={() => setQueueCount(activeProject.id, scene.id, Math.max(0, scene.queueCount - 1))}
                                            onDelete={() => deleteScene(activeProject.id, scene.id)}
                                        />
                                    ))}
                                    
                                    {/* Add Button Holder */}
                                    <button 
                                        className="aspect-[2/3] md:aspect-[3/2] lg:aspect-[2/3] xl:aspect-[3/2] rounded-xl border-2 border-dashed border-muted hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
                                        onClick={() => addScene(activeProject.id)}
                                    >
                                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                        </div>
                                        <span className="text-sm text-muted-foreground group-hover:text-foreground">{t('scene.addNewScene')}</span>
                                    </button>
                                </div>
                            )}
                        </ScrollArea>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        {t('scene.selectProject')}
                    </div>
                )}
            </div>
        </div>
    )
}
