# NAI Airdrop Relay Worker

此目录包含了用于 NAI Assistant 极速云端图传 (Cloud Airdrop) 的 Cloudflare Worker 信令转发服务代码。

## 原理说明
当你在手机端选择了多张图片点击 Airdrop 时：
1. 手机端会将图片上传到一个公共高速图床（如 catbox.moe），换取直链。
2. 手机端将这些直链（携带你设定的 Cloud Sync Token）作为 Payload POST 给此 Worker (`/api/relay/push`)。
3. Worker 收到后，会将信号追加到该 token 对应的 Cloudflare KV mailbox 中，mailbox 默认保留 5 分钟。
4. PC 端的 NAI Assistant 正在后台轮询 Worker (`/api/relay/pull?token=...&limit=20`)。
5. Worker 在 `pull` 时会一次性返回最多 N 条信号，并立刻将这些信号从 mailbox 中移除；客户端不再需要单独调用 `/api/relay/ack`。

## 当前接口

- `POST /api/relay/push`
  - 写入一条新的 airdrop 或 generate_command 信号
- `GET /api/relay/pull?token=...&limit=20`
  - 读取并移除当前 token mailbox 中前 N 条信号
- `POST /api/relay/register_pc`
  - 记录当前 PC 的局域网 IP 心跳
- `GET /api/relay/discover_pc?token=...`
  - 查询指定 token 最近一次登记的 PC 局域网 IP
- `POST /api/nai/subscription`
  - 作为 NovelAI `user/subscription` 的可选代理跳板，供桌面端在直连失败时回退

说明：`/api/relay/ack` 已废弃并从 Worker 中移除，新的客户端流程只使用 `push` 和 `pull`。

## 部署步骤

### 1. 准备环境
确保你系统已经安装了 Node.js，并在本目录下运行：
```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare
```bash
wrangler login
```

### 3. 创建 KV 命名空间
你需要一个存放临时信令的数据库。在终端执行：
```bash
wrangler kv:namespace create AIRDROP_SIGNALS
```
执行完毕后，终端会打印出类似下方的配置段落：
```toml
{ binding = "AIRDROP_SIGNALS", id = "xxx-xxx-xxx" }
```
**关键**：请将这一段复制，并覆盖到本项目 `wrangler.toml` 的第 8 行 `kv_namespaces` 下方，替换掉原来的 `PUT_YOUR_KV_NAMESPACE_ID_HERE`。

### 4. 部署至生产环境
```bash
wrangler deploy
```

成功部署后，Cloudflare 会分配给你一个公网域名（如 `nai-airdrop-relay.<your-name>.workers.dev`）。
此时，请回到 NAI Assistant 前端项目的：
- `src/services/cloud-push-service.ts`
- `src/services/cloud-pull-service.ts`
将里面的 `RELAY_BASE_URL` 改为你刚部署获得的 Worker 公网 URL 后加上 `/api/relay`（例如 `https://nai-airdrop-relay.<your-name>.workers.dev/api/relay`）。

当前桌面端 NovelAI 登录验证还会使用同一个 Worker 的：
- `POST https://<your-worker>.workers.dev/api/nai/subscription`

如果你使用最新版桌面端，可以直接在设置页切到：
- `NovelAI 代理 -> 自定义 Worker`

然后填入：
- `https://<your-worker>.workers.dev/api/nai/subscription`

或者直接使用一键导入深链：
```text
nais2://proxy?workerUrl=https%3A%2F%2F<your-worker>.workers.dev%2Fapi%2Fnai%2Fsubscription
```

如果系统已经安装最新版 NAI Assistant，打开这条链接后会自动把自定义 Worker 地址写入应用设置。

### 5. 浏览器一键导入（可选）

你也可以做一个最小浏览器书签或扩展，点击后直接打开：

```javascript
location.href = 'nais2://proxy?workerUrl=' + encodeURIComponent('https://<your-worker>.workers.dev/api/nai/subscription')
```

这样用户部署完 Worker 后，可以一键把地址带回桌面端。

如果你是在对接旧客户端，请确认其不再依赖 `/api/relay/ack`，并将 pull 请求升级为带 `limit` 参数的形式。
