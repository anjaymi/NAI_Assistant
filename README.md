# NAI Assistant

<p align="center">
  <strong>NovelAI image workflow workspace for desktop, Android, and optional Cloudflare Workers.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green.svg"></a>
  <a href="https://tauri.app"><img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-blue.svg"></a>
  <a href="https://react.dev"><img alt="React" src="https://img.shields.io/badge/React-18-61dafb.svg"></a>
  <a href="https://www.rust-lang.org"><img alt="Rust" src="https://img.shields.io/badge/Rust-1.88+-orange.svg"></a>
  <a href="docs/cloud-setup.md"><img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-f38020.svg"></a>
</p>

<p align="center">
  <strong>Read this page in:</strong>
  <br>
  <a href="#zh-cn"><img alt="中文" src="https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E9%A6%96%E9%A1%B5%E8%AF%B4%E6%98%8E-d73a31.svg"></a>
  <a href="#en-us"><img alt="English" src="https://img.shields.io/badge/English-Overview-2563eb.svg"></a>
  <a href="#ja-jp"><img alt="日本語" src="https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-%E6%A6%82%E8%A6%81-7c3aed.svg"></a>
</p>

<p align="center">
  <a href="docs/features.md"><strong>Feature Overview</strong></a>
  ·
  <a href="docs/cloud-setup.md"><strong>Cloud Setup</strong></a>
  ·
  <a href="docs/i18n-architecture.md"><strong>I18n Architecture</strong></a>
  ·
  <a href="docs/custom-worker-user-guide.md"><strong>Custom Worker Guide</strong></a>
</p>

## Product Snapshot

| Desktop | Android | Cloud |
| --- | --- | --- |
| Tauri 2 shell, Rust commands, local file/API utilities, deep links, Windows release build support | Tauri-generated Android project under `src-tauri/gen/android`, with signed release support through your own keystore | Optional Cloudflare D1 sync Worker and KV airdrop/NovelAI proxy Worker |

| Workflow Layer | Included Capabilities |
| --- | --- |
| NovelAI | Token verification, Anlas/subscription lookup, generation, img2img, inpainting, upscaling |
| Prompt | Tag search, tag shards, wildcard management, presets, scenes, character prompts |
| Gallery | Local gallery, generation history, preview, metadata parsing, artist library |
| Community | Public wildcard and artist entries through optional Worker services |
| Language | Current app locales: `zh-CN`, `en-US`; README supports same-page `中文 / English / 日本語` reading sections |

> GitHub README files cannot run JavaScript, so the language switch above uses same-page anchors. It behaves like tabs while staying compatible with GitHub rendering.

<a id="zh-cn"></a>

## 中文

### 项目定位

NAI Assistant 是一个围绕 NovelAI 图片工作流构建的 Tauri 2 桌面端与 Android 应用。它把 React/Vite 前端、Rust/Tauri 后端、移动端工程、浏览器辅助扩展，以及可选 Cloudflare Workers 云端能力放在同一个开源仓库里。

### 你能用它做什么

| 模块 | 说明 |
| --- | --- |
| NovelAI 工作流 | Token 校验、Anlas/订阅读取、文生图、图生图、局部重绘、放大 |
| 提示词工作台 | 标签搜索、标签分片加载、wildcard、预设、场景、角色提示词 |
| 图库与历史 | 本地图库、生成历史、图片预览、元数据解析、艺术家库 |
| 桌面端 | Tauri 2 + Rust commands，支持深链接、系统能力、本地文件与 HTTP 工具 |
| Android | Tauri 2 生成的 Android 工程，位于 `src-tauri/gen/android` |
| 云端可选能力 | D1 同步 Worker、KV 图传 Worker、NovelAI subscription 代理 |
| 浏览器扩展 | 辅助复制 Worker 模板、导入自定义 Worker URL |

### 快速开始

| 目标 | 命令 |
| --- | --- |
| 安装依赖 | `npm install` |
| 启动桌面开发 | `npm run tauri dev` |
| 构建前端 | `npm run build` |
| 构建桌面版 | `npm run tauri build` |
| 启动 Android 开发 | `npm run tauri android dev` |
| 构建 Android | `npm run build:android` |

基础环境：

- Node.js 20 或更新版本。
- Rust 1.88 或更新版本。
- Tauri 2 对应平台依赖。
- Android Studio、Android SDK、NDK、Java，用于 Android 构建。
- Wrangler CLI，用于可选 Cloudflare Worker 部署。

