// App.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './services/supabaseClient';
import { geminiService } from './services/geminiService';
import type { StreamChunk } from './services/geminiService';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { ChatMessageHistory } from './components/ChatMessageHistory';
import { ActionButtons } from './components/ActionButtons';
import { PromptSuggestions } from './components/PromptSuggestions';
import { ShareModal } from './components/ShareModal';
import { ProjectBoard } from './components/ProjectBoard';
import { DocumentWorkspace } from './components/DocumentWorkspace';
import { NewAnalysisModal } from './components/NewAnalysisModal';
import { FeatureSuggestionsModal } from './components/FeatureSuggestionsModal';
import { RegenerateConfirmationModal } from './components/RegenerateConfirmationModal';
import { SAMPLE_ANALYSIS_DOCUMENT, ANALYSIS_TEMPLATES, TEST_SCENARIO_TEMPLATES } from './templates';
import type { User, Conversation, Message, Theme, AppMode, GeminiModel, GeneratedDocs, FeedbackItem, Template, VizData, AnalysisVersion, ExpertStep } from './types';
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

// FIX: Define a default object for `GeneratedDocs` to ensure type safety during updates.
// This prevents errors where required properties might be missing after spreading.
const defaultGeneratedDocs: GeneratedDocs = {
    analysisDoc: '',
    testScenarios: '',
    visualization: '',
    traceabilityMatrix: '',
};

const useNextBestAction = (
    conversation: Conversation | null,
    onGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => void,
    onNavigateToBacklogGeneration: () => void,
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
        const hasRealAnalysisDoc = !!generatedDocs?.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");
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
        
        const hasVisualization = generatedDocs?.mermaidViz?.code || generatedDocs?.bpmnViz?.code || generatedDocs?.visualization;

        if (hasRealAnalysisDoc && hasVisualization && generatedDocs?.testScenarios) {
            return {
                label: "Proje Görevleri Oluştur",
                action: onNavigateToBacklogGeneration,
                icon: NextActionIcons.CREATE_TASKS,
                disabled: false
            };
        }
        if (hasRealAnalysisDoc && hasVisualization && !generatedDocs?.testScenarios) {
             return {
                label: "Test Senaryoları Oluştur",
                action: () => onGenerateDoc('test'),
                icon: NextActionIcons.CREATE_TESTS,
                disabled: false
            };
        }
        if (hasRealAnalysisDoc && !hasVisualization) {
            return {
                label: "Süreç Akışını Görselleştir",
                action: () => onGenerateDoc('viz'),
                icon: NextActionIcons.CREATE_VIZ,
                disabled: false
            };
        }
        if (generatedDocs?.maturityReport?.isSufficient && !hasRealAnalysisDoc) {
             return {
                label: "İş Analizi Dokümanı Oluştur",
                action: () => onGenerateDoc('analysis'),
                icon: NextActionIcons.CREATE_ANALYSIS,
                disabled: false
            };
        }
        const firstQuestion = generatedDocs?.maturityReport?.suggestedQuestions?.[0];
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
    }, [conversation, onGenerateDoc, onNavigateToBacklogGeneration, onSendMessage, onEvaluateDocument]);
};

