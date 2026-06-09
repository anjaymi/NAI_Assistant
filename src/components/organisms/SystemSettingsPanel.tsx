import { ParameterControl } from '@/components/molecules/ParameterControl'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'
import { open } from '@tauri-apps/plugin-dialog'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import { FolderOpen, Download, CheckCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { Switch } from '@/components/atoms/Switch'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/Dialog'
import { useState, useEffect, type ReactNode } from 'react'
import { TaggerDownloadDialog } from '@/components/features/TaggerDownloadDialog'
import { checkTaggerExists, ensureLocalTaggerReady } from '@/services/tagger-service'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import customWorkerUserGuide from '../../../docs/custom-worker-user-guide.md?raw'

import { useAppStore } from '@/stores/app-store'

type ApiHealthStatus = 'idle' | 'checking' | 'ok' | 'error'

type ApiHealthResult = {
  id: string
  label: string
  target: string
  status: ApiHealthStatus
  detail?: string
}

const SYNC_WORKER_URL = 'https://nais2-sync-worker.liuanjay.workers.dev'
const WORKER_DEPLOY_DOC_URL = 'https://github.com/sunakgo/NAIS2/tree/main/worker-cloud-airdrop'
const DEEP_LINK_IMPORT_EXAMPLE = 'nais2://proxy?workerUrl=https%3A%2F%2Fyour-worker.workers.dev%2Fapi%2Fnai%2Fsubscription'
const RELAY_WORKER_URL = 'https://nai-airdrop-relay.liuanjay.workers.dev'
const NOVELAI_IMAGE_URL = 'https://image.novelai.net'

async function runCheck(request: () => Promise<{ detail: string }>) {
  try {
    const result = await request()
    return { status: 'ok' as const, detail: result.detail }
  } catch (error) {
    return { status: 'error' as const, detail: error instanceof Error ? error.message : String(error) }
  }
}

async function headLike(url: string, timeout = 8000) {
  try {
    const response = await tauriFetch(url, {
      method: 'GET',
      connectTimeout: timeout,
    })
    if (response.status === 404) {
      return { reachable: true, detail: '服务可达，当前检测路径返回 404' }
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return { reachable: true, detail: '连接正常' }
  } catch (error) {
    // Browser dev mode may not have native HTTP privileges.
    const controller = new AbortController()
    const id = window.setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(url, { method: 'GET', signal: controller.signal })
      if (response.status === 404) {
        return { reachable: true, detail: '服务可达，当前检测路径返回 404' }
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return { reachable: true, detail: '连接正常' }
    } catch {
      throw error
    } finally {
      window.clearTimeout(id)
    }
  }
}

interface SystemSettingsPanelProps {
    activeTab: 'general' | 'appearance' | 'api' | 'storage'
}

const SETTINGS_PAGE_CLASS = 'space-y-6 animate-in fade-in slide-in-from-right-4 duration-300'
const SETTINGS_CARD_CLASS = 'rounded-[1.35rem] border border-black/5 bg-[#ffffff]/95 p-5 shadow-sm dark:border-white/10 dark:bg-[#08090d] dark:shadow-none'

function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-white/40">{title}</h3>
        {description ? <p className="text-xs leading-5 text-slate-500 dark:text-white/45">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(SETTINGS_CARD_CLASS, className)}>{children}</div>
}

export default function SystemSettingsPanel({ activeTab }: SystemSettingsPanelProps) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme, forceMobile, toggleForceMobile } = useAppStore()
  const { 
      savePath, setSavePath, 
      imageFormat, setImageFormat,
      qualityTags, setQualityTags,
      generationDelay, setGenerationDelay,
      randomizeDelay, setRandomizeDelay,
      batchDelaySize, setBatchDelaySize,
      batchDelay, setBatchDelay,
      remoteTaggerUrl, setRemoteTaggerUrl,
      novelAiProxyMode, setNovelAiProxyMode,
      novelAiProxyUrl, setNovelAiProxyUrl,
      psBridgePort, setPsBridgePort,
      streamingEnabled, setStreamingEnabled,
      autoOpenGallery, setAutoOpenGallery,
      taggerMode, setTaggerMode,
      taggerDownloaded, setTaggerDownloaded,
      cloudSyncToken, setCloudSyncToken
  } = useSettingsStore()

  // Tagger download state
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [checkingTagger, setCheckingTagger] = useState(false)
  
  // Inline download progress state  
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({ downloaded: 0, total: 0, progress: 0 })
  const [downloadError, setDownloadError] = useState('')
  const [downloadSource, setDownloadSource] = useState('')
  const [showWorkerGuide, setShowWorkerGuide] = useState(false)
  const [apiChecks, setApiChecks] = useState<ApiHealthResult[]>([
      { id: 'novelai', label: 'NovelAI Image API', target: NOVELAI_IMAGE_URL, status: 'idle' },
      { id: 'sync-worker', label: 'Sync Worker', target: SYNC_WORKER_URL, status: 'idle' },
      { id: 'relay-worker', label: 'Relay Worker', target: RELAY_WORKER_URL, status: 'idle' },
      { id: 'tagger', label: 'Local Tagger', target: remoteTaggerUrl, status: 'idle' },
      { id: 'ps-bridge', label: 'PS Bridge', target: `http://127.0.0.1:${psBridgePort}`, status: 'idle' },
  ])
  const [isCheckingApis, setIsCheckingApis] = useState(false)

  // Listen for download progress events
  useEffect(() => {
      let unlisten: (() => void) | null = null
      
      const setupListener = async () => {
          const { listen } = await import('@tauri-apps/api/event')
          
          // Progress listener
          const unlistenProgress = await listen<{ downloaded: number; total: number; progress: number; source: string }>('tagger-download-progress', (event) => {
              setDownloadProgress(event.payload)
              setDownloadSource(event.payload.source || '')
          })
          
          // Status listener
          const unlistenStatus = await listen<{ status: string; source: string }>('tagger-download-status', (event) => {
              if (event.payload.status === 'connecting') {
                  setDownloadSource(event.payload.source)
              }
          })
          
          unlisten = () => {
              unlistenProgress()
              unlistenStatus()
          }
      }
      
      if (isDownloading) {
          setupListener()
      }
      
      return () => {
          if (unlisten) unlisten()
      }
  }, [isDownloading])

  // Handle inline download
  const handleDownloadTagger = async () => {
      setIsDownloading(true)
      setDownloadError('')
      setDownloadProgress({ downloaded: 0, total: 0, progress: 0 })
      
      try {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('download_tagger')
          setTaggerDownloaded(true)
      } catch (e) {
          setDownloadError(String(e))
      } finally {
          setIsDownloading(false)
      }
  }

  // Format bytes to readable size
  const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Check tagger availability when user switches to local mode
  const handleTaggerModeChange = async (mode: 'online' | 'local') => {
      setTaggerMode(mode)
      
      if (mode === 'local' && !taggerDownloaded) {
          // Check if already downloaded (might have been manually installed)
          setCheckingTagger(true)
          try {
              const exists = await checkTaggerExists()
              if (exists) {
                  setTaggerDownloaded(true)
              }
          } catch {
              // Ignore - just means tagger not found
          } finally {
              setCheckingTagger(false)
          }
      }
  }

  useEffect(() => {
      setApiChecks((prev) => prev.map((item) => {
          if (item.id === 'tagger') return { ...item, target: remoteTaggerUrl }
          if (item.id === 'ps-bridge') return { ...item, target: `http://127.0.0.1:${psBridgePort}` }
          return item
      }))
  }, [remoteTaggerUrl, psBridgePort])

  const updateApiCheck = (id: string, patch: Partial<ApiHealthResult>) => {
      setApiChecks((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const handleRunApiChecks = async () => {
      setIsCheckingApis(true)
      setApiChecks((prev) => prev.map((item) => ({ ...item, status: 'checking', detail: '检测中...' })))

      const checks: Array<Promise<void>> = [
          runCheck(() => headLike(NOVELAI_IMAGE_URL)).then((result) => updateApiCheck('novelai', result)),
          runCheck(() => headLike(`${SYNC_WORKER_URL}/auth/check`)).then((result) => updateApiCheck('sync-worker', result)),
          runCheck(async () => {
              const response = await tauriFetch(`${RELAY_WORKER_URL}/api/relay/discover_pc?token=${encodeURIComponent(cloudSyncToken || 'health-check')}`)
              if (response.status === 404) {
                  return { detail: '服务可达，当前检测路径返回 404' }
              }
              if (!response.ok) {
                  throw new Error(`HTTP ${response.status}`)
              }
              return { detail: '连接正常' }
          }).then((result) => updateApiCheck('relay-worker', result)),
          runCheck(async () => {
              const normalizedTaggerUrl = remoteTaggerUrl.replace(/\/$/, '')
              const taggerExists = await checkTaggerExists()

              if (!taggerExists) {
                  throw new Error('Tagger 未下载，请先下载本地 Tagger')
              }

              const ready = await ensureLocalTaggerReady()
              if (!ready) {
                  throw new Error('Local Tagger 启动失败，请检查 tagger-server 是否可执行')
              }

              const result = await headLike(`${normalizedTaggerUrl}/health`)
              return { detail: result.detail }
          }).then((result) => updateApiCheck('tagger', result)),
          runCheck(() => headLike(`http://127.0.0.1:${psBridgePort}/health`)).then((result) => updateApiCheck('ps-bridge', result)),
      ]

      await Promise.all(checks)
      setIsCheckingApis(false)
  }


  // General Settings
  if (activeTab === 'general') {
      return (
          <div className={SETTINGS_PAGE_CLASS}>
              <SettingsSection
                  title={t('settings.headers.application', 'Application')}
              >
                 <SettingsCard className="space-y-4">
                         <ParameterControl
                             label={t('settings.language')}
                             type="select"
                            value={i18n.language}
                            onChange={(val) => i18n.changeLanguage(val as string)}
                            options={[
                                { label: '中文', value: 'zh-CN' },
                                { label: 'English', value: 'en-US' },
                            ]}
                        />

                        <div className="flex items-center justify-between text-slate-800 dark:text-white border-t border-black/5 dark:border-white/10 pt-4">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium">{t('settings.desktopMode', 'Desktop Mode')}</label>
                                <p className="text-xs text-slate-500 dark:text-muted-foreground">{t('settings.exitMobileView', 'Toggle the mobile UI view on PC')}</p>
                            </div>
                            <Switch checked={forceMobile} onCheckedChange={toggleForceMobile} />
                        </div>
                     </SettingsCard>
                 </SettingsSection>
              
              <SettingsSection
                  title={t('settings.headers.generation', 'Generation')}
              >
                 <SettingsCard className="space-y-6">
                     <div className="flex items-center justify-between">
                         <div className="space-y-0.5">
                             <label className="text-sm font-medium text-slate-800 dark:text-white">{t('settings.streaming', 'Streaming Generation')}</label>
                            <p className="text-xs text-slate-500 dark:text-muted-foreground">{t('settings.streamingDesc', 'Show real-time progress during image generation')}</p>
                        </div>
                        {/* Custom Switch using Checkbox for now, or use ParameterControl if supported */}
                        <div 
                            onClick={() => setStreamingEnabled(!streamingEnabled)}
                            className={cn(
                                "w-11 h-6 rounded-full transition-colors cursor-pointer relative",
                                streamingEnabled ? "bg-green-500" : "bg-black/10 dark:bg-white/10"
                            )}
                        >
                            <div className={cn(
                                "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm",
                                streamingEnabled ? "translate-x-5" : "translate-x-0"
                            )} />
                        </div>
                    </div>

                     <ParameterControl
                          label={t('settings.generationDelay')}
                          type="slider"
                         value={generationDelay / 1000}
                         onChange={(v) => setGenerationDelay(Number(v) * 1000)}
                         min={0} max={60} step={0.1}
                          suffix={t('settings.unit.s', 's')}
                     />

                     <div className="space-y-1.5">
                         <label className="text-sm font-medium text-slate-800 dark:text-white">画质标签</label>
                         <Input
                             value={qualityTags}
                             onChange={(e) => setQualityTags(e.target.value)}
                             placeholder="best quality, amazing quality, very aesthetic, absurdres"
                             className="font-mono text-sm"
                         />
                         <p className="text-xs text-slate-500 dark:text-muted-foreground">主页面左侧栏“画质标签”按钮会按这个列表补全缺失标签。</p>
                     </div>

                     {/* Human-like Behavior */}
                     <div className="pt-4 space-y-4 border-t border-black/5 dark:border-white/10">
                         <h4 className="text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wider">{t('settings.humanLike', 'Human-like Behavior')}</h4>
                         
                         <div className="flex items-center justify-between">
                             <div className="space-y-0.5">
                                <label className="text-sm font-medium text-slate-800 dark:text-white">{t('settings.randomizeDelay', 'Randomize Delay')}</label>
                                <p className="text-xs text-slate-500 dark:text-muted-foreground">{t('settings.randomizeDelayDesc', 'Add random jitter (+/- 20%) to delay')}</p>
                            </div>
                            <Switch checked={randomizeDelay} onChange={(e) => setRandomizeDelay(e.target.checked)} />
                        </div>

                        <ParameterControl
                             label={t('settings.batchDelaySize', 'Long Pause Frequency')}
                             type="slider"
                             value={batchDelaySize}
                             onChange={setBatchDelaySize}
                             min={1} max={50} step={1}
                             suffix={t('settings.unit.images', 'imgs')}
                        />

                        <ParameterControl
                             label={t('settings.batchDelay', 'Long Pause Duration')}
                             type="slider"
                             value={batchDelay}
                             onChange={setBatchDelay}
                             min={0} max={300} step={5}
                             suffix={t('settings.unit.s', 's')}
                         />
                     </div>
                 </SettingsCard>
             </SettingsSection>

             <SettingsSection title={t('settings.version', 'Version')}>
                 <SettingsCard className="flex items-center justify-between">
                     <div>
                         <div className="text-sm font-medium text-slate-800 dark:text-white">{t('settings.version', 'Version')}</div>
                         <div className="text-xs text-slate-500 dark:text-muted-foreground">NAI Assistant v1.0.0</div>
                     </div>
                     <button className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-black/[0.04] dark:bg-white/[0.05] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] rounded-lg transition-colors border border-black/5 dark:border-white/10">
                          {t('settings.checkUpdate', 'Check for Updates')}
                     </button>
                 </SettingsCard>
             </SettingsSection>
           </div>
       )
  }

  // Storage Settings
  if (activeTab === 'storage') {
      return (
        <div className={SETTINGS_PAGE_CLASS}>
             <SettingsSection
                 title={t('settings.headers.fileStorage', 'File & Storage')}
             >
                 <SettingsCard className="space-y-4">
                     <ParameterControl
                         label={t('settings.imageFormat')}
                         type="select"
                        value={imageFormat}
                        onChange={(v) => setImageFormat(v as 'png'|'webp')}
                        options={[
                            { label: 'PNG (Lossless)', value: 'png' },
                            { label: 'WEBP (Efficient)', value: 'webp' },
                        ]}
                    />
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-800 dark:text-white">{t('settings.savePath', 'Save Path')}</label>
                        <div className="flex gap-2">
                             <Input 
                                 value={savePath} 
                                 onChange={(e) => {
                                     const val = e.target.value
                                     setSavePath(val)
                                     // Auto-detect absolute path on Windows (Driver letter or UNC)
                                     if (/^[a-zA-Z]:[\\/]/.test(val) || val.startsWith('\\\\')) {
                                         useSettingsStore.getState().setUseAbsolutePath(true)
                                     }
                                 }}
                                 className="flex-1 font-mono text-xs"
                             />
                             <Button 
                                 variant="outline" 
                                 size="icon" 
                                 onClick={async () => {
                                     try {
                                         const selected = await open({
                                             directory: true,
                                             multiple: false,
                                             defaultPath: savePath || undefined
                                         });
                                         if (selected && typeof selected === 'string') {
                                             setSavePath(selected);
                                             useSettingsStore.getState().setUseAbsolutePath(true)
                                         }
                                     } catch (err) {
                                         console.error("Failed to open dialog:", err);
                                     }
                                 }}
                                 title="Browse Folder"
                              >
                                  <FolderOpen className="w-4 h-4" />
                              </Button>
                         </div>
                     </div>
                 </SettingsCard>
             </SettingsSection>
         </div>
       )
  }

  // API Settings
  if (activeTab === 'api') {
      return (
        <div className={SETTINGS_PAGE_CLASS}>
             <SettingsSection
                 title={t('settings.headers.tagger', 'Style Tagger')}
             >
                 <SettingsCard className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-sm font-medium">{t('settings.taggerMode', 'Tagger Mode')}</label>
                          <div className="flex gap-2">
                             <button
                                 onClick={() => handleTaggerModeChange('online')}
                                 className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                     taggerMode === 'online' 
                                         ? 'bg-primary text-primary-foreground' 
                                         : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                                 }`}
                             >
                                 🌐 {t('settings.taggerModeOnline', 'Online (HF)')}
                             </button>
                             <button
                                 onClick={() => handleTaggerModeChange('local')}
                                 disabled={checkingTagger}
                                 className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                     taggerMode === 'local' 
                                         ? 'bg-primary text-primary-foreground' 
                                         : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                                 } ${checkingTagger ? 'opacity-50' : ''}`}
                             >
                                 {checkingTagger ? (
                                     <><Loader2 className="inline w-4 h-4 mr-1 animate-spin" /> Checking...</>
                                 ) : (
                                     <>💻 {t('settings.taggerModeLocal', 'Local')}</>
                                 )}
                             </button>
                         </div>
                         <p className="text-xs text-slate-500 dark:text-muted-foreground">
                             {taggerMode === 'online' 
                                 ? t('settings.taggerModeOnlineDesc', 'Uses Hugging Face WD Tagger API. No download required, but requires internet.')
                                 : t('settings.taggerModeLocalDesc', 'Uses local tagger-server. Faster but requires ~170MB download.')}
                         </p>
                     </div>
                     
                     {/* Show URL input and download status for local mode */}
                      {taggerMode === 'local' && (
                          <div className="space-y-3">
                              <ParameterControl
                                 label={t('settings.taggerUrl', 'Tagger 地址')}
                                 type="input"
                                 value={remoteTaggerUrl}
                                 onChange={setRemoteTaggerUrl}
                             />
                             
                             {/* Download Status / Button / Progress */}
                              <div className="p-3 bg-white/70 dark:bg-white/[0.04] rounded-xl space-y-3 shadow-inner border border-black/5 dark:border-white/10">
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                         {taggerDownloaded ? (
                                             <>
                                                 <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500" />
                                                 <span className="text-sm text-green-600 dark:text-green-500">{t('settings.taggerReady', 'Tagger 已就绪')}</span>
                                             </>
                                         ) : isDownloading ? (
                                             <>
                                                 <Loader2 className="w-4 h-4 text-indigo-600 dark:text-primary animate-spin" />
                                                 <span className="text-sm text-indigo-600 dark:text-primary">
                                                     {downloadSource ? `正在从 ${downloadSource} 下载...` : '正在下载...'}
                                                 </span>
                                             </>
                                         ) : (
                                             <>
                                                 <Download className="w-4 h-4 text-amber-600 dark:text-yellow-500" />
                                                 <span className="text-sm text-amber-600 dark:text-yellow-500">{t('settings.taggerNotDownloaded', '需要下载 Tagger (~170MB)')}</span>
                                             </>
                                         )}
                                     </div>
                                     {!taggerDownloaded && !isDownloading && (
                                          <Button 
                                              size="sm" 
                                              variant="outline"
                                              onClick={handleDownloadTagger}
                                              className="text-slate-700 dark:text-slate-200 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                                          >
                                              <Download className="w-4 h-4 mr-1" />
                                              {t('settings.downloadTagger', '下载')}
                                         </Button>
                                     )}
                                 </div>
                                 
                                 {/* Inline Progress Bar */}
                                 {isDownloading && (
                                     <div className="space-y-2">
                                         <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                             <div 
                                                 className="h-full bg-primary transition-all duration-300 rounded-full"
                                                 style={{ width: `${downloadProgress.progress}%` }}
                                             />
                                         </div>
                                         <div className="flex justify-between text-xs text-muted-foreground">
                                             <span>{formatSize(downloadProgress.downloaded)} / {formatSize(downloadProgress.total)}</span>
                                             <span>{downloadProgress.progress}%</span>
                                         </div>
                                     </div>
                                 )}
                                 
                                 {/* Error Message */}
                                 {downloadError && (
                                     <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                         {downloadError}
                                     </div>
                                 )}
                              </div>
                          </div>
                      )}
                 </SettingsCard>
             </SettingsSection>
              
              {/* Tagger Download Dialog */}
              <TaggerDownloadDialog
                 open={showDownloadDialog}
                 onOpenChange={setShowDownloadDialog}
                 onUseOnline={() => {
                     setTaggerMode('online')
                     setShowDownloadDialog(false)
                 }}
                 onDownloadComplete={() => {
                     setTaggerDownloaded(true)
                     setShowDownloadDialog(false)
                 }}
             />
             
             {/* Other Integration Settings */}
              <SettingsSection
                  title="NovelAI 代理"
                  description="当部分电脑无法直连 NovelAI 时，可通过 Cloudflare Worker 作为跳板验证 Token 与查询余额。"
              >
                  <SettingsCard className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-800 dark:text-white">连接模式</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {[
                                  { value: 'direct', label: '直连', desc: '直接访问 NovelAI 官方 API' },
                                  { value: 'official', label: '官方 Worker', desc: '直连失败时走我们提供的代理跳板' },
                                  { value: 'custom', label: '自定义 Worker', desc: '使用你自己的 Cloudflare Worker' },
                              ].map((option) => (
                                  <button
                                      key={option.value}
                                      onClick={() => setNovelAiProxyMode(option.value as 'direct' | 'official' | 'custom')}
                                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                                          novelAiProxyMode === option.value
                                              ? 'border-primary bg-primary/10 text-slate-900 dark:text-white'
                                              : 'border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-200'
                                      }`}
                                  >
                                      <div className="text-sm font-medium">{option.label}</div>
                                      <div className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">{option.desc}</div>
                                  </button>
                              ))}
                          </div>
                      </div>

                      {novelAiProxyMode === 'custom' && (
                          <ParameterControl
                              label="NovelAI 代理地址"
                              type="input"
                              value={novelAiProxyUrl}
                              onChange={(v) => setNovelAiProxyUrl(String(v))}
                          />
                      )}

                      <p className="text-xs text-slate-500 dark:text-muted-foreground leading-relaxed">
                          {novelAiProxyMode === 'custom'
                              ? '示例：https://your-worker.workers.dev/api/nai/subscription'
                              : '推荐公司网络受限的用户优先试官方 Worker，不够用时再自行部署自定义 Worker。'}
                      </p>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <Button
                              variant="outline"
                              className="justify-start"
                              onClick={() => navigator.clipboard.writeText('npm install -g wrangler && wrangler login && wrangler deploy')}
                          >
                              复制部署命令
                          </Button>
                          <Button
                              variant="outline"
                              className="justify-start"
                              onClick={() => openExternal(WORKER_DEPLOY_DOC_URL)}
                          >
                              打开部署文档
                          </Button>
                          <Button
                              variant="outline"
                              className="justify-start"
                              onClick={() => setShowWorkerGuide(true)}
                          >
                              查看内置教程
                          </Button>
                          <Button
                              variant="outline"
                              className="justify-start"
                              onClick={() => navigator.clipboard.writeText(DEEP_LINK_IMPORT_EXAMPLE)}
                          >
                              复制一键导入链接
                          </Button>
                      </div>
                  </SettingsCard>
              </SettingsSection>

              <SettingsSection
                  title={t('settings.headers.integration', 'Integration')}
              >
                  <SettingsCard className="space-y-4">
                      <ParameterControl
                         label={t('settings.psBridgePort', 'PS Bridge Port')}
                         type="number"
                        value={psBridgePort}
                        onChange={(v) => setPsBridgePort(Number(v))}
                    />
                    
                     <div className="pt-4 border-t border-black/5 dark:border-white/10 space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                              <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m14 15-2-2-2 2"/><path d="M12 13v8"/></svg>
                             </div>
                             <span className="text-sm font-semibold text-slate-800 dark:text-white">Cloud Airdrop</span>
                         </div>
                         <ParameterControl
                             label={t('settings.cloudSyncToken', 'Connection Token')}
                             type="input"
                             value={cloudSyncToken || ''}
                             onChange={(v) => setCloudSyncToken(String(v))}
                         />
                          <p className="text-xs text-slate-500 dark:text-muted-foreground leading-relaxed">
                              配置与手机端一致的中继 Token，以实现跨网络环境的多图极速传输。留空则代表不启用长轮询监听。
                          </p>
                      </div>
                  </SettingsCard>
              </SettingsSection>

              <SettingsSection
                  title={t('settings.headers.apiHealth', 'API Health')}
                  description="检查常用外部服务与本地桥接是否可达。"
              >
                  <SettingsCard className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                          <div>
                              <div className="text-sm font-medium text-slate-800 dark:text-white">一键检测连接</div>
                              <div className="text-xs text-slate-500 dark:text-muted-foreground">覆盖 NovelAI、同步中继、本地 Tagger 与 PS Bridge。</div>
                          </div>
                          <Button
                              variant="outline"
                              onClick={handleRunApiChecks}
                              disabled={isCheckingApis}
                              className="border-black/10 dark:border-white/10"
                          >
                              {isCheckingApis ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                              开始检测
                          </Button>
                      </div>

                      <div className="space-y-2">
                          {apiChecks.map((item) => (
                              <div key={item.id} className="rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2.5">
                                  <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                          <div className="text-sm font-medium text-slate-800 dark:text-white">{item.label}</div>
                                          <div className="text-[11px] font-mono text-slate-500 dark:text-white/45 break-all">{item.target}</div>
                                      </div>
                                      <div className={cn(
                                          'shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider',
                                          item.status === 'ok' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                                          item.status === 'error' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                                          item.status === 'checking' && 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
                                          item.status === 'idle' && 'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-white/45'
                                      )}>
                                          {item.status === 'ok' ? 'OK' : item.status === 'error' ? 'FAIL' : item.status === 'checking' ? 'CHECKING' : 'IDLE'}
                                      </div>
                                  </div>
                                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-white/60">
                                      {item.status === 'error' ? <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                                      <span>{item.detail || '尚未检测'}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </SettingsCard>
              </SettingsSection>
              <Dialog open={showWorkerGuide} onOpenChange={setShowWorkerGuide}>
                  <DialogContent className="flex max-w-4xl max-h-[85vh] flex-col p-0 overflow-hidden">
                      <div className="border-b border-black/5 dark:border-white/10 px-6 py-4">
                          <DialogTitle>自定义 Cloudflare Worker 使用说明</DialogTitle>
                          <DialogDescription>
                              已内置在应用里，用户只拿到安装包也能查看部署和导入步骤。
                          </DialogDescription>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                          <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-700 dark:text-slate-200 font-mono">
                              {customWorkerUserGuide}
                          </pre>
                      </div>
                  </DialogContent>
              </Dialog>
          </div>
        )
  }

  // Appearance Settings
  if (activeTab === 'appearance') {
      const themeOptions = [
          { id: 'light', label: t('settings.themeOptions.light', 'Light'), icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
          )},
          { id: 'dark', label: t('settings.themeOptions.dark', 'Dark'), icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
          )},
          { id: 'system', label: t('settings.themeOptions.system', 'System'), icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
              </svg>
          )},
      ];

      return (
        <div className={SETTINGS_PAGE_CLASS}>
             <SettingsSection
                  title={t('settings.headers.appearance', 'Appearance')}
             >
                 <SettingsCard className="space-y-5">
                      <div className="space-y-3">
                          <label className="text-sm font-medium text-slate-800 dark:text-white">{t('settings.theme', 'Theme Mode')}</label>
                          <div className="grid grid-cols-3 gap-3">
                             {themeOptions.map((opt) => (
                                 <button
                                      key={opt.id}
                                      onClick={() => setTheme(opt.id as 'dark' | 'light' | 'system')}
                                      className={cn(
                                          "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                                          theme === opt.id
                                              ? "border-slate-900 bg-slate-100 text-slate-950 dark:border-white dark:bg-white/10 dark:text-white shadow-sm"
                                              : "border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/5 hover:border-black/10 dark:hover:border-white/20"
                                      )}
                                  >
                                      <div className={cn(
                                         "transition-transform duration-200",
                                         theme === opt.id && "scale-110"
                                     )}>
                                         {opt.icon}
                                     </div>
                                     <span className="text-sm font-medium">{opt.label}</span>
                                 </button>
                              ))}
                          </div>
                      </div>
                 </SettingsCard>
             </SettingsSection>
         </div>
       )
  }

  return null
}
