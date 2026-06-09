// NAI Service — API 客户端
// Token 验证、用户信息、Upscale、Vibe 编码

import { invokeWithTimeout } from '@/lib/ipc-timeout'
import JSZip from 'jszip'
import type { AnlasInfo, UserInfo } from './types'
import { stripBase64Header, isTauri, CLIENT_FETCH, API_ENDPOINTS } from './image-utils'
import { useSettingsStore } from '@/stores/settings-store'

const OFFICIAL_NOVELAI_PROXY_URL = 'https://nai-airdrop-relay.liuanjay.workers.dev/api/nai/subscription'

function resolveNovelAiProxyUrl() {
    const { novelAiProxyMode, novelAiProxyUrl } = useSettingsStore.getState()

    if (novelAiProxyMode === 'official') {
        return OFFICIAL_NOVELAI_PROXY_URL
    }

    if (novelAiProxyMode === 'custom') {
        return novelAiProxyUrl.trim() || null
    }

    return null
}

function formatNovelAiAuthError(error: unknown): string {
    const message = String(error || '')
    const lower = message.toLowerCase()

    if (lower.includes("ipc call 'verify_token' timed out")) {
        return '连接 NovelAI 超时，请检查网络或代理后重试'
    }

    if (lower.includes('dns') || lower.includes('failed to lookup address information')) {
        return '无法解析 NovelAI 域名，请检查 DNS 或网络环境'
    }

    if (lower.includes('timed out')) {
        return '连接 NovelAI 超时，请检查网络或代理后重试'
    }

    if (lower.includes('tls') || lower.includes('certificate') || lower.includes('handshake')) {
        return 'NovelAI HTTPS 握手失败，请检查代理、证书或系统时间'
    }

    if (lower.includes('connection refused') || lower.includes('actively refused')) {
        return '连接被拒绝，请检查本机代理或防火墙设置'
    }

    if (lower.includes('network error') || lower.includes('error sending request')) {
        return '无法连接 NovelAI API，请检查网络、代理或地区访问限制'
    }

    return message || 'NovelAI 认证失败'
}

export async function verifyToken(token: string): Promise<{
    valid: boolean
    tier?: 'paper' | 'tablet' | 'scroll' | 'opus'
    error?: string
}> {
    try {
        const trimmedToken = token.trim()
        
        if (!isTauri()) {
            console.warn('[Web Mode] Mocking verifyToken')
            return { valid: true, tier: 'opus' }
        }

        const result = await invokeWithTimeout<{ valid: boolean; tier?: string; error?: string }>('verify_token', {
            token: trimmedToken,
            proxyUrl: resolveNovelAiProxyUrl(),
        }, 30000)
        
        if (result.valid && result.tier) {
            return { valid: true, tier: result.tier as 'paper' | 'tablet' | 'scroll' | 'opus' }
        }
        return { valid: false, error: formatNovelAiAuthError(result.error || 'Authentication failed') }
    } catch (e) {
        console.error('Verify token error:', e)
        return { valid: false, error: formatNovelAiAuthError(e) }
    }
}

export async function getUserInfo(token: string): Promise<UserInfo | null> {
    try {
        const trimmedToken = token.trim()

        if (!isTauri()) {
             return { anlas: { fixed: 10000, purchased: 0, total: 10000 } }
        }

        const result = await invokeWithTimeout<{ success: boolean; fixed?: number; purchased?: number; error?: string }>('get_anlas_balance', {
            token: trimmedToken,
            proxyUrl: resolveNovelAiProxyUrl(),
        }, 30000)

        if (result.success) {
            const fixed = result.fixed || 0
            const purchased = result.purchased || 0
            return { anlas: { fixed, purchased, total: fixed + purchased } }
        }
        return null
    } catch (e) {
        return null
    }
}

export async function upscaleImage(
    token: string,
    imageBase64: string,
    width: number,
    height: number
): Promise<{ success: boolean; imageData?: string; error?: string }> {
    if (!token) return { success: false, error: 'Token required' }

    if (!isTauri()) {
        console.warn('[Web Mode] Upscale requires Tauri backend currently')
        return { success: false, error: 'Upscale API can only be used in Desktop App' }
    }

    try {
        const rawBase64 = stripBase64Header(imageBase64)
        const trimmedToken = token.trim()
        
        console.log(`[Upscale] Requesting 4x upscale for ${width}x${height} image...`)
        
        const result = await invokeWithTimeout<{ success: boolean; image_data?: string; error?: string }>(
            'upscale_image',
            {
                token: trimmedToken,
                image: rawBase64,
                width: width,
                height: height,
                scale: 4,
            },
            // 超分辨率可能需要较长时间，设置 60 秒超时
            60000 
        )

        if (result.success && result.image_data) {
            return { success: true, imageData: result.image_data }
        }

        return { success: false, error: result.error || 'Upscale failed without specific error' }
    } catch (e) {
        console.error('[Upscale] Invoke error:', e)
        return { success: false, error: String(e) }
    }
}

/**
 * Encode image for Vibe Transfer
 */
export async function encodeVibeImage(token: string, imageBase64: string, info: number = 1.0, model: string = 'nai-diffusion-3'): Promise<string> {
    const rawBase64 = stripBase64Header(imageBase64)
    const payload = {
        image: rawBase64,
        model: model, 
        information_extracted: info
    }

    const response = await CLIENT_FETCH(API_ENDPOINTS.VIBE_ENCODE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'NAI_Assistant/1.0'
        },
        body: JSON.stringify(payload)
    })

    if (!response.ok) {
        throw new Error(`Vibe encoding failed: ${response.status}`)
    }

    const blob = await response.blob()
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            const base64data = reader.result as string
            const parts = base64data.split(',')
            resolve(parts.length > 1 ? parts[1] : parts[0])
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}
