// NAI Service — 图像处理工具
// Canvas 操作：resize、mask 转换、角色参考图 pad、URL 解析

/** 去除 Base64 data URL 头部 */
export const stripBase64Header = (base64: string) => {
    return base64.replace(/^data:image\/[a-z]+;base64,/, '')
}

/**
 * Round dimension DOWN to nearest multiple of 64
 * NAI API requires all image dimensions to be multiples of 64
 */
export function roundToMultipleOf64(value: number): number {
    return Math.floor(value / 64) * 64
}

/**
 * Resize image so both dimensions are multiples of 64
 * Required for I2I and Inpainting to work correctly
 * @param imageBase64 - Input image (with or without data URL header)
 * @param useMaskScaling - If true, use nearest-neighbor scaling (for masks)
 * @returns Promise with resized image as base64 (no header) and final dimensions
 */
export async function resizeToMultipleOf64(
    imageBase64: string,
    useMaskScaling: boolean = false
): Promise<{ base64: string; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const targetWidth = roundToMultipleOf64(img.width)
            const targetHeight = roundToMultipleOf64(img.height)
            
            // If already aligned, return as-is (stripped of header)
            if (targetWidth === img.width && targetHeight === img.height) {
                resolve({
                    base64: stripBase64Header(imageBase64),
                    width: img.width,
                    height: img.height
                })
                return
            }
            
            console.log(`[ResizeTo64] ${img.width}x${img.height} -> ${targetWidth}x${targetHeight}`)
            
            const canvas = document.createElement('canvas')
            canvas.width = targetWidth
            canvas.height = targetHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Canvas context failed'))
                return
            }
            
            // For masks: use nearest-neighbor to preserve hard edges
            // For images: use default (bilinear) for quality
            if (useMaskScaling) {
                ctx.imageSmoothingEnabled = false
            }
            
            // Draw resized image (crops from top-left)
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
            
            const format = useMaskScaling ? 'image/png' : 'image/png'
            const dataUrl = canvas.toDataURL(format)
            
            // CRITICAL: 释放 canvas 和 image 内存
            canvas.width = 0
            canvas.height = 0
            img.src = ''
            
            resolve({
                base64: stripBase64Header(dataUrl),
                width: targetWidth,
                height: targetHeight
            })
        }
        img.onerror = (e) => {
            img.src = ''
            reject(new Error('Image load failed for resize'))
        }
        if (imageBase64.startsWith('http') || imageBase64.startsWith('asset')) {
            img.crossOrigin = 'Anonymous'
            img.src = imageBase64
        } else {
            img.src = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
        }
    })
}

/**
 * Remove comment lines from prompt (lines starting with #)
 */
export function removeComments(prompt: string): string {
    return prompt
        .split('\n')
        .filter(line => !line.trimStart().startsWith('#'))
        .join('\n')
}

/** Web Compatibility Helper */
export const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window

/** 带超时的 API 请求客户端 (默认 30秒请求超时) */
export const CLIENT_FETCH = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 30000) => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await window.fetch(input, {
            ...init,
            signal: controller.signal
        })
        clearTimeout(id)
        return response
    } catch (e: any) {
        clearTimeout(id)
        if (e.name === 'AbortError') {
            throw new Error(`请求超时 (${timeoutMs}ms): 服务器未能在指定时间内响应`)
        }
        throw e
    }
}

/** NAI API 端点常量 */
export const API_ENDPOINTS = {
    IMAGE_GENERATE: 'https://image.novelai.net/ai/generate-image',
    IMAGE_GENERATE_STREAM: 'https://image.novelai.net/ai/generate-image-stream',
    VIBE_ENCODE: 'https://image.novelai.net/ai/encode-vibe',
    UPSCALE: 'https://image.novelai.net/ai/upscale',
}

/**
 * Convert RGBA mask to pure grayscale for NAI API
 * NAI expects: Black (0) = preserve, White (255) = inpaint
 * 
 * Reference: Semi-Auto-NovelAI-to-Pixiv change_the_mask_color()
 * - if alpha != 0: set to (255, 255, 255)
 * - if alpha == 0: set to (0, 0, 0)
 */
export async function convertMaskToGrayscale(maskBase64: string, targetWidth: number, targetHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            // Create canvas at TARGET size
            const canvas = document.createElement('canvas')
            canvas.width = targetWidth
            canvas.height = targetHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Canvas context failed'))
                return
            }

            // Disable image smoothing to prevent anti-aliasing on edges
            ctx.imageSmoothingEnabled = false

            // Draw original mask (with nearest-neighbor scaling if dimensions differ)
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

            // Process pixels - Match reference implementation EXACTLY
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data

            // Reference: if a != 0 -> white, else black
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3]
                // Match reference: alpha !== 0 means this pixel is part of the mask
                if (alpha !== 0) {
                    data[i] = 255     // R
                    data[i + 1] = 255 // G
                    data[i + 2] = 255 // B
                    data[i + 3] = 255 // A (Full Opacity)
                } else {
                    data[i] = 0       // R
                    data[i + 1] = 0   // G
                    data[i + 2] = 0   // B
                    data[i + 3] = 255 // A (Full Opacity Black)
                }
            }

            ctx.putImageData(imageData, 0, 0)
            const dataUrl = canvas.toDataURL('image/png')
            
            // CRITICAL: 释放 canvas 和 image 内存
            canvas.width = 0
            canvas.height = 0
            img.src = ''
            
            resolve(stripBase64Header(dataUrl))
        }
        img.onerror = () => {
            img.src = ''
            reject(new Error('Mask image load failed'))
        }
        if (maskBase64.startsWith('http') || maskBase64.startsWith('asset')) {
            img.crossOrigin = 'Anonymous'
            img.src = maskBase64
        } else {
            img.src = maskBase64.startsWith('data:') ? maskBase64 : `data:image/png;base64,${maskBase64}`
        }
    })
}

/**
 * Resize and pad image for Character Reference (Director Tools)
 */
export async function processCharacterImage(imageBase64: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const width = img.width
            const height = img.height
            let targetW = 1472, targetH = 1472

            if (width > height) { targetW = 1536; targetH = 1024 }
            else if (width < height) { targetW = 1024; targetH = 1536 }

            const canvas = document.createElement('canvas')
            canvas.width = targetW
            canvas.height = targetH
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Canvas context failed'))
                return
            }

            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, targetW, targetH)

            const scale = Math.min(targetW / width, targetH / height)
            const w = width * scale
            const h = height * scale
            const x = (targetW - w) / 2
            const y = (targetH - h) / 2

            ctx.drawImage(img, x, y, w, h)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
            
            // CRITICAL: 释放 canvas 和 image 内存
            canvas.width = 0
            canvas.height = 0
            img.src = ''
            
            resolve(dataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, ''))
        }
        img.onerror = () => {
            img.src = ''
            reject(new Error("Image load failed"))
        }
        if (imageBase64.startsWith('http') || imageBase64.startsWith('asset')) {
            img.crossOrigin = 'Anonymous'
            img.src = imageBase64
        } else {
            img.src = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
        }
    })
}

/** 确保输入为 base64（URL 会被 fetch 转换） */
export async function resolveImageToBase64(input: string): Promise<string> {
    if (input.startsWith('http') || input.startsWith('asset')) {
        try {
            const resp = await CLIENT_FETCH(input)
            const blob = await resp.blob()
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(blob)
            })
        } catch (e) {
            console.error("Failed to resolve image URL:", input, e)
            throw e
        }
    }
    return input
}
