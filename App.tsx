// App.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './services/supabaseClient';
import { geminiService } from './services/geminiService';
// FIX: Import the missing promptService to resolve 'Cannot find name' error.
import { promptService } from './services/promptService';
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
import { DeveloperPanel } from './components/DeveloperPanel';
import { FeedbackDashboard } from './components/FeedbackDashboard';
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
        const hasMessages = messages.filter(m => m.role !== 'system').length > 0; // Filter out system messages

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
    onEditLastUserMessage: () => void;
    onStopGeneration: () => void;
    messageToEdit: string | null;
    onSuggestNextFeature: () => void;
    nextBestAction: ReturnType<typeof useNextBestAction>;
    isExpertMode: boolean;
    onExpertModeChange: (isOn: boolean) => void;
}

const AnalystView: React.FC<AnalystViewProps> = ({
    activeConversation,
    user,
    isProcessing,
    generatingDocType,
    onSendMessage,
    onFeedbackUpdate,
    onEditLastUserMessage,
    onStopGeneration,
    messageToEdit,
    onSuggestNextFeature,
    nextBestAction,
    isExpertMode,
    onExpertModeChange,
}) => {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <main className="flex-1 overflow-y-auto min-h-0">
                 <div className="max-w-4xl mx-auto w-full px-4 pt-4">
                    {activeConversation && activeConversation.messages.filter(m => m.role !== 'system').length > 0 ? (
                        <ChatMessageHistory
                            user={user}
                            chatHistory={activeConversation.messages}
                            isLoading={isProcessing && !generatingDocType}
                            onFeedbackUpdate={onFeedbackUpdate}
                            onEditLastUserMessage={onEditLastUserMessage}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full pt-10">
                            <PromptSuggestions onSelectPrompt={(p) => onSendMessage(p)} />
                        </div>
                    )}
                 </div>
            </main>
            <footer className="p-4 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                <div className="max-w-4xl mx-auto w-full space-y-3">
                    <ActionButtons
                        onSuggestNextFeature={onSuggestNextFeature}
                        isLoading={isProcessing}
                        isConversationStarted={!!activeConversation && activeConversation.messages.filter(m => m.role !== 'system').length > 0}
                        nextAction={nextBestAction}
                    />
                    <ChatInterface
                        isLoading={isProcessing && !generatingDocType}
                        onSendMessage={onSendMessage}
                        activeConversationId={activeConversation?.id || null}
                        onStopGeneration={onStopGeneration}
                        initialText={messageToEdit}
                        isExpertMode={isExpertMode}
                        onExpertModeChange={onExpertModeChange}
                    />
                </div>
            </footer>
        </div>
    );
}


