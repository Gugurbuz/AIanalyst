// App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './services/supabaseClient';
import { geminiService } from './services/geminiService';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { ChatMessageHistory } from './components/ChatMessageHistory';
import { ActionButtons } from './components/ActionButtons';
import { PromptSuggestions } from './components/PromptSuggestions';
import { DeveloperPanel } from './components/DeveloperPanel';
import { ShareModal } from './components/ShareModal';
import { TaskGenerationModal } from './components/TaskGenerationModal';
import { ProjectBoard } from './components/ProjectBoard';
import { LiveCoPilotModal } from './components/LiveCoPilotModal';
import { DocumentsModal } from './components/DocumentsModal';
import { NewAnalysisModal } from './components/NewAnalysisModal';
import { FeedbackDashboard } from './components/FeedbackDashboard';
import { SAMPLE_ANALYSIS_DOCUMENT, ANALYSIS_TEMPLATES, TEST_SCENARIO_TEMPLATES } from './templates';
import type { User, Conversation, Message, Theme, AppMode, GeminiModel, GeneratedDocs, FeedbackItem, Template } from './types';
import { v4 as uuidv4 } from 'uuid';
import { FileText, GanttChartSquare, Beaker, PlusSquare, Search, Sparkles, X, AlertTriangle } from 'lucide-react';

interface AppProps {
  user: User;
  onLogout: () => void;
}

// --- Icons for the new smart button ---
const NextActionIcons = {
    DEEPEN: <Sparkles className="h-5 w-5" />,
    CREATE_ANALYSIS: <FileText className="h-5 w-5" />,
    CREATE_VIZ: <GanttChartSquare className="h-5 w-5" />,
    CREATE_TESTS: <Beaker className="h-5 w-5" />,
    CREATE_TASKS: <PlusSquare className="h-5 w-5" />,
    EVALUATE_DOC: <Search className="h-5 w-5" />,
};

const useNextBestAction = (
    conversation: Conversation | null,
    onGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => void,
    onGenerateTasks: () => void,
    onSendMessage: (content: string, isSystemMessage?: boolean) => void,
    onEvaluateDocument: () => void
) => {
    return useMemo(() => {
        if (!conversation) {
            return {
                label: "Başlamak için bir mesaj gönderin",
                action: () => {},
                icon: NextActionIcons.DEEPEN,
                disabled: true
            };
        }

        const { generatedDocs, messages } = conversation;
        const hasRealAnalysisDoc = !!generatedDocs.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");
        const hasMessages = messages.length > 0;

        if (hasRealAnalysisDoc && !hasMessages) {
             return {
                label: "Dokümanı Değerlendir ve Soru Sor",
                action: onEvaluateDocument,
                icon: NextActionIcons.EVALUATE_DOC,
                disabled: false,
                tooltip: "AI'nın mevcut dokümanı analiz etmesini ve iyileştirme için sorular sormasını sağlayın."
            };
        }

        if (hasRealAnalysisDoc && generatedDocs.visualization && generatedDocs.testScenarios) {
            return {
                label: "Proje Görevleri Oluştur",
                action: onGenerateTasks,
                icon: NextActionIcons.CREATE_TASKS,
                disabled: false
            };
        }
        if (hasRealAnalysisDoc && generatedDocs.visualization && !generatedDocs.testScenarios) {
             return {
                label: "Test Senaryoları Oluştur",
                action: () => onGenerateDoc('test'),
                icon: NextActionIcons.CREATE_TESTS,
                disabled: false
            };
        }
        if (hasRealAnalysisDoc && !generatedDocs.visualization) {
            return {
                label: "Süreç Akışını Görselleştir",
                action: () => onGenerateDoc('viz'),
                icon: NextActionIcons.CREATE_VIZ,
                disabled: false
            };
        }
        if (generatedDocs.maturityReport?.isSufficient && !hasRealAnalysisDoc) {
             return {
                label: "İş Analizi Dokümanı Oluştur",
                action: () => onGenerateDoc('analysis'),
                icon: NextActionIcons.CREATE_ANALYSIS,
                disabled: false
            };
        }
        const firstQuestion = generatedDocs.maturityReport?.suggestedQuestions?.[0];
        if (firstQuestion) {
             return {
                label: "Analizi Derinleştir",
                action: () => onSendMessage(firstQuestion, false),
                icon: NextActionIcons.DEEPEN,
                disabled: false,
                tooltip: `Öneri: "${firstQuestion}" sorusunu sorun.`
            };
        }
        if (hasMessages) {
            return {
                label: "Analizi Derinleştirmek İçin Soru Sorun",
                action: () => {},
                icon: NextActionIcons.DEEPEN,
                disabled: true,
                tooltip: "Daha fazla detay için soru sorabilir veya olgunluk kontrolü yapabilirsiniz."
            };
        }

        return {
            label: "Başlamak için bir mesaj gönderin",
            action: () => {},
            icon: NextActionIcons.DEEPEN,
            disabled: true
        };
    }, [conversation, onGenerateDoc, onGenerateTasks, onSendMessage, onEvaluateDocument]);
};

