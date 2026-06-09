"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { 
    Copy, Save, RefreshCw, Wand2, Paintbrush, 
    Image as ImageIcon, Users, FolderOpen, FileSearch, Trash2
} from "lucide-react"

import {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
} from "@/components/atoms/ContextMenu"
import { useToast } from "@/hooks/use-toast"
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

interface ImageContextMenuProps {
    children: React.ReactNode
    imageSrc: string | null
    // Callbacks for menu actions
    onRegenerate?: () => void
    onSmartTools?: () => void
    onInpaint?: () => void
    onI2I?: () => void
    onAddRef?: () => void
    onOpenFolder?: () => void
    onLoadMetadata?: () => void
    onDelete?: () => void
    asChild?: boolean
}

export function ImageContextMenu({ 
    children, 
    imageSrc, 
    onRegenerate,
    onSmartTools,
    onInpaint,
    onI2I,
    onAddRef,
    onOpenFolder,
    onLoadMetadata,
    onDelete,
    asChild = false
}: ImageContextMenuProps) {
    const { t } = useTranslation()
    const { toast } = useToast()

    // Helper: Save Image As...
    const handleSaveAs = async () => {
        if (!imageSrc) return
        try {
            const defaultName = `image_${Date.now()}.png`
            
            const filePath = await save({
                defaultPath: defaultName,
                filters: [{
                    name: 'Image',
                    extensions: ['png', 'jpg', 'webp']
                }]
            })

            if (!filePath) return

            const response = await fetch(imageSrc)
            const blob = await response.blob()
            const arrayBuffer = await blob.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)

            await writeFile(filePath, uint8Array)
            toast({ title: t('actions.saved', '保存成功'), description: filePath, duration: 2000 })
        } catch (error) {
            console.error(error)
            toast({ title: t('actions.saveFailed', '保存失败'), description: String(error), variant: "destructive" })
        }
    }

    // Helper: Copy Image to Clipboard
    const handleCopy = async () => {
        if (!imageSrc) return
        try {
            const response = await fetch(imageSrc)
            const blob = await response.blob()
            const item = new ClipboardItem({ [blob.type]: blob })
            await navigator.clipboard.write([item])
            toast({ title: t('actions.copied', '已复制到剪贴板'), duration: 2000 })
        } catch (error) {
            console.error(error)
            toast({ title: t('actions.copyFailed', '复制失败'), description: String(error), variant: "destructive" })
        }
    }

    if (!imageSrc) return <>{children}</>

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild={asChild}>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
                {/* Basic Actions */}
                <ContextMenuItem onClick={handleSaveAs}>
                    <Save className="mr-2 h-4 w-4" />
                    <span>{t('actions.saveAs', '另存为')}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>{t('actions.copy', '复制')}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={onRegenerate} disabled={!onRegenerate}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span>{t('actions.regenerate', '重新生成')}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={onSmartTools} disabled={!onSmartTools}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    <span>{t('smartTools.title', '智能工具箱')}</span>
                </ContextMenuItem>

                <ContextMenuSeparator />

                {/* Image Processing */}
                <ContextMenuItem onClick={onInpaint} disabled={!onInpaint}>
                    <Paintbrush className="mr-2 h-4 w-4" />
                    <span>{t('tools.inpainting.title', '局部重绘')}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={onI2I} disabled={!onI2I}>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    <span>{t('tools.i2i.title', '图生图')}</span>
                </ContextMenuItem>

                <ContextMenuSeparator />

                {/* Reference & File */}
                <ContextMenuItem onClick={onAddRef} disabled={!onAddRef}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>{t('actions.addAsRef', '添加为参考')}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={onOpenFolder} disabled={!onOpenFolder}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    <span>{t('actions.openFolder', '打开输出文件夹')}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={onLoadMetadata} disabled={!onLoadMetadata}>
                    <FileSearch className="mr-2 h-4 w-4" />
                    <span>{t('metadata.loadFromImage', '加载元数据')}</span>
                </ContextMenuItem>

                <ContextMenuSeparator />

                {/* Delete */}
                <ContextMenuItem 
                    onClick={onDelete} 
                    disabled={!onDelete}
                    className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>{t('actions.delete', '删除')}</span>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
