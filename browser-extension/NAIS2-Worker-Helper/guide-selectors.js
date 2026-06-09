window.NAIS2_CF_GUIDE_SELECTORS = {
  isVisible(el) {
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  },

  matchByHint(el, hints) {
    const text = (el.textContent || '').trim().toLowerCase()
    return hints.some((hint) => text.includes(hint.toLowerCase()))
  },

  scoreElement(el, step) {
    const text = (el.textContent || '').trim().toLowerCase()
    let score = 0

    for (const hint of step.textHints) {
      const lowerHint = hint.toLowerCase()
      if (text === lowerHint) score += 6
      else if (text.includes(lowerHint)) score += 3
    }

    if (el.tagName === 'BUTTON') score += 2
    if (el.tagName === 'A') score += 1
    if (text.length > 120) score -= 6
    if (text.length > 220) score -= 10
    if ((el.getAttribute('href') || '').includes('workers')) score += 3
    if ((el.getAttribute('href') || '').includes('create')) score += 3
    if ((el.getAttribute('data-testid') || '').toLowerCase().includes('deploy')) score += 4
    if ((el.getAttribute('role') || '').toLowerCase() === 'button') score += 2

    const clickableParent = el.closest('button, a, [role="button"]')
    if (clickableParent && clickableParent !== el) score += 1

    const rect = el.getBoundingClientRect()
    if (rect.top >= 0 && rect.top < window.innerHeight) score += 2
    if (rect.width > 900) score -= 4
    if (rect.height > 120) score -= 3

    return score
  },

  getElementLabel(target) {
    if (!target) return ''
    const clickable = target.closest('button, a, [role="button"]') || target
    const text = (clickable.textContent || '').replace(/\s+/g, ' ').trim()
    if (text) return text.slice(0, 80)
    return clickable.getAttribute('aria-label') || clickable.getAttribute('title') || clickable.tagName
  },

  getConfidence(score) {
    if (score >= 10) return 'high'
    if (score >= 5) return 'medium'
    return 'low'
  },
}
