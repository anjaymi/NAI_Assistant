"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
    glassOverlayClass,
    glassPanelSurfaceClass,
    overlayMotionClass,
    sheetPanelMotionClass,
} from "@/lib/motion"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <SheetPrimitive.Overlay
        className={cn(
            "fixed inset-0 z-50",
            overlayMotionClass,
            glassOverlayClass,
            className
        )}
        {...props}
        ref={ref}
    />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
    "fixed z-50 gap-4 p-6 transition ease-out overflow-hidden border-slate-200/60 dark:border-white/10 supports-[backdrop-filter]:bg-white/68 dark:supports-[backdrop-filter]:bg-[#050816]/74",
    {
        variants: {
            side: {
                top: "inset-x-4 top-4 rounded-[2rem] border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
                bottom:
                    "inset-x-4 bottom-4 rounded-[2rem] border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
                left: "inset-y-4 left-4 h-[calc(100%-2rem)] w-3/4 rounded-[2rem] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
                right:
                    "inset-y-4 right-4 h-[calc(100%-2rem)] w-3/4 rounded-[2rem] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
            },
        },
        defaultVariants: {
            side: "right",
        },
    }
)

interface SheetContentProps
    extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> { }

const SheetContent = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Content>,
    SheetContentProps & { hideClose?: boolean }
>(({ side = "right", className, children, hideClose, ...props }, ref) => (
    <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
            ref={ref}
            aria-describedby={props['aria-describedby'] ?? undefined}
            className={cn(sheetVariants({ side }), glassPanelSurfaceClass, sheetPanelMotionClass, className)}
            {...props}
        >
            {/* Fallback accessible title - will be overridden by user-provided SheetTitle */}
            <SheetPrimitive.Title className="sr-only">Sheet</SheetPrimitive.Title>
            {!hideClose && (
                <SheetPrimitive.Close className="absolute right-4 top-4 z-50 rounded-xl border border-slate-200/60 bg-white/65 p-1.5 text-slate-500 shadow-sm ring-offset-background transition-all duration-200 hover:scale-[1.02] hover:bg-white hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </SheetPrimitive.Close>
            )}
            {children}
        </SheetPrimitive.Content>
    </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col space-y-2 text-center sm:text-left",
            className
        )}
        {...props}
    />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
            className
        )}
        {...props}
    />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
    <SheetPrimitive.Title
        ref={ref}
        className={cn("text-lg font-semibold text-foreground", className)}
        {...props}
    />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
    <SheetPrimitive.Description
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
    Sheet,
    SheetPortal,
    SheetOverlay,
    SheetTrigger,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetDescription,
}
