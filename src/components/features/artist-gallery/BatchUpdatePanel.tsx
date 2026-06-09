import { useState, useEffect } from 'react';
import { Button } from '@/components/atoms/Button';
// import { Progress } from '@/components/ui/progress';
import { danbooruService } from '@/services/danbooru-service';
import { RefreshCw, Search, StopCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function BatchUpdatePanel() {
    const { t } = useTranslation();
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [total, setTotal] = useState(0);
    const [current, setCurrent] = useState(0);
    const [shouldStop, setShouldStop] = useState(false);

    const handleStart = async () => {
        setIsRunning(true);
        setShouldStop(false);
        setProgress(0);
        setStatus(t('batchUpdate.starting', 'Starting batch update...'));

        try {
            await danbooruService.batchUpdateArtistLinks(
                (curr, tot, stat) => {
                    setCurrent(curr);
                    setTotal(tot);
                    setProgress((curr / tot) * 100);
                    setStatus(stat);
                },
                () => shouldStop
            );
            setStatus(t('batchUpdate.complete', 'Update completed!'));
        } catch (e) {
            console.error(e);
            setStatus(t('batchUpdate.error', 'Update failed.'));
        } finally {
            setIsRunning(false);
        }
    };

    const handleStop = () => {
        setShouldStop(true);
        setStatus(t('batchUpdate.stopping', 'Stopping...'));
    };

    return (
        <div className="p-4 rounded-lg bg-zinc-900/50 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Search className="w-4 h-4 text-indigo-400" />
                    {t('batchUpdate.title', 'Auto-Link Local Artists')}
                </h3>
                {!isRunning ? (
                    <Button size="sm" onClick={handleStart} variant="outline" className="h-8">
                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                        {t('batchUpdate.start', 'Start Scan')}
                    </Button>
                ) : (
                    <Button size="sm" onClick={handleStop} variant="destructive" className="h-8">
                        <StopCircle className="w-3.5 h-3.5 mr-2" />
                        {t('batchUpdate.stop', 'Stop')}
                    </Button>
                )}
            </div>

            <p className="text-xs text-zinc-400">
                {t('batchUpdate.description', 'Scan local artists without links and fetch previews from Danbooru to reduce storage size.')}
            </p>

            {isRunning || progress > 0 ? (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span>{status}</span>
                        <span>{current} / {total}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
