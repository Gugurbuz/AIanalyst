// components/NewAnalysisModal.tsx
import React, { useState } from 'react';
import { MessageSquare, FilePlus, ArrowLeft } from 'lucide-react';

interface NewAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartFromScratch: () => void;
    onStartWithDocument: (documentContent: string, title: string) => void;
    isProcessing: boolean;
}

export const NewAnalysisModal: React.FC<NewAnalysisModalProps> = ({
    isOpen,
    onClose,
    onStartFromScratch,
    onStartWithDocument,
    isProcessing
}) => {
    const [step, setStep] = useState<'options' | 'paste'>('options');
    const [pastedContent, setPastedContent] = useState('');
    const [title, setTitle] = useState('');

    if (!isOpen) return null;

    const handleBack = () => {
        setStep('options');
        setPastedContent('');
        setTitle('');
    }

    const handleSubmitPastedDoc = () => {
        if (!pastedContent.trim()) return;
        onStartWithDocument(pastedContent, title.trim());
    }

    const renderOptions = () => (
        <>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Yeni Analiz Nasıl Başlasın?</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={onStartFromScratch}
                    disabled={isProcessing}
                    className="p-6 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-left hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 p-2 rounded-lg">
                           <MessageSquare className="h-6 w-6" />
                        </div>
                         <div>
                            <h3 className="font-semibold">Sıfırdan Başla</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">AI ile sohbet ederek talebinizi adım adım olgunlaştırın.</p>
                         </div>
                    </div>
                </button>
                 <button
                    onClick={() => setStep('paste')}
                    disabled={isProcessing}
                    className="p-6 border-2 border-slate-300 dark:border-slate-600 rounded-lg text-left hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
                >
                     <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 p-2 rounded-lg">
                            <FilePlus className="h-6 w-6" />
                        </div>
                         <div>
                            <h3 className="font-semibold">Mevcut Analizi İyileştir</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Hazır bir dokümanı yapıştırarak AI'dan öneriler alın.</p>
                         </div>
                    </div>
                </button>
            </div>
        </>
    );

    const renderPasteDocument = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
                 <button onClick={handleBack} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                    <ArrowLeft className="h-5 w-5" />
                 </button>
                 <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Mevcut Analizi Yapıştırın</h2>
            </div>
            <div className="space-y-4 flex-1 flex flex-col">
                <div>
                     <label htmlFor="doc-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Başlık (İsteğe bağlı)</label>
                     <input 
                        id="doc-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Örn: Müşteri Geri Bildirim Sistemi Analizi"
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700"
                    />
                </div>
                 <div className="flex-1 flex flex-col">
                    <label htmlFor="doc-content" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Doküman İçeriği</label>
                    <textarea 
                        id="doc-content"
                        value={pastedContent}
                        onChange={(e) => setPastedContent(e.target.value)}
                        placeholder="Analiz dokümanınızı, e-posta metnini veya notlarınızı buraya yapıştırın..."
                        className="w-full flex-1 p-3 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 resize-none"
                    />
                 </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleSubmitPastedDoc}
                    disabled={isProcessing || !pastedContent.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {isProcessing ? 'Başlatılıyor...' : 'Analizi Başlat'}
                </button>
            </div>
        </div>
    );
    

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }} onClick={onClose}>
            <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-3xl h-full max-h-[90vh] flex flex-col p-6" 
                onClick={e => e.stopPropagation()}
            >
                {step === 'options' ? renderOptions() : renderPasteDocument()}
            </div>
        </div>
    );
};