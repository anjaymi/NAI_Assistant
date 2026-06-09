import { useSync } from '@/context/SyncContext'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Cloud, CheckCircle, RefreshCw, LogOut, Send, Download, Copy, Edit2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { SyncAuthForm } from '@/components/molecules/SyncAuthForm'
import { BindEmailForm } from '@/components/molecules/BindEmailForm'
import { motion, AnimatePresence } from 'framer-motion'

export default function SyncSettingsPanel() {
    const { t } = useTranslation()
    const { isLoggedIn, user, login, register, logout, sync, isSyncing, lastSyncTime, generateShareCode, importShareCode, changeUsername } = useSync()

    const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: number } | null>(null)
    const [inputCode, setInputCode] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isEditingUsername, setIsEditingUsername] = useState(false)
    const [newUsername, setNewUsername] = useState('')
    const [isChangingUsername, setIsChangingUsername] = useState(false)

    const handleGenerate = async () => {
        setIsGenerating(true)
        const res = await generateShareCode()
        setIsGenerating(false)
        if (res) {
            setGeneratedCode(res)
        }
    }

    const handleImport = async () => {
        if (!inputCode || inputCode.length !== 6) return
        setIsImporting(true)
        try {
            const success = await importShareCode(inputCode)
            if (success) {
                // simple alert for now, can be improved with toast
                alert(t('settings.sync.importSuccess', 'Data imported successfully!'))
                setInputCode('')
            }
        } catch (e) {
            alert(t('settings.sync.importFailed', 'Import failed: ') + String(e))
        } finally {
            setIsImporting(false)
        }
    }

    const copyCode = () => {
        if (generatedCode) {
            navigator.clipboard.writeText(generatedCode.code)
            alert(t('settings.share.copied', 'Code copied'))
        }
    }

    const handleChangeUsername = async () => {
        const trimmed = newUsername.trim()
        if (!trimmed || trimmed.length < 3) {
            alert(t('auth.usernameTooShort', 'Username must be at least 3 characters'))
            return
        }
        setIsChangingUsername(true)
        try {
            await changeUsername(trimmed)
            setIsEditingUsername(false)
            setNewUsername('')
            // It modifies the token and user within context, so it will update automatically
        } catch (e: any) {
            alert(String(e))
        } finally {
            setIsChangingUsername(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <section className="space-y-4">
                <h3 className="flex items-center gap-2 pl-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-white/40">
                    <Cloud className="h-4 w-4" />
                    {t('settings.headers.cloudSync', 'Cloud Sync')}
                </h3>
                <div className="rounded-[1.5rem] border border-black/5 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-[#08090d] dark:shadow-none space-y-6">
                    
                    {/* Status & Login */}
                    <div className="space-y-4">
                        <div className="rounded-[1.15rem] border border-black/5 bg-slate-50 dark:border-white/10 dark:bg-[#0e0f12]">
                            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-black/5 dark:border-white/10">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/35">账户</div>
                                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white tracking-[-0.01em]">
                                        {isLoggedIn ? (user?.name || t('settings.sync.loggedIn', '已登录')) : t('settings.sync.notLoggedIn', '未登录')}
                                        {isLoggedIn && (
                                            <button 
                                                onClick={() => {
                                                    setNewUsername(user?.name || '')
                                                    setIsEditingUsername(true)
                                                }}
                                                className="p-1 rounded-lg bg-white dark:bg-[#15171b] hover:bg-slate-200 dark:hover:bg-[#1b1d22] text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white transition-colors"
                                                title={t('settings.sync.changeUsername', '修改用户名')}
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isLoggedIn ? (
                                    <Button variant="ghost" size="sm" onClick={logout} className="h-8 px-3 rounded-xl text-xs font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:text-rose-300 dark:hover:text-rose-200 dark:hover:bg-rose-500/10">
                                        <LogOut className="w-3.5 h-3.5 mr-2" />
                                        {t('settings.sync.logout', '退出登录')}
                                    </Button>
                                ) : (
                                     <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45">
                                        <Cloud className="h-3.5 w-3.5" />
                                        云同步
                                    </div>
                                )}
                            </div>

                            <div className="px-4 py-3 text-xs text-slate-500 dark:text-white/45">
                                {isLoggedIn ? `ID: ${user?.id?.slice(0, 8)}...` : t('settings.sync.desc', '登录后可启用同步与分享。')}
                            </div>
                        </div>
                         
                        {isLoggedIn && (
                              <div className="px-1">
                                <BindEmailForm />
                             </div>
                        )}

                        {!isLoggedIn && (
                            <div className="pt-2">
                                <SyncAuthForm />
                            </div>
                        )}
                    </div>

                    {/* Sync Actions */}
                    {isLoggedIn && (
                        <div className="pt-5 border-t border-black/5 dark:border-white/10 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[1.15rem] p-4 border border-black/5 bg-slate-50 dark:border-white/10 dark:bg-[#0e0f12]">
                                <div className="space-y-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/35">{t('settings.sync.lastSync', '最近同步')}</div>
                                    <div className="text-sm text-slate-800 dark:text-white/85 font-medium font-mono">
                                        {lastSyncTime > 0 ? new Date(lastSyncTime).toLocaleString() : t('settings.sync.never', '从未')}
                                    </div>
                                </div>
                                <Button size="sm" variant="secondary" onClick={sync} disabled={isSyncing} className="h-10 px-5 rounded-xl bg-white text-slate-800 hover:bg-slate-100 dark:bg-[#15171b] dark:hover:bg-[#1b1d22] dark:text-white border border-black/5 dark:border-white/10 shadow-sm transition-all sm:w-auto w-full font-medium">
                                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                                    {isSyncing ? t('settings.sync.syncing', '同步中...') : t('settings.sync.syncNow', '立即同步')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

             {/* Share & Import Section */}
             <section className="space-y-4">
                <h3 className="flex items-center gap-2 pl-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-white/40">
                    <Send className="h-4 w-4" />    
                    {t('settings.headers.share', '数据分享')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* LEFT: Generate Code (Only if logged in) */}
                    <div className={`rounded-[1.5rem] border border-black/5 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-[#08090d] dark:shadow-none space-y-4 ${!isLoggedIn ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="space-y-1">
                             <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/35">分享</div>
                             <div className="text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">{t('settings.share.generate', '生成分享码')}</div>
                         </div>
                          
                         {!generatedCode ? (
                              <Button className="w-full h-11 rounded-xl bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-800 dark:text-white border border-black/5 dark:border-white/10 font-medium text-sm shadow-sm transition-all" onClick={handleGenerate} disabled={isGenerating}>
                                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                   {t('settings.share.createCode', '生成分享码')}
                              </Button>
                          ) : (
                             <div className="space-y-3">
                                  <div className="p-4 bg-slate-50 dark:bg-[#0e0f12] rounded-xl border border-black/5 dark:border-white/10 text-center space-y-1 shadow-[inset_0_1px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_8px_rgba(0,0,0,0.22)]">
                                      <div className="text-3xl font-mono font-semibold tracking-[0.2em] text-slate-900 dark:text-white">{generatedCode.code}</div>
                                      <div className="text-[10px] text-slate-400 dark:text-white/40 font-medium mt-2">过期时间：{new Date(generatedCode.expiresAt).toLocaleTimeString()}</div>
                                  </div>
                                  <Button variant="secondary" className="w-full h-10 rounded-xl font-medium bg-white dark:bg-[#15171b] hover:bg-slate-100 dark:hover:bg-[#1b1d22] text-slate-900 dark:text-white border border-black/5 dark:border-white/10" onClick={copyCode}>
                                      <Copy className="w-4 h-4 mr-2" />
                                      {t('settings.share.copy', '复制分享码')}
                                  </Button>
                                  <Button variant="ghost" className="w-full text-xs h-8 rounded-lg text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setGeneratedCode(null)}>
                                      {t('settings.share.cancel', '重置')}
                                  </Button>
                              </div>
                          )}
                    </div>

                    {/* RIGHT: Import Code */}
                    <div className="rounded-[1.5rem] border border-black/5 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-[#08090d] dark:shadow-none space-y-4">
                        <div className="space-y-1">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/35">导入</div>
                            <div className="text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">{t('settings.share.import', '输入分享码')}</div>
                        </div>
                          
                         <div className="space-y-3">
                              <Input 
                                  placeholder="000000" 
                                  className="font-mono text-center tracking-[0.3em] text-2xl h-14 bg-slate-50 dark:bg-[#0e0f12] border-black/5 dark:border-white/10 rounded-xl shadow-inner focus-visible:ring-indigo-500/50 transition-all font-semibold placeholder:tracking-normal placeholder:font-sans placeholder:text-base placeholder:text-slate-400" 
                                 maxLength={6}
                                 value={inputCode}
                                 onChange={(e) => setInputCode(e.target.value)}
                              />
                               <Button className="w-full h-11 rounded-xl bg-white dark:bg-[#15171b] text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1b1d22] border border-black/5 dark:border-white/10 font-medium transition-all shadow-sm text-sm" variant="secondary" onClick={handleImport} disabled={isImporting || inputCode.length !== 6}>
                                  {isImporting ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : null}
                                  {t('settings.share.startImport', '开始导入')}
                              </Button>
                         </div>
                    </div>

                </div>
            </section>

            {/* Edit Username Modal */}
            <AnimatePresence>
                {isEditingUsername && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => !isChangingUsername && setIsEditingUsername(false)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[1.5rem] shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
                                <h3 className="font-semibold text-slate-900 dark:text-white">{t('settings.sync.changeUsername', '修改用户名')}</h3>
                                <button className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors" onClick={() => setIsEditingUsername(false)} disabled={isChangingUsername}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <p className="text-sm text-slate-500 dark:text-white/60">
                                    {t('settings.sync.changeUsernameDesc', '输入新的用户名。')}
                                </p>
                                <Input 
                                    className="w-full bg-slate-50 dark:bg-black/50 border-slate-200 dark:border-white/10"
                                    placeholder={t('auth.username', '用户名')}
                                    autoFocus
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleChangeUsername()
                                    }}
                                    disabled={isChangingUsername}
                                />
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="ghost" className="h-9 px-4 rounded-xl text-sm font-medium" onClick={() => setIsEditingUsername(false)} disabled={isChangingUsername}>
                                        {t('common.cancel', '取消')}
                                    </Button>
                                    <Button className="h-9 px-5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium" onClick={handleChangeUsername} disabled={isChangingUsername || !newUsername.trim()}>
                                        {isChangingUsername ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                        {t('common.save', '保存')}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
