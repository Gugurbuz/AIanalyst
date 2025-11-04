
// components/LongTextModal.tsx
import React from 'react';
import { Sparkles, FileText, X } from 'lucide-react';

interface LongTextModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectChoice: (choice: 'analyze' | 'save') => void;
}

export const LongTextModal: React.FC<LongTextModalProps> = ({ isOpen, onClose, onSelectChoice }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-70 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }} onClick={onClose}>
            <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-3xl flex flex-col p-6" 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Uzun Metin Algılandı</h2>
                     <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </button>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-6">Yapıştırdığınız uzun metinle ne yapmak istersiniz?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={() => onSelectChoice('analyze')}
                        className="p-6 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-left hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 p-3 rounded-lg">
                               <Sparkles className="h-7 w-7" />
                            </div>
                             <div>
                                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">Yeni Talep Olarak Analiz Et</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Metni AI'a göndererek analiz sürecini interaktif olarak başlatın. AI, metni anlamak ve olgunlaştırmak için sorular soracaktır.</p>
                             </div>
                        </div>
                    </button>
                     <button
                        onClick={() => onSelectChoice('save')}
                        className="p-6 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-left hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                         <div className="flex items-center gap-4">
                            <div className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 p-3 rounded-lg">
                                <FileText className="h-7 w-7" />
                            </div>
                             <div>
                                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">Doküman Olarak Kaydet</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Metni doğrudan 'İş Analizi Dokümanı' olarak kaydedin. AI, bu metni projenin mevcut durumu olarak kabul edecektir.</p>
                             </div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
