window.NAIS2_CF_GUIDE_RUNTIME = {
  bindPanelHandlers(bindingsApi, panel, handlers) {
    bindingsApi.bind(panel, handlers)
  },

  applyHighlight(highlight, target) {
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      this.hideHighlight(highlight)
      return
    }

    highlight.style.opacity = '1'
    highlight.style.left = `${rect.left - 6}px`
    highlight.style.top = `${rect.top - 6}px`
    highlight.style.width = `${rect.width + 12}px`
    highlight.style.height = `${rect.height + 12}px`
    if (rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth) {
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    }
  },

  hideHighlight(highlight) {
    highlight.style.opacity = '0'
  },

  scheduleRetry(state, updateGuide, delay) {
    if (state.retryTimer) window.clearTimeout(state.retryTimer)
    state.retryTimer = window.setTimeout(updateGuide, delay)
  },
}
