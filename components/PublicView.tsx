// components/PublicView.tsx
import React, { useState, useEffect } from 'react';
// FIX: Import missing types to handle generatedDocs and documentVersions.
import type { Conversation, Theme, User, GenerativeSuggestion, Message, GeneratedDocs, Document, DocumentType, DocumentVersion, SourcedDocument } from '../types';
import { supabase } from '../services/supabaseClient';
import { ChatMessageHistory } from './ChatMessageHistory';
// FIX: The component 'GeneratedDocument' was renamed; it is now 'DocumentCanvas'.
import { DocumentCanvas } from './DocumentCanvas';
import { Visualizations } from './Visualizations';
import { ThemeSwitcher } from './ThemeSwitcher';

interface PublicViewProps {
    conversation: Conversation;
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

// FIX: Added helper functions from App.tsx to build the generatedDocs object.
const defaultGeneratedDocs: GeneratedDocs = {
    analysisDoc: '',
    testScenarios: '',
    visualization: '',
    traceabilityMatrix: '',
};

const documentTypeToKeyMap: Record<DocumentType, keyof GeneratedDocs> = {
    analysis: 'analysisDoc',
    test: 'testScenarios',
    traceability: 'traceabilityMatrix',
    mermaid: 'mermaidViz',
    bpmn: 'bpmnViz',
    maturity_report: 'maturityReport',
};

const buildGeneratedDocs = (documents: Document[]): GeneratedDocs => {
    const docs = { ...defaultGeneratedDocs };
    if (!documents) return docs;

    for (const doc of documents) {
        const key = documentTypeToKeyMap[doc.document_type];
        if (key) {
            if (key === 'mermaidViz' || key === 'bpmnViz' || key === 'maturityReport' || key === 'testScenarios' || key === 'traceabilityMatrix') {
                try {
                    (docs as any)[key] = JSON.parse(doc.content);
                } catch (e) {
                    console.error(`Error parsing JSON for ${key}:`, e);
                     if (key.endsWith('Viz')) {
                        (docs as any)[key] = { code: '', sourceHash: '' };
                     } else if (key === 'testScenarios' || key === 'traceabilityMatrix') {
                        (docs as any)[key] = doc.content; // Fallback for old string format
                     } else {
                        (docs as any)[key] = null;
                     }
                }
            } else {
                 (docs as any)[key] = doc.content;
            }
        }
    }
    return docs;
};


export const PublicView: React.FC<PublicViewProps> = ({ conversation }) => {
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
    
    // Create a mock user object for the ChatMessageHistory component
    const mockUser: User = {
      id: 'public-user',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    if (!conversation) {
        return <ErrorScreen message="Paylaşılan analiz bulunamadı." />;
    }
    
    // FIX: Compute generatedDocs from the documents array to fix property access error.
    const { title, messages } = conversation;
    const generatedDocs = buildGeneratedDocs(conversation.documents);
    
    const diagramType = generatedDocs.bpmnViz?.code ? 'bpmn' : 'mermaid';

    const vizContent = diagramType === 'bpmn'
        ? generatedDocs.bpmnViz?.code ?? ''
        : generatedDocs.mermaidViz?.code ?? '';


    // A dummy function for read-only components
    const noOp = async () => {};
    const noOpWithArgs = (...args: any[]) => {};

    const testScenariosContent = typeof generatedDocs.testScenarios === 'object'
        ? generatedDocs.testScenarios.content
        : generatedDocs.testScenarios;

    const traceabilityMatrixContent = typeof generatedDocs.traceabilityMatrix === 'object'
        ? generatedDocs.traceabilityMatrix.content
        : generatedDocs.traceabilityMatrix;

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
                                user={mockUser}
                                chatHistory={messages}
                                onFeedbackUpdate={noOpWithArgs}
                                onEditLastUserMessage={noOpWithArgs}
                                onApplySuggestion={noOpWithArgs}
                            />
                        </div>
                    </div>
                     <div className="space-y-6 bg-slate-200/50 dark:bg-slate-900/50 pb-6">
                        <div className="p-4 md:p-6 pt-6 space-y-6">
                             {generatedDocs.analysisDoc && (
                                <div className="max-w-4xl mx-auto w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
   // ... (Satır 170)
                            {generatedDocs.analysisDoc && (
                                <div className="max-w-4xl mx-auto w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    
                                    {/* DÜZELTİLMİŞ BAŞLIK BÖLÜMÜ */}
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{conversation.title} - Analiz Dokümanı</h3>
                                    </div>

                                    {/* İÇERİK BÖLÜMÜ */}
                                    <div className="p-4 md:p-6">
                                        <MarkdownRenderer content={generatedDocs.analysisDoc} />
                                    </div>

                                </div>
                            )}
// ...