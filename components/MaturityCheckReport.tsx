// components/MaturityCheckReport.tsx
import React from 'react';
import type { MaturityReport } from '../types';
import { ClipboardCheck, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface MaturityCheckReportProps {
    report: MaturityReport | null;
    onSelectQuestion: (question: string) => void;
    onRecheck: () => void;
    isLoading: boolean;
}

export const MaturityCheckReport: React.FC<MaturityCheckReportProps> = ({ report, onSelectQuestion, onRecheck, isLoading }) => {
    
    if (!report) {
         return (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                <ClipboardCheck className="mx-auto h-12 w-12 text-slate-400" strokeWidth={1} />
                <h3 className="mt-2 text-lg font-medium text-slate-800 dark:text-slate-200">Olgunluk Raporu</h3>
                <p className="mt-1 text-sm">Analizinizin doküman oluşturmaya hazır olup olmadığını kontrol etmek için "Olgunluk Kontrolü" butonunu kullanın.</p>
            </div>
        );
    }

    const { isSufficient, summary, missingTopics, suggestedQuestions } = report;

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Analiz Olgunluk Raporu</h3>
                 <button 
                    onClick={onRecheck}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm transition-opacity duration-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                 >
                     <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? 'Kontrol Ediliyor...' : 'Yeniden Kontrol Et'}
                </button>
            </div>
            <div className={`flex items-start gap-4 p-4 rounded-lg ${isSufficient ? 'bg-emerald-50 dark:bg-emerald-900/50' : 'bg-amber-50 dark:bg-amber-900/50'}`}>
                {isSufficient ? (
                     <CheckCircle2 className="h-8 w-8 text-emerald-500 flex-shrink-0" />
                ) : (
                     <AlertTriangle className="h-8 w-8 text-amber-500 flex-shrink-0" />
                )}
                <div>
                    <h3 className={`text-lg font-bold ${isSufficient ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>
                        {isSufficient ? 'Analiz Doküman Oluşturmak İçin Yeterli' : 'Analiz Henüz Yeterli Değil'}
                    </h3>
                    <p className={`mt-1 text-sm ${isSufficient ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        {summary}
                    </p>
                </div>
            </div>
            
            {!isSufficient && missingTopics.length > 0 && (
                <div>
                    <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300 mb-2">Eksik Konu Başlıkları</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 p-3 rounded-md">
                        {missingTopics.map((topic, index) => <li key={index}>{topic}</li>)}
                    </ul>
                </div>
            )}
            
             {suggestedQuestions.length > 0 && (
                <div>
                    <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300 mb-2">Analizi İlerletmek İçin Önerilen Sorular</h4>
                    <div className="flex flex-wrap gap-2">
                        {suggestedQuestions.map((q, index) => (
                            <button 
                                key={index} 
                                onClick={() => onSelectQuestion(q)}
                                className="px-3 py-1.5 bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200 rounded-full text-sm hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors duration-200"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};