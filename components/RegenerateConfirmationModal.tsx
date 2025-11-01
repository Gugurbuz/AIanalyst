// components/RegenerateConfirmationModal.tsx
import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface RegenerateConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (saveCurrent: boolean) => void;
    documentName: string;
    templateName: string;
}

export const RegenerateConfirmationModal: React.FC<RegenerateConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    documentName,
    templateName,
}) => {
    const [saveCurrent, setSaveCurrent] = useState(true);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(saveCurrent);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-start">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/50 sm:mx-0 sm:h-10 sm:w-10">
                            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-slate-100">
                                {documentName} Yeniden Oluşturulsun mu?
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Seçtiğiniz yeni şablon ('<strong>{templateName}</strong>') ile doküman yeniden oluşturulacaktır. Bu işlem mevcut içeriğin üzerine yazacaktır.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 pl-0 sm:pl-14">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={saveCurrent}
                                onChange={(e) => setSaveCurrent(e.target.checked)}
                                className="h-5 w-5 text-indigo-600 border-slate-300 dark:border-slate-600 rounded focus:ring-indigo-500 bg-slate-100 dark:bg-slate-700 focus:ring-offset-white dark:focus:ring-offset-slate-800"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Mevcut versiyonu arşive kaydet</span>
                        </label>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-8">Kaydedilen versiyonlara dokümanın altındaki "Versiyon Geçmişi" bölümünden erişilebilir.</p>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={handleConfirm}
                    >
                        Yeniden Oluştur
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