### 多语言切换说明

当前应用内置语言包：

```text
src/i18n/locales/zh-CN.json
src/i18n/locales/en-US.json
```

语言架构基于 `i18next`、`react-i18next`、`i18next-browser-languagedetector`：

- 默认语言：`zh-CN`。
- 优先读取 `localStorage`，再读取浏览器或 WebView 的 `navigator` 语言。
- `zh` 会归一到 `zh-CN`，`en` 会归一到 `en-US`。
- 语言包通过动态 import 懒加载。
- 增加日文、韩文等新语言时，按 [I18n Architecture](docs/i18n-architecture.md) 扩展语言类型、loader 和 locale JSON。

### 云端部署

云端能力不是必需项。本地桌面版和 Android 版可以不部署 Worker。

| Worker | 目录 | 存储 | 用途 |
| --- | --- | --- | --- |
| 同步 Worker | `worker` | Cloudflare D1 | 账号、同步数据、分享码、公开 wildcard/artist |
| 图传 Worker | `worker-cloud-airdrop` | Cloudflare KV | 手机到 PC 的图传信令、PC 发现、NovelAI subscription 代理 |

完整步骤见 [Cloud Setup](docs/cloud-setup.md)。

<p align="right"><a href="#nai-assistant">回到顶部</a></p>

<a id="en-us"></a>

## English

### Positioning

NAI Assistant is a Tauri 2 desktop and Android app for NovelAI image workflows. The repository combines a React/Vite interface, a Rust/Tauri backend, Android support, browser helper tooling, and optional Cloudflare Workers.

### What You Get

| Module | Description |
| --- | --- |
| NovelAI workflow | Token verification, Anlas/subscription lookup, text-to-image, img2img, inpainting, upscaling |
| Prompt workspace | Tag search, tag shard loading, wildcard management, presets, scenes, character prompts |
| Gallery and history | Local gallery, generation history, preview, metadata parsing, artist library |
| Desktop app | Tauri 2 + Rust commands, deep links, system utilities, local file and HTTP tools |
| Android app | Tauri-generated Android project under `src-tauri/gen/android` |
| Optional cloud | D1 sync Worker, KV airdrop Worker, NovelAI subscription proxy |
| Browser helper | Helps copy Worker templates and import custom Worker URLs |

### Quick Start

| Goal | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Run desktop dev | `npm run tauri dev` |
| Build frontend | `npm run build` |
| Build desktop release | `npm run tauri build` |
| Run Android dev | `npm run tauri android dev` |
| Build Android | `npm run build:android` |

Requirements:

- Node.js 20 or newer.
- Rust 1.88 or newer.
- Tauri 2 prerequisites for your platform.
- Android Studio, Android SDK, NDK, and Java for Android builds.
- Wrangler CLI for optional Cloudflare Worker deployment.

### Language Switching

Current in-app locale files:

```text
src/i18n/locales/zh-CN.json
src/i18n/locales/en-US.json
```

The i18n layer uses `i18next`, `react-i18next`, and `i18next-browser-languagedetector`:

- Default language: `zh-CN`.
- Detection order: `localStorage`, then browser or WebView `navigator`.
- `zh` maps to `zh-CN`; `en` maps to `en-US`.
- Locale files are loaded lazily through dynamic imports.
- To add Japanese, Korean, or another language, extend the language type, loader map, normalization logic, and locale JSON files. See [I18n Architecture](docs/i18n-architecture.md).

### Cloud Setup

Cloud features are optional. The desktop and Android app can run without deploying any Worker.

| Worker | Directory | Storage | Purpose |
| --- | --- | --- | --- |
| Sync Worker | `worker` | Cloudflare D1 | Account, sync data, share codes, public wildcard/artist entries |
| Airdrop Worker | `worker-cloud-airdrop` | Cloudflare KV | Phone-to-PC relay, PC discovery, NovelAI subscription proxy |

Full guide: [Cloud Setup](docs/cloud-setup.md).

<p align="right"><a href="#nai-assistant">Back to top</a></p>

<a id="ja-jp"></a>

## 日本語

### プロジェクト概要

NAI Assistant は、NovelAI の画像生成ワークフロー向けに作られた Tauri 2 ベースのデスクトップおよび Android アプリです。このリポジトリには React/Vite の UI、Rust/Tauri バックエンド、Android プロジェクト、ブラウザ補助拡張、任意の Cloudflare Workers 構成が含まれます。

