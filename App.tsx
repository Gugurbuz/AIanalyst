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
import { NewAnalysisModal } from './components/NewAnalysisModal'; // New
import { SAMPLE_ANALYSIS_DOCUMENT, ANALYSIS_TEMPLATES, TEST_SCENARIO_TEMPLATES } from './templates';
import type { User, Conversation, Message, Theme, AppMode, GeminiModel, GeneratedDocs, FeedbackItem } from './types';
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

        // Rule 0: Doc exists, but no messages yet. First action is to evaluate it.
        if (hasRealAnalysisDoc && !hasMessages) {
             return {
                label: "Dokümanı Değerlendir ve Soru Sor",
                action: onEvaluateDocument,
                icon: NextActionIcons.EVALUATE_DOC,
                disabled: false,
                tooltip: "AI'nın mevcut dokümanı analiz etmesini ve iyileştirme için sorular sormasını sağlayın."
            };
        }

        // Rule 5: All docs exist, suggest creating tasks
        if (hasRealAnalysisDoc && generatedDocs.visualization && generatedDocs.testScenarios) {
            return {
                label: "Proje Görevleri Oluştur",
                action: onGenerateTasks,
                icon: NextActionIcons.CREATE_TASKS,
                disabled: false
            };
        }
        // Rule 4: Analysis and Viz exist, no tests
        if (hasRealAnalysisDoc && generatedDocs.visualization && !generatedDocs.testScenarios) {
             return {
                label: "Test Senaryoları Oluştur",
                action: () => onGenerateDoc('test'),
                icon: NextActionIcons.CREATE_TESTS,
                disabled: false
            };
        }
        // Rule 3: Analysis doc exists, no visualization
        if (hasRealAnalysisDoc && !generatedDocs.visualization) {
            return {
                label: "Süreç Akışını Görselleştir",
                action: () => onGenerateDoc('viz'),
                icon: NextActionIcons.CREATE_VIZ,
                disabled: false
            };
        }
         // Rule 2: Mature analysis, no doc yet
        if (generatedDocs.maturityReport?.isSufficient && !hasRealAnalysisDoc) {
             return {
                label: "İş Analizi Dokümanı Oluştur",
                action: () => onGenerateDoc('analysis'),
                icon: NextActionIcons.CREATE_ANALYSIS,
                disabled: false
            };
        }
        // Rule 1: Early stage, suggest questions
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
         // Default: If no maturity report yet, but conversation has started
        if (hasMessages) {
            return {
                label: "Analizi Derinleştirmek İçin Soru Sorun",
                action: () => {},
                icon: NextActionIcons.DEEPEN,
                disabled: true,
                tooltip: "Daha fazla detay için soru sorabilir veya olgunluk kontrolü yapabilirsiniz."
            };
        }

        // Catch-all default if no other condition is met
        return {
            label: "Başlamak için bir mesaj gönderin",
            action: () => {},
            icon: NextActionIcons.DEEPEN,
            disabled: true
        };

    }, [conversation, onGenerateDoc, onGenerateTasks, onSendMessage, onEvaluateDocument]);
};

interface AnalystViewProps {
    user: User;
    isLoadingConversations: boolean;
    activeConversation: Conversation | null;
    isProcessing: boolean;
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null;
    inlineModificationState: { docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null;
    onSendMessage: (content: string, isSystemMessage?: boolean) => Promise<void>;
    onUpdateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
    onCheckMaturity: () => Promise<void>;
    onStartLiveSession: () => void;
    onViewDocuments: () => void;
    onSuggestNextFeature: () => void;
    nextAction: {
        label: string;
        action: () => void;
        icon: React.ReactElement;
        disabled: boolean;
        tooltip?: string;
    };
}

const WelcomeLogoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path className="fill-slate-400 dark:fill-slate-600" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
      <circle className="fill-slate-300 dark:fill-slate-500" cx="50" cy="58" r="10"/>
    </svg>
);


