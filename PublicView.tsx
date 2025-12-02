// components/PublicView.tsx
import React, { useState, useEffect } from 'react';
import type { Conversation, Theme, User, Message, GeneratedDocs, Document, DocumentType, GeneratedDocument } from './types';
import { ChatMessageHistory } from './components/ChatMessageHistory';
import { DocumentCanvas } from './components/DocumentCanvas';
import { Visualizations } from './components/Visualizations';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { FileText, GanttChartSquare, Beaker, GitBranch, MessageSquare } from 'lucide-react';

interface PublicViewProps {
    conversation: Conversation;
}

const defaultGeneratedDocs: GeneratedDocs = {
    requestDoc: null,
    analysisDoc: null,
    testScenarios: null,
    bpmnViz: null,
    traceabilityMatrix: null,
    maturityReport: null,
    backlog: null,
};

const documentTypeToKeyMap: Record<DocumentType, keyof GeneratedDocs> = {
    request: 'requestDoc',
    analysis: 'analysisDoc',
    test: 'testScenarios',
    traceability: 'traceabilityMatrix',
    bpmn: 'bpmnViz',
    maturity_report: 'maturityReport',
};

const buildGeneratedDocs = (documents: Document[]): GeneratedDocs => {
    const docs = { ...defaultGeneratedDocs };
    if (!documents) return docs;

    for (const doc of documents) {
        const key = documentTypeToKeyMap[doc.document_type];
        if (!key) continue;

        const generatedDoc: GeneratedDocument = {
            content: doc.content,
            isStale: doc.is_stale,
            metadata: {}
        };

        try {
            if (key === 'bpmnViz') {
                if (doc.content.trim().startsWith('{')) {
                    const parsed = JSON.parse(doc.content);
                    generatedDoc.content = parsed.code || '';
                    generatedDoc.metadata = { sourceHash: parsed.sourceHash };
                }
            } else if (key === 'testScenarios' || key === 'traceabilityMatrix') {
                if (doc.content.trim().startsWith('{')) {
                    const parsed = JSON.parse(doc.content);
                    if (parsed && typeof parsed.content === 'string') {
                        generatedDoc.content = parsed.content;
                        generatedDoc.metadata = { sourceHash: parsed.sourceHash };
                    }
                }
            }
        } catch (e) {
            console.warn(`Error parsing metadata for ${key}, using raw content.`, e);
        }

        docs[key] = generatedDoc;
    }
    return docs;
};

const ErrorScreen: React.FC<{ message: string }> = ({ message }) => (
     <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Bir Hata Oluştu</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{message}</p>
        </div>
    </div>
);


export const PublicView: React.FC<PublicViewProps> = ({ conversation }) => {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    const [activeTab, setActiveTab] = useState<'chat' | 'analysis' | 'viz' | 'test' | 'traceability'>('chat');
    
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
    
    const { title, messages } = conversation;
    const generatedDocs = buildGeneratedDocs(conversation.documents);
    
    const vizContent = generatedDocs.bpmnViz?.content ?? '';
    const testScenariosContent = generatedDocs.testScenarios?.content ?? '';
    const traceabilityMatrixContent = generatedDocs.traceabilityMatrix?.content ?? '';

    const noOp = async () => {};
    const noOpWithArgs = (...args: any[]) => {};
    
    const tabs = [
        { id: 'chat', name: 'Sohbet', icon: MessageSquare, content: messages.length > 0 },
        { id: 'analysis', name: 'Analiz', icon: FileText, content: !!generatedDocs.analysisDoc },
        { id: 'viz', name: 'Görselleştirme', icon: GanttChartSquare, content: !!vizContent },
        { id: 'test', name: 'Test', icon: Beaker, content: !!testScenariosContent },
        { id: 'traceability', name: 'İzlenebilirlik', icon: GitBranch, content: !!traceabilityMatrixContent },
    ].filter(tab => tab.content);


    return (
        <div className="font-sans bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-screen flex flex-col">
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
            <div className="max-w-7xl mx-auto w-full flex-1 p-4 md:p-6 flex flex-col">
                <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        {tabs.map(tab => (
                             <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                    activeTab === tab.id
                                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-200 dark:hover:border-slate-500'
                                }`}
                            >
                                <tab.icon className="h-5 w-5" />
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex-1 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {activeTab === 'chat' && (
                        <div className="p-4 md:p-6 h-full overflow-y-auto">
                            <ChatMessageHistory
                                user={mockUser}
                                chatHistory={messages}
                                onFeedbackUpdate={noOpWithArgs}
                                onEditLastUserMessage={noOpWithArgs}
                                onApplySuggestion={noOpWithArgs}
                                onRetry={noOpWithArgs}
                            />
                        </div>
                    )}
                    {activeTab === 'analysis' && (
                        <DocumentCanvas
                            content={generatedDocs.analysisDoc?.content || ''} onContentChange={noOpWithArgs} docKey="analysisDoc" onModifySelection={noOpWithArgs}
                            inlineModificationState={null} isGenerating={false} isStreaming={false} documentVersions={conversation.documentVersions}
                            onAddTokens={noOpWithArgs} onRestoreVersion={noOpWithArgs} filename={`${title}-analiz`}
                            onExplainSelection={noOpWithArgs}
                        />
                    )}
                     {activeTab === 'viz' && (
                        <Visualizations
                            content={vizContent} onModifyDiagram={noOp} onGenerateDiagram={noOp} isLoading={false} error={null}
                            isAnalysisDocReady={!!generatedDocs.analysisDoc}
                        />
                     )}
                     {activeTab === 'test' && (
                        <DocumentCanvas
                            content={testScenariosContent} onContentChange={noOpWithArgs} docKey="testScenarios" onModifySelection={noOpWithArgs}
                            inlineModificationState={null} isGenerating={false} isStreaming={false} documentVersions={conversation.documentVersions}
                            onAddTokens={noOpWithArgs} onRestoreVersion={noOpWithArgs} filename={`${title}-test-senaryolari`} isTable
                            onExplainSelection={noOpWithArgs}
                        />
                     )}
                    {activeTab === 'traceability' && (
                        <DocumentCanvas
                            content={traceabilityMatrixContent} onContentChange={noOpWithArgs} docKey="traceabilityMatrix" onModifySelection={noOpWithArgs}
                            inlineModificationState={null} isGenerating={false} isStreaming={false} documentVersions={conversation.documentVersions}
                            onAddTokens={noOpWithArgs} onRestoreVersion={noOpWithArgs} filename={`${title}-izlenebilirlik`} isTable
                            onExplainSelection={noOpWithArgs}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};