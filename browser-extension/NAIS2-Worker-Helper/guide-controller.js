window.NAIS2_CF_GUIDE_CONTROLLER = {
  applyPreStepState(context) {
    const {
      isEditorStep,
      looksLikeCodeSelectionActive,
      canSkipCurrentStep,
      isOnRealEditorRoute,
      steps,
      state,
      syncState,
    } = context

    if (isEditorStep() && looksLikeCodeSelectionActive()) {
      state.waitingForManualSelectAll = true
      state.editorFocused = true
      state.panelStatusMessage = '已检测到代码区存在选中内容。你可以直接点“我已按 Ctrl+A，继续写入”。'
    }

    const skippedStep = canSkipCurrentStep()
    if (skippedStep !== null) {
      const skippedNames = steps.slice(state.currentStepIndex, skippedStep).map((step) => step.title)
      state.skippedStepsLog = skippedNames
      state.currentStepIndex = skippedStep
      state.panelStatusMessage = '已检测到你已经在真正的代码编辑器页面，已自动跳过前面的过渡步骤。'
    }

    if (isOnRealEditorRoute() && state.currentStepIndex >= 4 && !state.panelStatusMessage) {
      state.panelStatusMessage = '当前就是 Cloudflare 真编辑器页面，接下来可以直接自动填代码，再部署保存。'
    }

    syncState()
  },

  applyTargetResult(context) {
    const {
      target,
      highlight,
      state,
      runtimeApi,
      renderPanel,
      step,
      getElementLabel,
      syncState,
      updateGuide,
    } = context

    if (!highlight) return

    if (!target) {
      state.currentTarget = null
      state.currentConfidence = 'low'
      state.currentConfidenceReason = '当前页面没有找到足够明确的可点击目标。'
      runtimeApi.hideHighlight(highlight)
      renderPanel(step, false, '')
      runtimeApi.scheduleRetry(state, updateGuide, 1200)
      syncState()
      return
    }

    state.currentTarget = target
    state.currentConfidence = context.confidence || 'medium'
    state.currentConfidenceReason = context.confidenceReason || ''
    runtimeApi.applyHighlight(highlight, target)
    syncState()
    renderPanel(step, true, getElementLabel(target))
  },
}
