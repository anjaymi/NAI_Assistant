import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

interface ImageUploadProps {
    value?: string | null
    onChange: (base64: string | null) => void
    className?: string
    placeholder?: string
}

export function ImageUpload({ value, onChange, className, placeholder = "Upload Image" }: ImageUploadProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [previewValue, setPreviewValue] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!value) {
            setPreviewValue(null)
            return
        }

        let cancelled = false
        const img = new Image()
        img.onload = () => {
            if (cancelled) return
            const maxSize = 256
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
            const width = Math.max(1, Math.round(img.width * scale))
            const height = Math.max(1, Math.round(img.height * scale))
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                setPreviewValue(value)
                return
            }
            ctx.drawImage(img, 0, 0, width, height)
            const nextPreview = canvas.toDataURL('image/jpeg', 0.72)
            canvas.width = 0
            canvas.height = 0
            setPreviewValue(nextPreview)
        }
        img.onerror = () => {
            if (!cancelled) setPreviewValue(value)
        }
        img.src = value

        return () => {
            cancelled = true
            img.src = ''
        }
    }, [value])

    const handleFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid file type",
                description: "Please upload an image file.",
                variant: 'destructive'
            })
            return
        }

        const reader = new FileReader()
        reader.onloadend = () => {
            const result = reader.result as string
            onChange(result)
        }
        reader.readAsDataURL(file)
    }, [onChange])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0])
        }
    }, [handleFile])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!isDragging) setIsDragging(true)
    }, [isDragging])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleClick = () => {
        inputRef.current?.click()
    }

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange(null)
    }

    return (
        <div
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
                "relative group cursor-pointer rounded-[24px] border border-white/10 overflow-hidden min-h-[120px] flex items-center justify-center bg-black/40 hover:bg-black/60",
                isDragging ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/5 hover:border-white/20",
                value ? "border-solid p-0" : "p-4",
                className
            )}
        >
            <input
                type="file"
                ref={inputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                    e.target.value = '' // Reset input
                }}
            />

            {value ? (
                <>
                    <img 
                        src={previewValue || value} 
                        alt="Uploaded" 
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain max-h-[200px]" 
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <p className="text-white font-medium text-sm flex flex-col items-center gap-2 drop-shadow-md">
                           <Upload className="h-6 w-6 text-white/80" /> Change Image
                        </p>
                    </div>
                    <button
                        onClick={handleRemove}
                        className="absolute top-3 right-3 p-2 rounded-full bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/40 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </>
            ) : (
                <div className="flex flex-col items-center gap-3 text-white/50">
                    <div className={cn(
                        "p-4 rounded-full bg-white/5 border border-white/5",
                         isDragging ? "text-indigo-400 border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]" : "text-white/40 group-hover:text-white/70"
                    )}>
                        {isDragging ? <Upload className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-sm font-semibold tracking-wide text-white/80 group-hover:text-white">{placeholder}</p>
                        <p className="text-xs font-medium opacity-50">Click or drag & drop</p>
                    </div>
                </div>
            )}
        </div>
    )
}
