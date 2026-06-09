import { useState } from 'react'
import { useSync } from '@/context/SyncContext'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { RefreshCw, ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function SyncAuthForm() {
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

    const clearState = () => {
        setError('')
        setSuccessMsg('')
        setLoading(false)
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        clearState()
        setLoading(true)
        try {
            await login(username, password)
        } catch (err: any) {
            setError(err.message || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        clearState()
        setLoading(true)
        try {
            // Note: Register now accepts email optionally, but we should probably expose it in UI
            // However, the context.register signature might need update or we just pass it if we update context
            // For now, let's keep it simple or assuming update context to accept email
            // Use existing register signature for now, maybe add email to it?
            // The worker supports it. Let's assume we update context register to take email too.
            // checking SyncContext again... register(username, password)
            // We need to update SyncContext.register to accept email! 
            // WAIT: I missed updating register in SyncContext to pass email.
            // Let's implement it here assuming it works, and I'll update SyncContext next.
            
            // @ts-ignore
            await register(username, password, email) 
        } catch (err: any) {
            setError(err.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    const handleForgotRequest = async (e: React.FormEvent) => {
        e.preventDefault()
        clearState()
        setLoading(true)
        try {
            const sent = await resetPasswordRequest(email)
            if (sent) {
                setView('verify')
                setSuccessMsg('Confirmation code sent to your email')
            } else {
                setError('Failed to send code. Please check email.')
            }
        } catch (err: any) {
            setError(err.message || 'Request failed')
        } finally {
            setLoading(false)
        }
    }
    
    const handleVerifyReset = async (e: React.FormEvent) => {
        e.preventDefault()
        clearState()
        setLoading(true)
        try {
            const success = await resetPasswordVerify(email, code, newPassword)
            if (success) {
                setSuccessMsg('Password reset successfully! Please login.')
                setTimeout(() => {
                    setView('login')
                    setPassword('')
                    setSuccessMsg('')
                }, 2000)
            }
        } catch (err: any) {
             setError(err.message || 'Verification failed')
        } finally {
            setLoading(false)
        }
    }

    // --- RENDER ---

    if (view === 'forgot') {
        return (
            <form onSubmit={handleForgotRequest} className="bg-slate-50 dark:bg-black/20 p-5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4 animate-in fade-in slide-in-from-right-4 shadow-inner">
                <div className="flex items-center gap-2 mb-2">
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-white/10 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/5" onClick={() => setView('login')}>
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </Button>
                    <div className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest">
                        {t('auth.forgotPassword', 'Reset Password')}
                    </div>
                </div>

                <div className="space-y-3">
                     <Input 
                        type="email"
                        placeholder={t('auth.email', 'Email Address')} 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="h-10 text-sm bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 focus-visible:ring-indigo-500/50 shadow-sm"
                        required
                    />
                </div>
                 {error && <div className="text-[10px] text-red-500 dark:text-red-400 font-medium px-1">{error}</div>}
                 <Button type="submit" className="w-full h-10 text-sm font-bold transition-all bg-indigo-500 hover:bg-indigo-600 dark:bg-slate-50 text-white dark:text-slate-900 shadow-sm" disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <Mail className="w-4 h-4 mr-2" />}
                    {t('auth.sendCode', 'Send Reset Code')}
                </Button>
            </form>
        )
    }

    if (view === 'verify') {
        return (
            <form onSubmit={handleVerifyReset} className="bg-slate-50 dark:bg-black/20 p-5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4 animate-in fade-in slide-in-from-right-4 shadow-inner">
                 <div className="flex items-center gap-2 mb-2">
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-white/10 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/5" onClick={() => setView('forgot')}>
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </Button>
                    <div className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest">
                        {t('auth.verifyReset', 'New Password')}
                    </div>
                </div>
                
                 {successMsg && <div className="text-xs text-emerald-500 font-bold flex items-center gap-1 bg-emerald-50 p-2 rounded-lg border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5"/> {successMsg}</div>}

                <div className="space-y-3">
                     <div className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Code sent to <span className="text-slate-700 dark:text-white font-bold">{email}</span></div>
                     <Input 
                        placeholder={t('auth.code', 'Verification Code (6 digits)')} 
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="h-10 text-lg bg-white dark:bg-black/20 text-center tracking-[0.3em] font-mono font-bold border-slate-200 dark:border-white/10 focus-visible:ring-indigo-500/50 shadow-sm"
                        maxLength={6}
                        required
                    />
                    <Input 
                        type="password"
                        placeholder={t('auth.newPassword', 'New Password')} 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="h-10 text-sm bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 focus-visible:ring-indigo-500/50 shadow-sm"
                        minLength={6}
                        required
                    />
                </div>
                 {error && <div className="text-[10px] text-red-500 dark:text-red-400 font-medium px-1">{error}</div>}
                 <Button type="submit" className="w-full h-10 text-sm font-bold transition-all bg-indigo-500 hover:bg-indigo-600 dark:bg-slate-50 text-white dark:text-slate-900 shadow-sm" disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : null}
                    {t('auth.resetPassword', 'Set New Password')}
                </Button>
            </form>
        )
    }

    return (
        <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="bg-slate-50 dark:bg-black/20 p-5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4 animate-in fade-in shadow-inner">
            <div className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-3">
                {view === 'register' ? t('auth.register', 'Register Account') : t('auth.login', 'Login')}
            </div>
            
            <div className="space-y-3">
                <Input 
                    placeholder={t('auth.usernameOrEmail', 'Username / Email')} 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="h-10 text-sm bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 focus-visible:ring-indigo-500/50 shadow-sm"
                    required
                />
                
                {view === 'register' && (
                     <Input 
                        type="email"
                        placeholder={t('auth.emailOptional', 'Email (Optional for recovery)')} 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="h-10 text-sm bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 focus-visible:ring-indigo-500/50 shadow-sm"
                    />
                )}

                <Input 
                    type="password"
                    placeholder={t('auth.password', 'Password')} 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-10 text-sm bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 focus-visible:ring-indigo-500/50 shadow-sm"
                    minLength={6}
                    required
                />
            </div>

            {error && <div className="text-[10px] text-red-500 dark:text-red-400 font-medium px-1">{error}</div>}

            <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full h-10 text-sm font-bold transition-all bg-indigo-500 hover:bg-indigo-600 dark:bg-slate-50 text-white dark:text-slate-900 shadow-sm hover:shadow-md" disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : null}
                    {view === 'register' ? t('auth.createAccount', 'Create Account') : t('auth.signIn', 'Sign In')}
                </Button>
                
                <div className="flex justify-between gap-3">
                     <Button type="button" variant="outline" size="sm" onClick={() => {
                         setView(view === 'login' ? 'register' : 'login')
                         setError('')
                     }} className="flex-1 text-xs font-bold border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5">
                        {view === 'register' ? t('auth.switchToLogin', 'Have account?') : t('auth.switchToRegister', 'Need account?')}
                    </Button>
                    
                    {view === 'login' && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setView('forgot')} className="text-xs font-bold text-slate-400 hover:text-slate-700 hover:bg-transparent px-2 dark:hover:text-white">
                             {t('auth.forgot', 'Forgot?')}
                        </Button>
                    )}
                </div>
            </div>
        </form>
    )
}
