import { convertFileSrc, invoke } from '@tauri-apps/api/core'

export async function createCanvasPreviewImage(source: string, maxSize = 768): Promise<string> {
    if ((window as any)['__TAURI__']) {
        try {
            const previewPath = await invoke<string>('create_canvas_preview_image', { source, maxSize })
            return convertFileSrc(previewPath)
        } catch (error) {
            console.warn('[CanvasPreview] Rust preview generation failed, falling back to browser preview', error)
        }
    }

    return new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(img.width * scale))
            canvas.height = Math.max(1, Math.round(img.height * scale))
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve('')
                return
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            const preview = canvas.toDataURL('image/jpeg', 0.78)
            canvas.width = 0
            canvas.height = 0
            img.src = ''
            resolve(preview)
        }
        img.onerror = () => resolve('')
        img.src = source
    })
}
