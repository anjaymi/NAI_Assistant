import React, { useState } from 'react';
import { MonitorUp, Plus, Minus, SendHorizonal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/atoms/Dialog';
import { Button } from '@/components/atoms/Button';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generation-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useSync } from '@/context/SyncContext';
import { sendGenerateCommandToWorker } from '@/services/cloud-push-service';
import { toast } from '@/hooks/use-toast';

interface MobilePushToPCDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MobilePushToPCDialog({ open, onOpenChange }: MobilePushToPCDialogProps) {
    const [batchCount, setBatchCount] = useState(1);
    const [isPushing, setIsPushing] = useState(false);
    
    const manualToken = useSettingsStore((state) => state.cloudSyncToken);
    const { user } = useSync();
    
    // 优先使用 Supabase 登录 ID（与其他组件对齐），回退到手动 Token
    const cloudSyncToken = user?.id || manualToken || '';

    const handlePush = async () => {
        if (!cloudSyncToken) {
            toast({
                title: "未配置云同步",
                description: "请先在设置中登录 Cloud Sync 或配置 Token",
                variant: "destructive"
            });
            return;
        }

        setIsPushing(true);
        try {
            const genStore = useGenerationStore.getState();
            // Package the entire current config
            const config = {
                prompt: genStore.prompt,
                negativePrompt: genStore.negativePrompt,
                width: genStore.width,
                height: genStore.height,
                steps: genStore.steps,
                cfgScale: genStore.cfgScale,
                cfgRescale: genStore.cfgRescale,
                seed: genStore.seed,
                model: genStore.model,
                sampler: genStore.sampler,
                scheduler: genStore.scheduler,
                smea: genStore.smea,
                smeaDyn: genStore.smeaDyn,
                
                // Advanced/Img2Img params
                sourceImage: genStore.sourceImage,
                strength: genStore.strength,
                noise: genStore.noise,
                
                // The requested batch count
                imageCount: batchCount
            };

            await sendGenerateCommandToWorker(cloudSyncToken, config);
            toast({
                title: "推送成功",
                description: `已成功将参数及 ${batchCount} 次请求推送至 PC 端`
            });
            onOpenChange(false);
        } catch (error: any) {
            toast({
                title: "推送失败",
                description: error.message || String(error),
                variant: "destructive"
            });
        } finally {
            setIsPushing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[90vw] max-w-sm rounded-[32px] p-0 overflow-hidden bg-white/95 dark:bg-black/95 border border-white/20 dark:border-white/10">
                <div className="p-6">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="flex items-center justify-center gap-3 text-2xl font-bold bg-gradient-to-br from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                            <MonitorUp className="w-8 h-8 text-indigo-500" />
                            推送到电脑端 (PC)
                        </DialogTitle>
                        <p className="text-center text-sm text-slate-500 dark:text-white/50 mt-2">
                            让 PC 端接管生图任务，手机仅作图库遥控器。
                        </p>
                    </DialogHeader>

                    <GlassSurface 
                        className="rounded-3xl p-6 mb-8 border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 relative overflow-hidden"
                        brightness={70}
                    >
                        {/* Decorative glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/20 rounded-full blur-[40px] pointer-events-none" />
                        
                        <div className="flex flex-col items-center justify-center gap-4 relative z-10">
                            <span className="text-sm font-semibold text-slate-500 dark:text-white/60 tracking-wider uppercase">
                                生图批次数
                            </span>
                            
                            <div className="flex items-center gap-6">
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setBatchCount(Math.max(1, batchCount - 1))}
                                    className="w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-white/10 shadow-sm border border-slate-200 dark:border-white/5 text-slate-700 dark:text-white active:bg-slate-100 dark:active:bg-white/20 transition-colors"
                                >
                                    <Minus className="w-6 h-6" />
                                </motion.button>

                                <div className="text-5xl font-bold text-slate-800 dark:text-white w-16 text-center tabular-nums">
                                    {batchCount}
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setBatchCount(Math.min(99, batchCount + 1))}
                                    className="w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-white/10 shadow-sm border border-slate-200 dark:border-white/5 text-slate-700 dark:text-white active:bg-slate-100 dark:active:bg-white/20 transition-colors"
                                >
                                    <Plus className="w-6 h-6" />
                                </motion.button>
                            </div>
                        </div>
                    </GlassSurface>

                    <Button
                        variant="premium"
                        className={cn(
                            "w-full h-14 rounded-2xl text-lg font-bold flex items-center justify-center gap-3",
                            "shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]",
                            isPushing && "opacity-70 cursor-wait"
                        )}
                        onClick={handlePush}
                        disabled={isPushing}
                    >
                        {isPushing ? (
                            <>
                                <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                                发送协议中...
                            </>
                        ) : (
                            <>
                                <SendHorizonal className="w-5 h-5 ml-1" />
                                确认发射
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
