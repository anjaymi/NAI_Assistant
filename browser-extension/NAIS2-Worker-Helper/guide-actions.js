window.NAIS2_CF_GUIDE_ACTIONS = {
  looksLikeTemplateApplied() {
    const pageText = document.body.innerText || ''
    return pageText.includes('Access-Control-Allow-Origin') && pageText.includes('/api/nai/subscription')
  },

  looksLikeCodeSelectionActive() {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && String(selection).trim().length > 0) {
      return true
    }

    const active = document.activeElement
    if (active instanceof HTMLTextAreaElement) {
      return active.selectionStart !== active.selectionEnd
    }

    const selectedLine = document.querySelector('.selected-text, .view-line span[style*="selected"], .monaco-editor .selected-text')
    return Boolean(selectedLine)
  },

  dispatchCtrlA(target) {
    const keydown = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
      code: 'KeyA',
      ctrlKey: true,
    })
    const keyup = new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: 'a',
      code: 'KeyA',
      ctrlKey: true,
    })
    target.dispatchEvent(keydown)
    target.dispatchEvent(keyup)
    document.execCommand('selectAll', false)
  },

  insertTemplateIntoActiveElement(templateCode) {
    const active = document.activeElement
    if (active instanceof HTMLTextAreaElement) {
      document.execCommand('insertText', false, templateCode)
      active.dispatchEvent(new Event('input', { bubbles: true }))
      return this.looksLikeTemplateApplied() || active.value.includes('Access-Control-Allow-Origin')
    }

    if (active instanceof HTMLElement) {
      document.execCommand('insertText', false, templateCode)
      active.dispatchEvent(new Event('input', { bubbles: true }))
      return this.looksLikeTemplateApplied()
    }

    return false
  },

  tryClickCurrentTarget(currentTarget) {
    if (!(currentTarget instanceof HTMLElement)) {
      return false
    }

    currentTarget.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    const clickable = currentTarget.closest('button, a, [role="button"]') || currentTarget
    if (!(clickable instanceof HTMLElement)) {
      return false
    }

    const clickableText = (clickable.textContent || '').replace(/\s+/g, ' ').trim()
    if (clickableText.length > 120) {
      return false
    }

    clickable.focus?.()
    clickable.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }))
    clickable.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
    clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
    clickable.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }))
    clickable.click()
    return true
  },

  tryFocusCodeEditor(deps) {
    const { getCodeSurfaceCandidate, syncState, state } = deps
    const monacoView = document.querySelector('.monaco-editor .view-lines')
    const monacoEditor = document.querySelector('.monaco-editor')
    const inputArea = document.querySelector('textarea.inputarea')
    const codeSurface = getCodeSurfaceCandidate()

    const target =
      (monacoView instanceof HTMLElement && monacoView) ||
      (monacoEditor instanceof HTMLElement && monacoEditor) ||
      (inputArea instanceof HTMLTextAreaElement && inputArea) ||
      (codeSurface instanceof HTMLElement && codeSurface) ||
      null

    if (!target) {
      state.editorFocused = false
      syncState()
      return false
    }

    target.click()
    target.focus?.()
    if (inputArea instanceof HTMLTextAreaElement) {
      inputArea.focus()
    }

    const active = document.activeElement
    state.editorFocused = Boolean(
      active === inputArea ||
      (active instanceof HTMLElement && (active.closest('.monaco-editor') || active === target || target.contains(active)))
    )

    if (state.editorFocused) {
      state.waitingForManualSelectAll = false
    }

    syncState()
    return state.editorFocused
  },

  tryFillCodeEditor(deps) {
    const {
      templateCode,
      state,
      syncState,
      getCodeSurfaceCandidate,
      tryFocusCodeEditor,
    } = deps

    if (!state.editorFocused) {
      const focused = tryFocusCodeEditor(deps)
      if (!focused) {
        return false
      }
    }

    const monaco = window.monaco
    try {
      if (monaco?.editor?.getModels) {
        const models = monaco.editor.getModels()
        if (Array.isArray(models) && models[0]?.setValue) {
          models[0].setValue(templateCode)
          return this.looksLikeTemplateApplied() || true
        }
      }
    } catch {
      // Ignore and continue with DOM-based fallbacks.
    }

    const monacoView = document.querySelector('.monaco-editor .view-lines')
    const monacoTextArea = document.querySelector('textarea.inputarea')
    if (monacoView instanceof HTMLElement && monacoTextArea instanceof HTMLTextAreaElement) {
      monacoView.click()
      monacoTextArea.focus()
      this.dispatchCtrlA(monacoTextArea)
      const inserted = this.insertTemplateIntoActiveElement(templateCode)
      state.waitingForManualSelectAll = !inserted
      syncState()
      return inserted
    }

    const codeSurface = getCodeSurfaceCandidate()
    if (codeSurface instanceof HTMLElement) {
      codeSurface.click()
      const active = document.activeElement
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLElement) {
        if (active instanceof HTMLElement) {
          active.focus()
        }
        this.dispatchCtrlA(active)
        const inserted = this.insertTemplateIntoActiveElement(templateCode)
        state.waitingForManualSelectAll = !inserted
        syncState()
        return inserted
      }
    }

    const monacoEditor = document.querySelector('.monaco-editor')
    const monacoInput = monacoTextArea
    if (monacoEditor instanceof HTMLElement && monacoInput instanceof HTMLTextAreaElement) {
      monacoEditor.click()
      monacoInput.focus()
      monacoInput.value = ''
      monacoInput.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: templateCode }))
      document.execCommand('selectAll', false)
      document.execCommand('insertText', false, templateCode)
      monacoInput.dispatchEvent(new Event('input', { bubbles: true }))
      syncState()
      return true
    }

    const textareas = Array.from(document.querySelectorAll('textarea'))
    const textarea = textareas.find((node) => node instanceof HTMLTextAreaElement && node.offsetParent !== null)
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus()
      this.dispatchCtrlA(textarea)
      textarea.value = templateCode
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(new Event('change', { bubbles: true }))
      state.waitingForManualSelectAll = false
      syncState()
      return this.looksLikeTemplateApplied() || textarea.value.includes('Access-Control-Allow-Origin')
    }

    const codeMirror = document.querySelector('.cm-content[contenteditable="true"]')
    if (codeMirror instanceof HTMLElement) {
      codeMirror.focus()
      this.dispatchCtrlA(codeMirror)
      const inserted = this.insertTemplateIntoActiveElement(templateCode)
      state.waitingForManualSelectAll = !inserted
      syncState()
      return inserted
    }

    state.waitingForManualSelectAll = true
    syncState()
    return false
  },
}
