
import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/atoms/Dialog';
import { Button } from '@/components/atoms/Button';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    artistName?: string;
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
    open,
    onOpenChange,
    onConfirm,
    artistName
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-red-200 dark:border-red-900/30">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-5 w-5" />
                        <span>删除确认</span>
                    </DialogTitle>
                    <DialogDescription className="pt-2 text-slate-600 dark:text-slate-300">
                        您确定要删除画师 <span className="font-bold text-slate-900 dark:text-white">{artistName}</span> 吗？
                        <br />
                        此操作将从数据库中移除该画师，操作无法撤销。
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 mt-4">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        取消
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            onConfirm();
                            onOpenChange(false);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        确认删除
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
