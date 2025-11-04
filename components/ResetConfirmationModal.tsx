// components/ResetConfirmationModal.tsx
import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ResetConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    documentName: string;
    impactedDocs: string[];
}

export const ResetConfirmationModal: React.FC<ResetConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    documentName,
    impactedDocs,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-start">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-slate-100">
                                Bağımlı Dokümanlar Sıfırlansın mı?
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    '<strong>{documentName}</strong>' dokümanında yaptığınız değişiklik, ondan türetilen diğer dokümanları geçersiz kıldı.
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                                    Devam ederseniz, aşağıdaki dokümanların içeriği kalıcı olarak <strong>silinecektir</strong>:
                                </p>
                                <ul className="list-disc list-inside mt-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 p-3 rounded-md">
                                    {impactedDocs.map(doc => <li key={doc}>{doc}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={onConfirm}
                    >
                        Evet, Sıfırla
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        İptal
                    </button>
                </div>
            </div>
        </div>
    );
};
