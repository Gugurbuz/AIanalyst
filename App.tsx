import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Component Imports
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { ChatMessageHistory } from './components/ChatMessageHistory';
import { PromptSuggestions } from './components/PromptSuggestions';
import { MaturityCheckReport } from './components/MaturityCheckReport';
import { GeneratedDocument } from './components/GeneratedDocument';
import { Visualizations } from './components/Visualizations';
import { TemplateSelector } from './components/TemplateSelector';
import { ProjectBoard } from './components/ProjectBoard';
import { TaskGenerationModal } from './components/TaskGenerationModal';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { ExportDropdown } from './components/ExportDropdown';

// Service Imports
import { geminiService } from './services/geminiService';
import { supabase } from './services/supabaseClient';

// Type Imports
import type { User, Conversation, Message, MaturityReport, Theme, GeneratedDocs, AppMode, Task } from './types';
import { ANALYSIS_TEMPLATES, TEST_SCENARIO_TEMPLATES } from './templates';


const Header: React.FC<{
    user: User;
    onLogout: () => void;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    onOpenSidebar: () => void;
    appMode: AppMode;
    onAppModeChange: (mode: AppMode) => void;
    isAnalystView: boolean;
}> = ({ user, onLogout, theme, onThemeChange, onOpenSidebar, appMode, onAppModeChange, isAnalystView }) => (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm p-2 flex items-center justify-between h-16 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center">
            {isAnalystView && (
                <button onClick={onOpenSidebar} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 md:hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
            )}
            <div className="ml-4 hidden sm:flex items-center gap-2 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
                 <button 
                    onClick={() => onAppModeChange('analyst')}
                    className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${appMode === 'analyst' ? 'bg-white dark:bg-slate-800 shadow text-sky-600' : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
                >
                    Analist Asistanı
                </button>
                 <button 
                    onClick={() => onAppModeChange('board')}
                    className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${appMode === 'board' ? 'bg-white dark:bg-slate-800 shadow text-sky-600' : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
                >
                    Proje Panosu
                </button>
            </div>
             <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200 ml-4 truncate sm:hidden">
                {appMode === 'analyst' ? 'AI Analist Asistanı' : 'Proje Panosu'}
            </h1>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400 hidden sm:block">{user.email}</span>
            <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
             <button onClick={onLogout} className="px-3 py-1.5 text-sm font-semibold text-white bg-sky-600 rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition">
                Çıkış Yap
            </button>
        </div>
    </header>
);

const StageIndicator: React.FC<{ currentStage: string; onStageChange: (stage: any) => void }> = ({ currentStage, onStageChange }) => {
    const stages = ['chat', 'analysis', 'visualization', 'test'];
    const stageLabels: { [key: string]: string } = {
        chat: 'Sohbet & Analiz',
        analysis: 'Doküman Oluşturma',
        visualization: 'Görselleştirme',
        test: 'Test Senaryoları',
    };

    return (
        <div className="border-b border-slate-200 dark:border-slate-700">
            <nav className="flex justify-center space-x-2 sm:space-x-4 p-2" aria-label="Tabs">
                {stages.map((stage) => (
                    <button
                        key={stage}
                        onClick={() => onStageChange(stage)}
                        className={`px-3 py-2 font-medium text-sm rounded-md transition-colors ${
                            currentStage === stage
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        {stageLabels[stage]}
                    </button>
                ))}
            </nav>
        </div>
    );
};

const ActionButton: React.FC<{ onClick: () => void; disabled: boolean; children: React.ReactNode; }> = ({ onClick, disabled, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {disabled && (
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        )}
        {children}
    </button>
);


const App: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
    // State
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    const [appMode, setAppMode] = useState<AppMode>('analyst');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sidebarIsOpen, setSidebarIsOpen] = useState(true);
    const [maturityReport, setMaturityReport] = useState<MaturityReport | null>(null);
    const [currentStage, setCurrentStage] = useState<'chat' | 'analysis' | 'test' | 'visualization'>('chat');
    const [analysisTemplate, setAnalysisTemplate] = useState(ANALYSIS_TEMPLATES[0].id);
    const [testTemplate, setTestTemplate] = useState(TEST_SCENARIO_TEMPLATES[0].id);
    const [diagramType, setDiagramType] = useState('auto');
    const [isTaskGenModalOpen, setIsTaskGenModalOpen] = useState(false);

    // Granular loading states
    const [isGeneratingAnalysisDoc, setIsGeneratingAnalysisDoc] = useState(false);
    const [isGeneratingTestScenarios, setIsGeneratingTestScenarios] = useState(false);
    const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
    const [isCheckingMaturity, setIsCheckingMaturity] = useState(false);
    const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);


    const activeConversation = useMemo(() => conversations.find(c => c.id === activeConversationId) || null, [conversations, activeConversationId]);

    // Effects
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.toggle('dark', systemTheme === 'dark');
        } else {
            root.classList.toggle('dark', theme === 'dark');
        }
    }, [theme]);

    const fetchConversations = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        const { data, error } = await supabase.from('conversations').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) {
            setError(error.message);
        } else {
            setConversations(data as Conversation[]);
            if (data && data.length > 0 && !activeConversationId) {
                setActiveConversationId(data[0].id);
            }
        }
        setIsLoading(false);
    }, [user, activeConversationId]);
    
    useEffect(() => {
        fetchConversations();
    }, [user]);

    // Handlers
    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const updateConversationInState = (updatedConv: Conversation) => {
        setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
    };

    const handleSendMessage = async (input: string) => {
        setError(null);
        if (!input.trim()) return;

        let currentConv = activeConversation;
        const userMessage: Message = { id: uuidv4(), role: 'user', content: input.trim() };

        if (!currentConv) {
            setIsLoading(true);
            try {
                const title = await geminiService.generateConversationTitle(input.trim());
                const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title, messages: [userMessage], share_id: uuidv4(), generatedDocs: { analysisDoc: '', testScenarios: '', visualization: '' } }).select().single();
                if (error) throw error;
                currentConv = data as Conversation;
                setConversations(prev => [currentConv!, ...prev]);
                setActiveConversationId(currentConv!.id);
            } catch(err) {
                 setError(err instanceof Error ? err.message : 'Yeni sohbet oluşturulamadı.');
                 setIsLoading(false);
                 return;
            }
        } else {
             currentConv = { ...currentConv, messages: [...currentConv.messages, userMessage] };
             updateConversationInState(currentConv);
        }

        setIsLoading(true);
        
        try {
            const responseText = await geminiService.continueConversation(currentConv.messages);
            const assistantMessage: Message = { id: uuidv4(), role: 'assistant', content: responseText };
            const updatedMessages = [...currentConv.messages, assistantMessage];
            
            const { data: updatedConv, error: updateError } = await supabase.from('conversations').update({ messages: updatedMessages, updated_at: new Date().toISOString() }).eq('id', currentConv.id).select().single();
            if (updateError) throw updateError;
            
            updateConversationInState(updatedConv as Conversation);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Yanıt alınamadı.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleNewConversation = () => {
      setActiveConversationId(null);
      setMaturityReport(null);
      setCurrentStage('chat');
    };

    const handleUpdateConversationTitle = async (id: string, newTitle: string) => {
        const { data } = await supabase.from('conversations').update({ title: newTitle }).eq('id', id).select().single();
        if (data) updateConversationInState(data as Conversation);
    };

    const handleUpdateGeneratedDoc = async (docType: keyof GeneratedDocs, newContent: string) => {
        if (!activeConversation) return;
        const newDocs = { ...activeConversation.generatedDocs, [docType]: newContent };
        const { data } = await supabase.from('conversations').update({ generatedDocs: newDocs }).eq('id', activeConversation.id).select().single();
        if (data) updateConversationInState(data as Conversation);
    };

    const handleFeedbackUpdate = async (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => {
        if (!activeConversation) return;
        const updatedMessages = activeConversation.messages.map(msg => msg.id === messageId ? { ...msg, feedback: feedbackData } : msg);
        const { data } = await supabase.from('conversations').update({ messages: updatedMessages }).eq('id', activeConversation.id).select().single();
        if (data) updateConversationInState(data as Conversation);
    };

    const handleCheckMaturity = async () => {
        if (!activeConversation || activeConversation.messages.length === 0) {
            setError('Analiz olgunluğunu kontrol etmek için önce bir konuşma başlatmalısınız.');
            return;
        }
        setIsCheckingMaturity(true);
        setError(null);
        try {
            const report = await geminiService.checkAnalysisMaturity(activeConversation.messages);
            setMaturityReport(report);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Olgunluk raporu oluşturulamadı.');
        } finally {
            setIsCheckingMaturity(false);
        }
    };

    const handleGenerateDocument = async (docType: 'analysisDoc' | 'testScenarios') => {
        if (!activeConversation) return;

        const setLoading = docType === 'analysisDoc' ? setIsGeneratingAnalysisDoc : setIsGeneratingTestScenarios;
        const history = activeConversation.messages;
        const template = docType === 'analysisDoc' ? analysisTemplate : testTemplate;
        
        const inputContent = docType === 'analysisDoc' ? history : activeConversation.generatedDocs?.analysisDoc;
        
        if (!inputContent || (Array.isArray(inputContent) && inputContent.length === 0)) {
            setError(docType === 'analysisDoc' ? 'Doküman oluşturmak için konuşma geçmişi gerekli.' : 'Test senaryosu oluşturmak için önce bir analiz dokümanı oluşturmalısınız.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const generatedContent = docType === 'analysisDoc'
                ? await geminiService.generateAnalysisDocument(inputContent as Message[], template)
                : await geminiService.generateTestScenarios(inputContent as string, template);
            
            await handleUpdateGeneratedDoc(docType, generatedContent);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Doküman oluşturulamadı.');
        } finally {
            setLoading(false);
        }
    };
    
    const handleGenerateVisualization = async () => {
        if (!activeConversation?.generatedDocs?.analysisDoc) {
            setError('Görselleştirme oluşturmak için önce bir analiz dokümanı oluşturmalısınız.');
            return;
        }
        setIsGeneratingVisualization(true);
        setError(null);
        try {
            const mermaidCode = await geminiService.generateVisualization(activeConversation.generatedDocs.analysisDoc, diagramType);
            await handleUpdateGeneratedDoc('visualization', mermaidCode);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Görselleştirme oluşturulamadı.');
        } finally {
            setIsGeneratingVisualization(false);
        }
    };
    
    const handleGenerateTasks = async () => {
        if (!activeConversation?.generatedDocs?.analysisDoc) {
             setError('Görev listesi oluşturmak için önce bir analiz dokümanı oluşturmalısınız.');
            return;
        }
        setIsGeneratingTasks(true);
        setIsTaskGenModalOpen(true); // Open modal immediately
    };
    
    return (
        <div className="flex h-screen bg-slate-100 dark:bg-slate-900 font-sans">
            {appMode === 'analyst' && (
                <Sidebar
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onSelectConversation={(id) => { setActiveConversationId(id); setCurrentStage('chat'); setMaturityReport(null);}}
                    onNewConversation={handleNewConversation}
                    onUpdateConversationTitle={handleUpdateConversationTitle}
                    isOpen={sidebarIsOpen}
                    setIsOpen={setSidebarIsOpen}
                />
            )}
            <div className="flex-1 flex flex-col min-w-0">
                <Header
                    user={user}
                    onLogout={onLogout}
                    theme={theme}
                    onThemeChange={handleThemeChange}
                    onOpenSidebar={() => setSidebarIsOpen(true)}
                    appMode={appMode}
                    onAppModeChange={setAppMode}
                    isAnalystView={appMode === 'analyst'}
                />
                 {appMode === 'analyst' && activeConversation && (
                    <StageIndicator currentStage={currentStage} onStageChange={(stage) => {setCurrentStage(stage); setMaturityReport(null);}} />
                )}

                <main className="flex-1 overflow-y-auto">
                   {appMode === 'board' ? (
                       <ProjectBoard user={user} />
                   ) : (
                       <div className="max-w-4xl mx-auto w-full p-4 md:p-6">
                            {error && <div className="p-3 mb-4 text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600" onClick={() => setError(null)}>{error}</div>}
                            
                            {!activeConversationId ? (
                                 <div className="text-center py-12">
                                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Yeni bir analize başlayın!</h2>
                                    <p className="mt-2 text-slate-500 dark:text-slate-400">Sol menüden "Yeni Analiz" butonuna tıklayın veya bir istemle başlayın.</p>
                                    <div className="mt-8 max-w-2xl mx-auto">
                                         <PromptSuggestions onSelectPrompt={(p) => handleSendMessage(p)} />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {currentStage === 'chat' && (
                                        <>
                                            <ChatMessageHistory chatHistory={activeConversation?.messages || []} isLoading={isLoading} onFeedbackUpdate={handleFeedbackUpdate} />
                                            {maturityReport && <MaturityCheckReport report={maturityReport} onClose={() => setMaturityReport(null)} onSendQuestion={(q) => handleSendMessage(q)} />}
                                        </>
                                    )}
                                    
                                    {currentStage === 'analysis' && (
                                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 mt-4 animate-fade-in-up">
                                            <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700">
                                                <h3 className="text-md font-bold text-slate-800 dark:text-slate-200">Analiz Dokümanı</h3>
                                                <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                                                    <TemplateSelector label="Şablon" templates={ANALYSIS_TEMPLATES} selectedValue={analysisTemplate} onChange={(e) => setAnalysisTemplate(e.target.value)} disabled={isGeneratingAnalysisDoc} />
                                                    <ActionButton onClick={() => handleGenerateDocument('analysisDoc')} disabled={isGeneratingAnalysisDoc}>
                                                        {isGeneratingAnalysisDoc ? 'Oluşturuluyor...' : 'AI ile Doldur'}
                                                    </ActionButton>
                                                    <button onClick={handleGenerateTasks} disabled={isGeneratingTasks || !activeConversation?.generatedDocs?.analysisDoc} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed">
                                                        {isGeneratingTasks && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                                        AI ile Görev Listesi Oluştur
                                                    </button>
                                                    <ExportDropdown content={activeConversation?.generatedDocs?.analysisDoc || ''} filename={`${activeConversation?.title}_Analiz`} />
                                                </div>
                                            </div>
                                            <GeneratedDocument
                                                content={activeConversation?.generatedDocs?.analysisDoc || ''}
                                                onContentChange={(newContent) => handleUpdateGeneratedDoc('analysisDoc', newContent)}
                                                placeholder={isGeneratingAnalysisDoc ? 'Doküman oluşturuluyor, lütfen bekleyin...' : 'Başlamak için "AI ile Doldur" butonuna tıklayın veya içeriği manuel olarak girin.'}
                                            />
                                        </div>
                                    )}
                                    
                                    {currentStage === 'visualization' && (
                                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 mt-4 animate-fade-in-up">
                                            <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700">
                                                <h3 className="text-md font-bold">Süreç Akış Diyagramı</h3>
                                                 <div className="flex items-center gap-4 flex-wrap">
                                                    <TemplateSelector label="Diyagram Türü" templates={[{id: 'auto', name: 'Otomatik', prompt: ''}, {id: 'flowchart', name: 'Akış Şeması', prompt: ''}, {id: 'sequenceDiagram', name: 'Sekans Diyagramı', prompt: ''}, {id: 'mindmap', name: 'Zihin Haritası', prompt: ''}]} selectedValue={diagramType} onChange={(e) => setDiagramType(e.target.value)} disabled={isGeneratingVisualization} />
                                                    <ActionButton onClick={handleGenerateVisualization} disabled={isGeneratingVisualization}>
                                                        {isGeneratingVisualization ? 'Oluşturuluyor...' : 'Diyagram Oluştur'}
                                                    </ActionButton>
                                                    <ExportDropdown content={activeConversation?.generatedDocs?.visualization || ''} filename={`${activeConversation?.title}_Diyagram`} isVisualization />
                                                 </div>
                                            </div>
                                            <Visualizations content={activeConversation?.generatedDocs?.visualization || ''} onContentChange={(newContent) => handleUpdateGeneratedDoc('visualization', newContent)} />
                                        </div>
                                    )}

                                    {currentStage === 'test' && (
                                         <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 mt-4 animate-fade-in-up">
                                            <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700">
                                                <h3 className="text-md font-bold text-slate-800 dark:text-slate-200">Test Senaryoları</h3>
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <TemplateSelector label="Şablon" templates={TEST_SCENARIO_TEMPLATES} selectedValue={testTemplate} onChange={(e) => setTestTemplate(e.target.value)} disabled={isGeneratingTestScenarios} />
                                                    <ActionButton onClick={() => handleGenerateDocument('testScenarios')} disabled={isGeneratingTestScenarios}>
                                                        {isGeneratingTestScenarios ? 'Oluşturuluyor...' : 'AI ile Doldur'}
                                                    </ActionButton>
                                                    <ExportDropdown content={activeConversation?.generatedDocs?.testScenarios || ''} filename={`${activeConversation?.title}_Testler`} isTable />
                                                </div>
                                            </div>
                                            <GeneratedDocument
                                                content={activeConversation?.generatedDocs?.testScenarios || ''}
                                                onContentChange={(newContent) => handleUpdateGeneratedDoc('testScenarios', newContent)}
                                                placeholder={isGeneratingTestScenarios ? 'Test senaryoları oluşturuluyor, lütfen bekleyin...' : 'Başlamak için "AI ile Doldur" butonuna tıklayın veya içeriği manuel olarak girin.'}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                       </div>
                   )}
                </main>
                
                 {appMode === 'analyst' && (
                    <footer className="p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700">
                        <div className="max-w-4xl mx-auto">
                            <ChatInterface isLoading={isLoading} onSendMessage={handleSendMessage} activeConversationId={activeConversationId} />
                            {currentStage === 'chat' && activeConversationId && (
                                <div className="text-center mt-2">
                                     <button
                                        onClick={handleCheckMaturity}
                                        disabled={isCheckingMaturity}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center justify-center mx-auto"
                                    >
                                        {isCheckingMaturity && ( <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>)}
                                        {isCheckingMaturity ? 'Kontrol Ediliyor...' : 'Analiz Olgunluğunu Kontrol Et'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </footer>
                )}
            </div>

            {isTaskGenModalOpen && activeConversation && (
                <TaskGenerationModal
                    isOpen={isTaskGenModalOpen}
                    onClose={() => { setIsTaskGenModalOpen(false); setIsGeneratingTasks(false); }}
                    conversation={activeConversation}
                    isGenerating={isGeneratingTasks}
                    setIsGenerating={setIsGeneratingTasks}
                />
            )}
        </div>
    );
};

export default App;
