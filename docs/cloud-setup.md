# 云端部署说明

NAI Assistant 的云端能力基于 Cloudflare Workers。它分成两个独立目录，按需部署即可。

## 云端组件

```text
worker/
  Cloud Sync / account / share / community Worker

worker-cloud-airdrop/
  Cloud Airdrop / PC discovery / NovelAI subscription proxy Worker
```

如果你只想运行本地桌面版或 Android 版，不需要部署云端。

## 前置要求

- Cloudflare 账号。
- Node.js 20 或更新版本。
- Wrangler CLI。

安装并登录 Wrangler：

```bash
npm install -g wrangler
wrangler login
```

## 一. 部署同步 Worker

同步 Worker 位于：

```text
worker/
```

它使用 Cloudflare D1 保存：

- 用户账号。
- 用户同步数据。
- 分享码。
- 公开 wildcard。
- 公开 artist 条目。

### 1. 安装依赖

```bash
cd worker
npm install
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create nais2-db
```

把命令输出中的 `database_id` 填入 `worker/wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "nais2-db"
database_id = "YOUR_D1_DATABASE_ID"
```

### 3. 初始化数据库表

```bash
wrangler d1 execute nais2-db --file=./schema.sql
```

如果你要操作远端生产库，按 Wrangler 当前版本要求追加 `--remote`。

### 4. 配置环境变量

`worker/wrangler.toml` 中包含这些公开配置占位符：

```toml
QQ_APP_ID = "REPLACE_WITH_APP_ID"
QQ_APP_KEY = "REPLACE_WITH_APP_KEY"
REDIRECT_URI = "https://your-worker-subdomain.workers.dev/auth/qq/callback"
APP_SCHEME = "nais2://auth-callback"
```

如果需要邮件验证码或密码重置，设置 Resend secret：

```bash
wrangler secret put RESEND_API_KEY
```

仓库提供示例文件：

```text
worker/.dev.vars.example
```

不要提交真实 `.dev.vars`、API key 或 Cloudflare secret。

### 5. 部署

```bash
wrangler deploy
```

部署完成后记录 Worker URL，例如：

```text
https://nais2-sync-worker.<your-name>.workers.dev
```

## 二. 部署 Cloud Airdrop Worker

Airdrop Worker 位于：

```text
worker-cloud-airdrop/
```

它使用 Cloudflare KV 存放短期信令：

- 手机端推送图片直链或生成命令。
- PC 端按 token 拉取信令。
- PC 端短时登记局域网 IP，供手机发现。
- 可选 NovelAI subscription 代理。

### 1. 创建 KV namespace

```bash
cd worker-cloud-airdrop
wrangler kv:namespace create AIRDROP_SIGNALS
```

把输出填入 `worker-cloud-airdrop/wrangler.toml`：

```toml
kv_namespaces = [
  { binding = "AIRDROP_SIGNALS", id = "YOUR_KV_NAMESPACE_ID" }
]
```

### 2. 部署

```bash
wrangler deploy
```

部署完成后记录 Worker URL，例如：

```text
https://nai-airdrop-relay.<your-name>.workers.dev
```

## 三. 客户端如何使用云端地址

### NovelAI 自定义代理

如果直连 NovelAI 不稳定，可以在应用设置里选择：

```text
NovelAI 代理 -> 自定义 Worker
```

填入：

```text
https://<your-airdrop-worker>.workers.dev/api/nai/subscription
```

也可以使用深链接导入：

```text
nais2://proxy?workerUrl=https%3A%2F%2F<your-airdrop-worker>.workers.dev%2Fapi%2Fnai%2Fsubscription
```

### Cloud Airdrop Relay

Relay base URL 格式：

```text
https://<your-airdrop-worker>.workers.dev/api/relay
```

当前接口：

- `POST /api/relay/push`
- `GET /api/relay/pull?token=...&limit=20`
- `POST /api/relay/register_pc`
- `GET /api/relay/discover_pc?token=...`

### Cloud Sync

同步 Worker 提供：

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/reset-password-request`
- `POST /auth/reset-password-verify`
- `POST /auth/bind-email-request`
- `POST /auth/bind-email-verify`
- `POST /auth/change-username`
- `GET /sync/pull`
- `POST /sync/push`
- `POST /share/create`
- `POST /share/import`
- `POST /wildcards/publish`
- `GET /wildcards`
- `GET /wildcards/:id`
- `POST /artists/publish`
- `GET /artists`
- `GET /artists/:id`

具体客户端接入点在 `src/services` 和相关 store 中。

## 四. 本地调试

同步 Worker：

```bash
cd worker
wrangler dev
```

Airdrop Worker：

```bash
cd worker-cloud-airdrop
wrangler dev
```

本地调试时可以使用 `.dev.vars`，但只能保留在本机。仓库 `.gitignore` 已忽略该文件。

## 五. 安全注意事项

- 不要把自己的 NovelAI token 交给不可信 Worker。
- 不要提交 `.dev.vars`、Cloudflare token、Resend API key、QQ app key、D1 database id 或 KV namespace id。
- 如果公开部署给其他人使用，建议在 Cloudflare Dashboard 中查看调用量、错误率和异常来源。
- Worker 中的 CORS 当前允许跨域访问，适合客户端调用；如果你只服务自己的域名，可以自行收紧。

## 六. 故障排查

### D1 相关接口报错

检查：

- `database_id` 是否替换。
- `wrangler d1 execute ... --file=./schema.sql` 是否执行。
- Worker 部署时是否绑定了 `DB`。

### Airdrop 拉不到数据

检查：

- `AIRDROP_SIGNALS` KV namespace 是否创建并绑定。
- 手机端和 PC 端是否使用同一个 token。
- mailbox 默认 5 分钟过期，PC 端是否在轮询。
- `pull` 会读取并移除信令，重复请求不会再次返回同一批数据。

### NovelAI 代理不可用

检查：

- 地址是否是 `/api/nai/subscription`。
- 请求体是否包含 token。
- Worker 到 `https://api.novelai.net/user/subscription` 是否可达。
- 使用自己的 Worker，不要依赖陌生 Worker。