const AnalystView: React.FC<AnalystViewProps> = ({
    user,
    isLoadingConversations,
    activeConversation,
    isProcessing,
    generatingDocType,
    inlineModificationState,
    onSendMessage,
    onUpdateConversation,
    onCheckMaturity,
    onStartLiveSession,
    onViewDocuments,
    onSuggestNextFeature,
    nextAction,
}) => {
    if (isLoadingConversations) {
        return <div className="p-6 text-center">Sohbetler yükleniyor...</div>;
    }

    if (!activeConversation) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                <WelcomeLogoIcon className="w-16 h-16 mb-4" />
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Asisty.ai'ye Hoş Geldiniz</h2>
                <p className="mt-2 max-w-lg text-slate-500 dark:text-slate-400">
                    Yeni bir analiz başlatmak için kenar çubuğundaki butonu kullanın veya mevcut bir sohbeti seçin.
                </p>
            </div>
        );
    }
    
    return (
         <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 flex-shrink-0">
                 <ActionButtons
                    onCheckMaturity={onCheckMaturity}
                    onStartLiveSession={onStartLiveSession}
                    onViewDocuments={onViewDocuments}
                    onSuggestNextFeature={onSuggestNextFeature}
                    isLoading={isProcessing}
                    isConversationStarted={activeConversation.messages.length > 0 || !!activeConversation.generatedDocs.analysisDoc}
                    nextAction={nextAction}
                />
            </div>
            <div className="flex-1 flex flex-col p-4 min-h-0">
                <div className="flex-1 flex flex-col h-full min-h-0 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        {activeConversation.messages.length === 0 ? (
                           <PromptSuggestions onSelectPrompt={(p) => onSendMessage(p)} />
                        ) : (
                           <ChatMessageHistory
                                user={user}
                                chatHistory={activeConversation.messages}
                                isLoading={isProcessing && !generatingDocType}
                                onFeedbackUpdate={(messageId, feedbackData) => {
                                     const updatedMessages = activeConversation.messages.map(msg => msg.id === messageId ? { ...msg, feedback: feedbackData } : msg);
                                     onUpdateConversation(activeConversation.id, { messages: updatedMessages });
                                }}
                            />
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <ChatInterface
                            isLoading={isProcessing || !!inlineModificationState}
                            onSendMessage={onSendMessage}
                            activeConversationId={activeConversation.id}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const ErrorDisplay: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
    <div className="absolute top-16 left-0 right-0 z-30 error-banner-enter">
        <div className="bg-red-100 dark:bg-red-900/50 border-b-2 border-red-500 p-3 shadow-lg flex items-center justify-between mx-auto">
            <div className="flex items-center">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{message}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-300">
                <X className="h-5 w-5" />
            </button>
        </div>
    </div>
);


