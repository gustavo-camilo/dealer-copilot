import { AlertTriangle } from 'lucide-react';

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
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900 bg-opacity-50 dark:bg-navy-900 dark:bg-opacity-70 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {message}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-navy-700 rounded-lg hover:bg-gray-200 dark:hover:bg-navy-600 transition"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 dark:bg-blue-700 rounded-lg hover:bg-blue-800 dark:hover:bg-blue-600 transition"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
