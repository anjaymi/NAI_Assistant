import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSync } from '@/context/SyncContext';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { Cloud, RefreshCw, LogOut, Send, Download, Copy, Mail, AlertCircle, CheckCircle, ArrowLeft, Loader2, Network, QrCode, Zap, Edit2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
import { pingLanHost } from '@/services/cloud-push-service';
import { toast } from '@/hooks/use-toast';
import { useNetworkHealth } from '@/hooks/use-network-health';
import { motion, AnimatePresence } from 'framer-motion';

// --- Inline Sync Auth Form ---
function MobileSyncAuthForm() {
    const { login, register, resetPasswordRequest, resetPasswordVerify } = useSync()
    const { t } = useTranslation()
    
    const [view, setView] = useState<'login' | 'register' | 'forgot' | 'verify'>('login')
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [code, setCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    const timeoutRef = React.useRef<NodeJS.Timeout>();

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const clearState = () => { setError(''); setSuccessMsg(''); setLoading(false); }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); clearState(); setLoading(true);
        try { await login(username, password); } 
        catch (err: any) { setError(err.message || 'Login failed'); } 
        finally { setLoading(false); }
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault(); clearState(); setLoading(true);
        try { 
            // @ts-ignore
            await register(username, password, email); 
        } 
        catch (err: any) { setError(err.message || 'Registration failed'); } 
        finally { setLoading(false); }
    }

    const handleForgotRequest = async (e: React.FormEvent) => {
        e.preventDefault(); clearState(); setLoading(true);
        try {
            const sent = await resetPasswordRequest(email);
            if (sent) { setView('verify'); setSuccessMsg('Code sent to email'); } 
            else { setError('Failed to send code.'); }
        } catch (err: any) { setError(err.message || 'Request failed'); } 
        finally { setLoading(false); }
    }
    
    const handleVerifyReset = async (e: React.FormEvent) => {
        e.preventDefault(); clearState(); setLoading(true);
        try {
            const success = await resetPasswordVerify(email, code, newPassword);
            if (success) {
                setSuccessMsg('Password reset successfully!');
                timeoutRef.current = setTimeout(() => { setView('login'); setPassword(''); setSuccessMsg(''); }, 2000);
            }
        } catch (err: any) { setError(err.message || 'Verification failed'); } 
        finally { setLoading(false); }
    }

    // Common Input styling
    const inputClass = "h-11 text-xs bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400 dark:bg-black/30 dark:border-white/10 dark:text-white dark:placeholder:text-white/20 rounded-xl";
    const btnClass = "w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10 dark:bg-white dark:hover:bg-white/90 dark:text-black dark:shadow-white/10 font-semibold";
    const bgContainer = "space-y-3 bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-200 dark:border-white/5 animate-in slide-in-from-right-4";

    if (view === 'forgot') {
        return (
            <form onSubmit={handleForgotRequest} className={bgContainer}>
                <div className="flex items-center gap-2 mb-2">
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 bg-slate-200/50 hover:bg-slate-200 dark:text-white/50 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 rounded-full shrink-0" onClick={() => setView('login')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white/90">
                        {t('auth.forgotPassword', 'Reset Password')}
                    </div>
                </div>
                <Input type="email" placeholder={t('auth.email', 'Email Address')} value={email} onChange={e => setEmail(e.target.value)} className={inputClass} required />
                {error && <div className="text-[10px] text-red-500 dark:text-red-400 p-2 bg-red-100 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20">{error}</div>}
                {successMsg && <div className="text-[10px] text-green-500 dark:text-green-400 p-2 bg-green-100 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-500/20">{successMsg}</div>}
                <Button type="submit" className={btnClass} disabled={loading || !email}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Mail className="w-4 h-4 mr-2 text-white/80 dark:text-black/50" />}
                    {t('auth.sendCode', 'Send Reset Code')}
                </Button>
            </form>
        )
    }

    if (view === 'verify') {
        return (
            <form onSubmit={handleVerifyReset} className={bgContainer}>
                <div className="flex items-center gap-2 mb-2">
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 bg-slate-200/50 hover:bg-slate-200 dark:text-white/50 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 rounded-full shrink-0" onClick={() => setView('forgot')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white/90">
                        {t('auth.verifyReset', 'New Password')}
                    </div>
                </div>
                {successMsg && <div className="text-[10px] text-green-500 dark:text-green-400 flex items-center p-2 bg-green-100 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-500/20"><CheckCircle className="w-3 h-3 mr-1.5 shrink-0"/> {successMsg}</div>}
                <div className="text-[11px] text-slate-500 dark:text-white/40">Code sent to {email}</div>
                <Input placeholder={t('auth.code', 'Verification Code (6 digits)')} value={code} onChange={e => setCode(e.target.value)} className={cn(inputClass, "font-mono tracking-widest text-center text-lg")} maxLength={6} required />
                <Input type="password" placeholder={t('auth.newPassword', 'New Password')} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} minLength={6} required />
                {error && <div className="text-[10px] text-red-500 dark:text-red-400 p-2 bg-red-100 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20">{error}</div>}
                <Button type="submit" className={btnClass} disabled={loading || !code || !newPassword}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2"/>}
                    {t('auth.resetPassword', 'Set New Password')}
                </Button>
            </form>
        )
    }

    return (
        <form onSubmit={view === 'login' ? handleLogin : handleRegister} className={bgContainer}>
            <div className="text-sm font-semibold text-slate-900 dark:text-white/90 mb-1">
                {view === 'register' ? t('auth.register', 'Register Account') : t('auth.login', 'Login to Sync')}
            </div>
            <div className="space-y-2.5">
                <Input placeholder={t('auth.usernameOrEmail', 'Username / Email')} value={username} onChange={e => setUsername(e.target.value)} className={inputClass} required />
                {view === 'register' && (
                     <Input type="email" placeholder={t('auth.emailOptional', 'Email (Optional for recovery)')} value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
                )}
                <Input type="password" placeholder={t('auth.password', 'Password')} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} minLength={6} required />
            </div>

            {error && <div className="text-[10px] text-red-500 dark:text-red-400 p-2 bg-red-100 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20 flex items-center gap-1.5"><AlertCircle className="w-3 h-3 shrink-0" />{error}</div>}

            <div className="flex flex-col gap-2 pt-1">
                <Button type="submit" className={btnClass} disabled={loading || !username || !password}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2"/>}
                    {view === 'register' ? t('auth.createAccount', 'Create Account') : t('auth.signIn', 'Sign In')}
                </Button>
                
                <div className="flex justify-between items-center gap-2 pt-2 px-1">
                     <button type="button" onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError(''); }} className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white transition-colors">
                        {view === 'register' ? t('auth.switchToLogin', 'Have account? Sign IN') : t('auth.switchToRegister', 'Need account? Register')}
                    </button>
                    {view === 'login' && (
                        <button type="button" onClick={() => setView('forgot')} className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white transition-colors">
                             {t('auth.forgot', 'Forgot Password?')}
                        </button>
                    )}
                </div>
            </div>
        </form>
    )
}