// --- Type Definitions for AnalystView Props ---
interface AnalystViewProps {
    activeConversation: Conversation | null;
    user: User;
    isProcessing: boolean;
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null;
    onSendMessage: (content: string) => Promise<void>;
    onFeedbackUpdate: (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
    onSuggestNextFeature: () => void;
    nextAction: {
        label: string;
        action: () => void;
        icon: React.ReactElement;
        disabled: boolean;
        tooltip?: string;
    };
    onStopGeneration: () => void;
    onEditLastUserMessage: () => void;
    messageToEdit: string | null;
    isWorkspaceVisible: boolean;
    isExpertMode: boolean;
    onExpertModeChange: (isOn: boolean) => void;
}

// --- AnalystView Component (Extracted from App) ---
const AnalystView: React.FC<AnalystViewProps> = React.memo(({
    activeConversation,
    user,
    isProcessing,
    generatingDocType,
    onSendMessage,
    onFeedbackUpdate,
    onSuggestNextFeature,
    nextAction,
    onStopGeneration,
    onEditLastUserMessage,
    messageToEdit,
    isWorkspaceVisible,
    isExpertMode,
    onExpertModeChange,
}) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const prevConversationIdRef = useRef<string | null | undefined>(undefined);

    // This effect handles smart scrolling of the chat history.
    useEffect(() => {
        if (!chatContainerRef.current) return;

        const element = chatContainerRef.current;
        const isNewConversation = activeConversation?.id !== prevConversationIdRef.current;

        // User is considered at the bottom if they are within a certain pixel threshold.
        const isScrolledToBottom = element.scrollHeight - element.clientHeight <= element.scrollTop + 100;

        // Always scroll to the bottom for a new conversation.
        // For existing conversations, only scroll if the user is already near the bottom.
        if (isNewConversation || isScrolledToBottom) {
             element.scrollTo({
                top: element.scrollHeight,
                // Use instant scroll for new conversations, smooth for new messages.
                behavior: isNewConversation ? 'auto' : 'smooth'
            });
        }
        
        // Update the ref to the current conversation ID for the next render.
        prevConversationIdRef.current = activeConversation?.id;
    }, [activeConversation?.id, activeConversation?.messages.length, isProcessing]);

    return (
        <div className={`flex flex-col min-h-0 transition-all duration-500 ease-in-out ${isWorkspaceVisible ? 'w-full lg:w-1/3 flex-shrink-0' : 'w-full'}`}>
            {activeConversation ? (
                <>
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6">
                        <div className="max-w-4xl mx-auto w-full">
                            {activeConversation.messages.length === 0 ? (
                                <PromptSuggestions onSelectPrompt={(p) => onSendMessage(p)} />
                            ) : (
                                <ChatMessageHistory
                                    user={user}
                                    chatHistory={activeConversation.messages}
                                    isLoading={isProcessing && !generatingDocType}
                                    onFeedbackUpdate={onFeedbackUpdate}
                                    onEditLastUserMessage={onEditLastUserMessage}
                                />
                            )}
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-900/50 flex-shrink-0 space-y-4">
                        <ActionButtons
                            onSuggestNextFeature={onSuggestNextFeature}
                            isLoading={isProcessing}
                            isConversationStarted={activeConversation.messages.length > 0}
                            nextAction={nextAction}
                        />
                        <div className="max-w-4xl mx-auto">
                            <ChatInterface 
                                isLoading={isProcessing} 
                                onSendMessage={onSendMessage} 
                                activeConversationId={activeConversation.id}
                                onStopGeneration={onStopGeneration}
                                initialText={messageToEdit}
                                isExpertMode={isExpertMode}
                                onExpertModeChange={onExpertModeChange}
                            />
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
});

const simpleHash = (str: string): string => {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
};


export const App: React.FC<AppProps> = ({ user, onLogout }) => {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [generatingDocType, setGeneratingDocType] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null>(null);
    const [appMode, setAppMode] = useState<AppMode>('analyst');
    const [geminiModel, setGeminiModel] = useState<GeminiModel>(() => (localStorage.getItem('geminiModel') as GeminiModel) || 'gemini-2.5-flash');
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);

    // --- Expert Mode State ---
    const [isExpertMode, setIsExpertMode] = useState(false);
    const [awaitingExpertConfirmation, setAwaitingExpertConfirmation] = useState(false);
    const [isExpertRunActive, setIsExpertRunActive] = useState(false);


    // Modal states
    const [isNewAnalysisModalOpen, setIsNewAnalysisModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isWorkspaceVisible, setIsWorkspaceVisible] = useState(false);
    const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
    const [regenerateInfo, setRegenerateInfo] = useState<{ docType: 'analysis' | 'test', newTemplateId: string } | null>(null);
    
    // Feature suggestion states
    const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
    const [featureSuggestions, setFeatureSuggestions] = useState<string[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);

    // Document-related state
    const [activeDocTab, setActiveDocTab] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation'>('analysis');
    const [selectedTemplates, setSelectedTemplates] = useState({ analysis: 'default-analysis', test: 'default-test' });
    const [diagramType, setDiagramType] = useState<'mermaid' | 'bpmn'>('mermaid');

    // Interaction control states
    const stopController = useRef({ stop: false });
    const [messageToEdit, setMessageToEdit] = useState<string | null>(null);

    // Auto-save states
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const conversationsRef = useRef(conversations);
    
    // Maturity score state
    const [maturityScore, setMaturityScore] = useState<{ score: number, justification: string } | null>(null);
    const maturityScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


    // --- Computed State ---
    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConversationId) ?? null;
    }, [conversations, activeConversationId]);
    
    // --- Effects ---
    
    // Keep a ref to the latest conversations state for use in debounced function
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    // Auto-save effect with debouncing
    useEffect(() => {
        // Don't save on initial load or if no conversation is active
        if (isLoadingConversations || !activeConversationId) {
            return;
        }

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(async () => {
            const conversationToSave = conversationsRef.current.find(c => c.id === activeConversationId);
            
            if (!conversationToSave) return;
            
            setSaveStatus('saving');

            const { error } = await supabase
                .from('conversations')
                .update({
                    messages: conversationToSave.messages,
                    generatedDocs: conversationToSave.generatedDocs,
                    title: conversationToSave.title,
                    is_shared: conversationToSave.is_shared,
                })
                .eq('id', activeConversationId);

            if (error) {
                console.error('Auto-save error:', error);
                setSaveStatus('error');
                setTimeout(() => setSaveStatus('idle'), 5000); // Clear error after 5s
            } else {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000); // Reset to idle after 2s
            }
        }, 2500); // 2.5-second debounce delay

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [conversations, activeConversationId, isLoadingConversations]);


    // API Key Check on Load
    useEffect(() => {
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            setApiKeyError("Uygulamanın çalışması için Gemini API anahtarı gereklidir. Lütfen projenizin kök dizininde bir `.env` dosyası oluşturun ve içine `API_KEY=YOUR_API_KEY` veya `GEMINI_API_KEY=YOUR_API_KEY` satırını ekleyin.");
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
    const handleUpdateConversation = useCallback((id: string, updates: Partial<Conversation>): void => {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }, []);
    
    const handleNewConversation = useCallback(async (initialDoc?: { content?: string, title?: string }) => {
        setIsProcessing(true);
        setIsNewAnalysisModalOpen(false);
        setAwaitingExpertConfirmation(false);
        setIsExpertRunActive(false);

        const newConversation: Omit<Conversation, 'id' | 'created_at'> = {
            user_id: user.id,
            title: initialDoc?.title || "Yeni Analiz",
            messages: [],
            generatedDocs: {
                analysisDoc: initialDoc?.content || SAMPLE_ANALYSIS_DOCUMENT,
                analysisDocHistory: [],
                testScenarios: '',
                visualization: '',
                traceabilityMatrix: '',
                maturityReport: null,
                backlogSuggestions: [],
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

            if (initialDoc?.content) {
                setIsWorkspaceVisible(true);
            }

            if (initialDoc?.title && !initialDoc.content) {
                // If only a title is provided, send it as the first message
                await handleSendMessage(initialDoc.title);
            }
        }
        setIsProcessing(false);
    }, [user.id]);
    
    const handleSelectConversation = (id: string) => {
        setAwaitingExpertConfirmation(false);
        setIsExpertRunActive(false);
        setActiveConversationId(id);
    };

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

    const handleUpdateConversationTitle = (id: string, title: string) => {
        handleUpdateConversation(id, { title });
    };

    const handleSendMessage = useCallback(async (content: string) => {
        if (!activeConversationId || !content.trim() || !activeConversation || isExpertRunActive) return;
    
        if (messageToEdit) setMessageToEdit(null);
    
        setIsProcessing(true);
        stopController.current.stop = false;
    
        const userMessage: Message = { id: uuidv4(), role: 'user', content, timestamp: new Date().toISOString() };
        const updatedHistory = [...activeConversation.messages, userMessage];
        
        const assistantMessage: Message = { id: uuidv4(), role: 'assistant', content: '', timestamp: new Date().toISOString() };
        const historyWithPlaceholder = [...updatedHistory, assistantMessage];
    
        const streamingDocKeys = new Set<string>();
    
        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: historyWithPlaceholder } : c));
        
        // --- EXPERT MODE LOGIC ---
        if (isExpertMode) {
             const positiveConfirmation = ['evet', 'onaylıyorum', 'başla', 'evet başla', 'evet, başla'].includes(content.trim().toLowerCase());

            if (awaitingExpertConfirmation && positiveConfirmation) {
                setAwaitingExpertConfirmation(false);
                setIsExpertRunActive(true);
                const streamGenerator = geminiService.executeExpertRun(updatedHistory, selectedTemplates, geminiModel);
                // The rest of the logic is in the main stream loop under 'expert_run_update'
                 for await (const chunk of streamGenerator) {
                    if (stopController.current.stop) break; // Allow stopping
                    // This is now the main processing loop for the expert run
                    switch (chunk.type) {
                        case 'expert_run_update':
                            assistantMessage.expertRunChecklist = chunk.checklist;
                            if (chunk.isComplete && chunk.finalMessage) {
                                assistantMessage.content = chunk.finalMessage;
                            }
                             setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.map(m => m.id === assistantMessage.id ? assistantMessage : m) } : c));
                            break;
                        // Handle doc streams during the run
                        case 'doc_stream_chunk':
                        case 'visualization_update':
                             // This is a simplified version of the main loop's logic
                             setConversations(prev => prev.map(c => {
                                if (c.id === activeConversationId) {
                                    // FIX: Ensure updatedDocs satisfies the GeneratedDocs type by spreading a default object.
                                    const updatedDocs = { ...defaultGeneratedDocs, ...(c.generatedDocs || {}) };
                                    if (chunk.type === 'doc_stream_chunk') {
                                         if (!streamingDocKeys.has(chunk.docKey)) {
                                            updatedDocs[chunk.docKey] = chunk.chunk;
                                            streamingDocKeys.add(chunk.docKey);
                                        } else {
                                            (updatedDocs[chunk.docKey] as string) += chunk.chunk;
                                        }
                                    } else { // viz update
                                        updatedDocs.visualization = chunk.content;
                                        updatedDocs.visualizationType = 'mermaid'; // Expert mode defaults to mermaid
                                        updatedDocs.mermaidViz = { code: chunk.content, sourceHash: '' }; // No hash tracking in expert
                                    }
                                    return { ...c, generatedDocs: updatedDocs };
                                }
                                return c;
                            }));
                            break;
                    }
                 }
                setIsExpertRunActive(false);
                setIsProcessing(false);
                return;
            }

            // If not confirming, or it's the first message in expert mode
            setAwaitingExpertConfirmation(false);
            try {
                const clarificationResult = await geminiService.clarifyAndConfirmExpertMode(updatedHistory, geminiModel);
                if (clarificationResult.needsClarification) {
                    assistantMessage.content = clarificationResult.questions || "Birkaç sorum olacak.";
                } else {
                    assistantMessage.content = clarificationResult.confirmationRequest || "Onay bekleniyor.";
                    assistantMessage.expertRunChecklist = clarificationResult.checklist;
                    setAwaitingExpertConfirmation(true);
                }
                setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.map(m => m.id === assistantMessage.id ? assistantMessage : m) } : c));
            } catch (error) {
                console.error('Expert mode error:', error);
                assistantMessage.content = `Exper Modu'nda bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen Hata'}`;
                setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...updatedHistory, assistantMessage] } : c));
            } finally {
                setIsProcessing(false);
            }
            return;
        }
        
        // --- REGULAR MODE LOGIC ---
        try {
            const currentDocs = activeConversation.generatedDocs || { analysisDoc: '', testScenarios: '', visualization: '', traceabilityMatrix: '', backlogSuggestions: [] };
            const streamGenerator = geminiService.processAnalystMessageStream(updatedHistory, currentDocs, selectedTemplates, geminiModel);
    
            for await (const chunk of streamGenerator) {
                if (stopController.current.stop) {
                    assistantMessage.content += "\n\n--Kullanıcı tarafından durduruldu.--";
                    setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.map(m => m.id === assistantMessage.id ? { ...m, content: assistantMessage.content } : m) } : c));
                    break;
                }
                
                switch (chunk.type) {
                    case 'text_chunk':
                        assistantMessage.content += chunk.text;
                        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.map(m => m.id === assistantMessage.id ? { ...m, content: assistantMessage.content } : m) } : c));
                        break;

                    case 'status_update':
                        assistantMessage.content = chunk.message;
                        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: c.messages.map(m => m.id === assistantMessage.id ? { ...m, content: assistantMessage.content } : m) } : c));
                        break;
    
                    case 'chat_response':
                        assistantMessage.content = chunk.content;
                        setConversations(prev => prev.map(c => {
                             if (c.id === activeConversationId) {
                                const finalMessages = c.messages.map(m => m.id === assistantMessage.id ? { ...m, content: chunk.content } : m);
                                if (!finalMessages.some(m => m.id === assistantMessage.id)) {
                                    finalMessages.push({ ...assistantMessage, content: chunk.content });
                                }
                                return { ...c, messages: finalMessages };
                             }
                             return c;
                        }));
                        break;
    
                    case 'doc_stream_chunk':
                        setIsWorkspaceVisible(true);
                        const { docKey, chunk: docChunk, updatedReport } = chunk;
                        
                        const mappedDocType = docKey === 'analysisDoc' ? 'analysis' :
                                            docKey === 'testScenarios' ? 'test' :
                                            'traceability';
                        
                        if (generatingDocType !== mappedDocType) {
                            setGeneratingDocType(mappedDocType);
                        }
                        
                        setActiveDocTab(mappedDocType);
                        
                        const isFirstChunkForThisDoc = !streamingDocKeys.has(docKey);
                        if (isFirstChunkForThisDoc) {
                            streamingDocKeys.add(docKey);
                        }
    
                        setConversations(prev => prev.map(c => {
                            if (c.id === activeConversationId) {
                                // FIX: Ensure updatedDocs satisfies the GeneratedDocs type by spreading a default object.
                                const updatedDocs = { ...defaultGeneratedDocs, ...(c.generatedDocs || {}) };
                                if (isFirstChunkForThisDoc) updatedDocs[docKey] = docChunk;
                                else (updatedDocs[docKey] as string) += docChunk;
                                if (updatedReport) updatedDocs.maturityReport = updatedReport;
                                return { ...c, generatedDocs: updatedDocs };
                            }
                            return c;
                        }));
                        break;
                    
                    case 'maturity_update':
                        // FIX: Ensure updatedDocs satisfies the GeneratedDocs type by spreading a default object.
                        handleUpdateConversation(activeConversationId, {
                            generatedDocs: { ...defaultGeneratedDocs, ...(activeConversation.generatedDocs || {}), maturityReport: chunk.report }
                        });
                        
                        if (maturityScoreTimerRef.current) clearTimeout(maturityScoreTimerRef.current);
                        // FIX: The 'MaturityReport' type uses 'overallScore', not 'score'.
                        setMaturityScore({ score: chunk.report.overallScore, justification: chunk.report.justification });
                        maturityScoreTimerRef.current = setTimeout(() => setMaturityScore(null), 5000);
                        break;
    
                    case 'visualization_update':
                        setIsWorkspaceVisible(true);
                        setActiveDocTab('viz');
                        const currentAnalysisDoc = activeConversation.generatedDocs?.analysisDoc || '';
                        const currentAnalysisHash = simpleHash(currentAnalysisDoc);
    
                        setConversations(prev => prev.map(c => {
                            if (c.id === activeConversationId) {
                                // FIX: Ensure updatedDocs satisfies the GeneratedDocs type by spreading a default object.
                                const updatedDocs = { ...defaultGeneratedDocs, ...(c.generatedDocs || {}) };
                                if (diagramType === 'bpmn') {
                                    updatedDocs.bpmnViz = { code: chunk.content, sourceHash: currentAnalysisHash };
                                } else {
                                    updatedDocs.mermaidViz = { code: chunk.content, sourceHash: currentAnalysisHash };
                                }
                                updatedDocs.visualization = chunk.content;
                                updatedDocs.visualizationType = diagramType;
                                return { ...c, generatedDocs: updatedDocs };
                            }
                            return c;
                        }));
                        break;
    
                    case 'error':
                        assistantMessage.content = chunk.message;
                        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...updatedHistory, { ...assistantMessage, content: chunk.message }] } : c));
                        break;
                }
            }
        } catch (error) {
             console.error('Error sending message:', error);
             const errorMessage: Message = { ...assistantMessage, content: `Bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen Hata'}` };
             setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: [...updatedHistory, errorMessage] } : c));
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null); // Reset streaming state indicator
        }
    }, [activeConversationId, activeConversation, geminiModel, selectedTemplates, diagramType, messageToEdit, generatingDocType, handleUpdateConversation, isExpertMode, awaitingExpertConfirmation, isExpertRunActive]);
    
    const handleStopGeneration = useCallback(() => {
        stopController.current.stop = true;
    }, []);

    const handleEditLastUserMessage = useCallback(() => {
        if (!activeConversation) return;

        const messages = activeConversation.messages;
        let lastUserMessageIndex = -1;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === 'user') {
            lastUserMessageIndex = messages.length - 1;
        } else if (messages.length > 1 && lastMessage?.role === 'assistant' && messages[messages.length - 2]?.role === 'user') {
            lastUserMessageIndex = messages.length - 2;
        }

        if (lastUserMessageIndex !== -1) {
            const messageContentToEdit = messages[lastUserMessageIndex].content;
            const newMessages = messages.slice(0, lastUserMessageIndex);
            
            setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, messages: newMessages } : c));
            setMessageToEdit(messageContentToEdit);
        }
    }, [activeConversation]);


    const handleGenerateDoc = useCallback(async (type: 'analysis' | 'test' | 'viz' | 'traceability', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => {
        if (!activeConversationId) return;
        const currentConversation = conversations.find(c => c.id === activeConversationId);
        if (!currentConversation) return;

        let statusMessage = '';
        let completionMessage = '';

        switch(type) {
            case 'analysis': 
                statusMessage = 'İş analizi dokümanı oluşturuluyor...';
                completionMessage = 'İş analizi dokümanını oluşturdum. Çalışma alanından inceleyebilirsiniz.';
                break;
            case 'test': 
                statusMessage = 'Test senaryoları hazırlanıyor...';
                completionMessage = 'Test senaryolarını oluşturdum. Çalışma alanından inceleyebilirsiniz.';
                break;
            case 'traceability': 
                statusMessage = 'İzlenebilirlik matrisi oluşturuluyor...';
                completionMessage = 'İzlenebilirlik matrisini oluşturdum. Çalışma alanından inceleyebilirsiniz.';
                break;
            case 'viz': 
                statusMessage = 'Süreç akışı görselleştiriliyor...'; 
                completionMessage = 'Süreç akış diyagramını oluşturdum. Çalışma alanından inceleyebilirsiniz.';
                break;
        }

        const assistantMessage: Message = { 
            id: uuidv4(), 
            role: 'assistant', 
            content: statusMessage, 
            timestamp: new Date().toISOString() 
        };
        handleUpdateConversation(activeConversationId, { messages: [...currentConversation.messages, assistantMessage] });
    
        if (type !== 'viz') {
            setGeneratingDocType(type);
            setIsProcessing(true);
        }
        setIsWorkspaceVisible(true);
        setActiveDocTab(type);
        
        // FIX: Ensure currentDocs satisfies the GeneratedDocs type by spreading a default object.
        const currentDocs = { ...defaultGeneratedDocs, ...(currentConversation.generatedDocs || {}) };

        // FIX: Spread the full currentDocs object to maintain type integrity.
        if (type === 'analysis') handleUpdateConversation(activeConversationId, { generatedDocs: { ...currentDocs, analysisDoc: '' } });
        else if (type === 'test') handleUpdateConversation(activeConversationId, { generatedDocs: { ...currentDocs, testScenarios: '' } });
        else if (type === 'traceability') handleUpdateConversation(activeConversationId, { generatedDocs: { ...currentDocs, traceabilityMatrix: '' } });

        try {
            let stream;
            let docKey: 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix';

            if (type === 'analysis') {
                const templateId = newTemplateId || selectedTemplates.analysis;
                stream = geminiService.generateAnalysisDocument(currentConversation.messages, templateId, geminiModel);
                docKey = 'analysisDoc';
            } else if (type === 'test') {
                const templateId = newTemplateId || selectedTemplates.test;
                stream = geminiService.generateTestScenarios(currentDocs.analysisDoc, templateId, geminiModel);
                docKey = 'testScenarios';
            } else if (type === 'traceability') {
                stream = geminiService.generateTraceabilityMatrix(currentDocs.analysisDoc, currentDocs.testScenarios, geminiModel);
                docKey = 'traceabilityMatrix';
            } else if (type === 'viz') {
                const typeToUse = newDiagramType || diagramType;
                const currentAnalysisDoc = currentDocs.analysisDoc;
                const currentAnalysisHash = simpleHash(currentAnalysisDoc);

                const cachedViz = typeToUse === 'mermaid' ? currentDocs.mermaidViz : currentDocs.bpmnViz;
                if (cachedViz && cachedViz.sourceHash === currentAnalysisHash) {
                    const cachedCompletionMessage = 'Önbellekten yüklenen en son diyagramı gösteriyorum.';
                    const finalMessages = conversationsRef.current.find(c => c.id === activeConversationId)?.messages.map(m => m.id === assistantMessage.id ? { ...m, content: cachedCompletionMessage } : m) ?? [];
                    handleUpdateConversation(activeConversationId, { messages: finalMessages });
                    return; 
                }
                
                const result = await geminiService.generateDiagram(currentAnalysisDoc, typeToUse, geminiModel);
                
                const newVizData: VizData = { code: result, sourceHash: currentAnalysisHash };
                const newGeneratedDocs = { ...currentDocs };
                if (typeToUse === 'mermaid') newGeneratedDocs.mermaidViz = newVizData;
                else newGeneratedDocs.bpmnViz = newVizData;
                newGeneratedDocs.visualization = result;
                newGeneratedDocs.visualizationType = typeToUse;
                handleUpdateConversation(activeConversationId, { generatedDocs: newGeneratedDocs });

                const finalMessages = conversationsRef.current.find(c => c.id === activeConversationId)?.messages.map(m => m.id === assistantMessage.id ? { ...m, content: completionMessage } : m) ?? [];
                handleUpdateConversation(activeConversationId, { messages: finalMessages });
                return;
            } else {
                return;
            }

            for await (const chunk of stream) {
                setConversations(prev => {
                    return prev.map(c => {
                        if (c.id === activeConversationId) {
                            // FIX: Ensure updatedDocs satisfies the GeneratedDocs type by spreading a default object.
                            const updatedDocs = { ...defaultGeneratedDocs, ...(c.generatedDocs || {}) };
                            (updatedDocs[docKey] as string) += chunk;
                            return { ...c, generatedDocs: updatedDocs };
                        }
                        return c;
                    });
                });
            }

        } catch (error) {
            console.error(`Error generating ${type}:`, error);
            const errorContent = `'${type}' oluşturulurken bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`;
            const finalMessages = conversationsRef.current.find(c => c.id === activeConversationId)?.messages.map(m => m.id === assistantMessage.id ? { ...m, content: errorContent } : m) ?? [];
            handleUpdateConversation(activeConversationId, { messages: finalMessages });
        } finally {
            if (type !== 'viz') {
                setGeneratingDocType(null);
                setIsProcessing(false);
                
                const finalConversation = conversationsRef.current.find(c => c.id === activeConversationId);
                const finalMessage = finalConversation?.messages.find(m => m.id === assistantMessage.id);

                if (finalMessage?.content === statusMessage) {
                    const finalMessages = finalConversation.messages.map(m => m.id === assistantMessage.id ? { ...m, content: completionMessage } : m);
                    handleUpdateConversation(activeConversationId, { messages: finalMessages });
                }
            }
        }
    }, [activeConversationId, conversations, geminiModel, selectedTemplates, diagramType, handleUpdateConversation]);
    
    const handleSuggestNextFeature = useCallback(async () => {
        if (!activeConversation) return;

        setIsSuggestionModalOpen(true);
        setIsGeneratingSuggestions(true);
        setSuggestionError(null);
        setFeatureSuggestions([]);

        try {
            const suggestions = await geminiService.suggestNextFeature(
                activeConversation.generatedDocs?.analysisDoc || '',
                activeConversation.messages,
                geminiModel
            );
            setFeatureSuggestions(suggestions);
        } catch (error) {
            console.error('Error generating feature suggestions:', error);
            setSuggestionError(error instanceof Error ? error.message : "Fikirler üretilirken bir hata oluştu.");
        } finally {
            setIsGeneratingSuggestions(false);
        }
    }, [activeConversation, geminiModel]);

    const handleSelectSuggestion = useCallback((suggestion: string) => {
        handleSendMessage(suggestion);
        setIsSuggestionModalOpen(false);
    }, [handleSendMessage]);

    const handleFeedbackUpdate = useCallback((messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => {
        if (activeConversation) {
            const updatedMessages = activeConversation.messages.map(msg => msg.id === messageId ? { ...msg, feedback: feedbackData } : msg);
            handleUpdateConversation(activeConversation.id, { messages: updatedMessages });
        }
    }, [activeConversation, handleUpdateConversation]);

    const handleAnalysisTemplateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newTemplateId = event.target.value;
        const currentConversation = conversations.find(c => c.id === activeConversationId);
        if (!currentConversation) return;
        
        // FIX: Ensure currentDocs satisfies the GeneratedDocs type by spreading a default object.
        const currentDocs = { ...defaultGeneratedDocs, ...(currentConversation.generatedDocs || {}) };
        const hasRealContent = currentDocs.analysisDoc && !currentDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");

        if (hasRealContent) {
            setRegenerateInfo({ docType: 'analysis', newTemplateId });
            setIsRegenerateModalOpen(true);
        } else {
            setSelectedTemplates(prev => ({ ...prev, analysis: newTemplateId }));
            handleGenerateDoc('analysis', newTemplateId);
        }
    };

    const handleConfirmRegeneration = useCallback(async (saveCurrent: boolean) => {
        if (!regenerateInfo || !activeConversationId) return;

        const { docType, newTemplateId } = regenerateInfo;
        const currentConversation = conversations.find(c => c.id === activeConversationId);
        if (!currentConversation) return;

        let updatedConversation = { ...currentConversation };
        // FIX: Ensure currentDocs satisfies the GeneratedDocs type by spreading a default object.
        const currentDocs = { ...defaultGeneratedDocs, ...(updatedConversation.generatedDocs || {}) };

        if (saveCurrent && docType === 'analysis') {
            const currentTemplateId = selectedTemplates.analysis;
            const hasRealContent = currentDocs.analysisDoc && !currentDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");

            if (hasRealContent) {
                const newVersion: AnalysisVersion = {
                    id: uuidv4(),
                    content: currentDocs.analysisDoc,
                    templateId: currentTemplateId,
                    createdAt: new Date().toISOString(),
                };
                const history = currentDocs.analysisDocHistory || [];
                // FIX: Spread currentDocs to ensure all required properties are preserved.
                updatedConversation.generatedDocs = { 
                    ...currentDocs,
                    analysisDocHistory: [...history, newVersion] 
                };
                handleUpdateConversation(activeConversationId, { generatedDocs: updatedConversation.generatedDocs });
            }
        }

        setSelectedTemplates(prev => ({ ...prev, [docType]: newTemplateId }));
        await handleGenerateDoc(docType, newTemplateId);

        setIsRegenerateModalOpen(false);
        setRegenerateInfo(null);
    }, [activeConversationId, conversations, regenerateInfo, selectedTemplates.analysis, handleGenerateDoc, handleUpdateConversation]);

    const handleNavigateToBacklogGeneration = useCallback(() => {
        setAppMode('analyst');
        if (!isWorkspaceVisible) {
            setIsWorkspaceVisible(true);
        }
        setActiveDocTab('backlog-generation');
    }, [isWorkspaceVisible]);

    const handlePrepareQuestionForAnswer = (question: string) => {
        const textForInput = `${question}\n\nCevabınız: `;
        setMessageToEdit(textForInput);
        if (appMode !== 'analyst') {
            setAppMode('analyst');
        }
    };

    const nextAction = useNextBestAction(
        activeConversation,
        handleGenerateDoc,
        handleNavigateToBacklogGeneration,
        handleSendMessage,
        () => handleSendMessage("Bu dokümanı analiz et, eksiklerini ve belirsizliklerini belirle, ve bunları gidermek için bana sorular sor.")
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
                onOpenShareModal={() => setIsShareModalOpen(true)}
                isWorkspaceVisible={isWorkspaceVisible}
                onToggleWorkspace={() => setIsWorkspaceVisible(!isWorkspaceVisible)}
                saveStatus={saveStatus}
                maturityScore={maturityScore}
                isProcessing={isProcessing}
            />
            {apiKeyError && (
                <div className="bg-red-100 dark:bg-red-900/50 border-b-2 border-red-500 text-red-800 dark:text-red-200 p-3 text-sm font-semibold text-center flex items-center justify-center gap-2 error-banner-enter">
                    <AlertTriangle className="h-5 w-5" />
                    {apiKeyError}
                </div>
            )}
            <div className="flex-1 flex min-h-0 relative">
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
                <main className={`flex-1 flex transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-72' : 'ml-0'}`}>
                    {appMode === 'analyst' && activeConversation ? (
                        <div className="flex w-full h-full">
                            <AnalystView
                                activeConversation={activeConversation}
                                user={user}
                                isProcessing={isProcessing}
                                generatingDocType={generatingDocType}
                                onSendMessage={handleSendMessage}
                                onFeedbackUpdate={handleFeedbackUpdate}
                                onSuggestNextFeature={handleSuggestNextFeature}
                                nextAction={nextAction}
                                onStopGeneration={handleStopGeneration}
                                onEditLastUserMessage={handleEditLastUserMessage}
                                messageToEdit={messageToEdit}
                                isWorkspaceVisible={isWorkspaceVisible}
                                isExpertMode={isExpertMode}
                                onExpertModeChange={setIsExpertMode}
                            />
                            {isWorkspaceVisible && (
                                <div className="hidden lg:flex w-2/3 h-full flex-shrink-0 border-l border-slate-200 dark:border-slate-700">
                                    <DocumentWorkspace
                                        conversation={activeConversation}
                                        isProcessing={isProcessing}
                                        generatingDocType={generatingDocType}
                                        onUpdateConversation={handleUpdateConversation}
                                        onModifySelection={async (text, prompt, key) => { /* Placeholder */ }}
                                        onModifyDiagram={async (prompt) => { /* Placeholder */ }}
                                        onGenerateDoc={handleGenerateDoc}
                                        inlineModificationState={null}
                                        templates={{ analysis: ANALYSIS_TEMPLATES, test: TEST_SCENARIO_TEMPLATES }}
                                        selectedTemplates={selectedTemplates}
                                        onTemplateChange={{
                                            analysis: handleAnalysisTemplateChange,
                                            test: (e) => setSelectedTemplates(p => ({...p, test: e.target.value}))
                                        }}
                                        activeDocTab={activeDocTab}
                                        setActiveDocTab={setActiveDocTab}
                                        onPrepareQuestionForAnswer={handlePrepareQuestionForAnswer}
                                        diagramType={diagramType}
                                        setDiagramType={setDiagramType}
                                    />
                                </div>
                            )}
                        </div>
                    ) : appMode === 'backlog' ? <ProjectBoard user={user} /> : (
                         <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 w-full">
                            <p>Başlamak için yeni bir analiz başlatın veya mevcut bir sohbeti seçin.</p>
                        </div>
                    )}
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
            {isSuggestionModalOpen && (
                <FeatureSuggestionsModal
                    isOpen={isSuggestionModalOpen}
                    onClose={() => setIsSuggestionModalOpen(false)}
                    isLoading={isGeneratingSuggestions}
                    suggestions={featureSuggestions}
                    onSelectSuggestion={handleSelectSuggestion}
                    error={suggestionError}
                    onRetry={handleSuggestNextFeature}
                />
            )}
            {isRegenerateModalOpen && regenerateInfo && (
                <RegenerateConfirmationModal
                    isOpen={isRegenerateModalOpen}
                    onClose={() => {
                        setIsRegenerateModalOpen(false);
                        setRegenerateInfo(null);
                    }}
                    onConfirm={handleConfirmRegeneration}
                    documentName="İş Analizi Dokümanı"
                    templateName={ANALYSIS_TEMPLATES.find(t => t.id === regenerateInfo.newTemplateId)?.name || 'Bilinmeyen Şablon'}
                />
            )}
        </div>
    );
};
