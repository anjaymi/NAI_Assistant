window.NAIS2_CF_GUIDE_PANEL = {
  render(panel, options) {
    const {
      step,
      found,
      label,
      panelStatusMessage,
      skippedStepsLog,
      isEditorStep,
      editorFocused,
      waitingForManualSelectAll,
      confidence,
      mediumConfidenceConfirmed,
      confidenceReason,
      recentEvents,
    } = options

    const editorModeText = !isEditorStep
      ? ''
      : waitingForManualSelectAll
        ? '已检测到代码区选中状态，等待你继续写入。'
        : editorFocused
          ? '已聚焦代码区，现在可以自动填入 Worker 代码。'
          : '已定位到编辑器步骤，建议先聚焦代码区。'

    const confidenceText = confidence === 'high' ? '高' : confidence === 'medium' ? '中' : '低'
    const confidenceColor = confidence === 'high' ? '#86efac' : confidence === 'medium' ? '#fde68a' : '#fca5a5'

    panel.innerHTML = `
      <div style="font-size:12px;color:#93c5fd;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Cloudflare 页面高亮引导</div>
      <div style="margin-top:8px;font-size:18px;font-weight:700;line-height:1.3;">${step.title}</div>
      <div style="margin-top:8px;font-size:13px;line-height:1.6;color:#cbd5e1;">${step.description}</div>
      ${found && label ? `<div style="margin-top:10px;font-size:12px;line-height:1.6;color:#fde68a;">当前建议点击：<span style="font-weight:700;color:#fef3c7;">${label}</span></div>` : ''}
      ${found ? `<div style="margin-top:8px;font-size:12px;line-height:1.6;color:${confidenceColor};">匹配置信度：${confidenceText}</div>` : ''}
      ${found && confidenceReason ? `<div style="margin-top:6px;font-size:12px;line-height:1.6;color:#cbd5e1;">判断依据：${confidenceReason}</div>` : ''}
      <div style="margin-top:10px;font-size:12px;color:${found ? '#86efac' : '#fca5a5'};">${found ? '已找到可点击区域，页面上方已高亮。' : '当前页面还没找到目标按钮，你可以先切换页面或稍后再试。'}</div>
      ${isEditorStep ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(14,165,233,0.12);color:#bae6fd;font-size:12px;line-height:1.6;">当前状态：${editorModeText}</div>` : ''}
      ${panelStatusMessage ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(59,130,246,0.10);color:#bfdbfe;font-size:12px;line-height:1.6;">${panelStatusMessage}</div>` : ''}
      ${skippedStepsLog.length ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(34,197,94,0.10);color:#bbf7d0;font-size:12px;line-height:1.6;">已自动跳过：${skippedStepsLog.join(' -> ')}</div>` : ''}
      ${recentEvents?.length ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(15,23,42,0.72);border:1px solid rgba(148,163,184,0.18);color:#cbd5e1;font-size:12px;line-height:1.6;"><div style="font-weight:700;color:#93c5fd;margin-bottom:6px;">最近动作</div>${recentEvents.map((item) => `<div style="margin-top:4px;">#${item.index} ${item.time} ${item.message}</div>`).join('')}</div>` : ''}
      ${!found ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(250,204,21,0.10);color:#fde68a;font-size:12px;line-height:1.6;">没找到时怎么办：${step.fallback || '请先确认你在 Cloudflare 正确页面。'}</div>` : ''}
      ${isEditorStep ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(14,165,233,0.10);color:#bae6fd;font-size:12px;line-height:1.6;">编辑器步骤建议顺序：先聚焦代码区，再自动填入；如果失败，再按一次 Ctrl+A 后继续写入。</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button id="nais2-guide-prev" style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.25);background:#1e293b;color:#e2e8f0;cursor:pointer;">上一步</button>
        <button id="nais2-guide-next" style="flex:1;padding:10px 12px;border-radius:10px;border:0;background:#2563eb;color:white;cursor:pointer;">下一步</button>
        <button id="nais2-guide-close" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.25);background:#111827;color:#e2e8f0;cursor:pointer;">关闭</button>
      </div>
      ${found && confidence !== 'low' ? `<button id="nais2-guide-click" style="width:100%;margin-top:10px;padding:10px 12px;border-radius:10px;border:0;background:${confidence === 'high' ? '#f59e0b' : mediumConfidenceConfirmed ? '#ea580c' : '#fb923c'};color:white;cursor:pointer;">${confidence === 'high' ? '自动点击当前高亮' : mediumConfidenceConfirmed ? '我确认无误，执行自动点击' : '谨慎自动点击当前高亮'}</button>` : ''}
      ${found && confidence === 'medium' ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(251,146,60,0.12);color:#fdba74;font-size:12px;line-height:1.6;">当前目标置信度中等，建议你先看一眼高亮位置，再决定是否让插件自动点击。</div>` : ''}
      ${found && confidence === 'low' ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(239,68,68,0.12);color:#fecaca;font-size:12px;line-height:1.6;">当前目标置信度较低，已禁用自动点击。建议你先人工确认页面位置。</div>` : ''}
      ${isEditorStep ? `<button id="nais2-guide-focus" style="width:100%;margin-top:10px;padding:10px 12px;border-radius:10px;border:0;background:#0ea5e9;color:white;cursor:pointer;">先聚焦代码区</button>` : ''}
      ${isEditorStep && editorFocused ? `<button id="nais2-guide-fill" style="width:100%;margin-top:10px;padding:10px 12px;border-radius:10px;border:0;background:#16a34a;color:white;cursor:pointer;">自动填入 Worker 代码</button>` : ''}
      ${isEditorStep && waitingForManualSelectAll ? `<button id="nais2-guide-manual-fill" style="width:100%;margin-top:10px;padding:10px 12px;border-radius:10px;border:0;background:#7c3aed;color:white;cursor:pointer;">我已按 Ctrl+A，继续写入</button>` : ''}
    `
  },
}
