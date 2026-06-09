import { useGenerationStore } from '@/stores/generation-store'
import { useTranslation } from 'react-i18next'
import { GlassTextarea } from '@/components/atoms/GlassTextarea'
import { Label } from '@/components/atoms/Label'
import { Button } from '@/components/atoms/Button'
import { ChevronDown, ChevronUp, Copy, Eraser, Sparkles, Plug, ScrollText, List } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/atoms/Tooltip'
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem
} from '../atoms/DropdownMenu'
import { usePluginStore } from '@/stores/plugin-store'
import { useSettingsStore } from '@/stores/settings-store'
import { AutocompleteTextarea } from '@/components/ui/AutocompleteTextarea'
import { MagicTagDialog } from '../features/prompt/MagicTagDialog'
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/atoms/Dialog'
import { PresetManager } from './PresetManager'
import { shallow } from 'zustand/shallow'
import { lazy } from 'react'
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary'

const SimpleTagEditor = lazy(() => import('../features/prompt/SimpleTagEditor').then((module) => ({ default: module.SimpleTagEditor })))

/** 
 * 增强版 PromptArea 组件
 * 支持 SANA 风格的三段式提示词：Base / Additional / Detail
 * 内部合并为单一 prompt 传递给 generation-store
 */
interface PromptAreaProps {
  className?: string
}

function mergePromptTags(current: string, tagsToAdd: string[]) {
  const currentTags = current
    .split(/[,，]/)
    .map(tag => tag.trim())
    .filter(Boolean)

  const normalized = new Set(currentTags.map(tag => tag.toLowerCase()))
  const missingTags = tagsToAdd.filter(tag => !normalized.has(tag.toLowerCase()))

  return missingTags.length > 0
    ? [...missingTags, ...currentTags].join(', ')
    : current
}

