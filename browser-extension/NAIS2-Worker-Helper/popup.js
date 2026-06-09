const input = document.getElementById('workerUrl')
const button = document.getElementById('openApp')
const testWorkerButton = document.getElementById('testWorker')
const openCloudflareButton = document.getElementById('openCloudflare')
const startGuideButton = document.getElementById('startGuide')
const copyWorkerCodeButton = document.getElementById('copyWorkerCode')
const workerCode = document.getElementById('workerCode')
const status = document.getElementById('status')
const progressSteps = {
  openCloudflare: document.getElementById('step-open-cloudflare'),
  workerReady: document.getElementById('step-worker-ready'),
  imported: document.getElementById('step-imported'),
}

const TEMPLATE_CODE = `const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }
  return new Response(JSON.stringify(body), { ...init, headers })
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (url.pathname !== "/api/nai/subscription" || request.method !== "POST") {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS })
    }

    const body = await request.json()
    const token = typeof body?.token === "string" ? body.token.trim() : ""
    if (!token) {
      return jsonResponse({ error: "Missing token" }, { status: 400 })
    }

    const cleanToken = token.toLowerCase().startsWith("bearer ") ? token.slice(7).trim() : token
    const response = await fetch("https://api.novelai.net/user/subscription", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + cleanToken,
        "Content-Type": "application/json",
        "User-Agent": "NAI_Assistant_Relay/0.12.6"
      }
    })

    if (response.status === 401) {
      return jsonResponse({ valid: false, error: "Invalid API token" }, { status: 401 })
    }

    if (!response.ok) {
      return jsonResponse({ error: "NovelAI upstream error: " + response.status }, { status: response.status })
    }

    const data = await response.json()
    return jsonResponse({
      valid: true,
      tier: data.tier ?? 0,
      trainingStepsLeft: data.trainingStepsLeft ?? null,
    })
  }
}
`

workerCode.value = TEMPLATE_CODE

function setStatus(message, type = 'info') {
  status.textContent = message
  status.className = `status ${type}`
}

function setBusy(isBusy, label = '') {
  for (const element of [button, testWorkerButton, openCloudflareButton, startGuideButton, copyWorkerCodeButton]) {
    element.disabled = isBusy
  }
  if (label) {
    setStatus(label, 'info')
  }
}

function markStepDone(stepKey, done = true) {
  const step = progressSteps[stepKey]
  if (!step) return
  step.classList.toggle('done', done)
}

function normalizeWorkerUrl(value) {
  let raw = value.trim()
  if (!raw) {
    return ''
  }

  if (!/^https?:\/\//i.test(raw) && /^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(raw)) {
    raw = `https://${raw}`
  }

  const url = new URL(raw)
  if (url.protocol !== 'https:') {
    throw new Error('Worker 地址必须使用 https://')
  }

  if (!url.hostname) {
    throw new Error('Worker 地址缺少域名')
  }

  url.hash = ''

  if (url.pathname === '/' || url.pathname === '') {
    url.pathname = '/api/nai/subscription'
    return url.toString().replace(/\/$/, '')
  }

  if (url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString().replace(/\/$/, '')
}

async function testWorkerUrl(workerUrl) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  let response

  try {
    response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: '' }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请确认 Worker 已部署且网络可访问')
    }
    throw new Error('无法连接到这个 Worker 地址，请检查域名是否正确')
  } finally {
    window.clearTimeout(timeout)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  const errorMessage = typeof data?.error === 'string' ? data.error.toLowerCase() : ''
  if (response.status === 400 && (errorMessage.includes('missing token') || errorMessage.includes('token'))) {
    return { ok: true, detail: 'Worker 地址可用，接口响应正常' }
  }

  if (response.status === 404) {
    throw new Error('这个地址没有 /api/nai/subscription 路由，请确认填写的是完整地址')
  }

  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`)
  }

  return { ok: true, detail: 'Worker 地址可用' }
}

chrome.storage.sync.get(['nais2WorkerUrl'], (result) => {
  if (result.nais2WorkerUrl) {
    input.value = result.nais2WorkerUrl
    markStepDone('workerReady', true)
    setStatus('已载入上次保存的 Worker 地址。', 'info')
  }
})

input.addEventListener('blur', () => {
  try {
    const normalized = normalizeWorkerUrl(input.value)
    if (normalized) {
      input.value = normalized
      chrome.storage.sync.set({ nais2WorkerUrl: normalized })
      setStatus('已自动补全 Worker 接口地址，可以先点“测试 Worker 地址”。', 'info')
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '地址格式不正确', 'error')
  }
})

openCloudflareButton.addEventListener('click', async () => {
  await chrome.tabs.create({ url: 'https://dash.cloudflare.com/?to=/:account/workers-and-pages' })
  markStepDone('openCloudflare', true)
  setStatus('已打开 Cloudflare Workers 页面', 'info')
})

startGuideButton.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    setStatus('没有找到当前标签页', 'error')
    return
  }

  if (!tab.url?.startsWith('https://dash.cloudflare.com/')) {
    setStatus('请先切到 Cloudflare Dashboard 页面，再开启高亮引导', 'error')
    return
  }

  await chrome.tabs.sendMessage(tab.id, { type: 'NAIS2_START_CF_GUIDE' }).catch(() => null)
  setStatus('已尝试开启页面高亮引导，请回到 Cloudflare 页面查看', 'success')
})

copyWorkerCodeButton.addEventListener('click', async () => {
  workerCode.select()
  try {
    await navigator.clipboard.writeText(TEMPLATE_CODE)
    setStatus('Worker 代码模板已复制', 'success')
  } catch {
    document.execCommand('copy')
    setStatus('已选中并复制 Worker 代码模板', 'success')
  }
})

testWorkerButton.addEventListener('click', async () => {
  let workerUrl = input.value.trim()
  if (!workerUrl) {
    setStatus('请先填入部署后的 Worker 地址', 'error')
    return
  }

  try {
    workerUrl = normalizeWorkerUrl(workerUrl)
    input.value = workerUrl
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '地址格式不正确，请检查是否为 https:// 开头', 'error')
    return
  }

  setBusy(true, '正在测试 Worker 地址...')
  try {
    const result = await testWorkerUrl(workerUrl)
    markStepDone('workerReady', true)
    chrome.storage.sync.set({ nais2WorkerUrl: workerUrl })
    setStatus(`${result.detail}，现在可以点击“一键导入到 NAI Assistant”。`, 'success')
  } catch (error) {
    markStepDone('workerReady', false)
    setStatus(`测试失败：${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    setBusy(false)
  }
})

button.addEventListener('click', async () => {
  let workerUrl = input.value.trim()
  if (!workerUrl) {
    setStatus('请先填入部署后的 Worker 地址', 'error')
    return
  }

  try {
    workerUrl = normalizeWorkerUrl(workerUrl)
    input.value = workerUrl
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '地址格式不正确，请检查是否为 https:// 开头', 'error')
    return
  }

  setBusy(true, '先检查 Worker 地址可用性...')
  try {
    await testWorkerUrl(workerUrl)
    markStepDone('workerReady', true)
    chrome.storage.sync.set({ nais2WorkerUrl: workerUrl })
    markStepDone('imported', true)
    setStatus('地址检测通过，正在导入到 NAI Assistant...', 'success')
    location.href = `nais2://proxy?workerUrl=${encodeURIComponent(workerUrl)}`
  } catch (error) {
    markStepDone('imported', false)
    setStatus(`无法导入：${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    window.setTimeout(() => setBusy(false), 700)
  }
})