// --- Inline Bind Email Form ---
function MobileBindEmailForm() {
    const { user, bindEmailRequest, bindEmailVerify } = useSync()
    const { t } = useTranslation()
    
    const [isExpanded, setIsExpanded] = useState(false)
    const [step, setStep] = useState<'input' | 'verify'>('input')
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const timeoutRef = React.useRef<NodeJS.Timeout>();

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const isBound = !!user?.email

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setLoading(true);
        try { if (await bindEmailRequest(email)) setStep('verify'); } 
        catch (err: any) { setError(err.message || 'Failed to send code'); } 
        finally { setLoading(false); }
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (await bindEmailVerify(code)) {
                setSuccess(true);
                timeoutRef.current = setTimeout(() => setIsExpanded(false), 2000);
            }
        } catch (err: any) { setError(err.message || 'Verification failed'); } 
        finally { setLoading(false); }
    }

    if (isBound) {
        return (
            <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/10 px-3 py-2.5 rounded-xl border border-green-200 dark:border-green-500/20">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{user.email}</span>
            </div>
        )
    }

    if (!isExpanded) {
         return (
            <Button variant="outline" onClick={() => setIsExpanded(true)} className="w-full h-10 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-500 dark:border-white/20 dark:hover:border-white/40 dark:hover:bg-white/5 rounded-xl text-xs dark:text-white/60">
                <Mail className="w-4 h-4 mr-2" />
                {t('auth.bindEmail', 'Bind Email for Recovery')}
            </Button>
        )
    }

    if (success) {
         return (
            <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/10 px-3 py-2.5 rounded-xl border border-green-200 dark:border-green-500/20 animate-in fade-in">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{t('auth.bindSuccess', 'Email bound successfully!')}</span>
            </div>
        )
    }

    const inputClass = "h-10 text-xs bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400 dark:bg-black/40 dark:border-white/10 dark:text-white dark:placeholder:text-white/20 rounded-xl";

    return (
        <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white/90">
                    {step === 'input' ? t('auth.bindEmail', 'Bind Email') : t('auth.verifyEmail', 'Verify Email')}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/50 dark:hover:text-white" onClick={() => setIsExpanded(false)}>
                    &times;
                </Button>
            </div>

            {step === 'input' ? (
                <form onSubmit={handleSendCode} className="space-y-2.5">
                    <Input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} required />
                    {error && <p className="text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1 bg-red-100 dark:bg-red-500/10 px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20"><AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}</p>}
                    <Button type="submit" className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-white/90 dark:text-black font-semibold" disabled={loading || !email}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2 text-white/80 dark:text-black/50" />}
                        {t('auth.sendCode', 'Send Code')}
                    </Button>
                </form>
            ) : (
                <form onSubmit={handleVerify} className="space-y-2.5">
                    <div className="text-[10px] text-slate-500 dark:text-white/40">{t('auth.codeSent_to', 'Code sent to')} {email}</div>
                    <Input placeholder="123456" value={code} onChange={e => setCode(e.target.value)} className={cn(inputClass, "text-center tracking-widest font-mono text-lg")} maxLength={6} required />
                     {error && <p className="text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1 bg-red-100 dark:bg-red-500/10 px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20"><AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}</p>}
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" className="flex-1 h-10 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-200/50 hover:bg-slate-200 dark:text-white/60 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10" onClick={() => setStep('input')}>
                            {t('common.back', 'Back')}
                        </Button>
                        <Button type="submit" className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-white/90 dark:text-black font-semibold" disabled={loading || !code}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : t('auth.verify', 'Verify')}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    )
}

