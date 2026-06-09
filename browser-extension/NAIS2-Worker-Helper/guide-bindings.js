window.NAIS2_CF_GUIDE_BINDINGS = {
  bind(panel, handlers) {
    panel.querySelector('#nais2-guide-next')?.addEventListener('click', handlers.onNext)
    panel.querySelector('#nais2-guide-prev')?.addEventListener('click', handlers.onPrev)
    panel.querySelector('#nais2-guide-close')?.addEventListener('click', handlers.onClose)
    panel.querySelector('#nais2-guide-click')?.addEventListener('click', handlers.onClickTarget)
    panel.querySelector('#nais2-guide-focus')?.addEventListener('click', handlers.onFocusEditor)
    panel.querySelector('#nais2-guide-fill')?.addEventListener('click', handlers.onFillEditor)
    panel.querySelector('#nais2-guide-manual-fill')?.addEventListener('click', handlers.onManualFill)
  },
}
