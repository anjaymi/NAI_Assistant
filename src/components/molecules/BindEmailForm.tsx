import { useState } from 'react'
import { useSync } from '@/context/SyncContext'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { RefreshCw, Mail, CheckCircle, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function BindEmailForm() {
    const { user, bindEmailRequest, bindEmailVerify } = useSync()
    const { t } = useTranslation()
    
    const [isExpanded, setIsExpanded] = useState(false)
    const [step, setStep] = useState<'input' | 'verify'>('input')
    
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    // context user might not update immediately or might not have email if not refreshed
    // but bindEmailVerify updates it locally
    const isBound = !!user?.email

    if (isBound) {
        return (
             <div className="flex items-center gap-2 text-xs text-muted-foreground bg-green-500/10 p-2 rounded border border-green-500/20">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>{t('auth.emailBound', 'Email linked')}: {user.email}</span>
            </div>
        )
    }

    if (!isExpanded) {
         return (
            <Button variant="outline" size="sm" onClick={() => setIsExpanded(true)} className="w-full text-xs h-9 border-dashed border-slate-300 dark:border-white/20 hover:border-slate-400 dark:hover:border-white/40 text-slate-600 dark:text-white bg-slate-50 dark:bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 shadow-none transition-all">
                <Mail className="w-3.5 h-3.5 mr-2" />
                {t('auth.bindEmail', 'Bind Email for Recovery')}
            </Button>
        )
    }

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const sent = await bindEmailRequest(email)
            if (sent) {
                setStep('verify')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to send code')
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const ok = await bindEmailVerify(code)
            if (ok) {
                setSuccess(true)
                setTimeout(() => setIsExpanded(false), 2000)
            }
        } catch (err: any) {
            setError(err.message || 'Verification failed')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
         return (
            <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 p-3 rounded border border-green-500/20 animate-in fade-in">
                <CheckCircle className="w-4 h-4" />
                <span>{t('auth.bindSuccess', 'Email bound successfully!')}</span>
            </div>
        )
    }

    return (
        <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-4 animate-in fade-in zoom-in-95 shadow-inner">
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest">
                    {step === 'input' ? t('auth.bindEmail', 'Bind Email') : t('auth.verifyEmail', 'Verify Email')}
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-white/10 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/5" onClick={() => setIsExpanded(false)}>
                    <span className="sr-only">Close</span>
                    &times;
                </Button>
            </div>

            {step === 'input' ? (
                <form onSubmit={handleSendCode} className="space-y-3">
                    <Input 
                        type="email" 
                        placeholder="name@example.com" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="h-10 text-sm bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 focus-visible:ring-indigo-500/50 shadow-sm"
                        required
                    />
                    {error && <p className="text-[10px] text-red-500 dark:text-red-400 font-medium px-1">{error}</p>}
                    <Button type="submit" size="sm" className="w-full h-9 text-xs font-bold transition-all bg-indigo-500 hover:bg-indigo-600 dark:bg-slate-50 text-white dark:text-slate-900 shadow-sm" disabled={loading}>
                        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                        {t('auth.sendCode', 'Send Code')}
                    </Button>
                </form>
            ) : (
                <form onSubmit={handleVerify} className="space-y-3">
                    <div className="text-xs font-medium text-slate-500 dark:text-muted-foreground">{t('auth.codeSent_to', 'Code sent to')} <span className="text-slate-700 dark:text-white font-bold">{email}</span></div>
                    <Input 
                        placeholder="123456" 
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="h-10 text-lg bg-white dark:bg-black/20 text-center tracking-[0.3em] font-mono font-bold border-slate-200 dark:border-white/10 focus-visible:ring-indigo-500/50 shadow-sm"
                        maxLength={6}
                        required
                    />
                     {error && <p className="text-[10px] text-red-500 dark:text-red-400 font-medium px-1">{error}</p>}
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs font-bold border-slate-200 dark:border-white/10 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => setStep('input')}>
                            {t('common.back', 'Back')}
                        </Button>
                        <Button type="submit" size="sm" className="flex-1 h-9 text-xs font-bold transition-all bg-indigo-500 hover:bg-indigo-600 dark:bg-slate-50 text-white dark:text-slate-900 shadow-sm" disabled={loading}>
                            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                            {t('auth.verify', 'Verify')}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    )
}
