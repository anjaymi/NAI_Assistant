import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    dialogPanelMotionClass,
    glassOverlayClass,
    glassPanelSurfaceClass,
    overlayMotionClass,
} from '@/lib/motion'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

/**
 * 对话框遮罩层
 * 半透明黑色背景 + 模糊效果，符合二次元高级感美学
 */
const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            'fixed inset-0 z-[100]',
            overlayMotionClass,
            glassOverlayClass,
            className
        )}
        {...props}
    />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * 对话框内容容器
 * 居中定位，支持动画进出
 */
const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none sm:p-6">
            <DialogPrimitive.Content
                ref={ref}
                aria-describedby={props['aria-describedby'] ?? undefined}
                className={cn(
                    'pointer-events-auto relative grid w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-auto',
                    'gap-4 p-6 sm:rounded-[2rem]',
                    glassPanelSurfaceClass,
                    dialogPanelMotionClass,
                    className
                )}
                {...props}
            >
                {/* Fallback accessible title - will be overridden by user-provided DialogTitle */}
                <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
                {children}
                {!hideClose && (
                    <DialogPrimitive.Close className="absolute right-4 top-4 rounded-xl border border-slate-200/60 bg-white/65 p-1.5 text-slate-500 shadow-sm ring-offset-background transition-all duration-200 hover:scale-[1.02] hover:bg-white hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </div>
    </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
        {...props}
    />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
        {...props}
    />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-lg font-semibold leading-none tracking-tight', className)}
        {...props}
    />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
    />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
}
