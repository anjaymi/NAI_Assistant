import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/atoms/Dialog';
import SyncSettingsPanel from "@/components/organisms/SyncSettingsPanel";
import { BatchUpdatePanel } from './BatchUpdatePanel';
import { useTranslation } from "react-i18next";

interface SyncStatusDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SyncStatusDialog({ open, onOpenChange }: SyncStatusDialogProps) {
    const { t } = useTranslation();
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-[#0a0a0a] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>{t('settings.headers.cloudSyncShare', 'Cloud Sync & Share')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('settings.syncDesc', 'Manage cloud synchronization and sharing settings')}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-2 space-y-6">
                    <SyncSettingsPanel />
                    
                    <div className="border-t border-white/10 pt-4">
                        <BatchUpdatePanel />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
