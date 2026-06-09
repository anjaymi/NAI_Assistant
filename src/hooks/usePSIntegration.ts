/**
 * Photoshop Integration Hook
 * 
 * 监听来自 PS 插件的选区数据，自动执行图生图生成，并返回结果
 */
import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useGenerationStore } from '@/stores/generation-store'
import { toast } from '@/hooks/use-toast'

export interface PSSelectionData {
    image: string      // Base64 data URL
    width: number
    height: number
    mode: string       // "simple" or "advanced"
    strength: number
    noise: number
    model?: string
    steps?: number
    prompt?: string
    negativePrompt?: string
}

/**
 * 使用此 hook 在主页面启用 PS 插件集成
 * 
 * 工作流程：
 * 1. 接收 PS 选区数据
 * 2. 自动设置生成参数
 * 3. 自动触发图生图生成
 * 4. 生成完成后提交结果到后端
 * 5. 后端返回结果给 PS 插件
 */
export function usePSIntegration() {
    const isProcessingRef = useRef(false)

    useEffect(() => {
        // [WEB MODE FALLBACK] Tauri emit/listen relies on window.__TAURI_INTERNALS__
        if (typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__) {
            console.log('[PS Integration] Running in web mode. PS listener disabled.')
            return
        }

        const unlistenPromise = listen<PSSelectionData>('ps-selection-received', async (event) => {
            // 防止重复处理
            if (isProcessingRef.current) {
                console.log('[PS Integration] Already processing, skipping')
                return
            }
            
            isProcessingRef.current = true
            const data = event.payload
            console.log('[PS Integration] Received selection:', data.width, 'x', data.height)

            try {
                // 显示开始通知
                toast({
                    title: '🎨 Photoshop 选区已接收',
                    description: `正在生成 ${data.width}×${data.height} 图像...`,
                })

                // 设置图生图源图
                const genStore = useGenerationStore.getState()
                genStore.setSourceImage(data.image)
                
                // 设置尺寸
                genStore.setDimensions(data.width, data.height)
                
                // 设置图生图参数
                genStore.setStrength(data.strength)
                genStore.setNoise(data.noise)

                // 如果是高级模式，应用额外参数
                if (data.mode === 'advanced') {
                    if (data.model) genStore.setModel(data.model)
                    if (data.steps) genStore.setSteps(data.steps)
                    if (data.prompt) genStore.setPrompt(data.prompt)
                    if (data.negativePrompt) genStore.setNegativePrompt(data.negativePrompt)
                }

                // 等待一帧确保状态更新
                await new Promise(resolve => setTimeout(resolve, 100))

                // 自动触发生成
                console.log('[PS Integration] Starting generation...')
                
                // 调用生成函数
                await genStore.generate()
                
                // 等待生成完成（检查 previewImage 是否更新）
                await new Promise(resolve => setTimeout(resolve, 500))
                
                const previewImage = useGenerationStore.getState().previewImage
                if (previewImage) {
                    console.log('[PS Integration] Generation complete, submitting result')
                    
                    // 提交结果到后端
                    await submitResult(previewImage)
                    
                    toast({
                        title: '✅ 生成完成',
                        description: '结果已发送到 Photoshop',
                    })
                } else {
                    console.error('[PS Integration] Generation failed or no result')
                    await submitResult('') // 提交空结果表示失败
                    
                    toast({
                        title: '❌ 生成失败',
                        description: '请检查 API 设置',
                        variant: 'destructive'
                    })
                }
            } catch (error) {
                console.error('[PS Integration] Error:', error)
                await submitResult('') // 提交空结果
                
                toast({
                    title: '❌ 处理失败',
                    description: String(error),
                    variant: 'destructive'
                })
            } finally {
                isProcessingRef.current = false
            }
        })

        return () => {
            unlistenPromise.then((unlisten) => unlisten())
        }
    }, [])
}

/**
 * 提交生成结果到后端
 */
async function submitResult(imageData: string) {
    try {
        const response = await fetch('http://localhost:8080/api/ps/submit-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        })
        
        if (!response.ok) {
            console.error('[PS Integration] Failed to submit result:', response.status)
        }
    } catch (error) {
        console.error('[PS Integration] Submit error:', error)
    }
}
