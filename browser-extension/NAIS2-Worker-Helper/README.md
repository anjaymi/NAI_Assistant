# NAIS2 Worker Import Extension

这是一个面向小白用户的最小浏览器扩展，用来辅助在 Cloudflare 上创建 Worker，并把部署后的地址一键导入到桌面版 NAI Assistant。

## 用法

1. 打开浏览器扩展开发者模式
2. 加载此目录 `browser-extension/worker-import`
3. 打开插件后：

- 点击“打开 Cloudflare Workers 页面”
- 点击“复制 Worker 代码模板”
- 到 Cloudflare Worker 编辑器里粘贴并部署
- 把部署后的地址填回插件
- 先点“测试 Worker 地址”确认可用

提示：

- 你可以只填 `https://your-worker.workers.dev`
- 插件会自动补全成 `https://your-worker.workers.dev/api/nai/subscription`

4. 在弹窗里填入：

```text
https://your-worker.workers.dev/api/nai/subscription
```

5. 点击“`一键导入到 NAI Assistant`”

前提：
- 电脑已安装支持深链的最新版 NAI Assistant
- 应用注册了 `nais2://` 协议

导入成功后，应用会自动切换到：
- `自定义 Worker`
- 并写入对应 URL

## 说明

这个插件不会替用户自动：

- 注册 Cloudflare 账号
- 输入账号密码
- 绕过验证码
- 直接替用户部署 Worker

这是浏览器扩展的安全边界。

插件能做的是：

- 自动打开正确的 Cloudflare 页面
- 在 Cloudflare 页面内高亮当前建议点击的位置
- 提供可直接复制的 Worker 代码模板
- 测试 Worker 地址是否真的可用
- 引导用户把部署后的地址一键回填到 NAI Assistant
