// components/RequestConfirmationModal.tsx
import React from 'react';
import { Bot, Check, X } from 'lucide-react';

interface RequestConfirmationModalProps {
    isOpen: boolean;
    summary: string;
    onConfirm: () => void;
    onReject: () => void;
    onClose: () => void;
}

export const RequestConfirmationModal: React.FC<RequestConfirmationModalProps> = ({ isOpen, summary, onConfirm, onReject, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-70 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }} onClick={onClose}>
            <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-2xl flex flex-col p-6" 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Bot className="h-6 w-6 text-indigo-500" />
                        Talep Onayı
                    </h2>
                     <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </button>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-4">AI, talebinizi aşağıdaki gibi özetledi. Bu özeti projenin başlangıç 'Talep' dokümanı olarak kaydedelim mi?</p>
                
                <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-md border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto mb-6">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{summary}</p>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onReject}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition flex items-center gap-2"
                    >
                        <X className="h-5 w-5" />
                        Hayır, Tekrar Sor
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition flex items-center gap-2"
                    >
                         <Check className="h-5 w-5" />
                        Evet, Onayla ve Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
};
