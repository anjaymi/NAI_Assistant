# 功能说明

NAI Assistant 是一个面向 NovelAI 图片工作流的 Tauri 2 桌面与 Android 应用。仓库包含主应用、Tauri/Rust 后端、Android 工程、浏览器辅助扩展，以及可选 Cloudflare Worker 云端能力。

## 核心能力

- NovelAI token 校验与账号状态读取。
- Anlas 查询、订阅信息读取与基础登录状态提示。
- 文生图、图生图、局部重绘、放大与常用参数管理。
- 移动端、平板端、桌面端自适应布局。
- 本地图库、生成历史、图片预览和基础元数据读取。
- 提示词编辑、标签搜索、标签分片加载和 wildcard 管理。
- 艺术家库、社区艺术家条目、批量编辑与同步入口。
- 预设管理、场景管理、角色提示词和常用工作区设置。
- 可选 tagger sidecar 下载流程。大型预构建 sidecar 二进制不随仓库提交。

## 桌面版

桌面版基于 Tauri 2：

- 前端：React、TypeScript、Vite。
- 后端：Rust、Tauri commands、本地文件/HTTP/Store/SQL 等插件。
- 支持 Windows 打包；其他桌面平台按 Tauri 2 能力继续扩展。
- 深链接 scheme 使用 `nais2://`，用于导入自定义 Worker 地址或处理登录回调。

常用命令：

```bash
npm install
npm run tauri dev
npm run tauri build
```

## Android 版

Android 工程位于：

```text
src-tauri/gen/android
```

常用命令：

```bash
npm run tauri android dev
npm run build:android
```

签名发布需要自己准备 keystore：

```text
src-tauri/gen/android/keystore.properties.example
```

复制为 `keystore.properties` 后填入自己的 keystore 路径和密码。不要提交 keystore、密码或 release 产物。

## 浏览器辅助扩展

扩展目录：

```text
browser-extension/NAIS2-Worker-Helper
```

它用于辅助用户部署或导入自定义 Worker。Chromium/Edge 可以通过“加载已解压的扩展程序”加载该目录。

扩展不能替用户注册 Cloudflare、输入账号密码或绕过验证；它只提供打开页面、复制模板、生成深链接等辅助动作。

## 云端能力

仓库包含两个可选 Worker：

- `worker`：账号、同步、分享码、公开 wildcard/artist 数据。
- `worker-cloud-airdrop`：移动端到 PC 的云端图传信令、PC 发现、NovelAI subscription 代理。

云端不是运行主应用的必需项。只使用本地桌面/Android 能力时，可以不部署 Worker。

## 隐私与安全边界

- NovelAI token 应只保存在用户本机或用户自己控制的 Worker 请求中。
- 不要使用陌生人部署的 Worker 处理自己的 token。
- 开源仓库不包含 `.env`、`.dev.vars`、keystore、Cloudflare 真实资源 ID 或私有 API key。
- Worker 配置文件中的 ID 都是占位符，部署者必须替换为自己的 Cloudflare 资源。

## 当前不随仓库发布的内容

- 本地构建产物：`dist`、`src-tauri/target`、Gradle build 目录。
- Android 签名文件和密码。
- Worker 本地 secrets。
- 大型 sidecar exe。
- 本机调试日志、备份目录、临时探索文件。
