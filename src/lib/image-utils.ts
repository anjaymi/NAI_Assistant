/**
 * 图片工具库 — 内存安全的图片处理和引用图文件管理
 * 
 * 提供缩略图生成、引用图持久化存储功能。
 * 所有 Canvas/Image 操作在完成后立即释放资源，防止 OOM。
 */

import { appDataDir, join } from '@tauri-apps/api/path'
import { writeFile, readFile, remove, mkdir, exists } from '@tauri-apps/plugin-fs'

function uint8ArrayToBase64(data: Uint8Array): string {
    const chunkSize = 0x8000
    let binary = ''

    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.subarray(i, i + chunkSize)
        binary += String.fromCharCode(...chunk)
    }

    return btoa(binary)
}

// ===== 缩略图生成 =====

/**
 * 从 base64 图片生成缩略图（默认 256px，JPEG 0.7 质量）
 * 
 * @param base64Image - 完整的 base64 图片字符串（含 data: 前缀）
 * @param maxSize - 缩略图最大边长（默认 256px）
 * @returns 缩略图 base64 字符串（约 10-30KB）
 */
export const createThumbnail = (base64Image: string, maxSize = 256): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
            let canvas: HTMLCanvasElement | null = null
            try {
                canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')

                if (!ctx) {
                    resolve(base64Image)
                    return
                }

                // 按比例缩放
                let width = img.width
                let height = img.height
                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round(height * maxSize / width)
                        width = maxSize
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round(width * maxSize / height)
                        height = maxSize
                    }
                }

                canvas.width = width
                canvas.height = height
                ctx.drawImage(img, 0, 0, width, height)

                // JPEG 体积更小（~10-30KB vs 原图 2-5MB）
                const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
                resolve(thumbnail)
            } catch {
                resolve(base64Image) // 降级使用原图
            } finally {
                // CRITICAL: 释放 canvas 和 image 内存
                if (canvas) {
                    canvas.width = 0
                    canvas.height = 0
                }
                img.src = ''
            }
        }
        img.onerror = () => {
            img.src = ''
            resolve(base64Image)
        }
        img.src = base64Image
    })
}

// ===== 引用图文件管理 =====

const REFERENCES_DIR = 'references'
const ENCODED_VIBES_DIR = 'encoded-vibes'
const GENERATED_PREVIEWS_DIR = 'generated-previews'

/**
 * 获取引用图存储目录路径
 */
export const getReferencesDir = async (): Promise<string> => {
    const appData = await appDataDir()
    return await join(appData, REFERENCES_DIR)
}

/**
 * 确保引用图目录存在
 */
export const ensureReferencesDir = async (): Promise<string> => {
    const refDir = await getReferencesDir()
    if (!(await exists(refDir))) {
        await mkdir(refDir, { recursive: true })
    }
    return refDir
}

/**
 * 获取 encoded vibe 存储目录路径
 */
export const getEncodedVibesDir = async (): Promise<string> => {
    const appData = await appDataDir()
    return await join(appData, ENCODED_VIBES_DIR)
}

/**
 * 确保 encoded vibe 目录存在
 */
export const ensureEncodedVibesDir = async (): Promise<string> => {
    const vibeDir = await getEncodedVibesDir()
    if (!(await exists(vibeDir))) {
        await mkdir(vibeDir, { recursive: true })
    }
    return vibeDir
}

export const getGeneratedPreviewsDir = async (): Promise<string> => {
    const appData = await appDataDir()
    return await join(appData, GENERATED_PREVIEWS_DIR)
}

export const ensureGeneratedPreviewsDir = async (): Promise<string> => {
    const previewDir = await getGeneratedPreviewsDir()
    if (!(await exists(previewDir))) {
        await mkdir(previewDir, { recursive: true })
    }
    return previewDir
}

/**
 * 将 base64 图片保存为文件，返回文件路径
 * 
 * @param base64Image - 完整的 base64 字符串（含 data: 前缀）
 * @param id - 唯一标识符
 * @param type - 'character' 或 'vibe'
 * @returns 文件绝对路径
 */
