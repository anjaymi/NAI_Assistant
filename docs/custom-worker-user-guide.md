# 自定义 Cloudflare Worker 使用说明

适用于以下情况：

- 你的电脑或公司网络无法直连 NovelAI
- 官方 Worker 配额不够
- 你希望使用自己的 Cloudflare Worker 作为 NovelAI 代理跳板

本文会教你：

1. 部署你自己的 Cloudflare Worker
2. 在 NAI Assistant 0.12.5 中使用它
3. 用一键导入或浏览器插件把地址带回应用

## 一. 先安装最新版客户端

请先安装：

- `NAI Assistant_0.12.5_x64-setup.exe`

只有 `0.12.5` 及以上版本才内置：

- NovelAI 代理模式
- 自定义 Worker 地址
- `nais2://proxy?...` 一键导入

## 二. 部署你自己的 Cloudflare Worker

### 1. 安装 Wrangler

确保电脑已安装 Node.js，然后执行：

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 准备 Worker 代码

如果你拿到的是完整项目，请进入：

```text
worker-cloud-airdrop/
```

### 4. 创建 KV 命名空间

```bash
wrangler kv:namespace create AIRDROP_SIGNALS
```

把输出里的：

```toml
{ binding = "AIRDROP_SIGNALS", id = "xxx" }
```

填进 `wrangler.toml`。

### 5. 部署 Worker

```bash
wrangler deploy
```

部署成功后，你会得到类似这样的地址：

```text
https://your-worker.workers.dev
```

NovelAI 代理地址应填写为：

```text
https://your-worker.workers.dev/api/nai/subscription
```

## 三. 在 NAI Assistant 里启用自定义 Worker

打开：

- `设置`
- `API`
- `NovelAI 代理`

然后选择：

- `自定义 Worker`

并填写：

```text
https://your-worker.workers.dev/api/nai/subscription
```

保存后，客户端会在直连 NovelAI 失败时自动回退到你的 Worker。

## 四. 一键导入方式

如果你不想手动复制地址，可以直接使用深链接。

把下面这条链接里的域名替换成你自己的 Worker：

```text
nais2://proxy?workerUrl=https%3A%2F%2Fyour-worker.workers.dev%2Fapi%2Fnai%2Fsubscription
```

只要你电脑里已经装了最新版 NAI Assistant：

- 打开这条链接后
- 应用会自动切到 `自定义 Worker`
- 并写入对应地址

## 五. 使用浏览器插件一键导入

项目里提供了一个最小可用的浏览器插件：

```text
browser-extension/NAIS2-Worker-Helper/
```

### Chrome / Edge 加载方式

1. 打开扩展管理页
2. 开启开发者模式
3. 选择“加载已解压的扩展程序”
4. 选择这个目录：

```text
browser-extension/NAIS2-Worker-Helper
```

### 使用方式

1. 点击插件图标
2. 先点“打开 Cloudflare Workers 页面”
3. 再点“复制 Worker 代码模板”
4. 到 Cloudflare 页面里粘贴代码并部署
5. 输入你的 Worker 地址：

```text
https://your-worker.workers.dev/api/nai/subscription
```

6. 点击“`一键导入到 NAI Assistant`”

插件会打开：

```text
nais2://proxy?workerUrl=...
```

桌面端会自动导入。

说明：

- 插件可以帮你打开 Cloudflare 页面、复制代码模板、回填 Worker 地址
- 但它不能替你自动注册账号、输入密码或绕过 Cloudflare 验证

## 六. 常见问题

### 1. 为什么还是连不上？

可能原因：

- 你的公司网络连 `workers.dev` 也不通
- Worker 没部署成功
- 地址填错了，不是 `/api/nai/subscription`
- 客户端版本低于 `0.12.2`

### 2. 为什么我能打开 Worker 域名，但应用还是报错？

请确认访问的是：

```text
https://your-worker.workers.dev/api/nai/subscription
```

而不是只填根域名。

### 3. Token 会不会被记录？

当前代理逻辑设计为：

- Worker 仅转发请求
- 不应主动记录 Token

但如果你使用的是别人的 Worker，请默认视为对方可见你的 Token。

因此最安全的方式始终是：

- 使用你自己的 Cloudflare Worker

## 七. 最推荐的用法

如果你是普通用户：

1. 先试 `官方 Worker`
2. 如果额度不够或仍有问题，再改 `自定义 Worker`

如果你是公司网络用户：

1. 直接部署自己的 Worker
2. 用深链接或插件导入
3. 再重新登录 NovelAI
