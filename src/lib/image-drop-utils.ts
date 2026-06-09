/**
 * 图片拖拽工具模块
 *
 * 集中处理拖拽图片的校验（64 倍数）、NAI 元数据解析和分辨率预设匹配，
 * 供 InpaintingEditor 和 ToolsPanel 复用。
 */

import { parseMetadataFromFile, type NAIMetadata } from '@/lib/metadata-parser'
import { RESOLUTION_PRESETS } from '@/components/molecules/ResolutionSelector'

// =====================
// 类型定义
// =====================

export interface ImageDropResult {
    /** 图片 base64 data URL */
    dataUrl: string
    /** 图片宽度（像素） */
    width: number
    /** 图片高度（像素） */
    height: number
    /** NovelAI 元数据（如果解析成功） */
    metadata: NAIMetadata | null
    /** 匹配的分辨率预设名称（如果匹配） */
    matchedPreset: string | null
    /** 是否为 64 的倍数 */
    isMultipleOf64: boolean
}

export interface ImageDropError {
    type: 'not_image' | 'load_failed'
    message: string
}

// =====================
// 核心函数
// =====================

/**
 * 处理拖拽的图片文件
 *
 * 1. 验证文件类型
 * 2. 加载图片获取尺寸
 * 3. 检查宽高是否为 64 的倍数（放入 result 标志，不拦截）
 * 4. 尝试解析 NAI 元数据
 * 5. 匹配分辨率预设
 *
 * @param file - 拖拽的文件对象
 * @returns 成功返回 ImageDropResult，失败抛出 ImageDropError
 */
export async function processDroppedImageFile(
    file: File
): Promise<ImageDropResult> {
    // 1. 验证文件类型
    if (!file.type.startsWith('image/')) {
        throw {
            type: 'not_image',
            message: '不支持的文件类型，请拖入图片文件',
        } as ImageDropError
    }

    // 2. 读取为 dataURL 并获取尺寸
    const { dataUrl, width, height } = await loadImageFile(file)

    // 3. 检查 64 倍数
    const isMultipleOf64 = width % 64 === 0 && height % 64 === 0

    // 4. 尝试解析 NAI 元数据（仅 PNG 支持）
    let metadata: NAIMetadata | null = null
    if (file.type === 'image/png') {
        try {
            metadata = await parseMetadataFromFile(file)
        } catch (e) {
            console.warn('[ImageDrop] 元数据解析失败:', e)
        }
    }

    // 5. 匹配分辨率预设
    const matchedPreset = findMatchingPreset(width, height)

    return { dataUrl, width, height, metadata, matchedPreset, isMultipleOf64 }
}

/**
 * 将 NAI 元数据应用到 generation store
 *
 * 复用 GalleryViewer.handleRegenerate 的逻辑，集中管理避免重复代码
 */
export function applyMetadataToStore(
    metadata: NAIMetadata,
    store: {
        setPrompt: (p: string) => void
        setNegativePrompt: (p: string) => void
        setSteps: (s: number) => void
        setCfgScale: (s: number) => void
        setCfgRescale: (s: number) => void
        setSeed: (s: number) => void
        setModel: (m: string) => void
        setSampler: (s: string) => void
        setScheduler: (s: string) => void
        setSmea: (s: boolean) => void
        setSmeaDyn: (s: boolean) => void
        setDimensions: (w: number, h: number) => void
    }
): void {
    if (metadata.prompt) store.setPrompt(metadata.prompt)

    // V4 负向提示词优先级高于传统 uc
    if (metadata.v4_negative_prompt?.caption?.base_caption) {
        store.setNegativePrompt(metadata.v4_negative_prompt.caption.base_caption)
    } else if (metadata.negativePrompt) {
        store.setNegativePrompt(metadata.negativePrompt)
    }

    if (metadata.steps) store.setSteps(metadata.steps)
    if (metadata.cfgScale) store.setCfgScale(metadata.cfgScale)
    if (metadata.cfgRescale !== undefined) store.setCfgRescale(metadata.cfgRescale)
    if (metadata.seed) store.setSeed(metadata.seed)
    if (metadata.model) store.setModel(metadata.model)
    if (metadata.sampler) store.setSampler(metadata.sampler)
    if (metadata.scheduler) store.setScheduler(metadata.scheduler)
    if (metadata.smea !== undefined) store.setSmea(metadata.smea)
    if (metadata.smeaDyn !== undefined) store.setSmeaDyn(metadata.smeaDyn)
    if (metadata.width && metadata.height) {
        store.setDimensions(metadata.width, metadata.height)
    }
}

// =====================
// 内部辅助函数
// =====================

/**
 * 加载图片文件，获取 dataURL 和尺寸
 */
function loadImageFile(
    file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string
            if (!dataUrl) {
                reject({
                    type: 'load_failed',
                    message: '文件读取失败',
                } as ImageDropError)
                return
            }

            // 加载为 Image 获取真实尺寸
            const img = new Image()
            img.onload = () => {
                resolve({ dataUrl, width: img.width, height: img.height })
                // 释放内存
                img.src = ''
            }
            img.onerror = () => {
                reject({
                    type: 'load_failed',
                    message: '图片加载失败，文件可能已损坏',
                } as ImageDropError)
                img.src = ''
            }
            img.src = dataUrl
        }
        reader.onerror = () => {
            reject({
                type: 'load_failed',
                message: '文件读取失败',
            } as ImageDropError)
        }
        reader.readAsDataURL(file)
    })
}

/**
 * 查找匹配的分辨率预设
 */
function findMatchingPreset(width: number, height: number): string | null {
    const matched = RESOLUTION_PRESETS.find(
        (p) => p.width === width && p.height === height
    )
    return matched ? `${matched.label} (${matched.width}×${matched.height})` : null
}