### 主な機能

| モジュール | 内容 |
| --- | --- |
| NovelAI ワークフロー | Token 検証、Anlas/サブスクリプション確認、画像生成、img2img、inpainting、upscaling |
| プロンプト作業 | タグ検索、タグ shard 読み込み、wildcard、preset、scene、character prompt |
| ギャラリー | ローカルギャラリー、生成履歴、プレビュー、メタデータ解析、アーティストライブラリ |
| デスクトップ | Tauri 2 + Rust commands、deep link、システム連携、ローカルファイル/HTTP ツール |
| Android | `src-tauri/gen/android` 配下の Tauri Android プロジェクト |
| クラウド任意機能 | D1 sync Worker、KV airdrop Worker、NovelAI subscription proxy |
| ブラウザ補助 | Worker テンプレートのコピーと custom Worker URL の deep link インポート |

### クイックスタート

| 目的 | コマンド |
| --- | --- |
| 依存関係のインストール | `npm install` |
| デスクトップ開発 | `npm run tauri dev` |
| フロントエンドビルド | `npm run build` |
| デスクトップリリース | `npm run tauri build` |
| Android 開発 | `npm run tauri android dev` |
| Android ビルド | `npm run build:android` |

必要な環境：

- Node.js 20 以上。
- Rust 1.88 以上。
- 各プラットフォームの Tauri 2 前提環境。
- Android build 用の Android Studio、Android SDK、NDK、Java。
- 任意の Cloudflare Worker deploy 用 Wrangler CLI。

### 言語切り替え

現在のアプリ内 locale ファイル：

```text
src/i18n/locales/zh-CN.json
src/i18n/locales/en-US.json
```

i18n レイヤーは `i18next`、`react-i18next`、`i18next-browser-languagedetector` を使用します：

- デフォルト言語：`zh-CN`。
- 検出順：`localStorage`、次に browser/WebView の `navigator`。
- `zh` は `zh-CN`、`en` は `en-US` に正規化されます。
- locale ファイルは dynamic import で遅延ロードされます。
- 日本語など新しい言語を追加する場合は、language type、loader、normalization、locale JSON を追加します。詳細は [I18n Architecture](docs/i18n-architecture.md) を参照してください。

### クラウド構成

クラウド機能は任意です。デスクトップ版と Android 版は Worker なしでも実行できます。

| Worker | ディレクトリ | ストレージ | 用途 |
| --- | --- | --- | --- |
| Sync Worker | `worker` | Cloudflare D1 | アカウント、同期データ、共有コード、公開 wildcard/artist |
| Airdrop Worker | `worker-cloud-airdrop` | Cloudflare KV | スマホから PC への relay、PC discovery、NovelAI subscription proxy |

詳細手順：[Cloud Setup](docs/cloud-setup.md)。

<p align="right"><a href="#nai-assistant">トップへ戻る</a></p>

## Developer Docs

| Document | Purpose |
| --- | --- |
| [Feature Overview](docs/features.md) | Public feature list and product boundary |
| [Cloud Setup](docs/cloud-setup.md) | D1/KV Worker deployment and troubleshooting |
| [I18n Architecture](docs/i18n-architecture.md) | Language loading, switching, and adding new locales |
| [Custom Worker Guide](docs/custom-worker-user-guide.md) | User-facing custom Worker setup |
| [Share Message Template](docs/user-share-message.txt) | Message template for sharing |

## Repository Layout

```text
src/                         React app source
src/i18n/                    i18next configuration and locale files
src-tauri/                   Tauri 2 Rust backend and desktop config
src-tauri/gen/android/       Tauri Android project
browser-extension/           Browser helper extension
worker/                      Cloud Sync Worker
worker-cloud-airdrop/        Cloud Airdrop and NovelAI proxy Worker
docs/                        Open-source docs and user guides
```

## Open Source Hygiene

Do not commit:

- `.env`, `.dev.vars`, or local Worker secrets.
- Android keystores, `keystore.properties`, `.jks`, `.keystore`, `.p12`, or `.pfx` files.
- `node_modules`, `dist`, `src-tauri/target`, Gradle caches, or generated build logs.
- Generated Android frontend assets or large prebuilt sidecar binaries.
- Generated tag shards under `src/assets/tags-shards`.
- Personal app state, tokens, screenshots, temporary files, or private backups.

## License

MIT
