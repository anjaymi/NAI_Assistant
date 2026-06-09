import { Scene } from '@/stores/scene-store'
import { Card } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Plus, Minus, Trash2, GripVertical, Image as ImageIcon } from 'lucide-react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'


interface SceneCardProps {
    scene: Scene
    isActive?: boolean
    onClick?: () => void
    onIncrement?: (e: React.MouseEvent) => void
    onDecrement?: (e: React.MouseEvent) => void
    onDelete?: (e: React.MouseEvent) => void
    dragHandleProps?: any
}

export function SceneCard({ 
    scene, 
    isActive, 
    onClick, 
    onIncrement, 
    onDecrement, 
    onDelete,
    dragHandleProps 
}: SceneCardProps) {
    const { t } = useTranslation()
    const latestImage = scene.images.find(img => img.isFavorite) || scene.images[0]
    const imageUrl = latestImage ? convertFileSrc(latestImage.path) : null

    return (
        <Card 
            className={cn(
                "group relative overflow-hidden transition-all hover:ring-2 hover:ring-primary/50 flex flex-col h-[280px]",
                isActive && "ring-2 ring-primary bg-primary/5"
            )}
            onClick={onClick}
        >
            {/* Drag Handle */}
            {dragHandleProps && (
                <div 
                    {...dragHandleProps}
                    className="absolute top-2 left-2 z-20 p-1.5 rounded-md bg-black/50 text-white/50 hover:bg-black/70 hover:text-white cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="h-4 w-4" />
                </div>
            )}

            {/* Image Area */}
            <div className="relative flex-1 bg-muted/20 overflow-hidden">
                {imageUrl ? (
                    <img 
                        src={imageUrl} 
                        alt={scene.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
                        <ImageIcon className="h-12 w-12" />
                        <span className="text-xs mt-2">{t('scene.noImage')}</span>
                    </div>
                )}
                
                {/* Overlay Info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <h3 className="font-semibold truncate text-shadow-sm">{scene.name}</h3>
                    <p className="text-xs text-white/70 truncate">{scene.prompt || t('scene.noPrompt')}</p>
                </div>
            </div>

            {/* Controls Area */}
            <div className="h-12 border-t bg-card/50 flex items-center justify-between px-2 shrink-0">
                <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete?.(e)
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 hover:bg-background"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDecrement?.(e)
                        }}
                        disabled={scene.queueCount <= 0}
                    >
                        <Minus className="h-3 w-3" />
                    </Button>
                    <span className={cn(
                        "w-8 text-center text-sm font-mono font-medium",
                        scene.queueCount > 0 ? "text-primary" : "text-muted-foreground"
                    )}>
                        {scene.queueCount}
                    </span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 hover:bg-background"
                        onClick={(e) => {
                            e.stopPropagation()
                            onIncrement?.(e)
                        }}
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </Card>
    )
}
