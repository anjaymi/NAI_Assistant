import { useSettingsStore } from '@/stores/settings-store';
import { useSync } from '@/context/SyncContext';
import { Cloud, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/atoms/Tooltip';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { copyFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { useGalleryStore } from '@/stores/gallery-store';
import { toast } from '@/hooks/use-toast';
import { registerLanPcIp } from '@/services/cloud-push-service';
import { LanPairingQRDialog } from './LanPairingQRDialog';
import { useSyncFlowStore } from '@/stores/sync-flow-store';

export function PCSyncIndicator() {
    const manualToken = useSettingsStore((state) => state.cloudSyncToken);
    const savePath = useSettingsStore((state) => state.savePath);
    const { user } = useSync();
    // 优先使用 Supabase 登录 ID（与移动端对齐），回退到手动输入的 Token
    const cloudSyncToken = user?.id || manualToken || '';
    const refreshGallery = useGalleryStore(state => state.refreshGallery);
    const relayState = useSyncFlowStore((state) => state.relayState);
    const currentTask = useSyncFlowStore((state) => state.currentTask);

    // LAN Anchor Status
    const [localIp, setLocalIp] = useState<string>('');
    const [lanPingActive, setLanPingActive] = useState(false);
    const [showQRDialog, setShowQRDialog] = useState(false);

    useEffect(() => {
        let isMounted = true;

        invoke<string>('get_local_ip')
            .then((ip) => {
                if (isMounted) {
                    setLocalIp(ip);
                }
            })
            .catch(console.error);

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!cloudSyncToken) return;

        const registerIp = () => {
            if (cloudSyncToken && localIp) {
                registerLanPcIp(cloudSyncToken, localIp).catch(err => console.debug("Auto IP Registration skipped: ", err));
            }
        };

        if (!localIp) return;

        registerIp();
        const ipRegisterInterval = window.setInterval(registerIp, 300000);

        return () => {
            window.clearInterval(ipRegisterInterval);
        };
    }, [cloudSyncToken, localIp]);

    useEffect(() => {
        let lanAnchorTimeout: number | null = null;

        // Listen for Mobile Ping (Anchor Event)
        const unlistenPing = listen('lan_ping_received', () => {
            setLanPingActive(true);
            if (lanAnchorTimeout !== null) {
                window.clearTimeout(lanAnchorTimeout);
            }
            lanAnchorTimeout = window.setTimeout(() => setLanPingActive(false), 8000);
        });

        return () => {
            if (lanAnchorTimeout !== null) {
                window.clearTimeout(lanAnchorTimeout);
            }
            unlistenPing.then(f => f());
        };
    }, []);

    useEffect(() => {
        // Listen for LAN Airdrop Event
        const unlisten = listen<{ temp_path: string, filename: string }>('lan_airdrop_received', async (event) => {
            try {
                const { temp_path, filename } = event.payload;
                
                // Determine destination directory (Airdrop Sync Folder)
                // Use the savePath setting if available, otherwise fallback to appDataDir/airdrop
                let destDir = '';
                if (savePath) {
                    destDir = await join(savePath, 'airdrop');
                } else {
                    destDir = await join(await appDataDir(), 'airdrop');
                }
                
                // Ensure directory exists
                const dirExists = await exists(destDir);
                if (!dirExists) {
                    await mkdir(destDir, { recursive: true });
                }

                const finalPath = await join(destDir, filename);
                await copyFile(temp_path, finalPath);
                
                // Refresh PC Gallery seamlessly
                refreshGallery();
                toast({ title: "LAN 收件", description: `已通过局域网接收 ${filename}` });
            } catch (err: any) {
                console.error("Failed to process LAN airdrop file:", err);
                toast({ title: "收取失败", description: err.message, variant: "destructive" });
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [savePath, refreshGallery]);

    return (
        <AnimatePresence>
            {cloudSyncToken && (
                <motion.div
                    key="pc-sync-status"
                    initial={{ opacity: 0, scale: 0.8, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 20 }}
                    transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                    className="flex items-center gap-2"
                >
                    {/* LAN Indicator (Anchor) */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div 
                                    onClick={() => localIp && setShowQRDialog(true)}
                                    className={cn(
                                    "flex items-center space-x-1.5 px-2 py-1.5 rounded-xl border backdrop-blur-md transition-all duration-300",
                                    lanPingActive 
                                        ? "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                                        : "bg-slate-100/50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700/50 text-slate-400 dark:text-zinc-500",
                                    localIp ? "cursor-pointer hover:brightness-110" : "cursor-default"
                                )}>
                                    <div className="relative flex items-center justify-center">
                                        <Smartphone className="w-3.5 h-3.5" />
                                        <AnimatePresence>
                                            {lanPingActive && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.5 }}
                                                    animate={{ opacity: 1, scale: 1.5 }}
                                                    exit={{ opacity: 0, scale: 2 }}
                                                    transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                                                    className="absolute -top-0.5 -right-0.5"
                                                >
                                                    <span className="flex h-1.5 w-1.5 relative">
                                                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    </span>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {!lanPingActive && localIp && (
                                            <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                                                <span className="relative inline-flex rounded-full h-1 w-1 m-[1px] bg-emerald-500/40"></span>
                                            </span>
                                        )}
                                    </div>
                                    {lanPingActive && (
                                        <span className="text-[10px] font-bold tracking-wider hidden sm:inline-block pr-1">
                                            ANCHORED
                                        </span>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="font-semibold">{lanPingActive ? "手机端已连接局域网" : "点击显示配对码"}</p>
                                <p className="text-slate-500 text-[10px] mt-0.5">高速图片直输通道 (P2P)</p>
                                {localIp && (
                                    <div className="mt-2 text-xs font-mono bg-black/5 dark:bg-white/5 py-0.5 px-1.5 rounded text-slate-600 dark:text-slate-300">
                                        {localIp}:38080
                                    </div>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Cloud Indicator */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={cn(
                                    "flex items-center space-x-2 px-3 py-1.5 rounded-2xl border backdrop-blur-md transition-colors",
                                    relayState === 'error'
                                        ? "bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/25 dark:border-rose-500/35"
                                        : relayState === 'busy'
                                            ? "bg-indigo-500/12 dark:bg-indigo-500/22 border-indigo-500/25 dark:border-indigo-500/35"
                                            : "bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20 dark:border-indigo-500/30",
                                    "shadow-sm dark:shadow-inner cursor-default"
                                )}>
                                    <div className="relative flex items-center justify-center">
                                        <Cloud className={cn(
                                            "w-4 h-4",
                                            relayState === 'error' ? "text-rose-600 dark:text-rose-400" : "text-indigo-600 dark:text-indigo-400"
                                        )} />
                                        <AnimatePresence>
                                            {relayState === 'busy' && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.5 }}
                                                    animate={{ opacity: 1, scale: 1.5 }}
                                                    exit={{ opacity: 0, scale: 2 }}
                                                    transition={{ duration: 0.8 }}
                                                    className="absolute -top-0.5 -right-0.5"
                                                >
                                                    <span className="flex h-2 w-2 relative">
                                                        <span className={cn(
                                                            "absolute inline-flex h-full w-full rounded-full opacity-75",
                                                            "bg-indigo-400"
                                                        )}></span>
                                                    </span>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {relayState !== 'busy' && (
                                            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                                <span className={cn(
                                                    "relative inline-flex rounded-full h-2 w-2 border border-white dark:border-zinc-800",
                                                    relayState === 'error' ? "bg-rose-500" : "bg-indigo-500"
                                                )}></span>
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-xs font-medium hidden sm:inline-block max-w-[132px] truncate",
                                        relayState === 'error' ? "text-rose-700 dark:text-rose-300" : "text-indigo-700 dark:text-indigo-300"
                                    )}>
                                        {relayState === 'busy' ? '正在同步' : relayState === 'error' ? '同步异常' : 'Airdrop 就绪'}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{relayState === 'busy' ? 'Cloud Relay 正在处理任务' : relayState === 'error' ? 'Cloud Relay 当前拉取异常' : 'Cloud Airdrop 设备侦听中'}</p>
                                <p className="text-slate-500 text-[10px] mt-0.5">基于中继信令的广域网传输</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <AnimatePresence mode="wait">
                        {currentTask && (
                            <motion.div
                                key={currentTask.id + currentTask.updatedAt}
                                initial={{ opacity: 0, x: 14, scale: 0.96 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 10, scale: 0.98 }}
                                transition={{ duration: 0.24, ease: 'easeOut' }}
                                className={cn(
                                    "hidden xl:flex min-w-[220px] max-w-[320px] items-center gap-3 rounded-2xl border px-3 py-2 backdrop-blur-xl shadow-sm",
                                    currentTask.tone === 'success'
                                        ? "border-emerald-500/20 bg-emerald-500/10 dark:border-emerald-500/30 dark:bg-emerald-500/12"
                                        : currentTask.tone === 'error'
                                            ? "border-rose-500/20 bg-rose-500/10 dark:border-rose-500/30 dark:bg-rose-500/12"
                                            : "border-slate-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5"
                                )}
                            >
                                <div className={cn(
                                    "h-2.5 w-2.5 rounded-full shrink-0",
                                    currentTask.tone === 'success'
                                        ? "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.35)]"
                                        : currentTask.tone === 'error'
                                            ? "bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.32)]"
                                            : "bg-indigo-500 shadow-[0_0_14px_rgba(99,102,241,0.35)]"
                                )} />
                                <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-semibold tracking-wide text-slate-700 dark:text-white/85 truncate">
                                        {currentTask.title}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-white/55 truncate">
                                        {currentTask.detail}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* QR 配对弹窗 */}
            <LanPairingQRDialog 
                key="lan-pairing-qr"
                open={showQRDialog} 
                onOpenChange={setShowQRDialog} 
                localIp={localIp} 
            />
        </AnimatePresence>
    );
}

