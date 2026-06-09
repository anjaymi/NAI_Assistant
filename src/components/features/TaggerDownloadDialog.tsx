import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Button } from '@/components/atoms/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/atoms/Dialog';
import { Download, Wifi, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settings-store';

interface TaggerDownloadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUseOnline: () => void;
    onDownloadComplete: () => void;
}

interface DownloadProgress {
    downloaded: number;
    total: number;
    progress: number;
    speed?: number;
    eta?: number;
}

type DownloadState = 'idle' | 'downloading' | 'complete' | 'error';

export function TaggerDownloadDialog({ 
    open, 
    onOpenChange, 
    onUseOnline,
    onDownloadComplete 
}: TaggerDownloadDialogProps) {
    const { t } = useTranslation();
    const { setTaggerDownloaded, setTaggerMode } = useSettingsStore();
    
    const [state, setState] = useState<DownloadState>('idle');
    const [progress, setProgress] = useState<DownloadProgress>({ downloaded: 0, total: 0, progress: 0 });
    const [error, setError] = useState<string>('');

    // Listen for download progress events
    useEffect(() => {
        if (typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__) return; // bypass if not in Tauri

        const unlisten = listen<DownloadProgress>('tagger-download-progress', (event) => {
            setProgress(event.payload);
        });

        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

    const handleDownload = async () => {
        setState('downloading');
        setError('');
        setProgress({ downloaded: 0, total: 0, progress: 0 });

        try {
            if (typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__) {
                throw new Error("Not running in Tauri environment. Please use the Desktop app to download local models.");
            }

            await invoke('download_tagger');
            setState('complete');
            setTaggerDownloaded(true);
            
            // Auto-start the tagger after download
            try {
                await invoke('start_local_tagger');
            } catch (e) {
                console.warn('Failed to auto-start tagger:', e);
            }
            
            setTimeout(() => {
                onDownloadComplete();
                onOpenChange(false);
            }, 1500);
        } catch (e) {
            console.error('Download failed:', e);
            setState('error');
            setError(String(e));
        }
    };

    const handleUseOnline = () => {
        setTaggerMode('online');
        onUseOnline();
        onOpenChange(false);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatSpeed = (bytes: number | undefined) => {
        if (!bytes) return '';
        return formatSize(bytes) + '/s';
    };

    const formatTime = (seconds: number | undefined) => {
        if (!seconds) return '';
        if (seconds < 60) return `${Math.ceil(seconds)}s`;
        return `${Math.ceil(seconds / 60)}m`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        {t('tagger.downloadTitle', 'Download Local Tagger')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('tagger.downloadDesc', 'Local mode requires downloading the WD14 Tagger (~170MB). This provides faster tagging without internet.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {state === 'idle' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                                <span className="text-sm font-medium">tagger-server.exe</span>
                                <span className="text-xs text-muted-foreground">~170 MB</span>
                            </div>
                        </div>
                    )}

                    {state === 'downloading' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{t('tagger.downloading', 'Downloading...')}</span>
                            </div>
                            {/* Custom progress bar */}
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-300 rounded-full"
                                    style={{ width: `${progress.progress}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{formatSize(progress.downloaded)} / {formatSize(progress.total)}</span>
                                <div className="flex gap-3">
                                    {progress.speed ? <span>{formatSpeed(progress.speed)}</span> : null}
                                    {progress.eta ? <span>{formatTime(progress.eta)} remaining</span> : null}
                                </div>
                            </div>
                        </div>
                    )}

                    {state === 'complete' && (
                        <div className="flex items-center gap-2 text-green-500">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">{t('tagger.downloadComplete', 'Download complete!')}</span>
                        </div>
                    )}

                    {state === 'error' && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">{t('tagger.downloadError', 'Download failed')}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{error}</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex gap-2 sm:gap-2">
                    {state === 'idle' && (
                        <>
                            <Button 
                                variant="outline" 
                                onClick={handleUseOnline}
                                className="flex-1 gap-2"
                            >
                                <Wifi className="h-4 w-4" />
                                {t('tagger.useOnline', 'Use Online Instead')}
                            </Button>
                            <Button 
                                onClick={handleDownload}
                                className="flex-1 gap-2"
                            >
                                <Download className="h-4 w-4" />
                                {t('tagger.startDownload', 'Download')}
                            </Button>
                        </>
                    )}

                    {state === 'downloading' && (
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled>
                            {t('common.cancel', 'Cancel')}
                        </Button>
                    )}

                    {state === 'error' && (
                        <>
                            <Button variant="outline" onClick={handleUseOnline}>
                                {t('tagger.useOnline', 'Use Online Instead')}
                            </Button>
                            <Button onClick={handleDownload}>
                                {t('common.retry', 'Retry')}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
