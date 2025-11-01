// components/FeedbackDashboard.tsx
import React from 'react';
// FIX: Import the centralized FeedbackItem type from types.ts, which is now used across the app.
import type { FeedbackItem } from '../types';
import { geminiService } from '../services/geminiService';
import { MarkdownRenderer } from './MarkdownRenderer';

// A type for the structured feedback data
// This type has been moved to types.ts to be shared across the application.

interface FeedbackDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    feedbackData: FeedbackItem[];
}

const ActionSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


export const FeedbackDashboard: React.FC<FeedbackDashboardProps> = ({ isOpen, onClose, feedbackData }) => {
    const [analysis, setAnalysis] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    if (!isOpen) {
        return null;
    }

    const positiveFeedback = feedbackData.filter(f => f.message.feedback?.rating === 'up' && f.message.feedback.comment);
    const negativeFeedback = feedbackData.filter(f => f.message.feedback?.rating === 'down' && f.message.feedback.comment);
    const totalFeedback = positiveFeedback.length + negativeFeedback.length;
    const satisfactionRate = totalFeedback > 0 ? (positiveFeedback.length / totalFeedback) * 100 : 0;

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        setAnalysis(null);
        try {
            // FIX: The geminiService.analyzeFeedback now returns an object with the analysis text.
            // Destructure the `analysis` property to get the string result.
            const { analysis: result } = await geminiService.analyzeFeedback(feedbackData);
            setAnalysis(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Analiz sırasında bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-4xl h-full max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Geri Bildirim Paneli</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Stats Section */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-white dark:bg-slate-700/50 rounded-lg shadow-sm">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Toplam Geri Bildirim</h3>
                            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">{totalFeedback}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-700/50 rounded-lg shadow-sm">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Memnuniyet Oranı</h3>
                            <p className={`text-3xl font-bold ${satisfactionRate >= 75 ? 'text-emerald-500' : satisfactionRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                {satisfactionRate.toFixed(1)}%
                            </p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-700/50 rounded-lg shadow-sm">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Beğeni / Beğenmeme</h3>
                            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                                <span className="text-emerald-500">{positiveFeedback.length}</span> / <span className="text-red-500">{negativeFeedback.length}</span>
                            </p>
                        </div>
                    </section>

                    {/* AI Analysis Section */}
                    <section>
                         <div className="p-4 bg-white dark:bg-slate-700/50 rounded-lg shadow-sm">
                             <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">AI Analizi</h3>
                                <button onClick={handleAnalyze} disabled={isLoading || totalFeedback === 0} className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center">
                                    {isLoading ? <><ActionSpinner /> Analiz Ediliyor...</> : 'Geri Bildirimleri Analiz Et'}
                                </button>
                             </div>
                             {error && <div className="p-3 text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600">{error}</div>}
                             {analysis ? (
                                <MarkdownRenderer content={analysis} />
                             ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400 p-2">Henüz bir analiz yapılmadı. Analiz etmek için butona tıklayın.</p>
                             )}
                         </div>
                    </section>
                    
                     {/* Comments Section */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-3 text-emerald-600 dark:text-emerald-400">Olumlu Yorumlar ({positiveFeedback.length})</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {positiveFeedback.length > 0 ? positiveFeedback.map(f => (
                                    <div key={f.message.id} className="p-3 bg-white dark:bg-slate-700/50 rounded-lg shadow-sm">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{f.message.feedback?.comment}"</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">Analiz: {f.conversationTitle}</p>
                                    </div>
                                )) : <p className="text-sm text-slate-500 dark:text-slate-400">Yorum bulunmuyor.</p>}
                            </div>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold mb-3 text-red-600 dark:text-red-400">Olumsuz Yorumlar ({negativeFeedback.length})</h3>
                             <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {negativeFeedback.length > 0 ? negativeFeedback.map(f => (
                                    <div key={f.message.id} className="p-3 bg-white dark:bg-slate-700/50 rounded-lg shadow-sm">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{f.message.feedback?.comment}"</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">Analiz: {f.conversationTitle}</p>
                                    </div>
                                )) : <p className="text-sm text-slate-500 dark:text-slate-400">Yorum bulunmuyor.</p>}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};