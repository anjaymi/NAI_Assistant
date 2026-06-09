
import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionProps {
    title: string
    children: React.ReactNode
    defaultOpen?: boolean
    className?: string
}

export function Accordion({ title, children, defaultOpen = false, className }: AccordionProps) {
    const [isOpen, setIsOpen] = React.useState(defaultOpen)

    return (
        <div className={cn("border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden bg-black/5 dark:bg-black/20 backdrop-blur-xl shadow-inner", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-slate-900 dark:text-white/90"
            >
                {title}
                <ChevronDown
                    className={cn(
                        "h-4 w-4 text-slate-500 dark:text-white/50 transition-transform duration-300",
                        isOpen && "transform rotate-180"
                    )}
                />
            </button>
            <div
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-[1000px] opacity-100 p-4 pt-0" : "max-h-0 opacity-0"
                )}
            >
                {children}
            </div>
        </div>
    )
}
