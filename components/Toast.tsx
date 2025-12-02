
import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Toast as ToastType } from '../contexts/UIContext';

interface ToastProps {
    toast: ToastType;
    onClose: (id: string) => void;
}

const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
};

const styles = {
    success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
};

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
    return (
        <div 
            className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border animate-fade-in-up w-full max-w-sm pointer-events-auto ${styles[toast.type]}`}
            role="alert"
        >
            <div className="flex-shrink-0 mt-0.5">
                {icons[toast.type]}
            </div>
            <div className="flex-1 text-sm font-medium">
                {toast.message}
            </div>
            <button 
                onClick={() => onClose(toast.id)} 
                className="flex-shrink-0 ml-4 inline-flex text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
            >
                <span className="sr-only">Kapat</span>
                <X className="h-4 w-4" />
            </button>
        </div>
    );
};
