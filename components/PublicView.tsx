// components/PublicView.tsx
import React, { useState, useEffect } from 'react';
import type { Conversation, Theme } from '../types';
import { supabase } from '../services/supabaseClient';
import { ChatMessageHistory } from './ChatMessageHistory';
import { GeneratedDocument } from './GeneratedDocument';
import { Visualizations } from './Visualizations';
import { ThemeSwitcher } from './ThemeSwitcher';

interface PublicViewProps {
    shareId: string;
}

const LoadingScreen: React.FC = () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
        <div className="flex flex-col items-center">
             <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Analiz yükleniyor...</p>
        </div>
    </div>
);

const ErrorScreen: React.FC<{ message: string }> = ({ message }) => (
     <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Bir Hata Oluştu</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{message}</p>
        </div>
    </div>
);

export const PublicView: React.FC<PublicViewProps> = ({ shareId }) => {
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    
    // --- Theme Management ---
    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (theme === 'system') {
            root.classList.toggle('dark', prefersDark);
        } else {
            root.classList.toggle('dark', isDark);
        }
    }, [theme]);

     const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    useEffect(() => {
        const fetchSharedConversation = async () => {
            setIsLoading(true);
            setError(null);
            
            const { data, error } = await supabase
                .from('conversations')
                .select('*')
                .eq('share_id', shareId)
                .eq('is_shared', true)
                .single();

            if (error) {
                console.error('Error fetching shared conversation:', error);
                setError('Bu analize erişilemiyor. Linkin doğru olduğundan emin olun veya paylaşım ayarları değiştirilmiş olabilir.');
            } else if (data) {
                setConversation(data as Conversation);
            } else {
                 setError('Paylaşılan analiz bulunamadı.');
            }
            setIsLoading(false);
        };

        fetchSharedConversation();
    }, [shareId]);

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (error) {
        return <ErrorScreen message={error} />;
    }

    if (!conversation) {
        return <ErrorScreen message="Paylaşılan analiz bulunamadı." />;
    }
    
    const { title, messages, generatedDocs } = conversation;

    return (
        <div className="font-sans bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-screen">
             <header className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm p-2 flex items-center justify-between h-16 border-b border-slate-200 dark:border-slate-700 z-20">
                 <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200 ml-4 truncate flex-1 min-w-0" title={title}>
                    {title}
                </h1>
                <div className="flex items-center gap-4 mr-4 flex-shrink-0">
                    <ThemeSwitcher theme={theme} onThemeChange={handleThemeChange} />
                    <a href="/" className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition">
                       Asistanı Kullan
                    </a>
                </div>
            </header>
            <main className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6">
                        <div className="max-w-4xl mx-auto w-full">
                             <ChatMessageHistory 
                                chatHistory={messages} 
                                isLoading={false}
                                onFeedbackUpdate={() => {}} // No feedback in public view
                            />
                        </div>
                    </div>
                     <div className="space-y-6 bg-slate-200/50 dark:bg-slate-900/50 pb-6">
                        <div className="p-4 md:p-6 pt-6 space-y-6">
                             {generatedDocs.analysisDoc && (
                                <div className="max-w-4xl mx-auto w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                        <h3 className="text-md font-bold">Analiz Dokümanı</h3>
                                    </div>
                                    <GeneratedDocument content={generatedDocs.analysisDoc} onContentChange={() => {}} docKey='analysisDoc' onRephraseSelection={() => {}} rephrasingState={null} isGenerating={false}/>
                                </div>
                            )}

                             {generatedDocs.visualization && (
                                <div className="max-w-4xl mx-auto w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                        <h3 className="text-md font-bold">Süreç Akış Diyagramı</h3>
                                    </div>
                                    <Visualizations content={generatedDocs.visualization} onContentChange={() => {}} />
                                </div>
                             )}

                            {generatedDocs.testScenarios && (
                                <div className="max-w-4xl mx-auto w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                        <h3 className="text-md font-bold">Test Senaryoları</h3>
                                    </div>
                                    <GeneratedDocument content={generatedDocs.testScenarios} onContentChange={() => {}} docKey='testScenarios' onRephraseSelection={() => {}} rephrasingState={null} isGenerating={false}/>
                                </div>
                            )}

                            {generatedDocs.traceabilityMatrix && (
                                <div className="max-w-4xl mx-auto w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                        <h3 className="text-md font-bold">İzlenebilirlik Matrisi</h3>
                                    </div>
                                    <GeneratedDocument 
                                        content={generatedDocs.traceabilityMatrix} 
                                        onContentChange={() => {}} 
                                        docKey='analysisDoc' // Dummy key for type compliance
                                        onRephraseSelection={() => {}} 
                                        rephrasingState={null}
                                        isGenerating={false}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
