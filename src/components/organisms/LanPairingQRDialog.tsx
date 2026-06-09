import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/atoms/Dialog';
import { QrCode, Smartphone, ArrowRight, Monitor } from 'lucide-react';
import { motion } from 'framer-motion';

interface LanPairingQRDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    localIp: string;
    port?: number;
}

/**
 * PC 端局域网配对码弹窗
 * 
 * 包含 QR 码 + 文字配对码，手机端扫码或手动输入即可建立 LAN 直连。
 * QR 内容格式: nais://pair?ip=192.168.x.x&port=38080
 */
export function LanPairingQRDialog({ 
    open, 
    onOpenChange, 
    localIp, 
    port = 38080 
}: LanPairingQRDialogProps) {
    const pairingUrl = `nais://pair?ip=${localIp}&port=${port}`;
    
    // 4 位短码 = IP 最后一段，方便手动输入
    const shortCode = localIp.split('.').pop() || '???';
    const fullAddress = `${localIp}:${port}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[420px] max-w-[90vw] rounded-3xl p-0 overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl border border-slate-200/50 dark:border-white/10 shadow-2xl">
                <div className="p-8">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="flex items-center justify-center gap-3 text-xl font-bold text-slate-800 dark:text-white">
                            <QrCode className="w-6 h-6 text-cyan-500" />
                            局域网配对
                        </DialogTitle>
                    </DialogHeader>

                    {/* 设备连线示意 */}
                    <div className="flex items-center justify-center gap-3 mb-6 text-slate-400 dark:text-white/30">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                            <Smartphone className="w-4 h-4" />
                            <span>手机</span>
                        </div>
                        <motion.div
                            animate={{ x: [0, 4, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        >
                            <ArrowRight className="w-4 h-4 text-cyan-500" />
                        </motion.div>
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                            <Monitor className="w-4 h-4" />
                            <span>此电脑</span>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="flex justify-center mb-6">
                        <div className="p-5 bg-white rounded-2xl shadow-inner border border-slate-100 dark:border-slate-700">
                            <QRCodeSVG 
                                value={pairingUrl}
                                size={180}
                                level="M"
                                bgColor="transparent"
                                fgColor="#0f172a"
                            />
                        </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">
                            或手动输入
                        </span>
                        <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                    </div>

                    {/* 手动配对码 */}
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <span className="font-mono text-lg font-bold text-slate-800 dark:text-white tracking-widest select-all">
                                {fullAddress}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-white/40">
                            在手机端 设置 → Airdrop 局域网直连 → 手动输入 PC IP
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