// --- Main Export ---
export function MobileSyncSettings() {
    const { t } = useTranslation()
    const { isLoggedIn, user, sync, isSyncing, lastSyncTime, syncError, syncLogs, generateShareCode, importShareCode, logout, changeUsername } = useSync()
    const { lanPcIp, setLanPcIp, cloudSyncToken: manualToken } = useSettingsStore()
    
    // 使用登录 ID 优先匹配
    const effectiveToken = user?.id || manualToken || '';
    const { lanReady } = useNetworkHealth(effectiveToken);

    const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: number } | null>(null)
    const [inputCode, setInputCode] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isPingTesting, setIsPingTesting] = useState(false)
    
    // Change Username States
    const [isEditingUsername, setIsEditingUsername] = useState(false)
    const [newUsername, setNewUsername] = useState('')
    const [isChangingUsername, setIsChangingUsername] = useState(false)

    const handlePingTest = async () => {
        if (!lanPcIp || isPingTesting) return;
        setIsPingTesting(true);
        try {
            const result = await pingLanHost(lanPcIp);
            if (result === true) {
                toast({ title: "✅ 连接成功", description: `PC 端 ${lanPcIp}:38080 已响应` });
            } else if (typeof result === 'string') {
                toast({ title: "❌ 连接失败", description: result, variant: "destructive" });
            } else {
                toast({ title: "❌ 连接失败", description: "PC 端返回了非成功状态码", variant: "destructive" });
            }
        } finally {
            setIsPingTesting(false);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true)
        const res = await generateShareCode()
        setIsGenerating(false)
        if (res) setGeneratedCode(res)
    }

    const handleImport = async () => {
        if (!inputCode || inputCode.length !== 6) return
        setIsImporting(true)
        try {
            const success = await importShareCode(inputCode)
            if (success) {
                toast({ title: "导入成功", description: t('settings.sync.importSuccess', 'Data imported successfully!') })
                setInputCode('')
            }
        } catch (e) {
            toast({ title: "导入失败", description: String(e), variant: "destructive" })
        } finally {
            setIsImporting(false)
        }
    }

    const copyCode = () => {
        if (generatedCode) {
            navigator.clipboard.writeText(generatedCode.code)
            toast({ title: "已复制", description: t('settings.share.copied', 'Code copied') })
        }
    }

    const handleChangeUsername = async () => {
        const trimmed = newUsername.trim()
        if (!trimmed || trimmed.length < 3) {
            toast({ title: t('auth.usernameTooShort', 'Username must be at least 3 characters'), variant: 'destructive' })
            return
        }
        setIsChangingUsername(true)
        try {
            await changeUsername(trimmed)
            setIsEditingUsername(false)
            setNewUsername('')
            toast({ title: "修改成功", description: "用户名已更新" })
        } catch (e: any) {
            toast({ title: "修改失败", description: String(e), variant: "destructive" })
        } finally {
            setIsChangingUsername(false)
        }
    }

    return (
        <div className="space-y-8 pb-10">
            {/* LAN Airdrop Config */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 pl-1 text-slate-500 dark:text-white/50">
                    <Network className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Airdrop 局域网直连</h3>
                    {/* 实时状态徽章 */}
                    {lanReady && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 dark:bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/20">
                            <Zap className="w-3 h-3" />
                            已连通
                        </span>
                    )}
                </div>
                
                <GlassSurface className="p-4 rounded-2xl border border-slate-200 bg-white/40 shadow-sm dark:shadow-none dark:border-white/5 dark:bg-white/[0.02]" borderRadius={16} backgroundOpacity={0.02}>
                    <div className="space-y-3">
                        {/* 连接状态区 */}
                        <div className="pt-1">
                            {lanPcIp && lanReady ? (
                                <div className="flex items-center justify-between bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 px-4 py-3 rounded-xl animate-in zoom-in-95">
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-2 w-2 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                        </span>
                                        <span className="font-mono text-sm text-cyan-800 dark:text-cyan-300 tracking-wide font-bold">
                                            {lanPcIp}:38080
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Zap className="w-3.5 h-3.5 text-cyan-500" />
                                        <span className="text-[10px] uppercase font-bold text-cyan-600/70 dark:text-cyan-400/70 tracking-wider">
                                            LAN Ready
                                        </span>
                                    </div>
                                </div>
                            ) : lanPcIp ? (
                                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                                        <span className="font-mono text-sm text-amber-800 dark:text-amber-300 tracking-wide font-bold">
                                            {lanPcIp}:38080
                                        </span>
                                    </div>
                                    <span className="text-[10px] uppercase font-bold text-amber-600/70 dark:text-amber-400/70 tracking-wider">
                                        Connecting...
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-4 py-3 rounded-xl text-slate-400 dark:text-white/40">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-xs font-semibold tracking-wider uppercase">Searching LAN Hosts...</span>
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] text-slate-400 dark:text-white/40 leading-relaxed px-1">
                            在 PC 端点击 <span className="font-semibold text-slate-500 dark:text-white/60">📱 手机图标</span> 可查看配对二维码和 IP 地址。
                        </p>

                        {/* 手动 IP 输入区 */}
                        <div className="pt-2 border-t border-slate-200/50 dark:border-white/5 space-y-2">
                            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-white/40 tracking-wider px-1">
                                手动输入 PC IP
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="192.168.x.x"
                                    className="font-mono text-sm h-10 bg-slate-100 border-slate-200 text-slate-900 rounded-xl flex-1 dark:bg-black/30 dark:border-white/10 dark:text-white"
                                    value={lanPcIp || ''}
                                    onChange={(e) => setLanPcIp(e.target.value.trim())}
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!lanPcIp || isPingTesting}
                                    className="h-10 px-4 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-medium dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 disabled:opacity-50"
                                    onClick={handlePingTest}
                                >
                                    {isPingTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : '测试'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </GlassSurface>
            </section>

            {/* Cloud Sync section */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 pl-1 text-slate-500 dark:text-white/50">
                    <Cloud className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">{t('settings.headers.cloudSync', 'Cloud Sync')}</h3>
                </div>
                
                <GlassSurface className="p-4 rounded-2xl border border-slate-200 bg-white/40 shadow-sm dark:shadow-none dark:border-white/5 dark:bg-white/[0.02]" borderRadius={16} backgroundOpacity={0.02}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className={cn("w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 border", isLoggedIn ? 'bg-indigo-100 text-indigo-500 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/20' : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-white/5 dark:text-white/40 dark:border-white/10')}>
                            <Cloud className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white/90 truncate">
                                {isLoggedIn ? (user?.name || t('settings.sync.loggedIn', 'Logged in')) : t('settings.sync.notLoggedIn', 'Not logged in')}
                                {isLoggedIn && (
                                     <button 
                                        onClick={() => {
                                            setNewUsername(user?.name || '')
                                            setIsEditingUsername(true)
                                        }}
                                        className="p-1 rounded bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white transition-colors"
                                     >
                                         <Edit2 className="w-3.5 h-3.5" />
                                     </button>
                                )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-white/40 mt-1 leading-tight line-clamp-1">
                                {isLoggedIn ? `ID: ${user?.id?.slice(0, 10)}...` : t('settings.sync.desc', 'Sync your data across devices')}
                            </div>
                        </div>
                        {isLoggedIn && (
                            <Button variant="ghost" size="sm" onClick={logout} className="h-8 px-3 text-xs text-slate-500 hover:text-red-500 bg-slate-100 hover:bg-slate-200 dark:text-white/40 dark:hover:text-red-400 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl">
                                <LogOut className="w-3.5 h-3.5 shrink-0" />
                            </Button>
                        )}
                    </div>

                    {!isLoggedIn ? (
                        <div className="pt-2">
                             <MobileSyncAuthForm />
                        </div>
                    ) : (
                        <div className="space-y-4 pt-2">
                            <MobileBindEmailForm />
                            <div className="pt-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between px-1">
                                <div className="space-y-1">
                                    <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-white/40 tracking-wider">
                                        {t('settings.sync.lastSync', 'Last Sync')}
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-600 dark:text-white/60">
                                        {lastSyncTime > 0 ? new Date(lastSyncTime).toLocaleString() : t('settings.sync.never', 'Never')}
                                    </div>
                                </div>
                                <Button size="sm" onClick={sync} disabled={isSyncing} className="h-9 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-4 shadow-lg shadow-indigo-500/20">
                                    <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isSyncing && "animate-spin")} />
                                    {isSyncing ? t('settings.sync.syncing', 'Syncing...') : t('settings.sync.syncNow', 'Sync Now')}
                                </Button>
                            </div>

                            {/* Debug Log Panel */}
                            {(syncLogs.length > 0 || syncError) && (
                                <div className="mt-3 p-3 bg-slate-900 dark:bg-black/60 rounded-xl border border-slate-700 dark:border-white/10 max-h-48 overflow-y-auto">
                                    <div className="text-[9px] font-mono text-green-400 space-y-0.5">
                                        {syncLogs.map((log, i) => (
                                            <div key={i} className={log.includes('ERROR') || log.includes('FAILED') ? 'text-red-400 font-bold' : log.includes('SUCCESS') ? 'text-green-300 font-bold' : log.includes('WARN') ? 'text-yellow-400' : ''}>
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                    {syncError && (
                                        <div className="mt-2 p-2 bg-red-900/40 rounded-lg border border-red-500/30 text-[10px] text-red-300 font-mono break-all">
                                            ❌ {syncError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </GlassSurface>
            </section>

            {/* Data Share section */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 pl-1 text-slate-500 dark:text-white/50">
                    <Send className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">{t('settings.headers.share', 'Data Share')}</h3>
                </div>
                <GlassSurface className={cn("p-4 rounded-2xl border border-slate-200 bg-white/40 dark:border-white/5 dark:bg-white/[0.02] space-y-5", !isLoggedIn && "opacity-50 pointer-events-none")} borderRadius={16} backgroundOpacity={0.02}>
                    <div className="space-y-1.5 px-1">
                        <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed font-medium">
                            {t('settings.share.generateDesc', 'Generate a one-time code for others to access your data temporarily.')}
                        </p>
                    </div>

                    {!generatedCode ? (
                         <Button className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-slate-900/10 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border dark:border-white/10 dark:shadow-sm" onClick={handleGenerate} disabled={isGenerating}>
                             {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                             {t('settings.share.createCode', 'Create Share Code')}
                         </Button>
                    ) : (
                         <div className="space-y-3 bg-slate-50 dark:bg-black/20 p-3 rounded-2xl border border-slate-200 dark:border-white/5 animate-in slide-in-from-bottom-2 fade-in">
                             <div className="p-4 bg-white dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/10 text-center flex flex-col items-center gap-1.5 shadow-inner">
                                 <div className="text-3xl font-mono font-black tracking-widest text-indigo-600 dark:text-indigo-400 drop-shadow-md">{generatedCode.code}</div>
                                 <div className="text-[10px] text-slate-500 dark:text-white/40 font-mono flex items-center gap-1">
                                     <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                     Expires: {new Date(generatedCode.expiresAt).toLocaleTimeString()}
                                 </div>
                             </div>
                             <div className="flex gap-2">
                                 <Button className="flex-1 h-10 rounded-xl font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" onClick={copyCode}>
                                     <Copy className="w-4 h-4 mr-2" />
                                     {t('settings.share.copy', 'Copy Code')}
                                 </Button>
                                 <Button variant="ghost" className="h-10 px-4 rounded-xl text-slate-500 hover:text-slate-900 bg-slate-200/50 hover:bg-slate-200 dark:text-white/50 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10" onClick={() => setGeneratedCode(null)}>
                                     {t('settings.share.cancel', 'Reset')}
                                 </Button>
                             </div>
                         </div>
                    )}

                    <div className="pt-5 border-t border-slate-200 dark:border-white/5 space-y-3">
                         <div className="space-y-1 px-1">
                             <div className="flex items-center gap-1.5 text-slate-800 dark:text-white/80">
                                 <Download className="w-4 h-4" />
                                 <span className="text-sm font-semibold">{t('settings.share.import', 'Import Data')}</span>
                             </div>
                             <p className="text-[11px] text-slate-500 dark:text-white/40 leading-relaxed">
                                 {t('settings.share.importDesc', 'Enter a 6-digit share code to import data.')}
                             </p>
                         </div>
                         <div className="flex gap-2">
                             <Input 
                                placeholder="000000" 
                                className="font-mono text-center tracking-widest text-lg h-11 bg-slate-100 border-slate-200 text-slate-900 shadow-slate-100 rounded-xl flex-1 dark:bg-black/30 dark:border-white/10 dark:text-white dark:shadow-inner place-content-center" 
                                maxLength={6}
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value)}
                             />
                             <Button className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-slate-900/10 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border dark:border-white/5 dark:shadow-sm" onClick={handleImport} disabled={isImporting || inputCode.length !== 6}>
                                 {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                                 {t('settings.share.startImport', 'Import')}
                             </Button>
                         </div>
                    </div>
                </GlassSurface>
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
                            className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
                                <h3 className="font-bold text-slate-900 dark:text-white">{t('settings.sync.changeUsername', 'Change Username')}</h3>
                                <button className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors" onClick={() => setIsEditingUsername(false)} disabled={isChangingUsername}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <p className="text-sm text-slate-500 dark:text-white/60">
                                    {t('settings.sync.changeUsernameDesc', 'Enter a new username. Note: This will also update the author name on your shared community resources.')}
                                </p>
                                <Input 
                                    className="w-full h-11 bg-slate-50 dark:bg-black/50 border-slate-200 dark:border-white/10 rounded-xl"
                                    placeholder={t('auth.username', 'Username')}
                                    autoFocus
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleChangeUsername()
                                    }}
                                    disabled={isChangingUsername}
                                />
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="ghost" className="h-10 px-4 rounded-xl text-sm font-medium" onClick={() => setIsEditingUsername(false)} disabled={isChangingUsername}>
                                        {t('common.cancel', 'Cancel')}
                                    </Button>
                                    <Button className="h-10 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl text-sm font-medium" onClick={handleChangeUsername} disabled={isChangingUsername || !newUsername.trim()}>
                                        {isChangingUsername ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        {t('common.save', 'Save')}
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
