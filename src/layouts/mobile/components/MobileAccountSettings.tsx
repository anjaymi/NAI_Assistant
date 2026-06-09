import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { Crown, Coins, LogOut, AlertCircle, CheckCircle, User, Loader2 } from 'lucide-react';
import { shallow } from 'zustand/shallow';

export function MobileAccountSettings() {
    const { t } = useTranslation();
    const { token, login, logout, isVerified, tier, anlas, isLoading, error, refreshAnlas } = useAuthStore((state) => ({
        token: state.token,
        login: state.login,
        logout: state.logout,
        isVerified: state.isVerified,
        tier: state.tier,
        anlas: state.anlas,
        isLoading: state.isLoading,
        error: state.error,
        refreshAnlas: state.refreshAnlas,
    }), shallow);
    const [localToken, setLocalToken] = useState(token);

    useEffect(() => {
        if (isVerified) refreshAnlas();
    }, [isVerified, refreshAnlas]);

    useEffect(() => {
        setLocalToken(token);
    }, [token]);

    const handleLogin = async () => {
        await login(localToken);
    };

    const handleLogout = () => {
        logout();
        setLocalToken('');
    };

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2 pl-1 text-slate-500 dark:text-white/50">
                <User className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                    {t('settings.account', 'Account')}
                </h3>
            </div>
            <GlassSurface className="p-4 rounded-2xl border border-slate-200 bg-white/40 dark:border-white/5 dark:bg-white/[0.02]" borderRadius={16} backgroundOpacity={0.02}>
                {isVerified ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-semibold">{t('common.account', 'Account')}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-7 text-xs text-slate-500 hover:text-red-500 bg-slate-100 hover:bg-slate-200 dark:text-white/40 dark:hover:text-red-400 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl px-3">
                                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                                {t('common.logout', 'Logout')}
                            </Button>
                        </div>
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 border border-slate-200 dark:bg-white/5 dark:border-white/10">
                            <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400">
                                <Crown className="w-4 h-4" />
                                <span className="text-sm font-bold capitalize">{tier || t('common.free', 'Free')}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-200 border border-transparent dark:bg-black/40 px-3 py-1.5 rounded-full dark:border-white/5">
                                <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
                                <span className="text-sm font-bold font-mono text-slate-800 dark:text-white/90">{anlas?.total.toLocaleString() ?? 0}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-slate-800 dark:text-white/80">
                                <span className="text-sm font-medium">{t('common.login', 'Login')}</span>
                            </div>
                        </div>
                        <div className="space-y-3 mb-1">
                            <Input 
                                type="password" 
                                placeholder="eyJ..." 
                                value={localToken}
                                onChange={(e) => setLocalToken(e.target.value)}
                                className="font-mono text-xs rounded-xl bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400 dark:bg-black/30 dark:border-white/10 dark:text-white dark:placeholder:text-white/20 h-11"
                            />
                            {error && (
                                <div className="text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1 bg-red-100 dark:bg-red-500/10 p-2 rounded-lg border border-red-200 dark:border-red-500/20">
                                    <AlertCircle className="h-3 w-3 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}
                            <Button 
                                onClick={handleLogin} 
                                disabled={isLoading || !localToken}
                                className="w-full rounded-xl h-11 bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10 dark:bg-white dark:hover:bg-white/90 dark:text-black dark:shadow-white/10 font-semibold"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {t('common.login', 'Login')}
                            </Button>
                        </div>
                    </div>
                )}
            </GlassSurface>
        </section>
    );
}
