import React from 'react';
import type { MaturityReport } from '../types';

interface MaturityCheckReportProps {
    report: MaturityReport;
    onSendQuestion: (question: string) => void;
    onClose: () => void;
}

export const MaturityCheckReport: React.FC<MaturityCheckReportProps> = ({ report, onSendQuestion, onClose }) => {
    const status = report.isSufficient 
        ? { text: 'Analiz Yeterli', color: 'teal', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
        ) }
        : { text: 'Geliştirilmeli', color: 'amber', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 5a1 1 0 011 1v3a1 1 0 01-2 0V6a1 1 0 011-1zm1 5a1 1 0 10-2 0v2a1 1 0 102 0v-2z" clipRule="evenodd" />
            </svg>
        ) };
    
    return (
        <div className="mb-4 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 animate-fade-in-up">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Analiz Olgunluk Raporu</h3>
                    <div className={`mt-1 flex items-center text-sm font-semibold text-${status.color}-600 dark:text-${status.color}-400`}>
                        {status.icon}
                        <span>{status.text}</span>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700" title="Kapat">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{report.summary}</p>

            {report.missingTopics && report.missingTopics.length > 0 && (
                <div className="mt-4">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Eksik Konular</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {report.missingTopics.map((topic, index) => (
                            <span key={index} className="px-2.5 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full">{topic}</span>
                        ))}
                    </div>
                </div>
            )}
            
            {report.suggestedQuestions && report.suggestedQuestions.length > 0 && (
                <div className="mt-4">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Analizi Derinleştirmek İçin Sorular</h4>
                    <div className="space-y-2 mt-2">
                        {report.suggestedQuestions.map((q, index) => (
                            <button 
                                key={index} 
                                onClick={() => onSendQuestion(q)} 
                                className="w-full text-left flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-900/50 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/50 group transition-colors"
                            >
                                <span className="text-sm text-slate-700 dark:text-slate-300">{q}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                </svg>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};