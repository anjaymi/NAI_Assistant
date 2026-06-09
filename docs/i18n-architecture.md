# 多语言架构说明

NAI Assistant 的多语言层基于 `i18next`、`react-i18next` 和 `i18next-browser-languagedetector`。当前内置语言为：

- `zh-CN`
- `en-US`

## 文件结构

```text
src/i18n/
  config.ts
  locales/
    zh-CN.json
    en-US.json
```

`src/i18n/config.ts` 是唯一入口。应用启动时先初始化 i18n，再按当前语言动态加载对应 JSON 语言包。

## 加载流程

1. 默认语言为 `zh-CN`。
2. 语言探测优先读取 `localStorage`，然后读取浏览器或 WebView 的 `navigator` 语言。
3. 探测到的语言会被归一化：
   - `zh`、`zh-Hans`、`zh-CN` -> `zh-CN`
   - `en`、`en-US`、`en-GB` -> `en-US`
   - 其他语言 -> `zh-CN`
4. 语言包通过动态 import 加载：
   - `import('./locales/zh-CN.json')`
   - `import('./locales/en-US.json')`
5. 加载过的语言会记录在 `loadedLanguages`，避免重复注入资源。
6. 切换语言时，若目标语言尚未加载，会先加载资源，再执行 `i18n.changeLanguage`。

## 在组件中使用

React 组件中使用 `useTranslation`：

```tsx
import { useTranslation } from 'react-i18next'

function Example() {
  const { t } = useTranslation()
  return <button>{t('common.save')}</button>
}
```

非组件模块中可以导入默认 i18n 实例，但优先让 UI 文案停留在组件层：

```ts
import i18n from '@/i18n/config'

const message = i18n.t('errors.network')
```

## 增加新语言

以日语 `ja-JP` 为例：

1. 新增语言包：

```text
src/i18n/locales/ja-JP.json
```

2. 在 `src/i18n/config.ts` 中扩展类型和语言集合：

```ts
type SupportedLanguage = 'zh-CN' | 'en-US' | 'ja-JP'

const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>([
  'zh-CN',
  'en-US',
  'ja-JP'
])
```

3. 增加 loader：

```ts
const localeLoaders = {
  'zh-CN': () => import('./locales/zh-CN.json'),
  'en-US': () => import('./locales/en-US.json'),
  'ja-JP': () => import('./locales/ja-JP.json')
} as const
```

4. 在 `normalizeLanguage` 中增加映射：

```ts
if (baseLanguage === 'ja') return 'ja-JP'
```

5. 保持 JSON key 与现有语言完全一致。新增 UI 文案时，必须同步补齐所有语言包。

## 文案约定

- key 使用稳定语义，不使用整句中文作为 key。
- 通用操作放在 `common`，错误放在 `errors`，功能模块放在对应模块命名空间。
- 不把 API token、用户输入、远端返回内容写进翻译文件。
- 如果某个字符串包含变量，用 i18next interpolation：

```json
{
  "sync": {
    "itemsUploaded": "已上传 {{count}} 项"
  }
}
```

```tsx
t('sync.itemsUploaded', { count })
```

## 开源维护建议

- PR 中新增页面或设置项时，检查 `zh-CN.json` 与 `en-US.json` 是否同时更新。
- 不要在组件里硬编码长期可见的中文或英文 UI 文案。
- 调试日志、内部错误码、开发者注释不要求翻译；用户可见 toast、dialog、button、empty state 需要翻译。
