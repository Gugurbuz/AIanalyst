import React from 'react';
import { Zap, X } from 'lucide-react';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-md p-6 text-center" onClick={e => e.stopPropagation()}>
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                    <Zap className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                </div>
                <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-slate-100 mt-4">
                    Token Limitinize Ulaştınız
                </h3>
                <div className="mt-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Ücretsiz planınızdaki token kullanım hakkınızı doldurdunuz. Asisty.ai'yi kullanmaya devam etmek için lütfen planınızı yükseltin.
                    </p>
                </div>
                <div className="mt-5 space-y-2">
                    <a
                        href="/#pricing" // Assuming landing page is root and has pricing section
                        onClick={onClose}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                    >
                        Planları Görüntüle
                    </a>
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-transparent text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 sm:mt-0 sm:text-sm"
                        onClick={onClose}
                    >
                        Kapat
                    </button>
                </div>
            </div>
        </div>
    );
};
