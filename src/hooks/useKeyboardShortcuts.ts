import { useEffect, useCallback } from 'react'
import { useShortcutStore, matchesShortcut } from '@/stores/shortcut-store'

/** 动作处理函数映射 */
export type ActionHandlers = Record<string, () => void>

/**
 * 全局快捷键监听 Hook
 * 
 * @description
 * - 挂载后监听全局 keydown 事件
 * - 匹配 shortcut-store 中启用的绑定
 * - 输入框/textarea 焦点时自动跳过（防止打字冲突）
 * - 需要 Enter 的快捷键在 textarea 中仍然生效（如 Ctrl+Enter 生成）
 * 
 * @param handlers - actionId → callback 的映射
 */
export function useKeyboardShortcuts(handlers: ActionHandlers): void {
    const bindings = useShortcutStore((s) => s.bindings)

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            const tagName = target.tagName
            const isInputFocused = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable

            for (const binding of bindings) {
                if (!binding.enabled) continue
                if (!matchesShortcut(e, binding.keys)) continue

                // 在输入框中，只允许带修饰键的快捷键通过
                const hasModifier = e.ctrlKey || e.metaKey || e.altKey
                if (isInputFocused && !hasModifier) continue

                const handler = handlers[binding.actionId]
                if (handler) {
                    e.preventDefault()
                    e.stopPropagation()
                    handler()
                    return // 一次只执行一个匹配
                }
            }
        },
        [bindings, handlers]
    )

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown, true) // capture phase
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [handleKeyDown])
}