export const App: React.FC<AppProps> = ({ user, onLogout }) => {
    // --- Core State ---
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [generatingDocType, setGeneratingDocType] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null>(null);
    const [error, setError] = useState<string | null>(null);
    // FIX: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility.
    const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- UI & Mode State ---
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark'); // Set default to 'dark'
    const [appMode, setAppMode] = useState<AppMode>('analyst');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isWorkspaceVisible, setIsWorkspaceVisible] = useState(true);
    const [isNewAnalysisModalOpen, setIsNewAnalysisModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isFeatureSuggestionsModalOpen, setIsFeatureSuggestionsModalOpen] = useState(false);
    const [featureSuggestions, setFeatureSuggestions] = useState<string[]>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
    const regenerateModalData = useRef<{ docType: 'analysis' | 'test', newTemplateId: string } | null>(null);
    // FIX: Moved state declaration before its first use to prevent a ReferenceError.
    const [activeDocTab, setActiveDocTab] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation'>('analysis');
    
    // --- Developer & Feedback Panel State ---
    const [isDeveloperPanelOpen, setIsDeveloperPanelOpen] = useState(false);
    const [isFeedbackDashboardOpen, setIsFeedbackDashboardOpen] = useState(false);
    const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);
    const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);

    // --- Conversation & Document State ---
    const [messageToEdit, setMessageToEdit] = useState<string | null>(null);
    const [inlineModificationState, setInlineModificationState] = useState<{ docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [geminiModel, setGeminiModel] = useState<GeminiModel>(() => (localStorage.getItem('geminiModel') as GeminiModel) || 'gemini-2.5-flash');
    const [isExpertMode, setIsExpertMode] = useState(false);
    const [diagramType, setDiagramType] = useState<'mermaid' | 'bpmn'>('mermaid');
    const [selectedTemplates, setSelectedTemplates] = useState({
        analysis: ANALYSIS_TEMPLATES[0].id,
        test: TEST_SCENARIO_TEMPLATES[0].id,
    });
    
    const [displayedMaturityScore, setDisplayedMaturityScore] = useState<{ score: number; justification: string } | null>(null);
    // FIX: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility.
    const maturityScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const streamControllerRef = useRef<AbortController | null>(null);

    // FIX: Moved the useEffect hook for handling the error display timer before any early returns to prevent a "Rendered more hooks than during the previous render" error.
    useEffect(() => {
        if (error) {
            if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
            errorTimerRef.current = setTimeout(() => setError(null), 5000);
        }
        return () => {
            if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        };
    }, [error]);

    // --- Memoized Values ---
    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConversationId);
    }, [conversations, activeConversationId]);
    
    // --- Theme Management ---
    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark';
        // When theme is 'system', we explicitly toggle 'dark' based on system preference
        // When theme is 'light' or 'dark', we explicitly set the class.
        if (theme === 'system') {
            root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
        } else {
            root.classList.toggle('dark', isDark);
        }
    }, [theme]);
    
     const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    // --- Data Fetching ---
    const fetchConversations = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            setError("Sohbetler yüklenirken bir hata oluştu.");
            setConversations([]);
        } else if (data) {
            setConversations(data as Conversation[]);
        }
        setIsLoading(false);
    }, [user.id]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // This effect runs after conversations are fetched to set the active one.
    useEffect(() => {
        if (!activeConversationId && conversations.length > 0) {
            setActiveConversationId(conversations[0].id);
        }
    }, [conversations, activeConversationId]);


    // --- Developer & Feedback Panel Logic ---
    const handleToggleDeveloperPanel = () => {
        setIsDeveloperPanelOpen(prev => !prev);
    };

    const fetchAllFeedback = useCallback(async () => {
        setIsFetchingFeedback(true);
        const { data, error } = await supabase
            .from('conversations')
            .select('title, messages')
            .eq('user_id', user.id);

        if (error) {
            console.error("Geri bildirim getirilirken hata:", error);
            setError("Geri bildirimler yüklenemedi.");
            setAllFeedback([]);
        } else if (data) {
            const feedbackItems: FeedbackItem[] = [];
            data.forEach(conv => {
                if (conv.messages) {
                    const messagesArray: Message[] = Array.isArray(conv.messages) ? conv.messages : [];
                    messagesArray.forEach(msg => {
                        if (msg.role === 'assistant' && msg.feedback && (msg.feedback.rating || msg.feedback.comment)) {
                            feedbackItems.push({
                                message: msg,
                                conversationTitle: conv.title || 'Başlıksız Analiz'
                            });
                        }
                    });
                }
            });
            setAllFeedback(feedbackItems);
        }
        setIsFetchingFeedback(false);
    }, [user.id]);

    const handleToggleFeedbackDashboard = useCallback(() => {
        if (!isFeedbackDashboardOpen) {
            fetchAllFeedback();
        }
        setIsFeedbackDashboardOpen(prev => !prev);
        if (!isFeedbackDashboardOpen) {
            setIsDeveloperPanelOpen(false); // Close dev panel when opening feedback dashboard
        }
    }, [isFeedbackDashboardOpen, fetchAllFeedback]);

    // --- Save Conversation Debouncing ---
    const debouncedSave = useRef<(conv: Conversation) => void>();

    useEffect(() => {
        debouncedSave.current = (conv: Conversation) => {
            const save = async () => {
                setSaveStatus('saving');
                const { error } = await supabase
                    .from('conversations')
                    .update(conv)
                    .eq('id', conv.id);

                if (error) {
                    setSaveStatus('error');
                    console.error('Save error:', error);
                } else {
                    setSaveStatus('saved');
                     setTimeout(() => setSaveStatus('idle'), 2000);
                }
            };
            save();
        };
    }, []);

    const useDebounce = (callback: (conv: Conversation) => void, delay: number) => {
        // FIX: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility.
        const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
        return useCallback((conv: Conversation) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                callback(conv);
            }, delay);
        }, [callback, delay]);
    };
    
    const triggerSave = useDebounce((conv: Conversation) => {
        if (debouncedSave.current) {
            debouncedSave.current(conv);
        }
    }, 1500);
    
    const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
        setConversations(prev => {
            const newConversations = prev.map(c => {
                if (c.id === id) {
                    const updatedConv = { ...c, ...updates };
                    triggerSave(updatedConv);
                    return updatedConv;
                }
                return c;
            });
            return newConversations;
        });
    }, [triggerSave]);

    const createNewConversation = useCallback(async (initialMessages: Message[] = [], initialDocs: Partial<GeneratedDocs> = {}, customTitle: string | null = null) => {
        let title = customTitle;
        if (!title) {
            const firstUserMessage = initialMessages.find(m => m.role === 'user');
             // FIX: The `generateConversationTitle` function was called without the required 'firstMessage' argument. Passing `firstUserMessage.content` to fix the error.
             title = firstUserMessage ? await geminiService.generateConversationTitle(firstUserMessage.content) : 'Yeni Analiz';
        }

        const newConversation: Omit<Conversation, 'id' | 'created_at'> = {
            user_id: user.id,
            title: title || 'Yeni Analiz',
            messages: initialMessages,
            generatedDocs: { ...defaultGeneratedDocs, ...initialDocs },
            is_shared: false,
            share_id: uuidv4(),
        };

        const { data, error } = await supabase
            .from('conversations')
            .insert(newConversation)
            .select()
            .single();

        if (error) {
            console.error(error);
            setError("Yeni sohbet oluşturulamadı.");
        } else if (data) {
            const newConv = data as Conversation;
            setConversations(prev => [newConv, ...prev]);
            setActiveConversationId(newConv.id);
            return newConv; // Return the new conversation
        }
        return null;
    }, [user.id]);
    
     const handleNewConversation = useCallback(() => {
        setIsNewAnalysisModalOpen(true);
    }, []);

    const handleStartFromScratch = () => {
        createNewConversation();
        setIsNewAnalysisModalOpen(false);
    }
    
    const handleStartWithDocument = (documentContent: string, title: string) => {
        createNewConversation(
            [], // No initial messages
            { analysisDoc: documentContent }, // Start with the pasted document
            title || 'Mevcut Analiz'
        );
        setIsNewAnalysisModalOpen(false);
        setActiveDocTab('analysis'); // Switch to the analysis doc tab
    }
    
    const updateConversationTitle = async (id: string, newTitle: string) => {
        updateConversation(id, { title: newTitle });
    };
    
    const deleteConversation = async (id: string) => {
        const remainingConversations = conversations.filter(c => c.id !== id);
        setConversations(remainingConversations);
        
        if (activeConversationId === id) {
             setActiveConversationId(remainingConversations.length > 0 ? remainingConversations[0].id : null);
        }
        
        await supabase.from('conversations').delete().eq('id', id);
    };

    const handleStopGeneration = () => {
        if (streamControllerRef.current) {
            streamControllerRef.current.abort();
            setIsProcessing(false);
            setGeneratingDocType(null);
            console.log("Stream stopped by user.");
        }
    };
    
    const processStream = useCallback(async (
        stream: AsyncGenerator<StreamChunk>,
        docKey: 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix' | 'chat_response' | 'visualization' | 'maturity' | 'expert_run'
    ) => {
        let fullResponse = "";
        let finalMessage = "";

        for await (const chunk of stream) {
            if (chunk.type === 'doc_stream_chunk' && activeConversationId) {
                fullResponse += chunk.chunk;
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        const newDocs = { ...c.generatedDocs, [chunk.docKey]: fullResponse };
                         if (chunk.updatedReport) {
                            newDocs.maturityReport = chunk.updatedReport;
                        }
                        return { ...c, generatedDocs: newDocs };
                    }
                    return c;
                }));
            } else if (chunk.type === 'visualization_update' && activeConversationId) {
                setConversations(prev => prev.map(c => {
                     if (c.id === activeConversationId) {
                        const newDocs: GeneratedDocs = { ...c.generatedDocs };
                        if (diagramType === 'mermaid') {
                            newDocs.mermaidViz = { code: chunk.content, sourceHash: '' }; // hash updated on save
                        } else {
                             newDocs.bpmnViz = { code: chunk.content, sourceHash: '' };
                        }
                        return { ...c, generatedDocs: newDocs };
                    }
                    return c;
                }));
            } else if (chunk.type === 'chat_response' && activeConversationId) {
                finalMessage = chunk.content;
            } else if (chunk.type === 'maturity_update' && activeConversationId) {
                 setConversations(prev => prev.map(c => 
                    c.id === activeConversationId ? { ...c, generatedDocs: { ...c.generatedDocs, maturityReport: chunk.report } } : c
                ));
                 if (maturityScoreTimerRef.current) clearTimeout(maturityScoreTimerRef.current);
                setDisplayedMaturityScore({ score: chunk.report.overallScore, justification: chunk.report.justification });
                maturityScoreTimerRef.current = setTimeout(() => setDisplayedMaturityScore(null), 5000);
            } else if (chunk.type === 'expert_run_update' && activeConversationId) {
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        const lastMessage = c.messages[c.messages.length -1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                           return {
                                ...c,
                                messages: [
                                    ...c.messages.slice(0, -1),
                                    { ...lastMessage, expertRunChecklist: chunk.checklist }
                                ]
                            };
                        }
                    }
                    return c;
                }));
                if (chunk.isComplete) {
                    finalMessage = chunk.finalMessage || "Süreç tamamlandı.";
                }
            } else if (chunk.type === 'error') {
                 setError(chunk.message);
                 break;
            }
        }
        
        return { fullResponse, finalMessage };
    }, [activeConversationId, diagramType]);


    const sendMessage = useCallback(async (content: string, isSystemMessage: boolean = false) => {
        if (!content.trim()) return;

        let convId = activeConversationId;
        let convToUpdate: Conversation | undefined = activeConversation;

        setMessageToEdit(null);

        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date().toISOString()
        };

        if (!convToUpdate) {
            const newConv = await createNewConversation([userMessage], { analysisDoc: SAMPLE_ANALYSIS_DOCUMENT });
            if (!newConv) {
                setError("Sohbet oluşturulamadı.");
                return;
            }
            convId = newConv.id;
            convToUpdate = newConv;
        } else {
            const updatedMessages = [...convToUpdate.messages, userMessage];
            updateConversation(convId!, { messages: updatedMessages });
            convToUpdate = { ...convToUpdate, messages: updatedMessages };
        }

        setIsProcessing(true);
        streamControllerRef.current = new AbortController();

        try {
            let stream;
            let finalMessageContent = "";
            let newChecklist: ExpertStep[] | undefined;

            if (isExpertMode) {
                const assistantMessage: Message = {
                    id: uuidv4(), role: 'assistant', content: "Exper modu başlatılıyor...", timestamp: new Date().toISOString()
                };
                
                const updatedMessagesWithPlaceholder = [...convToUpdate.messages, assistantMessage];
                updateConversation(convId!, { messages: updatedMessagesWithPlaceholder });
                convToUpdate = { ...convToUpdate, messages: updatedMessagesWithPlaceholder };

                const clarification = await geminiService.clarifyAndConfirmExpertMode(convToUpdate.messages, geminiModel);

                if (clarification.needsClarification && clarification.questions) {
                    finalMessageContent = clarification.questions;
                } else {
                    assistantMessage.content = clarification.confirmationRequest || "Onay bekleniyor...";
                    assistantMessage.expertRunChecklist = clarification.checklist;
                    newChecklist = clarification.checklist;

                    const existingMessages = convToUpdate.messages.filter(m => m.id !== assistantMessage.id);
                    const finalMessagesForRun = [...existingMessages, assistantMessage];
                    updateConversation(convId!, { messages: finalMessagesForRun });
                    convToUpdate = { ...convToUpdate, messages: finalMessagesForRun };

                    const userConfirmed = await new Promise(resolve => {
                        const lastUserMsg = convToUpdate!.messages.find(m => m.role === 'user');
                        const lastUserMsgContent = lastUserMsg ? lastUserMsg.content.toLowerCase() : '';
                        if (['başla', 'devam et', 'onaylıyorum', 'evet'].some(kw => lastUserMsgContent.includes(kw))) {
                            resolve(true);
                        } else {
                            resolve(true);
                        }
                    });

                    if (userConfirmed) {
                        stream = geminiService.executeExpertRun(convToUpdate.messages, { analysis: selectedTemplates.analysis, test: selectedTemplates.test }, geminiModel);
                        const { finalMessage } = await processStream(stream, 'expert_run');
                        finalMessageContent = finalMessage;
                    } else {
                        finalMessageContent = "Anladım, devam etmeden önce eklemek istediğiniz başka bir detay var mı?";
                    }
                }
            } else {
                stream = geminiService.processAnalystMessageStream(convToUpdate.messages, convToUpdate.generatedDocs, { analysis: selectedTemplates.analysis, test: selectedTemplates.test }, geminiModel);
                const { finalMessage } = await processStream(stream, 'chat_response');
                finalMessageContent = finalMessage;
            }
            
            if (finalMessageContent && convId) {
                const assistantMessage: Message = {
                    id: uuidv4(), role: 'assistant', content: finalMessageContent, timestamp: new Date().toISOString(),
                    expertRunChecklist: newChecklist
                };
                // Ensure we are updating from the most recent state
                setConversations(prev => {
                    const currentConv = prev.find(c => c.id === convId);
                    if (currentConv) {
                        const updatedMessages = [...currentConv.messages, assistantMessage];
                        updateConversation(convId, { messages: updatedMessages });
                    }
                    return prev;
                });
            }
            
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                console.error("Stream processing error:", err);
                setError(err.message);
            }
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
            streamControllerRef.current = null;
        }
    }, [activeConversation, activeConversationId, user.id, isExpertMode, geminiModel, selectedTemplates, processStream, createNewConversation, updateConversation, conversations]);

     const handleGenerateDoc = useCallback(async (
        type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', 
        newTemplateId?: string,
        newDiagramType?: 'mermaid' | 'bpmn'
    ) => {
        if (!activeConversation) return;

        if (type === 'backlog-generation') {
            setActiveDocTab('backlog-generation');
            return;
        }

        setIsProcessing(true);
        setGeneratingDocType(type);
        setActiveDocTab(type);

        const currentTemplateId = newTemplateId || (type === 'analysis' ? selectedTemplates.analysis : selectedTemplates.test);
        const currentDiagramType = newDiagramType || diagramType;

        try {
            let stream;
            if (type === 'analysis') {
                stream = geminiService.generateAnalysisDocument(activeConversation.messages, currentTemplateId, geminiModel);
            } else if (type === 'test') {
                stream = geminiService.generateTestScenarios(activeConversation.generatedDocs.analysisDoc, currentTemplateId, geminiModel);
            } else if (type === 'traceability') {
                 stream = geminiService.generateTraceabilityMatrix(activeConversation.generatedDocs.analysisDoc, activeConversation.generatedDocs.testScenarios, geminiModel);
            } else { // 'viz'
                 stream = geminiService.generateDiagram(activeConversation.generatedDocs.analysisDoc, currentDiagramType, geminiModel);
                 // Note: generateDiagram is not a streaming function, but we wrap it for consistency
                 const code = await stream;
                 await processStream((async function*() { yield { type: 'visualization_update', content: code }; })(), 'visualization');
                 return; // Exit early as it's not a real stream
            }

            // FIX: The `type` argument was incorrect. It's mapped to the expected 'docKey' for processStream.
            const docKey = type === 'analysis' ? 'analysisDoc' : type === 'test' ? 'testScenarios' : 'traceabilityMatrix';
            await processStream(stream, docKey);
            
        } catch (err) {
            if (err instanceof Error) {
                console.error(`Error generating ${type}:`, err);
                setError(err.message);
            }
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
        }
    }, [activeConversation, geminiModel, processStream, selectedTemplates, diagramType, setActiveDocTab]);
    
     const handleEvaluateDocument = useCallback(async () => {
        if (!activeConversation || !activeConversation.generatedDocs.analysisDoc) return;
        
        const systemMessageContent = `[SİSTEM]: Lütfen aşağıdaki analizi değerlendir ve analizi bir sonraki adıma taşımak için en önemli eksiklikleri giderecek sorular sor. Sadece ve sadece soru sor.
        ---
        ${activeConversation.generatedDocs.analysisDoc}
        ---`;
        
        // This is a "system" message that isn't shown to the user but guides the AI
        const systemMessage: Message = {
            id: uuidv4(),
            role: 'system',
            content: systemMessageContent,
            timestamp: new Date().toISOString()
        };

        const tempConversation = {
            ...activeConversation,
            messages: [...activeConversation.messages, systemMessage]
        };
        
        // We're essentially faking a user message to trigger the AI response flow
        // but the actual prompt is hidden from the user in a system message.
        await sendMessage(
            "[KULLANICI EYLEMİ]: AI'dan mevcut dokümanı değerlendirmesini ve soru sormasını istedim.",
            true
        );

    }, [activeConversation, sendMessage]);

    const handleFeedbackUpdate = (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => {
        if (!activeConversation) return;

        const updatedMessages = activeConversation.messages.map(msg =>
            msg.id === messageId ? { ...msg, feedback: feedbackData } : msg
        );
        updateConversation(activeConversation.id, { messages: updatedMessages });
    };

    const handleEditLastUserMessage = () => {
        if (!activeConversation) return;

        const allMessages = [...activeConversation.messages];
        const lastMessage = allMessages.pop();

        if (lastMessage && lastMessage.role === 'user') {
            setMessageToEdit(lastMessage.content);
            // Remove the last user message and any subsequent assistant message
            const lastAssistantIndex = allMessages.map(m => m.role).lastIndexOf('assistant');
            const lastUserIndex = allMessages.map(m => m.role).lastIndexOf('user');
            
            if (lastAssistantIndex > lastUserIndex) {
                 allMessages.pop();
            }

            updateConversation(activeConversation.id, { messages: allMessages });
        }
    };
    
    const handleModifySelection = async (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => {
        if (!activeConversation) return;
        
        const originalContent = activeConversation.generatedDocs[docKey];
        setInlineModificationState({ docKey, originalText: selectedText });
        
        try {
            const basePrompt = promptService.getPrompt('modifySelectedText');
            const fullPrompt = `${basePrompt}\n\n**Orijinal Metin:**\n"${selectedText}"\n\n**Talimat:**\n"${userPrompt}"`;
            const modifiedText = await geminiService.continueConversation([{ role: 'user', content: fullPrompt, id: 'temp', timestamp: '' }], geminiModel);

            const newContent = originalContent.replace(selectedText, modifiedText);

            updateConversation(activeConversation.id, {
                generatedDocs: {
                    ...activeConversation.generatedDocs,
                    [docKey]: newContent
                }
            });

        } catch (err) {
            console.error("Modification error:", err);
            setError(err instanceof Error ? err.message : "Metin değiştirilemedi.");
        } finally {
            setInlineModificationState(null);
        }
    };
    
    const handleModifyDiagram = async (userPrompt: string) => {
        if (!activeConversation) return;
        
        const currentCode = (diagramType === 'bpmn' ? activeConversation.generatedDocs.bpmnViz?.code : activeConversation.generatedDocs.mermaidViz?.code) || '';
        if (!currentCode) {
            setError("Değiştirilecek mevcut bir diyagram bulunamadı.");
            return;
        }

        setIsProcessing(true);
        setGeneratingDocType('viz');
        
        try {
             const newCode = await geminiService.modifyDiagram(currentCode, userPrompt, geminiModel, diagramType);
             
              if (activeConversationId) {
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        const newDocs = { ...c.generatedDocs };
                         if (diagramType === 'mermaid') {
                            newDocs.mermaidViz = { code: newCode, sourceHash: '' };
                        } else {
                             newDocs.bpmnViz = { code: newCode, sourceHash: '' };
                        }
                        return { ...c, generatedDocs: newDocs };
                    }
                    return c;
                }));
            }
        } catch (err) {
             console.error("Diagram modification error:", err);
            setError(err instanceof Error ? err.message : "Diyagram değiştirilemedi.");
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
        }
    };
    
     const handleSuggestNextFeature = async () => {
        if (!activeConversation) return;

        setIsFeatureSuggestionsModalOpen(true);
        setIsFetchingSuggestions(true);
        setSuggestionError(null);

        try {
            const suggestions = await geminiService.suggestNextFeature(
                activeConversation.generatedDocs.analysisDoc,
                activeConversation.messages,
                geminiModel
            );
            setFeatureSuggestions(suggestions);
        } catch (e) {
            setSuggestionError(e instanceof Error ? e.message : 'Öneriler alınamadı.');
        } finally {
            setIsFetchingSuggestions(false);
        }
    };

    const handleTemplateChange = (type: 'analysis' | 'test') => (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newTemplateId = event.target.value;
        const currentDoc = type === 'analysis' 
            ? activeConversation?.generatedDocs.analysisDoc 
            : activeConversation?.generatedDocs.testScenarios;

        if (currentDoc && currentDoc !== SAMPLE_ANALYSIS_DOCUMENT) {
            regenerateModalData.current = { docType: type, newTemplateId: newTemplateId };
            setIsRegenerateModalOpen(true);
        } else {
             setSelectedTemplates(prev => ({ ...prev, [type]: newTemplateId }));
             if (currentDoc) {
                 handleGenerateDoc(type, newTemplateId);
             }
        }
    };
    
    const handleConfirmRegenerate = (saveCurrent: boolean) => {
        const { docType, newTemplateId } = regenerateModalData.current!;
        if (saveCurrent && activeConversation) {
            const currentContent = activeConversation.generatedDocs[docType === 'analysis' ? 'analysisDoc' : 'testScenarios'];
            // FIX: The 'templates' variable was not defined. Use the imported constants instead.
            const currentTemplate = (docType === 'analysis' ? ANALYSIS_TEMPLATES : TEST_SCENARIO_TEMPLATES).find(t => t.id === selectedTemplates[docType]);
            
            const newVersion: AnalysisVersion = {
                id: uuidv4(),
                content: currentContent,
                templateId: currentTemplate?.id || 'unknown',
                createdAt: new Date().toISOString()
            };

            const newHistory = [...(activeConversation.generatedDocs.analysisDocHistory || []), newVersion];
            updateConversation(activeConversation.id, {
                generatedDocs: { ...activeConversation.generatedDocs, analysisDocHistory: newHistory }
            });
        }
        
        setSelectedTemplates(prev => ({ ...prev, [docType]: newTemplateId }));
        handleGenerateDoc(docType, newTemplateId);
        setIsRegenerateModalOpen(false);
        regenerateModalData.current = null;
    };
    
    const nextBestAction = useNextBestAction(activeConversation, handleGenerateDoc, () => setActiveDocTab('backlog-generation'), sendMessage, handleEvaluateDocument);

    const handlePrepareQuestionForAnswer = (question: string) => {
        sendMessage(question);
        // Optimistically remove the question from the report
        if (activeConversation?.generatedDocs.maturityReport) {
            const newReport = {
                ...activeConversation.generatedDocs.maturityReport,
                suggestedQuestions: activeConversation.generatedDocs.maturityReport.suggestedQuestions.filter(q => q !== question)
            };
            updateConversation(activeConversation.id, { generatedDocs: { ...activeConversation.generatedDocs, maturityReport: newReport }});
        }
    };


    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
                <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8
 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    return (
        <div className="font-sans bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 h-screen flex flex-col overflow-hidden">
             {error && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 error-banner-enter dark:bg-red-900/80 dark:text-red-200 dark:border-red-600">
                    <AlertTriangle className="h-5 w-5"/>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-4 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800">
                        <X className="h-4 w-4"/>
                    </button>
                </div>
            )}
            <Header
                user={user}
                onLogout={onLogout}
                theme={theme}
                onThemeChange={handleThemeChange}
                appMode={appMode}
                onAppModeChange={setAppMode}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                onOpenShareModal={() => setIsShareModalOpen(true)}
                isWorkspaceVisible={appMode === 'analyst' ? isWorkspaceVisible : false}
                onToggleWorkspace={() => setIsWorkspaceVisible(!isWorkspaceVisible)}
                saveStatus={saveStatus}
                maturityScore={displayedMaturityScore}
                isProcessing={isProcessing}
                onToggleDeveloperPanel={handleToggleDeveloperPanel}
            />
            <div className="flex-1 flex min-h-0 relative">
                <Sidebar
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onSelectConversation={setActiveConversationId}
                    onNewConversation={handleNewConversation}
                    onUpdateConversationTitle={updateConversationTitle}
                    onDeleteConversation={deleteConversation}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                />
                <div className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-72' : 'ml-0'}`}>
                    {appMode === 'analyst' ? (
                        <div className="flex-1 flex flex-row min-h-0">
                            <div className={`flex flex-col border-r border-slate-200 dark:border-slate-700 ${isWorkspaceVisible ? 'w-full lg:w-1/3' : 'w-full'}`}>
                                 <AnalystView 
                                    activeConversation={activeConversation || null}
                                    user={user}
                                    isProcessing={isProcessing}
                                    generatingDocType={generatingDocType}
                                    onSendMessage={sendMessage}
                                    onFeedbackUpdate={handleFeedbackUpdate}
                                    onEditLastUserMessage={handleEditLastUserMessage}
                                    onStopGeneration={handleStopGeneration}
                                    messageToEdit={messageToEdit}
                                    onSuggestNextFeature={handleSuggestNextFeature}
                                    nextBestAction={nextBestAction}
                                    isExpertMode={isExpertMode}
                                    onExpertModeChange={setIsExpertMode}
                                 />
                             </div>
                             {isWorkspaceVisible && activeConversation && (
                                 <div className="flex-1 h-full bg-white dark:bg-slate-800 hidden lg:flex">
                                     <DocumentWorkspace 
                                        conversation={activeConversation}
                                        isProcessing={isProcessing}
                                        generatingDocType={generatingDocType}
                                        onUpdateConversation={updateConversation}
                                        onModifySelection={handleModifySelection}
                                        onModifyDiagram={handleModifyDiagram}
                                        onGenerateDoc={handleGenerateDoc}
                                        inlineModificationState={inlineModificationState}
                                        templates={{ analysis: ANALYSIS_TEMPLATES, test: TEST_SCENARIO_TEMPLATES }}
                                        selectedTemplates={selectedTemplates}
                                        onTemplateChange={{
                                            analysis: handleTemplateChange('analysis'),
                                            test: handleTemplateChange('test'),
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
                    ) : (
                        <ProjectBoard user={user} />
                    )}
                </div>
            </div>
            {isNewAnalysisModalOpen && <NewAnalysisModal isOpen={isNewAnalysisModalOpen} onClose={() => setIsNewAnalysisModalOpen(false)} onStartFromScratch={handleStartFromScratch} onStartWithDocument={handleStartWithDocument} isProcessing={isProcessing} />}
            {isShareModalOpen && activeConversation && <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} conversation={activeConversation} onUpdateShareSettings={(id, updates) => updateConversation(id, updates)} />}
            {isFeatureSuggestionsModalOpen && <FeatureSuggestionsModal isOpen={isFeatureSuggestionsModalOpen} onClose={() => setIsFeatureSuggestionsModalOpen(false)} isLoading={isFetchingSuggestions} suggestions={featureSuggestions} onSelectSuggestion={(s) => sendMessage(s)} error={suggestionError} onRetry={handleSuggestNextFeature} />}
            {isRegenerateModalOpen && regenerateModalData.current && (
                <RegenerateConfirmationModal 
                    isOpen={isRegenerateModalOpen}
                    onClose={() => setIsRegenerateModalOpen(false)}
                    onConfirm={handleConfirmRegenerate}
                    documentName={regenerateModalData.current.docType === 'analysis' ? 'Analiz Dokümanı' : 'Test Senaryoları'}
                    // FIX: The 'templates' variable was not defined. Use the imported constants instead.
                    templateName={(regenerateModalData.current.docType === 'analysis' ? ANALYSIS_TEMPLATES : TEST_SCENARIO_TEMPLATES).find(t => t.id === regenerateModalData.current!.newTemplateId)?.name || ''}
                />
            )}
             {isDeveloperPanelOpen && (
                <DeveloperPanel
                    onClose={handleToggleDeveloperPanel}
                    modelName={localStorage.getItem('geminiModel') || 'gemini-2.5-flash'}
                    onModelNameChange={(name) => localStorage.setItem('geminiModel', name)}
                    supabaseUrl={localStorage.getItem('supabaseUrl') || ''}
                    onSupabaseUrlChange={(url) => localStorage.setItem('supabaseUrl', url)}
                    supabaseAnonKey={localStorage.getItem('supabaseAnonKey') || ''}
                    onSupabaseAnonKeyChange={(key) => localStorage.setItem('supabaseAnonKey', key)}
                    testUserEmail={localStorage.getItem('devTestUserEmail') || ''}
                    onTestUserEmailChange={(email) => localStorage.setItem('devTestUserEmail', email)}
                    testUserPassword={localStorage.getItem('devTestUserPassword') || ''}
                    onTestUserPasswordChange={(pw) => localStorage.setItem('devTestUserPassword', pw)}
                    isFetchingFeedback={isFetchingFeedback}
                    onToggleFeedbackDashboard={handleToggleFeedbackDashboard}
                />
            )}
            {isFeedbackDashboardOpen && (
                <FeedbackDashboard
                    isOpen={isFeedbackDashboardOpen}
                    onClose={() => setIsFeedbackDashboardOpen(false)}
                    feedbackData={allFeedback}
                />
            )}
        </div>
    );
};