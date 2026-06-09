import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 快捷键绑定定义
 * @description 每个快捷键由 actionId 唯一标识，keys 描述按键组合
 */
export interface ShortcutBinding {
    /** 动作唯一标识 */
    actionId: string
    /** 显示名称 */
    label: string
    /** 功能描述 */
    description: string
    /** 按键组合，如 "Ctrl+Enter", "Ctrl+H" */
    keys: string
    /** 是否启用 */
    enabled: boolean
}

/** 默认快捷键配置 */
const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
    {
        actionId: 'generate',
        label: '生成图片',
        description: '触发图片生成',
        keys: 'Ctrl+Enter',
        enabled: true,
    },
    {
        actionId: 'openSettings',
        label: '打开设置',
        description: '打开生成设置面板',
        keys: 'Ctrl+,',
        enabled: true,
    },
    {
        actionId: 'toggleHistory',
        label: '历史记录',
        description: '打开/关闭历史面板',
        keys: 'Ctrl+H',
        enabled: true,
    },
    {
        actionId: 'openArtistLibrary',
        label: '画师库',
        description: '打开画师库面板',
        keys: 'Ctrl+L',
        enabled: true,
    },
    {
        actionId: 'saveImage',
        label: '保存图片',
        description: '保存当前预览图片',
        keys: 'Ctrl+S',
        enabled: true,
    },
    {
        actionId: 'toggleSidebar',
        label: '切换侧边栏',
        description: '展开/折叠侧边栏',
        keys: 'Ctrl+B',
        enabled: true,
    },
]

interface ShortcutState {
    /** 所有快捷键绑定 */
    bindings: ShortcutBinding[]

    /** 更新指定动作的按键组合 */
    updateBinding: (actionId: string, newKeys: string) => void

    /** 切换指定快捷键的启用状态 */
    toggleBinding: (actionId: string) => void

    /** 重置所有快捷键为默认值 */
    resetToDefaults: () => void
}

/**
 * 将 KeyboardEvent 转换为可读的快捷键字符串
 * @example "Ctrl+Shift+S", "Ctrl+Enter", "F5"
 */
export function eventToKeyString(e: KeyboardEvent): string {
    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')

    // 排除修饰键本身
    const ignoredKeys = ['Control', 'Alt', 'Shift', 'Meta']
    if (!ignoredKeys.includes(e.key)) {
        // 规范化 key name
        let keyName = e.key
        if (keyName === ' ') keyName = 'Space'
        else if (keyName === ',') keyName = ','
        else if (keyName === '.') keyName = '.'
        else if (keyName.length === 1) keyName = keyName.toUpperCase()
        parts.push(keyName)
    }

    return parts.join('+')
}

/**
 * 检查 KeyboardEvent 是否匹配指定的快捷键字符串
 */
export function matchesShortcut(e: KeyboardEvent, shortcutKeys: string): boolean {
    const eventStr = eventToKeyString(e)
    return eventStr === shortcutKeys
}

export const useShortcutStore = create<ShortcutState>()(
    persist(
        (set) => ({
            bindings: [...DEFAULT_SHORTCUTS],

            updateBinding: (actionId, newKeys) =>
                set((state) => ({
                    bindings: state.bindings.map((b) =>
                        b.actionId === actionId ? { ...b, keys: newKeys } : b
                    ),
                })),

            toggleBinding: (actionId) =>
                set((state) => ({
                    bindings: state.bindings.map((b) =>
                        b.actionId === actionId ? { ...b, enabled: !b.enabled } : b
                    ),
                })),

            resetToDefaults: () => set({ bindings: [...DEFAULT_SHORTCUTS] }),
        }),
        {
            name: 'shortcut-storage',
            // 合并策略：新版本若添加了新快捷键，确保不丢失
            merge: (persisted, current) => {
                const p = persisted as Partial<ShortcutState>
                if (!p?.bindings) return current

                // 以默认列表为基准，覆盖用户已自定义的
                const merged = DEFAULT_SHORTCUTS.map((def) => {
                    const userBinding = p.bindings!.find((b) => b.actionId === def.actionId)
                    return userBinding ? { ...def, keys: userBinding.keys, enabled: userBinding.enabled } : def
                })

                return { ...current, bindings: merged }
            },
        }
    )
)
