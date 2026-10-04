import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui';

interface ConfirmationDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
}

export default function ConfirmationDialog({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Unsaved Changes',
    message = 'You have unsaved changes in the profit calculator. Are you sure you want to leave?',
    confirmLabel = 'Leave & Discard',
    cancelLabel = 'Stay on Page',
}: ConfirmationDialogProps) {
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
                    <motion.div
                        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />
                    <motion.div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="confirm-title"
                        className="relative w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl"
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                    >
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/10 text-warning">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <h3 id="confirm-title" className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
                        <p className="mt-1.5 text-sm text-ink-muted">{message}</p>
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button variant="secondary" onClick={onCancel} autoFocus>
                                {cancelLabel}
                            </Button>
                            <Button variant="inverse" onClick={onConfirm}>
                                {confirmLabel}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