export const saveReferenceImage = async (
    base64Image: string,
    id: string,
    type: 'character' | 'vibe'
): Promise<string> => {
    const refDir = await ensureReferencesDir()

    // 提取 base64 数据部分（去掉 data:image/...;base64, 前缀）
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

    // 从 data 前缀推断扩展名
    const ext = base64Image.includes('image/webp') ? 'webp' : 'png'
    const fileName = `${type}_${id}.${ext}`
    const filePath = await join(refDir, fileName)

    await writeFile(filePath, binaryData)
    console.log(`[ImageUtils] Saved reference image: ${filePath}`)

    return filePath
}

/**
 * 从文件路径加载 base64 图片
 * 
 * @param filePath - 绝对文件路径
 * @returns base64 字符串（含 data: 前缀），文件不存在返回 null
 */
export const loadReferenceImage = async (filePath: string): Promise<string | null> => {
    try {
        if (!(await exists(filePath))) {
            console.warn(`[ImageUtils] Reference image not found: ${filePath}`)
            return null
        }

        const data = await readFile(filePath)
        const base64 = uint8ArrayToBase64(data)

        // 从扩展名推断 MIME 类型
        const ext = filePath.toLowerCase().split('.').pop()
        const mimeType = ext === 'webp' ? 'image/webp' : 'image/png'

        return `data:${mimeType};base64,${base64}`
    } catch (e) {
        console.error(`[ImageUtils] Failed to load reference image: ${filePath}`, e)
        return null
    }
}

export const resolveImageInputToBase64 = async (input: string): Promise<string> => {
    if (!input) {
        return input
    }

    if (input.startsWith('data:')) {
        return input
    }

    if (isFilePath(input)) {
        const loaded = await loadReferenceImage(input)
        if (loaded) {
            return loaded
        }
    }

    const response = await fetch(input)
    const blob = await response.blob()

    return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
    })
}

export const saveGeneratedPreviewImage = async (base64Image: string, id: string): Promise<string> => {
    const previewDir = await ensureGeneratedPreviewsDir()
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    const ext = base64Image.includes('image/webp') ? 'webp' : 'png'
    const fileName = `preview_${id}.${ext}`
    const filePath = await join(previewDir, fileName)

    await writeFile(filePath, binaryData)
    return filePath
}

export const deleteGeneratedPreviewImage = async (filePath: string): Promise<void> => {
    await deleteReferenceImage(filePath)
}

/**
 * 将 encoded vibe 数据保存为文件，返回文件路径
 */
export const saveEncodedVibe = async (encodedVibe: string, id: string): Promise<string> => {
    const vibeDir = await ensureEncodedVibesDir()
    const fileName = `vibe_${id}.bin`
    const filePath = await join(vibeDir, fileName)
    const binaryData = Uint8Array.from(atob(encodedVibe), c => c.charCodeAt(0))

    await writeFile(filePath, binaryData)
    console.log(`[ImageUtils] Saved encoded vibe: ${filePath}`)

    return filePath
}

/**
 * 从文件路径加载 encoded vibe 数据
 */
export const loadEncodedVibe = async (filePath: string): Promise<string | null> => {
    try {
        if (!(await exists(filePath))) {
            console.warn(`[ImageUtils] Encoded vibe not found: ${filePath}`)
            return null
        }

        const data = await readFile(filePath)
        return uint8ArrayToBase64(data)
    } catch (e) {
        console.error(`[ImageUtils] Failed to load encoded vibe: ${filePath}`, e)
        return null
    }
}

/**
 * 删除引用图文件
 */
export const deleteReferenceImage = async (filePath: string): Promise<void> => {
    try {
        if (await exists(filePath)) {
            await remove(filePath)
            console.log(`[ImageUtils] Deleted reference image: ${filePath}`)
        }
    } catch (e) {
        console.error(`[ImageUtils] Failed to delete reference image: ${filePath}`, e)
    }
}

/**
 * 判断字符串是文件路径还是 base64 数据
 */
export const isFilePath = (str: string): boolean => {
    return !str.startsWith('data:') && (
        str.includes('/') || str.includes('\\') ||
        str.endsWith('.png') || str.endsWith('.webp') || str.endsWith('.jpg')
    )
}