export const App: React.FC<AppProps> = ({ user, onLogout }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // UI State
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    const [appMode, setAppMode] = useState<AppMode>('analyst');
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
    
    // Model & Config State
    const [geminiModel, setGeminiModel] = useState<GeminiModel>(() => (localStorage.getItem('geminiModel') as GeminiModel) || 'gemini-2.5-flash');
    const [selectedTemplates, setSelectedTemplates] = useState({ analysis: 'default-analysis', test: 'default-test' });
    const [activeDocTab, setActiveDocTab] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability'>('analysis');
    const [diagramType, setDiagramType] = useState<'mermaid' | 'bpmn'>('mermaid');

    // Modal States
    const [isNewAnalysisModalOpen, setIsNewAnalysisModalOpen] = useState(false); // New
    const [isDeveloperPanelOpen, setIsDeveloperPanelOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isTaskGenModalOpen, setIsTaskGenModalOpen] = useState(false);
    const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
    const [isLiveSessionModalOpen, setIsLiveSessionModalOpen] = useState(false);

    // Document Generation & Inline Modification State
    const [generatingDocType, setGeneratingDocType] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null>(null);
    const [inlineModificationState, setInlineModificationState] = useState<{ docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null>(null);
    
    // Feedback Dashboard State
    const [isFeedbackDashboardOpen, setIsFeedbackDashboardOpen] = useState(false);
    const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);
    const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);

    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConversationId) || null;
    }, [conversations, activeConversationId]);
    
    // Check for API key on startup
    useEffect(() => {
        if (!process.env.API_KEY) {
            setError("Gemini API Anahtarı ayarlanmamış. Uygulamanın çalışması için bu anahtarın ortam değişkeni olarak ayarlanması gerekmektedir.");
        }
    }, []);


    // --- Core Data Fetching & Management ---
    const fetchConversations = useCallback(async () => {
        setIsLoadingConversations(true);
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            setError(error.message);
        } else if (data) {
            setConversations(data as Conversation[]);
        }
        setIsLoadingConversations(false);
    }, [user.id]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);
    
    const handleUpdateConversation = useCallback(async (id: string, updates: Partial<Conversation>) => {
        // Optimistic UI update
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        
        const { error } = await supabase.from('conversations').update(updates).eq('id', id);
        if (error) {
            console.error("Failed to update conversation:", error);
            setError("Sohbet güncellenemedi. Değişiklikleriniz geri alınabilir.");
            fetchConversations(); // Revert on failure
        }
    }, [fetchConversations]);

    // --- Theme & UI Effects ---
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.toggle('dark', systemTheme === 'dark');
        } else {
            root.classList.toggle('dark', theme === 'dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // --- Dev Panel ---
    useEffect(() => {
        let keySequence = '';
        const targetSequence = 'devmode';
        const handler = (e: KeyboardEvent) => {
            keySequence += e.key.toLowerCase();
            if (keySequence.length > targetSequence.length) {
                keySequence = keySequence.slice(1);
            }
            if (keySequence === targetSequence) {
                setIsDeveloperPanelOpen(true);
                keySequence = '';
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // --- New Conversation Handlers ---
    const handleStartFromScratch = async () => {
        setIsNewAnalysisModalOpen(false);
        setIsProcessing(true);
        const { data, error } = await supabase
            .from('conversations')
            .insert({ 
                user_id: user.id, 
                title: 'Yeni Analiz',
                messages: [
                    { id: `msg-${Date.now()}`, role: 'assistant', content: "Harika, başlayalım! Bu projenin ana hedefini veya çözmek istediğiniz sorunu kısaca anlatır mısınız?", timestamp: new Date().toISOString() }
                ],
                generatedDocs: { analysisDoc: SAMPLE_ANALYSIS_DOCUMENT, testScenarios: '', visualization: '', visualizationType: 'mermaid', traceabilityMatrix: '', maturityReport: null }
            })
            .select()
            .single();
        
        if (error) { setError(error.message); } 
        else if (data) {
            setConversations(prev => [data as Conversation, ...prev]);
            setActiveConversationId(data.id);
            setAppMode('analyst');
        }
        setIsProcessing(false);
    };

    const handleStartWithPastedDocument = async (documentContent: string, title: string) => {
        setIsNewAnalysisModalOpen(false);
        setIsProcessing(true);
        const { data, error } = await supabase
            .from('conversations')
            .insert({ 
                user_id: user.id, 
                title: title || 'İyileştirilecek Analiz',
                messages: [], // Start with no messages
                generatedDocs: { 
                    analysisDoc: documentContent, 
                    testScenarios: '', 
                    visualization: '',
                    visualizationType: 'mermaid',
                    traceabilityMatrix: '',
                    maturityReport: null 
                }
            })
            .select()
            .single();
        
        if (error) { setError(error.message); } 
        else if (data) {
            setConversations(prev => [data as Conversation, ...prev]);
            setActiveConversationId(data.id);
            setAppMode('analyst');
            setActiveDocTab('analysis'); // Go directly to the doc
        }
        setIsProcessing(false);
    };

    const handleSelectConversation = (id: string) => {
        setActiveConversationId(id);
        setAppMode('analyst');
    };
    
    const handleUpdateConversationTitle = (id: string, title: string) => {
        handleUpdateConversation(id, { title });
    };

    const handleDeleteConversation = async (id: string) => {
        if (!window.confirm("Bu sohbeti silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) return;
        
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
            setActiveConversationId(conversations.length > 1 ? conversations.find(c => c.id !== id)?.id || null : null);
        }

        const { error } = await supabase.from('conversations').delete().eq('id', id);
        if (error) {
            setError(error.message);
            fetchConversations(); // Revert
        }
    };
    
    // --- Main Chat & AI Logic ---
     const handleSendMessage = async (content: string, isSystemMessage: boolean = false) => {
        if (!activeConversation) return;
        
        const newUserMessage: Message = { id: `msg-${Date.now()}`, role: 'user', content, timestamp: new Date().toISOString() };
        const updatedMessages = isSystemMessage ? activeConversation.messages : [...activeConversation.messages, newUserMessage];
        
        // Don't show system messages in history, but send them to AI
        if (!isSystemMessage) {
            handleUpdateConversation(activeConversation.id, { messages: updatedMessages });
        }

        setIsProcessing(true);
        setError(null);
        
        const messagesForApi = isSystemMessage
            ? [...activeConversation.messages, { id: `sys-${Date.now()}`, role: 'user' as const, content, timestamp: new Date().toISOString() }]
            : updatedMessages;
        
        if (messagesForApi.filter(msg => msg.role === 'user' || msg.role === 'assistant').length === 0) {
            setError("API'ye gönderilecek geçerli bir mesaj bulunamadı.");
            setIsProcessing(false);
            return;
        }


        try {
            if (activeConversation.messages.length <= 1) { // <= 1 because of initial AI message
                const newTitle = await geminiService.generateConversationTitle(content);
                handleUpdateConversation(activeConversation.id, { title: newTitle });
            }
            
            const modelToUse = geminiModel;
            const modelConfig = undefined;
            const templates = { analysis: selectedTemplates.analysis, test: selectedTemplates.test };
            const result = await geminiService.processAnalystMessage(messagesForApi, activeConversation.generatedDocs, templates, modelToUse, modelConfig);

            if (result.type === 'chat') {
                const newAssistantMessage: Message = { id: `msg-${Date.now() + 1}`, role: 'assistant', content: result.content, timestamp: new Date().toISOString() };
                handleUpdateConversation(activeConversation.id, { messages: [...updatedMessages, newAssistantMessage] });
            } else if (result.type === 'doc_update') {
                const { docKey, content: newContent, confirmation } = result;
                const newDocs: Partial<GeneratedDocs> = { ...activeConversation.generatedDocs, [docKey]: newContent };
                const newAssistantMessage: Message = { id: `msg-${Date.now() + 1}`, role: 'assistant', content: confirmation, timestamp: new Date().toISOString() };
                await handleUpdateConversation(activeConversation.id, { messages: [...updatedMessages, newAssistantMessage], generatedDocs: newDocs as GeneratedDocs });
                
                const tabMap: { [key in keyof GeneratedDocs]?: 'analysis' | 'viz' | 'test' } = {
                    analysisDoc: 'analysis',
                    visualization: 'viz',
                    testScenarios: 'test',
                };
                 if (tabMap[docKey as keyof typeof tabMap]) {
                    setActiveDocTab(tabMap[docKey as keyof typeof tabMap]!);
                    setIsDocumentsModalOpen(true);
                }
            }
        } catch (e) {
            const err = e instanceof Error ? e.message : 'Bir hata oluştu.';
            setError(err);
        } finally {
            setIsProcessing(false);
        }
    };
    
    // --- Action Button Handlers ---
    const handleCheckMaturity = async () => {
        if (!activeConversation || activeConversation.messages.length === 0) return;
        setIsProcessing(true);
        setGeneratingDocType('maturity');
        setError(null);
        try {
             const modelToUse = geminiModel;
             const report = await geminiService.checkAnalysisMaturity(activeConversation.messages, modelToUse);
             const newDocs = { ...activeConversation.generatedDocs, maturityReport: report };
             await handleUpdateConversation(activeConversation.id, { generatedDocs: newDocs });
             setActiveDocTab('maturity');
             setIsDocumentsModalOpen(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Olgunluk raporu oluşturulamadı.');
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
        }
    };
    
    const handleEvaluateDocument = async () => {
        if (!activeConversation || !activeConversation.generatedDocs.analysisDoc) return;
        const systemMessage = "Lütfen bu dokümanı incele ve iyileştirmek için sorular sor.";
        await handleSendMessage(systemMessage, true);
    };

    const handleGenerateDoc = async (type: 'analysis' | 'test' | 'viz' | 'traceability', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => {
        if (!activeConversation) return;
        setIsProcessing(true);
        setGeneratingDocType(type);
        setError(null);
        
        try {
            const modelToUse = geminiModel;
            const modelConfig = undefined;
            const currentDocs = activeConversation.generatedDocs;

            if (type === 'analysis') {
                const templateToUse = newTemplateId || selectedTemplates.analysis;
                const newContent = await geminiService.generateAnalysisDocument(activeConversation.messages, templateToUse, modelToUse, modelConfig);
                await handleUpdateConversation(activeConversation.id, { generatedDocs: { ...currentDocs, analysisDoc: newContent } });
            } else if (type === 'test') {
                const templateToUse = newTemplateId || selectedTemplates.test;
                const newContent = await geminiService.generateTestScenarios(currentDocs.analysisDoc, templateToUse, modelToUse, modelConfig);
                await handleUpdateConversation(activeConversation.id, { generatedDocs: { ...currentDocs, testScenarios: newContent } });
            } else if (type === 'viz') {
                 const typeToGenerate = newDiagramType || diagramType;
                 const newContent = await geminiService.generateDiagram(currentDocs.analysisDoc, typeToGenerate, modelToUse, modelConfig);
                 await handleUpdateConversation(activeConversation.id, { generatedDocs: { ...currentDocs, visualization: newContent, visualizationType: typeToGenerate } });
            } else if (type === 'traceability') {
                 const newContent = await geminiService.generateTraceabilityMatrix(currentDocs.analysisDoc, currentDocs.testScenarios, modelToUse, modelConfig);
                 await handleUpdateConversation(activeConversation.id, { generatedDocs: { ...currentDocs, traceabilityMatrix: newContent } });
            }
             const newTab = type === 'analysis' ? 'analysis' : type === 'viz' ? 'viz' : type === 'test' ? 'test' : 'traceability';
             setActiveDocTab(newTab);
             setIsDocumentsModalOpen(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Doküman oluşturulamadı.');
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
        }
    };
    
    const handleModifySelection = async (originalText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => {
        if (!activeConversation) return;
        setInlineModificationState({ docKey, originalText });
        try {
            const modifiedText = await geminiService.modifySelectedText(originalText, userPrompt);
            const currentDocs = activeConversation.generatedDocs;
            const newDocContent = currentDocs[docKey].replace(originalText, modifiedText);
            
            handleUpdateConversation(activeConversation.id, {
                generatedDocs: { ...currentDocs, [docKey]: newDocContent }
            });

        } catch (e) {
            setError(e instanceof Error ? e.message : 'Metin düzenlenemedi.');
        } finally {
            setInlineModificationState(null);
        }
    };
    
    const handleModifyDiagram = async (userPrompt: string) => {
        if (!activeConversation) return;
        setIsProcessing(true);
        setGeneratingDocType('viz');
        setError(null);
        try {
            const currentCode = activeConversation.generatedDocs.visualization;
            const currentType = activeConversation.generatedDocs.visualizationType || 'mermaid';
            const newCode = await geminiService.modifyDiagram(currentCode, userPrompt, geminiModel, currentType);
            const currentDocs = activeConversation.generatedDocs;
            handleUpdateConversation(activeConversation.id, {
                generatedDocs: { ...currentDocs, visualization: newCode }
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Diyagram düzenlenemedi.');
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
        }
    };


    const handleSuggestNextFeature = async () => {
        if (!activeConversation || !activeConversation.generatedDocs.analysisDoc) return;

        setIsProcessing(true);
        setError(null);
        try {
            const modelToUse = geminiModel;
            const modelConfig = undefined;

            const suggestion = await geminiService.suggestNextFeature(
                activeConversation.generatedDocs.analysisDoc,
                activeConversation.messages,
                modelToUse,
                modelConfig
            );

            // Send the suggestion as a new user message to continue the conversation
            await handleSendMessage(suggestion, false);

        } catch (e) {
            const err = e instanceof Error ? e.message : 'Bir hata oluştu.';
            setError(err);
            setIsProcessing(false); // Ensure processing is stopped on error
        }
    };
    
    const handleUpdateShareSettings = async (conversationId: string, updates: { is_shared: boolean }) => {
        await handleUpdateConversation(conversationId, updates);
    };
    
     const handleFetchAndShowFeedback = async () => {
        setIsFetchingFeedback(true);
        setError(null);
        try {
            const { data: convos, error } = await supabase
                .from('conversations')
                .select('title, messages')
                .eq('user_id', user.id);

            if (error) throw error;

            const feedbackItems: FeedbackItem[] = [];
            convos.forEach(c => {
                c.messages.forEach((m: Message) => {
                    if (m.feedback && (m.feedback.rating || m.feedback.comment)) {
                        feedbackItems.push({
                            message: m,
                            conversationTitle: c.title,
                        });
                    }
                });
            });
            setAllFeedback(feedbackItems);
            setIsFeedbackDashboardOpen(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Geri bildirim verileri alınamadı.');
        } finally {
            setIsFetchingFeedback(false);
        }
    };

    const handleTemplateChange = {
        analysis: (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newTemplateId = e.target.value;
            setSelectedTemplates(prev => ({ ...prev, analysis: newTemplateId }));
            if (activeConversation?.messages.length) {
                handleGenerateDoc('analysis', newTemplateId);
            }
        },
        test: (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newTemplateId = e.target.value;
            setSelectedTemplates(prev => ({ ...prev, test: newTemplateId }));
            if (activeConversation?.generatedDocs.analysisDoc) {
                handleGenerateDoc('test', newTemplateId);
            }
        },
    };


    const nextBestAction = useNextBestAction(
        activeConversation,
        handleGenerateDoc,
        () => setIsTaskGenModalOpen(true),
        handleSendMessage,
        handleEvaluateDocument
    );


    return (
        <div className={`flex h-screen font-sans bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200`}>
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
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-72' : 'ml-0'}`}>
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
                    isProcessing={isProcessing || !!inlineModificationState}
                />
                <main className="flex-1 overflow-hidden relative">
                    {error && <ErrorDisplay message={error} onClose={() => setError(null)} />}
                    {appMode === 'analyst' ? (
                        <AnalystView
                            user={user}
                            isLoadingConversations={isLoadingConversations}
                            activeConversation={activeConversation}
                            isProcessing={isProcessing}
                            generatingDocType={generatingDocType}
                            inlineModificationState={inlineModificationState}
                            onSendMessage={handleSendMessage}
                            onUpdateConversation={handleUpdateConversation}
                            onCheckMaturity={handleCheckMaturity}
                            onStartLiveSession={() => setIsLiveSessionModalOpen(true)}
                            onViewDocuments={() => setIsDocumentsModalOpen(true)}
                            onSuggestNextFeature={handleSuggestNextFeature}
                            nextAction={nextBestAction}
                        />
                    ) : <ProjectBoard user={user} />}
                </main>
            </div>
            
            {/* --- Modals --- */}
             <NewAnalysisModal
                isOpen={isNewAnalysisModalOpen}
                onClose={() => setIsNewAnalysisModalOpen(false)}
                onStartFromScratch={handleStartFromScratch}
                onStartWithDocument={handleStartWithPastedDocument}
                isProcessing={isProcessing}
            />
             {isDeveloperPanelOpen && (
                 <DeveloperPanel
                    onClose={() => setIsDeveloperPanelOpen(false)}
                    modelName={geminiModel}
                    onModelNameChange={(name) => { setGeminiModel(name as GeminiModel); localStorage.setItem('geminiModel', name); }}
                    supabaseUrl={localStorage.getItem('supabaseUrl') || ''}
                    onSupabaseUrlChange={(url) => localStorage.setItem('supabaseUrl', url)}
                    supabaseAnonKey={localStorage.getItem('supabaseAnonKey') || ''}
                    onSupabaseAnonKeyChange={(key) => localStorage.setItem('supabaseAnonKey', key)}
                    testUserEmail={localStorage.getItem('devTestUserEmail') || ''}
                    onTestUserEmailChange={(email) => localStorage.setItem('devTestUserEmail', email)}
                    testUserPassword={localStorage.getItem('devTestUserPassword') || ''}
                    onTestUserPasswordChange={(pw) => localStorage.setItem('devTestUserPassword', pw)}
                    isFetchingFeedback={isFetchingFeedback}
                    onToggleFeedbackDashboard={handleFetchAndShowFeedback}
                />
            )}
            {isShareModalOpen && activeConversation && (
                <ShareModal
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    conversation={activeConversation}
                    onUpdateShareSettings={handleUpdateShareSettings}
                />
            )}
            {isTaskGenModalOpen && activeConversation && (
                <TaskGenerationModal
                    isOpen={isTaskGenModalOpen}
                    onClose={() => setIsTaskGenModalOpen(false)}
                    conversation={activeConversation}
                    isGenerating={isProcessing}
                    setIsGenerating={setIsProcessing}
                    model={geminiModel}
                />
            )}
            {isDocumentsModalOpen && activeConversation && (
                 <DocumentsModal
                    isOpen={isDocumentsModalOpen}
                    onClose={() => setIsDocumentsModalOpen(false)}
                    conversation={activeConversation}
                    isGenerating={isProcessing}
                    generatingDocType={generatingDocType}
                    onUpdateConversation={handleUpdateConversation}
                    onModifySelection={handleModifySelection}
                    onModifyDiagram={handleModifyDiagram}
                    inlineModificationState={inlineModificationState}
                    onGenerateDoc={handleGenerateDoc}
                    templates={{ analysis: ANALYSIS_TEMPLATES, test: TEST_SCENARIO_TEMPLATES }}
                    selectedTemplates={selectedTemplates}
                    onTemplateChange={handleTemplateChange}
                    activeDocTab={activeDocTab}
                    setActiveDocTab={setActiveDocTab}
                    onSelectMaturityQuestion={(q) => { handleSendMessage(q); setIsDocumentsModalOpen(false); }}
                    onRecheckMaturity={handleCheckMaturity}
                    diagramType={diagramType}
                    setDiagramType={setDiagramType}
                 />
            )}
            {isLiveSessionModalOpen && activeConversation && (
                <LiveCoPilotModal
                    user={user}
                    isOpen={isLiveSessionModalOpen}
                    onClose={() => setIsLiveSessionModalOpen(false)}
                    conversation={activeConversation}
                    isProcessing={isProcessing}
                    generatingDocType={generatingDocType}
                    inlineModificationState={inlineModificationState}
                    selectedTemplates={selectedTemplates}
                    activeDocTab={activeDocTab}
                    setActiveDocTab={setActiveDocTab}
                    onSendMessage={handleSendMessage}
                    onUpdateConversation={handleUpdateConversation}
                    onModifySelection={handleModifySelection}
                    onModifyDiagram={handleModifyDiagram}
                    onGenerateDoc={handleGenerateDoc}
                    templates={{ analysis: ANALYSIS_TEMPLATES, test: TEST_SCENARIO_TEMPLATES }}
                    onTemplateChange={handleTemplateChange}
                    onSelectMaturityQuestion={(q) => { handleSendMessage(q); setIsLiveSessionModalOpen(false); }}
                    onRecheckMaturity={handleCheckMaturity}
                    diagramType={diagramType}
                    setDiagramType={setDiagramType}
                />
            )}
        </div>
    );
};