import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { FormField } from '@/components/molecules/FormField'
import { AlertCircle, Coins, Crown, CheckCircle2, Settings2 } from 'lucide-react'
import { shallow } from 'zustand/shallow'

interface LoginPanelProps {
    onOpenSettings?: () => void
}

export function LoginPanel({ onOpenSettings }: LoginPanelProps) {
    const { 
        token, login, logout, refreshAnlas,
        isVerified, tier, anlas, isLoading, error 
    } = useAuthStore((state) => ({
        token: state.token,
        login: state.login,
        logout: state.logout,
        refreshAnlas: state.refreshAnlas,
        isVerified: state.isVerified,
        tier: state.tier,
        anlas: state.anlas,
        isLoading: state.isLoading,
        error: state.error,
    }), shallow)
    const { t } = useTranslation()
    
    // Auto-refresh Anlas on mount if verified
    useEffect(() => {
        if (isVerified) {
            refreshAnlas() // Fire and forget
        }
    }, [isVerified, refreshAnlas])

    // Local state for input to avoid store trashing on every keystroke if desired, 
    // but store syncing is fine for now. 
    // Actually, let's use local state for the input field to prevent aggressive validation 
    // or just bind directly to store if we want persistence.
    // Let's bind directly to store since it's persisted.
    const [localToken, setLocalToken] = useState(token)

    // Sync local token with store token on mount/change
    useEffect(() => {
        setLocalToken(token)
    }, [token])

    const handleLogin = async () => {
        await login(localToken)
    }

    const handleLogout = () => {
        logout()
        setLocalToken('')
    }

    return (
        <div className="p-5 space-y-5 border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/40 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-[2rem] mx-2 mt-2">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold tracking-tight flex items-center gap-2">
                    <UserStatusIcon isVerified={isVerified} />
                    {t('common.account')}
                </h3>
                {isVerified && (
                    <div className="flex items-center gap-1">
                        {onOpenSettings && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={onOpenSettings} 
                                className="h-8 w-8 p-0 text-slate-500 dark:text-white/70 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-xl"
                                title={t('common.settings')}
                            >
                                <Settings2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 text-xs text-slate-400 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl">
                            {t('common.logout')}
                        </Button>
                    </div>
                )}
            </div>

            {!isVerified ? (
                <div className="space-y-3">
                    <FormField label={t('common.token')}>
                        <Input 
                            type="password" 
                            placeholder="eyJ..." 
                            value={localToken}
                            onChange={(e) => setLocalToken(e.target.value)}
                            className="font-mono text-xs rounded-xl"
                        />
                    </FormField>
                    {error && (
                        <div className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {error}
                        </div>
                    )}
                    <Button 
                        onClick={handleLogin} 
                        disabled={isLoading || !localToken}
                        className="w-full rounded-xl bg-white text-black hover:bg-white/90 shadow-[0_2px_10px_rgba(255,255,255,0.2)]"
                    >
                        {isLoading ? t('common.verifying') : t('common.login')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Tier Info */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium capitalize">{tier || t('common.free')}</span>
                        </div>
                         {/* Anlas Info */}
                        <div className="flex items-center gap-1.5">
                            <Coins className="h-3.5 w-3.5 text-primary" />
                            <span className="text-sm font-bold font-mono">
                                {anlas?.total.toLocaleString() ?? 0}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function UserStatusIcon({ isVerified }: { isVerified: boolean }) {
    if (isVerified) return <CheckCircle2 className="h-4 w-4 text-green-500" />
    return <AlertCircle className="h-4 w-4 text-muted-foreground" />
}