export function PromptArea({ className }: PromptAreaProps) {
  const { t } = useTranslation()
  const { prompt, setPrompt, negativePrompt, setNegativePrompt, pendingTagsToAppend, clearPendingTagsToAppend } = useGenerationStore(
    (state) => ({
      prompt: state.prompt,
      setPrompt: state.setPrompt,
      negativePrompt: state.negativePrompt,
      setNegativePrompt: state.setNegativePrompt,
      pendingTagsToAppend: state.pendingTagsToAppend,
      clearPendingTagsToAppend: state.clearPendingTagsToAppend,
    }),
    shallow
  )
  const plugins = usePluginStore((state) => state.plugins)
  const togglePlugin = usePluginStore((state) => state.togglePlugin)
  const tagCompletionEnabled = usePluginStore((state) => state.plugins.find((plugin) => plugin.id === 'tag_completion')?.enabled ?? false)
  
  // 本地状态：三段式提示词
  // Init with prompt to prevent overwriting store on mount if store has data
  const [basePrompt, setBasePrompt] = useState(prompt || '')
  const [additionalPrompt, setAdditionalPrompt] = useState('')
  const [detailPrompt, setDetailPrompt] = useState('')
  const [negativeCollapsed, setNegativeCollapsed] = useState(false)
  const [magicTagOpen, setMagicTagOpen] = useState(false)

  // 快捷标签组
  const qualityTagsSetting = useSettingsStore((state) => state.qualityTags)
  const STYLE_TAGS = {
    anime: "anime style, illustration",
    realistic: "photorealistic, ultra detailed",
    artistic: "masterpiece, artistic, painterly"
  }
  
  // 组合三段为完整 prompt
  const buildFullPrompt = useCallback(() => {
    const parts = [basePrompt, additionalPrompt, detailPrompt].filter(p => p.trim())
    return parts.join(', ')
  }, [basePrompt, additionalPrompt, detailPrompt])
  
  const isInternalUpdate = useRef(false)

  // Sync TO Store (Local -> Global)
  useEffect(() => {
    const fullPrompt = buildFullPrompt()
    if (fullPrompt !== prompt) {
      isInternalUpdate.current = true
      setPrompt(fullPrompt)
    }
  }, [basePrompt, additionalPrompt, detailPrompt, buildFullPrompt, setPrompt])

  // Listen for tags from ToolsPanel (Apply to Prompt button)
  useEffect(() => {
    if (pendingTagsToAppend) {
      // Append to basePrompt (subject field)
      setBasePrompt(prev => prev ? `${prev}, ${pendingTagsToAppend}` : pendingTagsToAppend)
      clearPendingTagsToAppend()
    }
  }, [pendingTagsToAppend, clearPendingTagsToAppend])
  
  // Sync FROM Store (Global -> Local)
  useEffect(() => {
    if (isInternalUpdate.current) {
        isInternalUpdate.current = false
        return
    }
    
    // Check for external changes
    const currentFull = buildFullPrompt()
    if (prompt !== currentFull) {
        // Simple heuristic: If prompt starts with current, it's an append
        if (prompt.startsWith(currentFull)) {
            const diff = prompt.slice(currentFull.length).replace(/^[\s,]+/, '')
            if (diff) {
                setDetailPrompt(prev => prev ? `${prev}, ${diff}` : diff)
            }
        } else {
            // Complex change (e.g. History restore), dump to Base and clear others
            // This prevents data loss but loses structure
            setBasePrompt(prompt)
            setAdditionalPrompt('')
            setDetailPrompt('')
        }
    }
  }, [prompt])
  
  const addQualityTags = () => {
    const qualityTags = qualityTagsSetting.split(',').map(tag => tag.trim()).filter(Boolean)
    setBasePrompt(prev => mergePromptTags(prev, qualityTags))
  }
  
  const addStyleTag = (style: keyof typeof STYLE_TAGS) => {
    const tag = STYLE_TAGS[style]
    if (!additionalPrompt.includes(tag)) {
      setAdditionalPrompt(prev => prev ? `${prev}, ${tag}` : tag)
    }
  }
  
  const clearAll = () => {
    setBasePrompt('')
    setAdditionalPrompt('')
    setDetailPrompt('')
  }
  
  const copyAll = () => {
    navigator.clipboard.writeText(buildFullPrompt())
  }
  
  // Helper to convert Chinese punctuation to English
  const normalizePunctuation = (str: string) => {
    return str
      .replace(/，/g, ',')
      .replace(/。/g, '.')
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/【/g, '[')
      .replace(/】/g, ']')
      .replace(/“/g, '"')
      .replace(/”/g, '"')
      .replace(/‘/g, "'")
      .replace(/’/g, "'")
      .replace(/？/g, '?')
      .replace(/！/g, '!')
      .replace(/；/g, ';')
      .replace(/：/g, ':')
  }

  // Conditionally render Textarea
  const renderTextarea = (value: string, setValue: (s: string) => void, placeholder: string) => {
      const commonClasses = "flex-1 font-mono text-sm leading-relaxed resize-none min-h-0"
      
      const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          const newVal = normalizePunctuation(e.target.value)
          setValue(newVal)
      }

      if (tagCompletionEnabled) {
          return (
              <AutocompleteTextarea
                  value={value}
                  onChange={handleChange}
                  placeholder={placeholder}
                  // Now AutocompleteTextarea renders a native textarea, so we can pass standard classes
                  className={cn(commonClasses, "border border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/40 rounded-2xl shadow-inner backdrop-blur-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:bg-white/60 dark:focus-visible:ring-white/20 dark:focus-visible:bg-black/60 transition-all duration-300 placeholder:text-slate-400 dark:placeholder:text-white/30 text-slate-800 dark:text-white")}
                  style={{ fontSize: '0.875rem' }}
              />
          )
      }

      return (
          <GlassTextarea 
              value={value} 
              onChange={handleChange} 
              placeholder={placeholder}
              className={cn(commonClasses, "border border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/40 rounded-2xl shadow-inner backdrop-blur-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:bg-white/60 dark:focus-visible:ring-white/20 dark:focus-visible:bg-black/60 transition-all duration-300 placeholder:text-slate-400 dark:placeholder:text-white/30 text-slate-800 dark:text-white")}
          />
      )
  }

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col gap-3 h-full overflow-y-auto pr-1 pb-1", className)}>
        {/* 预设管理 */}
        <div className="mb-1">
            <PresetManager />
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-primary">{t('prompt.title')}</Label>
          <div className="flex gap-1 items-center">
            {/* 插件菜单 */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors">
                        <Plug className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white/90 dark:bg-black/60 border-black/5 dark:border-white/10 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-2xl p-2">
                    <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50 px-2 py-1.5">{t('prompt.plugins', 'Plugins')}</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-black/5 dark:bg-white/10 my-1" />
                    {plugins.map(plugin => (
                        <DropdownMenuCheckboxItem
                            key={plugin.id}
                            checked={plugin.enabled}
                            onCheckedChange={() => togglePlugin(plugin.id)}
                            className="text-xs"
                        >
                            <span className="font-medium">{plugin.name}</span>
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
                </DropdownMenu>

                {/* Advanced Tag Selector REMOVED */}
               
                <div className="w-px h-3 bg-black/10 dark:bg-white/10 mx-1" />

                {/* Magic Tag Plugin */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors" onClick={() => setMagicTagOpen(true)}>
                            <ScrollText className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Magic Tag Generator (Beta)</TooltipContent>
                </Tooltip>
                
                <MagicTagDialog 
                    open={magicTagOpen} 
                    onOpenChange={setMagicTagOpen}
                    onInject={(tags, target) => {
                        if (target === 'positive') {
                            setBasePrompt((prev: string) => {
                                const separator = prev.trim().length > 0 && !prev.trim().endsWith(',') ? ', ' : '';
                                return prev + separator + tags;
                            });
                        } else if (target === 'negative') {
                            const prevNeg = negativePrompt;
                            const separator = prevNeg.trim().length > 0 && !prevNeg.trim().endsWith(',') ? ', ' : '';
                            setNegativePrompt(prevNeg + separator + tags);
                            // Auto expand negative prompt if needed
                            if (negativeCollapsed) setNegativeCollapsed(false);
                        }
                    }}
                />

                <div className="w-px h-3 bg-black/10 dark:bg-white/10 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-amber-500 dark:text-amber-400/80 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors px-2" onClick={addQualityTags}>
                  <Sparkles className="h-3.5 w-3.5" /> {t('prompt.quality', 'Quality')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('prompt.qualityTooltip', 'Add Quality Tags')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors" onClick={copyAll}>
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('prompt.copyTooltip', 'Copy All')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 dark:text-red-500/60 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" onClick={clearAll}>
                  <Eraser className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('prompt.clearTooltip', 'Clear All')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* 三段式提示词 */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Base Prompt - 主体 */}
          <div className="flex flex-col gap-1 flex-[3] min-h-0 relative">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-white/50 uppercase tracking-widest pl-1">
                {t('prompt.base', 'Base')} <span className="text-slate-400 dark:text-white/30 font-medium">· 主体</span>
                </label>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 dark:text-white/30 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded">
                            <List className="h-3.5 w-3.5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent hideClose={true} className="w-auto h-auto max-w-none p-0 bg-transparent border-none shadow-none focus:outline-none overflow-hidden">
                        <DialogTitle className="sr-only">Edit Base Tags</DialogTitle>
                        <DialogDescription className="sr-only">Tag Editor for Base Prompt</DialogDescription>
                        <LazyModuleBoundary className="min-h-[420px] min-w-[720px]" label="Loading tag editor...">
                          <SimpleTagEditor 
                              initialTags={basePrompt.split(/[,，]/).map(t => t.trim()).filter(Boolean)}
                              onUpdate={(tags) => setBasePrompt(tags.join(', '))}
                          />
                        </LazyModuleBoundary>
                    </DialogContent>
                </Dialog>
            </div>
            {renderTextarea(basePrompt, setBasePrompt, "1girl, solo, white hair, red eyes...")}
          </div>

          {/* Additional Prompt - 额外 */}
          <div className="flex flex-col gap-1 flex-[2] min-h-0 relative">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-white/50 uppercase tracking-widest pl-1">
                {t('prompt.additional', 'Additional')} <span className="text-slate-400 dark:text-white/30 font-medium">· 场景/服饰</span>
                </label>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 dark:text-white/30 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded">
                            <List className="h-3.5 w-3.5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent hideClose={true} className="w-auto h-auto max-w-none p-0 bg-transparent border-none shadow-none focus:outline-none overflow-hidden">
                         <DialogTitle className="sr-only">Edit Additional Tags</DialogTitle>
                         <DialogDescription className="sr-only">Tag Editor for Additional Prompt</DialogDescription>
                        <LazyModuleBoundary className="min-h-[420px] min-w-[720px]" label="Loading tag editor...">
                          <SimpleTagEditor 
                              initialTags={additionalPrompt.split(/[,，]/).map(t => t.trim()).filter(Boolean)}
                              onUpdate={(tags) => setAdditionalPrompt(tags.join(', '))}
                          />
                        </LazyModuleBoundary>
                    </DialogContent>
                </Dialog>
            </div>
            {renderTextarea(additionalPrompt, setAdditionalPrompt, "school uniform, classroom, sitting...")}
          </div>

          {/* Detail Prompt - 细节 */}
          <div className="flex flex-col gap-1 flex-[2] min-h-0 relative">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-white/50 uppercase tracking-widest pl-1">
                {t('prompt.detail', 'Detail')} <span className="text-slate-400 dark:text-white/30 font-medium">· 光照/构图</span>
                </label>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 dark:text-white/30 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded">
                            <List className="h-3.5 w-3.5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent hideClose={true} className="w-auto h-auto max-w-none p-0 bg-transparent border-none shadow-none focus:outline-none overflow-hidden">
                        <DialogTitle className="sr-only">Edit Detail Tags</DialogTitle>
                        <DialogDescription className="sr-only">Tag Editor for Detail Prompt</DialogDescription>
                        <LazyModuleBoundary className="min-h-[420px] min-w-[720px]" label="Loading tag editor...">
                          <SimpleTagEditor 
                              initialTags={detailPrompt.split(/[,，]/).map(t => t.trim()).filter(Boolean)}
                              onUpdate={(tags) => setDetailPrompt(tags.join(', '))}
                          />
                        </LazyModuleBoundary>
                    </DialogContent>
                </Dialog>
            </div>
            {renderTextarea(detailPrompt, setDetailPrompt, "soft lighting, bokeh, upper body...")}
          </div>
        </div>

        {/* 快捷风格按钮 TODO: Review if they shouldn't just be styled better */}
        <div className="flex gap-2 flex-wrap px-1 my-2">
          <Button variant="outline" size="sm" className="h-7 px-3 text-[11px] font-medium rounded-full bg-white dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm" onClick={() => addStyleTag('anime')}>
            Anime
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-3 text-[11px] font-medium rounded-full bg-white dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm" onClick={() => addStyleTag('realistic')}>
            Realistic
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-3 text-[11px] font-medium rounded-full bg-white dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm" onClick={() => addStyleTag('artistic')}>
            Artistic
          </Button>
        </div>

        {/* Negative Prompt - 可折叠 */}
        <div className={cn(
          "flex flex-col gap-1 transition-all duration-300 ease-in-out",
          negativeCollapsed ? "flex-none" : "flex-[1.5] min-h-0"
        )}>
          <div className="flex justify-between items-center">
            <button 
              className="flex items-center gap-1.5 text-[10px] font-medium text-destructive/80 hover:text-destructive cursor-pointer uppercase tracking-wider"
              onClick={() => setNegativeCollapsed(!negativeCollapsed)}
            >
              {negativeCollapsed ? <ChevronDown className="h-3.5 w-3.5 transition-transform" /> : <ChevronUp className="h-3.5 w-3.5 transition-transform" />}
              {t('prompt.negative', 'Negative')}
              {negativeCollapsed && negativePrompt && (
                <span className="text-slate-400 dark:text-white/40 font-normal truncate max-w-[150px] normal-case mt-[1px]">
                  · {negativePrompt.split(',')[0]}...
                </span>
              )}
            </button>
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500/60 dark:text-red-500/40 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded">
                        <List className="h-3.5 w-3.5" />
                    </Button>
                </DialogTrigger>
                <DialogContent hideClose={true} className="w-auto h-auto max-w-none p-0 bg-transparent border-none shadow-none focus:outline-none overflow-hidden">
                    <DialogTitle className="sr-only">Edit Negative Tags</DialogTitle>
                    <DialogDescription className="sr-only">Tag Editor for Negative Prompt</DialogDescription>
                    <LazyModuleBoundary className="min-h-[420px] min-w-[720px]" label="Loading tag editor...">
                      <SimpleTagEditor 
                          initialTags={negativePrompt.split(/[,，]/).map(t => t.trim()).filter(Boolean)}
                          onUpdate={(tags) => setNegativePrompt(tags.join(', '))}
                      />
                    </LazyModuleBoundary>
                </DialogContent>
            </Dialog>
          </div>
          {!negativeCollapsed && (
            <GlassTextarea 
              value={negativePrompt} 
              onChange={(e) => setNegativePrompt(e.target.value)} 
              placeholder={t('prompt.negativePlaceholder', 'lowres, bad anatomy, bad hands...')}
              className="flex-1 font-mono text-sm leading-relaxed resize-none min-h-0 border-red-500/20 focus-visible:ring-red-500/30 bg-red-50 dark:bg-red-500/5 shadow-inner backdrop-blur-xl px-4 py-3 rounded-2xl placeholder:text-red-500/40 dark:placeholder:text-red-500/30 text-slate-800 dark:text-white transition-all duration-300"
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
