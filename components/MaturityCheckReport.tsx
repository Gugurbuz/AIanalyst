// components/MaturityCheckReport.tsx
import React from 'react';
import type { MaturityReport } from '../types';

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
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
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
                     <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                    {isLoading ? 'Kontrol Ediliyor...' : 'Yeniden Kontrol Et'}
                </button>
            </div>
            <div className={`flex items-start gap-4 p-4 rounded-lg ${isSufficient ? 'bg-emerald-50 dark:bg-emerald-900/50' : 'bg-amber-50 dark:bg-amber-900/50'}`}>
                {isSufficient ? (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
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