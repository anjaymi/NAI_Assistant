(function () {
  const OVERLAY_ID = 'nais2-cf-guide-overlay'
  const HIGHLIGHT_ID = 'nais2-cf-guide-highlight'
  const PANEL_ID = 'nais2-cf-guide-panel'
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

  const steps = window.NAIS2_CF_GUIDE_STEPS || []
  const state = window.NAIS2_CF_GUIDE_STATE || {}
  const selectorsApi = window.NAIS2_CF_GUIDE_SELECTORS || {}
  const panelApi = window.NAIS2_CF_GUIDE_PANEL || {}
  const actionsApi = window.NAIS2_CF_GUIDE_ACTIONS || {}
  const bindingsApi = window.NAIS2_CF_GUIDE_BINDINGS || {}
  const runtimeApi = window.NAIS2_CF_GUIDE_RUNTIME || {}
  const controllerApi = window.NAIS2_CF_GUIDE_CONTROLLER || {}

  let currentStepIndex = state.currentStepIndex ?? 0
  let mutationObserver = state.mutationObserver ?? null
  let retryTimer = state.retryTimer ?? null
  let panelStatusMessage = state.panelStatusMessage ?? ''
  let currentTarget = state.currentTarget ?? null
  let currentConfidence = state.currentConfidence ?? 'low'
  let currentConfidenceReason = state.currentConfidenceReason ?? ''
  let mediumConfidenceConfirmed = state.mediumConfidenceConfirmed ?? false
  let eventCounter = state.eventCounter ?? 0
  let recentEvents = state.recentEvents ?? []
  let editorFocused = state.editorFocused ?? false
  let waitingForManualSelectAll = state.waitingForManualSelectAll ?? false
  let skippedStepsLog = state.skippedStepsLog ?? []

  function syncState() {
    state.currentStepIndex = currentStepIndex
    state.mutationObserver = mutationObserver
    state.retryTimer = retryTimer
    state.panelStatusMessage = panelStatusMessage
    state.currentTarget = currentTarget
    state.currentConfidence = currentConfidence
    state.currentConfidenceReason = currentConfidenceReason
    state.mediumConfidenceConfirmed = mediumConfidenceConfirmed
    state.eventCounter = eventCounter
    state.recentEvents = recentEvents
    state.editorFocused = editorFocused
    state.waitingForManualSelectAll = waitingForManualSelectAll
    state.skippedStepsLog = skippedStepsLog
  }

  function getCodeSurfaceCandidate() {
    const candidates = Array.from(document.querySelectorAll('div, section, article, main'))
      .filter((node) => node instanceof HTMLElement)
      .map((node) => {
        const text = (node.textContent || '').trim()
        const rect = node.getBoundingClientRect()
        const score =
          (text.includes('export default') ? 5 : 0) +
          (text.includes('console.info') ? 4 : 0) +
          (text.includes('Hello World') ? 3 : 0) +
          (text.includes('Response') ? 2 : 0) +
          (rect.width > 500 ? 2 : 0) +
          (rect.height > 250 ? 2 : 0)

        return { node, text, rect, score }
      })
      .filter(({ node, rect, score }) => isVisible(node) && rect.width > 200 && rect.height > 120 && score > 0)
      .sort((a, b) => b.score - a.score)

    return candidates[0]?.node || null
  }

  function getNarrowEditorTarget() {
    const candidates = [
      document.querySelector('textarea.inputarea'),
      document.querySelector('.monaco-editor'),
      document.querySelector('.monaco-editor .overflow-guard'),
      document.querySelector('.monaco-editor .view-lines'),
      document.querySelector('.cm-editor'),
      document.querySelector('[data-testid*="editor"]'),
    ]

    return candidates.find((node) => node instanceof HTMLElement && isVisible(node)) || null
  }

  function tryFocusCodeEditor() {
    state.editorFocused = editorFocused
    state.waitingForManualSelectAll = waitingForManualSelectAll
    const result = actionsApi.tryFocusCodeEditor?.({
      getCodeSurfaceCandidate,
      syncState,
      state,
    })

    editorFocused = state.editorFocused ?? editorFocused
    waitingForManualSelectAll = state.waitingForManualSelectAll ?? waitingForManualSelectAll
    return Boolean(result)
  }

  function looksLikeTemplateApplied() {
    return actionsApi.looksLikeTemplateApplied ? actionsApi.looksLikeTemplateApplied() : false
  }

  function looksLikeCodeSelectionActive() {
    return actionsApi.looksLikeCodeSelectionActive ? actionsApi.looksLikeCodeSelectionActive() : false
  }

  function dispatchCtrlA(target) {
    return actionsApi.dispatchCtrlA ? actionsApi.dispatchCtrlA(target) : undefined
  }

  function insertTemplateIntoActiveElement() {
    return actionsApi.insertTemplateIntoActiveElement ? actionsApi.insertTemplateIntoActiveElement(TEMPLATE_CODE) : false
  }

  function hasRealEditor() {
    return Boolean(
      document.querySelector('.monaco-editor') ||
      document.querySelector('.cm-editor') ||
      document.querySelector('textarea.inputarea') ||
      document.querySelector('.view-lines') ||
      document.querySelector('.overflow-guard') ||
      document.querySelector('[class*="monaco-scrollable-element"]') ||
      document.querySelector('[data-testid*="editor"]') ||
      document.querySelector('[class*="editor"]') ||
      getCodeSurfaceCandidate()
    )
  }

  function isWorkerEditPage() {
    return /\/workers\/services\/edit\//.test(window.location.pathname)
  }

  function canSkipCurrentStep() {
    if ((currentStepIndex === 2 || currentStepIndex === 3) && (hasRealEditor() || isWorkerEditPage())) {
      return 4
    }
    return null
  }

  function isOnRealEditorRoute() {
    return isWorkerEditPage() && hasRealEditor()
  }

  function removeGuide() {
    document.getElementById(OVERLAY_ID)?.remove()
    document.getElementById(HIGHLIGHT_ID)?.remove()
    document.getElementById(PANEL_ID)?.remove()
    window.removeEventListener('resize', updateGuide)
    window.removeEventListener('scroll', updateGuide, true)
    mutationObserver?.disconnect()
    mutationObserver = null
    if (retryTimer) {
      window.clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function scheduleGuideUpdate(delay = 180) {
    if (retryTimer) window.clearTimeout(retryTimer)
    retryTimer = window.setTimeout(updateGuide, delay)
    syncState()
  }

  function ensureGuideShell() {
    if (!document.getElementById(OVERLAY_ID)) {
      const overlay = document.createElement('div')
      overlay.id = OVERLAY_ID
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.42);z-index:2147483640;pointer-events:none;'
      document.body.appendChild(overlay)
    }

    if (!document.getElementById(HIGHLIGHT_ID)) {
      const highlight = document.createElement('div')
      highlight.id = HIGHLIGHT_ID
      highlight.style.cssText = 'position:fixed;border:3px solid #fde047;border-radius:12px;box-shadow:0 0 0 9999px rgba(2,6,23,0.12), 0 0 0 6px rgba(253,224,71,0.18);z-index:2147483641;pointer-events:none;transition:all .18s ease;'
      document.body.appendChild(highlight)
    }

    if (!document.getElementById(PANEL_ID)) {
      const panel = document.createElement('div')
      panel.id = PANEL_ID
      panel.style.cssText = 'position:fixed;right:20px;bottom:20px;width:320px;padding:16px;border-radius:16px;background:#0f172a;color:#f8fafc;border:1px solid rgba(148,163,184,0.2);box-shadow:0 20px 40px rgba(0,0,0,.35);z-index:2147483642;font-family:Arial,sans-serif;'
      document.body.appendChild(panel)
    }
  }

  function isVisible(el) {
    return selectorsApi.isVisible ? selectorsApi.isVisible(el) : false
  }

  function matchByHint(el, hints) {
    return selectorsApi.matchByHint ? selectorsApi.matchByHint(el, hints) : false
  }

  function scoreElement(el, step) {
    return selectorsApi.scoreElement ? selectorsApi.scoreElement(el, step) : 0
  }

  function findStepTarget(step) {
    if (isOnRealEditorRoute()) {
      if (currentStepIndex === 4) {
        const editorTarget = getNarrowEditorTarget() || getCodeSurfaceCandidate()
        if (editorTarget instanceof HTMLElement && isVisible(editorTarget)) {
          currentConfidence = 'high'
          currentConfidenceReason = '已精确命中真正的代码编辑器节点。'
          return editorTarget
        }
      }

      if (currentStepIndex === 5) {
        const deployNodes = Array.from(document.querySelectorAll('button, a'))
        const deployTarget = deployNodes.find((node) => {
          if (!(node instanceof HTMLElement) || !isVisible(node)) return false
          const text = (node.textContent || '').trim().toLowerCase()
          return text === 'deploy' || text === 'save and deploy' || text === 'save'
        })
        if (deployTarget instanceof HTMLElement) {
          currentConfidence = 'high'
          currentConfidenceReason = '已精确命中短文本按钮（Deploy / Save）。'
          return deployTarget
        }
      }
    }

    const candidates = []
    for (const selector of step.selectors) {
      const nodes = Array.from(document.querySelectorAll(selector))
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue
        if (!isVisible(node)) continue
        if (!matchByHint(node, step.textHints)) continue
        candidates.push(node)
      }
    }

    candidates.sort((a, b) => scoreElement(b, step) - scoreElement(a, step))
    const bestScore = scoreElement(candidates[0] || document.body, step)
    currentConfidence = selectorsApi.getConfidence ? selectorsApi.getConfidence(bestScore) : 'low'
    currentConfidenceReason = currentConfidence === 'high'
      ? '命中了明确的可点击按钮，文本和位置都较准确。'
      : currentConfidence === 'medium'
        ? '命中了可点击区域，但文本或位置还不够精确。'
        : '命中的区域较宽或文本较长，存在误点风险。'
    return candidates[0] || null
  }

  function getElementLabel(target) {
    return selectorsApi.getElementLabel ? selectorsApi.getElementLabel(target) : ''
  }

  function setPanelStatus(message) {
    panelStatusMessage = message
    syncState()
    updateGuide()
  }

  function pushRecentEvent(message) {
    eventCounter += 1
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    recentEvents = [{ index: eventCounter, time, message }, ...recentEvents].slice(0, 5)
    syncState()
  }

  function isEditorStep() {
    return currentStepIndex === 4
  }

  function isDeployStep() {
    return currentStepIndex === 5
  }

  function tryFillCodeEditor() {
    state.editorFocused = editorFocused
    state.waitingForManualSelectAll = waitingForManualSelectAll
    const result = actionsApi.tryFillCodeEditor?.({
      templateCode: TEMPLATE_CODE,
      state,
      syncState,
      getCodeSurfaceCandidate,
      tryFocusCodeEditor,
    })

    editorFocused = state.editorFocused ?? editorFocused
    waitingForManualSelectAll = state.waitingForManualSelectAll ?? waitingForManualSelectAll
    return Boolean(result)
  }

  function tryClickCurrentTarget() {
    return actionsApi.tryClickCurrentTarget ? actionsApi.tryClickCurrentTarget(currentTarget) : false
  }

  function renderPanel(step, found, label) {
    const panel = document.getElementById(PANEL_ID)
    if (!panel) return
    panelApi.render(panel, {
      step,
      found,
      label,
      panelStatusMessage,
      skippedStepsLog,
      confidence: currentConfidence,
      confidenceReason: currentConfidenceReason,
      recentEvents,
      mediumConfidenceConfirmed,
      isEditorStep: isEditorStep(),
      editorFocused,
      waitingForManualSelectAll,
    })

    runtimeApi.bindPanelHandlers(bindingsApi, panel, {
      onNext: () => {
      currentStepIndex = (currentStepIndex + 1) % steps.length
      panelStatusMessage = ''
      pushRecentEvent('手动切换到下一步')
      syncState()
      updateGuide()
      },
      onPrev: () => {
      currentStepIndex = (currentStepIndex - 1 + steps.length) % steps.length
      panelStatusMessage = ''
      pushRecentEvent('手动返回上一步')
      syncState()
      updateGuide()
      },
      onClose: removeGuide,
      onClickTarget: () => {
      if (currentConfidence === 'medium' && !mediumConfidenceConfirmed) {
        mediumConfidenceConfirmed = true
        panelStatusMessage = '这是中置信度目标。请再次点击确认后，插件才会执行自动点击。'
        pushRecentEvent('中置信度目标进入二次确认')
        syncState()
        updateGuide()
        return
      }

      const success = tryClickCurrentTarget()
      if (!success) {
        pushRecentEvent('自动点击失败，目标不够可靠或不可点击')
        setPanelStatus('当前没有可点击的高亮目标。')
        return
      }

      mediumConfidenceConfirmed = false
      pushRecentEvent('已执行自动点击当前高亮目标')

      if (!isEditorStep()) {
        currentStepIndex = Math.min(currentStepIndex + 1, steps.length - 1)
      }

      panelStatusMessage = '已尝试自动点击当前高亮目标。若页面有变化，请稍等引导自动刷新。'
      scheduleGuideUpdate(isDeployStep() ? 1200 : 700)
      syncState()
      updateGuide()
      },
      onFocusEditor: () => {
      const success = tryFocusCodeEditor()
      pushRecentEvent(success ? '已尝试聚焦代码区' : '聚焦代码区失败')
      setPanelStatus(success ? '已尝试聚焦中间代码区。现在可以点击“自动填入 Worker 代码”。' : '没有找到可聚焦的代码区。请先手动点击中间代码区域，再试一次。')
      },
      onFillEditor: () => {
      const success = tryFillCodeEditor()
      if (!success) {
        pushRecentEvent('自动填入失败，等待 Ctrl+A 接力')
        setPanelStatus('已尝试自动写入，但页面内容没有确认变化。请先点击中间代码区，再按一次 Ctrl+A，然后点“我已按 Ctrl+A，继续写入”。')
        return
      }

      waitingForManualSelectAll = false
      currentStepIndex = Math.min(5, steps.length - 1)
      panelStatusMessage = '已尝试自动填入代码。现在为你切换到 Deploy 引导。'
      pushRecentEvent('已自动填入代码并切换到 Deploy 引导')
      scheduleGuideUpdate(700)
      syncState()
      updateGuide()
      },
      onManualFill: () => {
      const success = insertTemplateIntoActiveElement()
      if (!success) {
        pushRecentEvent('Ctrl+A 接力写入失败')
        setPanelStatus('仍未能写入代码。请确认你已经点中代码区并按过 Ctrl+A。')
        return
      }

      waitingForManualSelectAll = false
      currentStepIndex = Math.min(5, steps.length - 1)
      panelStatusMessage = '已通过手动选中 + 插件写入完成代码。现在为你切换到 Deploy 引导。'
      pushRecentEvent('已通过 Ctrl+A 接力完成写入')
      scheduleGuideUpdate(700)
      syncState()
      updateGuide()
      },
    })
  }

  function updateGuide() {
    ensureGuideShell()
    state.currentStepIndex = currentStepIndex
    state.editorFocused = editorFocused
    state.waitingForManualSelectAll = waitingForManualSelectAll
    state.panelStatusMessage = panelStatusMessage
    state.skippedStepsLog = skippedStepsLog
    state.currentConfidence = currentConfidence
    state.mediumConfidenceConfirmed = mediumConfidenceConfirmed

    controllerApi.applyPreStepState?.({
      isEditorStep,
      looksLikeCodeSelectionActive,
      canSkipCurrentStep,
      isOnRealEditorRoute,
      steps,
      state,
      syncState,
    })

    currentStepIndex = state.currentStepIndex ?? currentStepIndex
    editorFocused = state.editorFocused ?? editorFocused
    waitingForManualSelectAll = state.waitingForManualSelectAll ?? waitingForManualSelectAll
    panelStatusMessage = state.panelStatusMessage ?? panelStatusMessage
    skippedStepsLog = state.skippedStepsLog ?? skippedStepsLog
    mediumConfidenceConfirmed = state.mediumConfidenceConfirmed ?? mediumConfidenceConfirmed

    const step = steps[currentStepIndex]
    const target = findStepTarget(step)
    const highlight = document.getElementById(HIGHLIGHT_ID)
    state.currentTarget = currentTarget
    state.retryTimer = retryTimer
    state.currentConfidence = currentConfidence
    state.currentConfidenceReason = currentConfidenceReason
    controllerApi.applyTargetResult?.({
      target,
      confidence: currentConfidence,
      confidenceReason: currentConfidenceReason,
      highlight,
      state,
      runtimeApi,
      renderPanel,
      step,
      getElementLabel,
      syncState,
      updateGuide,
    })
    currentTarget = state.currentTarget ?? currentTarget
    currentConfidence = state.currentConfidence ?? currentConfidence
    currentConfidenceReason = state.currentConfidenceReason ?? currentConfidenceReason
    retryTimer = state.retryTimer ?? retryTimer
  }

  function startMutationObserver() {
    mutationObserver?.disconnect()
    mutationObserver = new MutationObserver((mutations) => {
      const onlyGuideChromeChanged = mutations.every((mutation) => {
        const target = mutation.target
        return target instanceof HTMLElement && Boolean(target.closest(`#${OVERLAY_ID}, #${HIGHLIGHT_ID}, #${PANEL_ID}`))
      })

      if (onlyGuideChromeChanged) {
        return
      }

      scheduleGuideUpdate(220)
    })
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'aria-hidden', 'class', 'disabled', 'href', 'style'],
    })
    syncState()
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'NAIS2_START_CF_GUIDE') {
      currentStepIndex = 0
      pushRecentEvent('已启动 Cloudflare 页面引导')
      syncState()
      updateGuide()
      window.addEventListener('resize', updateGuide)
      window.addEventListener('scroll', updateGuide, true)
      startMutationObserver()
    }
  })
})()
