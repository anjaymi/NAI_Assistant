import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, CloudLightning, Zap, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadToImageHost, sendPushSignalToWorker, uploadToLanHost } from '@/services/cloud-push-service';
import { useSettingsStore } from '@/stores/settings-store';
import { useNetworkHealth } from '@/hooks/use-network-health';

interface MobileSyncButtonProps {
    /** 当前生成的图片源（支持 data URL 或文件 URL） */
    imageSrc: string;
    /** 建议的文件名 */
    filename?: string;
    /** 生成参数元数据 */
    metadata?: Record<string, unknown>;
    /** 额外样式 */
    className?: string;
}

/**
 * 手机端推送按钮 — 将单张图片一键飞弹 (Airdrop) 到 PC 端。
 * 
 * 智能通道选择：
 * - ⚡ LAN 可用时：Rust reqwest 直传（毫秒级，零压缩）
 * - ☁️ LAN 不可用：Catbox 图床 + Cloud Relay 信令
 */
export function MobileSyncButton({
    imageSrc,
    filename,
    metadata,
    className
}: MobileSyncButtonProps) {
    const cloudSyncToken = useSettingsStore((s) => s.cloudSyncToken);
    const lanPcIp = useSettingsStore((s) => s.lanPcIp);
    const { lanReady } = useNetworkHealth(cloudSyncToken);
    
    // 状态流转: idle -> uploading -> signaling -> sent
    const [status, setStatus] = useState<'idle' | 'uploading' | 'signaling' | 'sent'>('idle');
    const [progress, setProgress] = useState(0);
    // 记录本次传输使用的通道
    const [usedChannel, setUsedChannel] = useState<'lan' | 'cloud' | null>(null);

    // 没有设置秘钥就不展示推送按钮
    if (!cloudSyncToken) return null;

    const handleSync = async () => {
        if (status !== 'idle') return;
        setStatus('uploading');
        setProgress(0);

        try {
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            const finalFilename = filename || `nai_airdrop_${Date.now()}.png`;

            // ⚡ 智能通道选择：LAN 优先
            if (lanReady && lanPcIp) {
                // === LAN 直传通道 ===
                setUsedChannel('lan');
                setProgress(50); // LAN 传输太快，直接跳到 50%
                
                const success = await uploadToLanHost(lanPcIp, blob, finalFilename);
                
                if (success) {
                    setProgress(100);
                    setStatus('sent');
                    setTimeout(() => { setStatus('idle'); setUsedChannel(null); }, 3000);
                    return;
                }
                
                // LAN 失败，回退到 Cloud 通道
                console.warn('[Airdrop] LAN transfer failed, falling back to Cloud');
            }

            // === Cloud 中继通道（Fallback 或 LAN 不可用）===
            setUsedChannel('cloud');
            
            // 1. 直传 Catbox
            const url = await uploadToImageHost(blob, finalFilename, (p) => {
                setProgress(p);
            });

            // 2. 将链接推给 Worker 信令服务器
            setStatus('signaling');
            await sendPushSignalToWorker(cloudSyncToken, [url], metadata);

            // 3. 完成
            setStatus('sent');
            setTimeout(() => { setStatus('idle'); setUsedChannel(null); }, 3000);
        } catch (error) {
            console.error('[CloudPush] Push failed:', error);
            setStatus('idle');
            setUsedChannel(null);
        } finally {
            setProgress(0);
        }
    };

    const isSending = status === 'uploading' || status === 'signaling';
    const isSent = status === 'sent';

    // 通道指示文案
    const channelLabel = (() => {
        if (status === 'uploading') {
            return usedChannel === 'lan' 
                ? `⚡ LAN 直传中...` 
                : `投递中 ${progress}%`;
        }
        if (status === 'signaling') return '信令交互...';
        if (isSent) {
            return usedChannel === 'lan' ? '⚡ LAN 已送达' : 'Airdrop 完成';
        }
        // idle 状态 — 显示将使用的通道
        return lanReady ? '⚡ LAN Airdrop' : 'Airdrop 推送';
    })();

    // 通道图标
    const ChannelIcon = (() => {
        if (isSending) return Loader2;
        if (isSent) return Check;
        return lanReady ? Zap : CloudLightning;
    })();

    return (
        <AnimatePresence>
            <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleSync}
                disabled={isSending}
                className={cn(
                    "relative overflow-hidden flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold tracking-wide",
                    "transition-all duration-300 shadow-ios backdrop-blur-xl",
                    isSent
                        ? usedChannel === 'lan'
                            ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]"
                            : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]"
                        : lanReady
                            ? "bg-white/70 dark:bg-zinc-800/70 py-[7px] text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 dark:border-cyan-500/10 hover:bg-white/90 dark:hover:bg-zinc-700/90 active:bg-cyan-50 dark:active:bg-cyan-900/40"
                            : "bg-white/70 dark:bg-zinc-800/70 py-[7px] text-fuchsia-600 dark:text-fuchsia-400 border border-white/20 dark:border-white/10 hover:bg-white/90 dark:hover:bg-zinc-700/90 active:bg-fuchsia-50 dark:active:bg-fuchsia-900/40",
                    isSending && "cursor-wait opacity-90",
                    className
                )}
            >
                {/* 进度条背景填充 (Glass Style) */}
                {status === 'uploading' && (
                    <div 
                        className={cn(
                            "absolute inset-0 transition-transform duration-300 ease-out origin-left",
                            usedChannel === 'lan' 
                                ? "bg-cyan-500/15 dark:bg-cyan-500/25"
                                : "bg-fuchsia-500/15 dark:bg-fuchsia-500/25"
                        )}
                        style={{ transform: `scaleX(${progress / 100})` }}
                    />
                )}
                
                {/* 脉冲跑马灯效果 (信令阶段) */}
                {status === 'signaling' && (
                   <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                       <div className="w-full h-full bg-gradient-to-r from-transparent via-fuchsia-500/20 dark:via-fuchsia-400/30 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                   </div>
                )}
                
                <div className="relative z-10 flex items-center gap-1.5">
                    <ChannelIcon className={cn(
                        "w-3.5 h-3.5",
                        isSending && "animate-spin",
                        !isSending && !isSent && lanReady && "text-cyan-500 dark:text-cyan-400"
                    )} />
                    <span>{channelLabel}</span>
                </div>
                
                {/* 悬浮反光效果 */}
                {!isSent && !isSending && (
                   <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/0 via-white/40 dark:via-white/10 to-white/0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                )}
            </motion.button>
        </AnimatePresence>
    );
}