export const App: React.FC<AppProps> = ({ user, onLogout }) => {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [generatingDocType, setGeneratingDocType] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null>(null);
    const [appMode, setAppMode] = useState<AppMode>('analyst');
    const [geminiModel, setGeminiModel] = useState<GeminiModel>(() => (localStorage.getItem('geminiModel') as GeminiModel) || 'gemini-2.5-flash');
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);

    // Modal states
    const [isNewAnalysisModalOpen, setIsNewAnalysisModalOpen] = useState(false);
    const [isDeveloperPanelOpen, setIsDeveloperPanelOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isLiveCoPilotOpen, setIsLiveCoPilotOpen] = useState(false);
    const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
    const [isFeedbackDashboardOpen, setIsFeedbackDashboardOpen] = useState(false);
    
    // Document-related state
    const [activeDocTab, setActiveDocTab] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability'>('analysis');
    const [selectedTemplates, setSelectedTemplates] = useState({ analysis: 'default-analysis', test: 'default-test' });
    const [inlineModificationState, setInlineModificationState] = useState<{ docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null>(null);
    const [diagramType, setDiagramType] = useState<'mermaid' | 'bpmn'>('mermaid');
    const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);


    // --- Computed State ---
    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConversationId) ?? null;
    }, [conversations, activeConversationId]);

    // --- Effects ---

    // API Key Check on Load
    useEffect(() => {
        if (!process.env.API_KEY) {
            setApiKeyError("Uygulamanın çalışması için Gemini API anahtarı gereklidir. Lütfen bu geliştirme ortamının 'Secrets' (Sırlar) bölümünde `API_KEY` adıyla anahtarınızı tanımlayın.");
        }
    }, []);

    // Theme Management
    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.classList.toggle('dark', isDark);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Fetch Initial Conversations
    useEffect(() => {
        const fetchConversations = async () => {
            const { data, error } = await supabase
                .from('conversations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching conversations:', error);
            } else {
                setConversations(data as Conversation[]);
                if (data.length > 0) {
                    setActiveConversationId(data[0].id);
                } else {
                    setIsNewAnalysisModalOpen(true);
                }
            }
            setIsLoadingConversations(false);
        };
        fetchConversations();
    }, []);

    // --- Handlers ---
    const handleUpdateConversation = useCallback(async (id: string, updates: Partial<Conversation>): Promise<void> => {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        const { error } = await supabase.from('conversations').update(updates).eq('id', id);
        if (error) console.error('Error updating conversation:', error);
    }, []);
    
    const handleNewConversation = useCallback(async (initialDoc?: { content: string, title?: string }) => {
        setIsProcessing(true);
        setIsNewAnalysisModalOpen(false);

        const newConversation: Omit<Conversation, 'id' | 'created_at'> = {
            user_id: user.id,
            title: initialDoc?.title || "Yeni Analiz",
            messages: [],
            generatedDocs: {
                analysisDoc: initialDoc?.content || SAMPLE_ANALYSIS_DOCUMENT,
                testScenarios: '',
                visualization: '',
                traceabilityMatrix: '',
                maturityReport: null,
            },
            is_shared: false,
            share_id: uuidv4(),
        };

        const { data, error } = await supabase.from('conversations').insert(newConversation).select().single();

        if (error) {
            console.error('Error creating new conversation', error);
        } else if (data) {
            const createdConv = data as Conversation;
            setConversations(prev => [createdConv, ...prev]);
            setActiveConversationId(createdConv.id);

            if (initialDoc?.title && !initialDoc.content) {
                // If only a title is provided, send it as the first message
                await handleSendMessage(initialDoc.title);
            }
        }
        setIsProcessing(false);
    }, [user.id]);
    
    const handleSelectConversation = (id: string) => setActiveConversationId(id);

    const handleDeleteConversation = async (id: string) => {
        const { error } = await supabase.from('conversations').delete().eq('id', id);
        if (error) console.error('Error deleting conversation', error);
        else {
            const updatedConversations = conversations.filter(c => c.id !== id);
            setConversations(updatedConversations);
            if (activeConversationId === id) {
                setActiveConversationId(updatedConversations[0]?.id || null);
            }
        }
    };

    const handleUpdateConversationTitle = async (id: string, title: string) => {
        handleUpdateConversation(id, { title });
    };

    const handleSendMessage = useCallback(async (content: string) => {
        if (!activeConversationId || !content.trim()) return;

        setIsProcessing(true);
        const userMessage: Message = { id: uuidv4(), role: 'user', content, timestamp: new Date().toISOString() };
        
        const updatedHistory = [...(activeConversation?.messages || []), userMessage];
        handleUpdateConversation(activeConversationId, { messages: updatedHistory });

        try {
            const assistantResponse = await geminiService.continueConversation(updatedHistory, geminiModel);
            const assistantMessage: Message = { id: uuidv4(), role: 'assistant', content: assistantResponse, timestamp: new Date().toISOString() };
            const finalHistory = [...updatedHistory, assistantMessage];
            handleUpdateConversation(activeConversationId, { messages: finalHistory });
        } catch (error) {
             console.error('Error sending message:', error);
             const errorMessage: Message = { id: uuidv4(), role: 'assistant', content: `Bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen Hata'}`, timestamp: new Date().toISOString() };
             const finalHistory = [...updatedHistory, errorMessage];
             handleUpdateConversation(activeConversationId, { messages: finalHistory });
        } finally {
            setIsProcessing(false);
        }
    }, [activeConversationId, activeConversation, geminiModel, handleUpdateConversation]);

    const handleGenerateDoc = useCallback(async (type: 'analysis' | 'test' | 'viz' | 'traceability', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => {
        if (!activeConversation) return;

        setGeneratingDocType(type);
        setIsProcessing(true);
        
        try {
            let result = '';
            if (type === 'analysis') {
                const templateId = newTemplateId || selectedTemplates.analysis;
                result = await geminiService.generateAnalysisDocument(activeConversation.messages, templateId, geminiModel);
                handleUpdateConversation(activeConversation.id, { generatedDocs: { ...activeConversation.generatedDocs, analysisDoc: result } });
            } else if (type === 'test') {
                const templateId = newTemplateId || selectedTemplates.test;
                result = await geminiService.generateTestScenarios(activeConversation.generatedDocs.analysisDoc, templateId, geminiModel);
                handleUpdateConversation(activeConversation.id, { generatedDocs: { ...activeConversation.generatedDocs, testScenarios: result } });
            } else if (type === 'viz') {
                const typeToUse = newDiagramType || diagramType;
                result = await geminiService.generateDiagram(activeConversation.generatedDocs.analysisDoc, typeToUse, geminiModel);
                handleUpdateConversation(activeConversation.id, { generatedDocs: { ...activeConversation.generatedDocs, visualization: result, visualizationType: typeToUse } });
            } else if (type === 'traceability') {
                 result = await geminiService.generateTraceabilityMatrix(activeConversation.generatedDocs.analysisDoc, activeConversation.generatedDocs.testScenarios, geminiModel);
                 handleUpdateConversation(activeConversation.id, { generatedDocs: { ...activeConversation.generatedDocs, traceabilityMatrix: result } });
            }
        } catch (error) {
            console.error(`Error generating ${type}:`, error);
        } finally {
            setGeneratingDocType(null);
            setIsProcessing(false);
        }
    }, [activeConversation, geminiModel, selectedTemplates, diagramType, handleUpdateConversation]);
    
    const handleCheckMaturity = useCallback(async () => {
        if (!activeConversation) return;

        setGeneratingDocType('maturity');
        setIsProcessing(true);
        try {
            const report = await geminiService.checkAnalysisMaturity(activeConversation.messages, geminiModel);
            handleUpdateConversation(activeConversation.id, { generatedDocs: { ...activeConversation.generatedDocs, maturityReport: report } });
            setActiveDocTab('maturity');
        } catch (error) {
            console.error('Error checking maturity:', error);
        } finally {
            setGeneratingDocType(null);
            setIsProcessing(false);
        }
    }, [activeConversation, geminiModel, handleUpdateConversation]);

    const nextAction = useNextBestAction(
        activeConversation,
        handleGenerateDoc,
        () => setIsTaskModalOpen(true),
        handleSendMessage,
        () => handleSendMessage("Bu dokümanı analiz et, eksiklerini ve belirsizliklerini belirle, ve bunları gidermek için bana sorular sor.")
    );

    const AnalystView = () => (
        <div className="flex-1 flex flex-col min-h-0">
            {activeConversation ? (
                <>
                    <div className="flex-1 overflow-y-auto p-4 md:p-6">
                        <div className="max-w-4xl mx-auto w-full">
                            {activeConversation.messages.length === 0 ? (
                                <PromptSuggestions onSelectPrompt={(p) => handleSendMessage(p)} />
                            ) : (
                                <ChatMessageHistory user={user} chatHistory={activeConversation.messages} isLoading={isProcessing && !generatingDocType} onFeedbackUpdate={(messageId, feedbackData) => {
                                    const updatedMessages = activeConversation.messages.map(msg => msg.id === messageId ? { ...msg, feedback: feedbackData } : msg);
                                    handleUpdateConversation(activeConversation.id, { messages: updatedMessages });
                                }} />
                            )}
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-900/50 flex-shrink-0 space-y-4">
                         <ActionButtons
                            onCheckMaturity={handleCheckMaturity}
                            onStartLiveSession={() => setIsLiveCoPilotOpen(true)}
                            onViewDocuments={() => setIsDocumentsModalOpen(true)}
                            onSuggestNextFeature={() => { /* Placeholder */ }}
                            isLoading={isProcessing}
                            isConversationStarted={activeConversation.messages.length > 0}
                            nextAction={nextAction}
                        />
                        <div className="max-w-4xl mx-auto">
                            <ChatInterface isLoading={isProcessing || !!inlineModificationState} onSendMessage={handleSendMessage} activeConversationId={activeConversationId} />
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                    <p>Başlamak için yeni bir analiz başlatın veya mevcut bir sohbeti seçin.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Header
                user={user}
                onLogout={onLogout}
                theme={theme}
                onThemeChange={setTheme}
                appMode={appMode}
                onAppModeChange={setAppMode}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                activeConversation={activeConversation}
                onOpenShareModal={() => setIsShareModalOpen(true)}
                isProcessing={isProcessing}
            />
            {apiKeyError && (
                <div className="bg-red-100 dark:bg-red-900/50 border-b-2 border-red-500 text-red-800 dark:text-red-200 p-3 text-sm font-semibold text-center flex items-center justify-center gap-2 error-banner-enter">
                    <AlertTriangle className="h-5 w-5" />
                    {apiKeyError}
                </div>
            )}
            <div className="flex-1 flex min-h-0">
                <Sidebar
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onSelectConversation={handleSelectConversation}
                    onNewConversation={() => setIsNewAnalysisModalOpen(true)}
                    onUpdateConversationTitle={handleUpdateConversationTitle}
                    onDeleteConversation={handleDeleteConversation}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                />
                <main className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-72' : 'ml-0'}`}>
                    {appMode === 'analyst' ? <AnalystView /> : <ProjectBoard user={user} />}
                </main>
            </div>
            
             {/* Modals */}
            {isNewAnalysisModalOpen && (
                <NewAnalysisModal
                    isOpen={isNewAnalysisModalOpen}
                    onClose={() => setIsNewAnalysisModalOpen(false)}
                    onStartFromScratch={() => handleNewConversation({ title: 'Yeni Analiz' })}
                    onStartWithDocument={(content, title) => handleNewConversation({ content, title: title || 'İçe Aktarılan Analiz' })}
                    isProcessing={isProcessing}
                />
            )}
            {activeConversation && isShareModalOpen && (
                 <ShareModal
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    conversation={activeConversation}
                    onUpdateShareSettings={(id, updates) => handleUpdateConversation(id, updates)}
                />
            )}
            {activeConversation && isTaskModalOpen && (
                <TaskGenerationModal
                    isOpen={isTaskModalOpen}
                    onClose={() => setIsTaskModalOpen(false)}
                    conversation={activeConversation}
                    isGenerating={isProcessing}
                    setIsGenerating={setIsProcessing}
                    model={geminiModel}
                />
            )}
            {activeConversation && isLiveCoPilotOpen && (
                <LiveCoPilotModal
                    isOpen={isLiveCoPilotOpen}
                    onClose={() => setIsLiveCoPilotOpen(false)}
                    conversation={activeConversation}
                    user={user}
                    isProcessing={isProcessing}
                    generatingDocType={generatingDocType}
                    inlineModificationState={inlineModificationState}
                    selectedTemplates={selectedTemplates}
                    activeDocTab={activeDocTab}
                    setActiveDocTab={setActiveDocTab}
                    onSendMessage={handleSendMessage}
                    onUpdateConversation={handleUpdateConversation}
                    onModifySelection={async (text, prompt, key) => { /* Placeholder */ }}
                    onModifyDiagram={async (prompt) => { /* Placeholder */ }}
                    onGenerateDoc={handleGenerateDoc}
                    onTemplateChange={{
                        analysis: (e) => setSelectedTemplates(p => ({...p, analysis: e.target.value})),
                        test: (e) => setSelectedTemplates(p => ({...p, test: e.target.value}))
                    }}
                    onSelectMaturityQuestion={(q) => handleSendMessage(q)}
                    onRecheckMaturity={handleCheckMaturity}
                    templates={{ analysis: ANALYSIS_TEMPLATES, test: TEST_SCENARIO_TEMPLATES }}
                    diagramType={diagramType}
                    setDiagramType={setDiagramType}
                />
            )}
             {activeConversation && isDocumentsModalOpen && (
                <DocumentsModal
                    isOpen={isDocumentsModalOpen}
                    onClose={() => setIsDocumentsModalOpen(false)}
                    conversation={activeConversation}
                    isGenerating={isProcessing}
                    generatingDocType={generatingDocType}
                    onUpdateConversation={handleUpdateConversation}
                    onModifySelection={async (text, prompt, key) => { /* Placeholder */ }}
                    onModifyDiagram={async (prompt) => { /* Placeholder */ }}
                    onGenerateDoc={handleGenerateDoc}
                    inlineModificationState={inlineModificationState}
                    templates={{ analysis: ANALYSIS_TEMPLATES, test: TEST_SCENARIO_TEMPLATES }}
                    selectedTemplates={selectedTemplates}
                    onTemplateChange={{
                        analysis: (e) => setSelectedTemplates(p => ({...p, analysis: e.target.value})),
                        test: (e) => setSelectedTemplates(p => ({...p, test: e.target.value}))
                    }}
                    activeDocTab={activeDocTab}
                    setActiveDocTab={setActiveDocTab}
                    onSelectMaturityQuestion={(q) => handleSendMessage(q)}
                    onRecheckMaturity={handleCheckMaturity}
                    diagramType={diagramType}
                    setDiagramType={setDiagramType}
                />
            )}
        </div>
    );
};
