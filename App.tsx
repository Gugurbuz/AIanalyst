// App.tsx
// FIX: Corrected the React import statement to properly import hooks.
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
import type { User, Conversation, Message, Theme, AppMode, GeminiModel, GeneratedDocs, FeedbackItem, Template, VizData, ExpertStep, GenerativeSuggestion, DocumentVersion, Document, DocumentType } from './types';
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

// A helper generator function to wrap raw doc streams into StreamChunk objects
const wrapDocStream = async function* (
    stream: AsyncGenerator<StreamChunk>, 
    docKey: 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix'
): AsyncGenerator<StreamChunk> {
    for await (const chunk of stream) {
        yield chunk;
    }
};

const useNextBestAction = (
    conversation: (Conversation & { generatedDocs: GeneratedDocs }) | null,
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
    activeConversation: (Conversation & { generatedDocs: GeneratedDocs }) | null;
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
    onApplySuggestion: (suggestion: GenerativeSuggestion, messageId: string) => void;
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
    onApplySuggestion,
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
                            onApplySuggestion={onApplySuggestion}
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


const documentTypeToKeyMap: Record<DocumentType, keyof GeneratedDocs> = {
    analysis: 'analysisDoc',
    test: 'testScenarios',
    traceability: 'traceabilityMatrix',
    mermaid: 'mermaidViz',
    bpmn: 'bpmnViz',
    maturity_report: 'maturityReport',
};

const keyToDocumentTypeMap: Record<keyof GeneratedDocs, DocumentType | null> = {
    analysisDoc: 'analysis',
    testScenarios: 'test',
    traceabilityMatrix: 'traceability',
    mermaidViz: 'mermaid',
    bpmnViz: 'bpmn',
    maturityReport: 'maturity_report',
    visualization: null,
    visualizationType: null,
    backlogSuggestions: null,
    isVizStale: null,
    isTestStale: null,
    isTraceabilityStale: null,
    isBacklogStale: null,
};


// Helper to build the `generatedDocs` object from the `documents` array
const buildGeneratedDocs = (documents: Document[]): GeneratedDocs => {
    const docs = { ...defaultGeneratedDocs };
    if (!documents) return docs;

    for (const doc of documents) {
        const key = documentTypeToKeyMap[doc.document_type];
        if (key) {
            if (key === 'mermaidViz' || key === 'bpmnViz' || key === 'maturityReport') {
                try {
                    (docs as any)[key] = JSON.parse(doc.content);
                } catch (e) {
                    console.error(`Error parsing JSON for ${key}:`, e);
                     (docs as any)[key] = key.endsWith('Viz') ? { code: '', sourceHash: '' } : null;
                }
            } else {
                 (docs as any)[key] = doc.content;
            }
        }
    }
    return docs;
};

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
    const expertModeClarificationAttempts = useRef(0);
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
        const conv = conversations.find(c => c.id === activeConversationId);
        if (!conv) return null;
        // The rest of the app expects `generatedDocs`, so we build it here.
        return {
            ...conv,
            generatedDocs: buildGeneratedDocs(conv.documents),
        };
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
            .select('*, conversation_details(*), document_versions(*), documents(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            setError("Sohbetler yüklenirken bir hata oluştu.");
            setConversations([]);
        } else if (data) {
            const conversationsWithDetails = data.map((conv: any) => ({
                ...conv,
                messages: (conv.conversation_details || []).sort(
                    (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                ),
                documentVersions: (conv.document_versions || []).sort(
                    (a: DocumentVersion, b: DocumentVersion) => a.version_number - b.version_number
                ),
                documents: conv.documents || [],
            }));
            setConversations(conversationsWithDetails as Conversation[]);
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
    
    // Reset expert mode attempt counter when switching conversations
    useEffect(() => {
        expertModeClarificationAttempts.current = 0;
    }, [activeConversationId]);


    // --- Developer & Feedback Panel Logic ---
    const handleToggleDeveloperPanel = () => {
        setIsDeveloperPanelOpen(prev => !prev);
    };

    const fetchAllFeedback = useCallback(async () => {
        setIsFetchingFeedback(true);
        const { data, error } = await supabase
            .from('conversations')
            .select('title, conversation_details(*)')
            .eq('user_id', user.id);

        if (error) {
            console.error("Geri bildirim getirilirken hata:", error);
            setError("Geri bildirimler yüklenemedi.");
            setAllFeedback([]);
        } else if (data) {
            const feedbackItems: FeedbackItem[] = [];
            data.forEach(conv => {
                if (conv.conversation_details) {
                    const messagesArray: Message[] = Array.isArray(conv.conversation_details) ? conv.conversation_details : [];
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
    const debouncedSave = useRef<(conv: Partial<Conversation> & { id: string }) => void>();

    useEffect(() => {
        debouncedSave.current = (conv: Partial<Conversation> & { id: string }) => {
            const save = async () => {
                setSaveStatus('saving');
                // Exclude messages & versions from the main update payload
                const { messages, documentVersions, documents, ...updatePayload } = conv;
                const { error } = await supabase
                    .from('conversations')
                    .update(updatePayload)
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

    const useDebounce = (callback: (conv: Partial<Conversation> & { id: string }) => void, delay: number) => {
        // FIX: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility.
        const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
        return useCallback((conv: Partial<Conversation> & { id: string }) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                callback(conv);
            }, delay);
        }, [callback, delay]);
    };
    
    const triggerSave = useDebounce((conv: Partial<Conversation> & { id: string }) => {
        if (debouncedSave.current) {
            debouncedSave.current(conv);
        }
    }, 1500);
    
    const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
        // Optimistically update local state first
        setConversations(prev =>
            prev.map(c => c.id === id ? { ...c, ...updates } : c)
        );
        // Then trigger the debounced save
        triggerSave({ id, ...updates });
    }, [triggerSave]);

    const addTokensToActiveConversation = useCallback((tokens: number) => {
        if (activeConversationId && tokens > 0) {
            const currentTokens = conversations.find(c => c.id === activeConversationId)?.total_tokens_used || 0;
            const newTotal = currentTokens + tokens;
            updateConversation(activeConversationId, { total_tokens_used: newTotal });
        }
    }, [activeConversationId, conversations, updateConversation]);

    const saveDocumentVersion = useCallback(async (
        docKey: keyof GeneratedDocs,
        newContent: any, // Can be string or object
        reason: string
    ) => {
        if (!activeConversationId) return;

        const conv = conversations.find(c => c.id === activeConversationId);
        if (!conv) return;

        const document_type = keyToDocumentTypeMap[docKey];
        if (!document_type) {
            console.warn(`Unknown docKey "${docKey}" passed to saveDocumentVersion. Skipping.`);
            return;
        }

        const newContentString = typeof newContent === 'string' ? newContent : JSON.stringify(newContent);
        
        // 1. Insert into versions table
        const versionsForDocType = (conv.documentVersions || []).filter(v => v.document_type === document_type);
        const latestVersion = versionsForDocType.reduce((max, v) => v.version_number > max ? v.version_number : max, 0);
        const newVersionNumber = latestVersion + 1;
        
        const newVersionRecord: Omit<DocumentVersion, 'id' | 'created_at'> = {
            conversation_id: conv.id,
            user_id: user.id,
            document_type,
            content: newContentString,
            version_number: newVersionNumber,
            reason_for_change: reason
        };

        const { data: newVersionDb, error: insertError } = await supabase
            .from('document_versions')
            .insert(newVersionRecord)
            .select()
            .single();

        if (insertError || !newVersionDb) {
            setError("Doküman versiyonu kaydedilemedi: " + (insertError?.message || 'Bilinmeyen hata'));
            return;
        }

        // 2. UPSERT into documents table
        const { data: updatedDoc, error: upsertError } = await supabase
            .from('documents')
            .upsert({
                conversation_id: conv.id,
                user_id: user.id,
                document_type: document_type,
                content: newContentString,
                current_version_id: newVersionDb.id,
            }, { onConflict: 'conversation_id, document_type' })
            .select()
            .single();

        if (upsertError || !updatedDoc) {
             setError("Ana doküman kaydedilemedi: " + (upsertError?.message || 'Bilinmeyen hata'));
             return;
        }

        // 3. Update local state
        setConversations(prev =>
            prev.map(c => {
                if (c.id === activeConversationId) {
                    const existingDocs = c.documents || [];
                    const docIndex = existingDocs.findIndex(d => d.document_type === document_type);
                    
                    let updatedDocuments;
                    if (docIndex > -1) {
                        updatedDocuments = [...existingDocs];
                        updatedDocuments[docIndex] = updatedDoc as Document;
                    } else {
                        updatedDocuments = [...existingDocs, updatedDoc as Document];
                    }

                    const updatedVersions = [...(c.documentVersions || []), newVersionDb as DocumentVersion];
                    return { ...c, documents: updatedDocuments, documentVersions: updatedVersions };
                }
                return c;
            })
        );
        
    }, [activeConversationId, conversations, user.id]);


    const createNewConversation = useCallback(async (initialDocs: Partial<GeneratedDocs> = {}, customTitleOrFirstMessage: string | null = null) => {
        let title: string;
        let tokensUsed = 0;
        
        // Heuristic to check if the provided string is a title or content for title generation
        const isCustomTitle = Object.keys(initialDocs).length > 0 && !!customTitleOrFirstMessage;
    
        if (isCustomTitle) {
            title = customTitleOrFirstMessage!;
        } else if (customTitleOrFirstMessage) {
            const { title: newTitle, tokens } = await geminiService.generateConversationTitle(customTitleOrFirstMessage);
            title = newTitle;
            tokensUsed = tokens;
        } else {
            title = 'Yeni Analiz';
        }

        const newConversationData: Omit<Conversation, 'id' | 'created_at' | 'messages' | 'documentVersions' | 'documents'> = {
            user_id: user.id,
            title: title || 'Yeni Analiz',
            is_shared: false,
            share_id: uuidv4(),
            total_tokens_used: tokensUsed,
        };

        const { data: convData, error: convError } = await supabase
            .from('conversations')
            .insert(newConversationData)
            .select()
            .single();

        if (convError || !convData) {
            console.error(convError);
            setError("Yeni sohbet oluşturulamadı.");
            return null;
        }

        const newConv = convData as Conversation;
        newConv.messages = [];
        newConv.documentVersions = [];
        newConv.documents = [];

        // This is a temporary state for the UI before the docs are saved.
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);

        // Save initial docs as version 1
        for (const key in initialDocs) {
            if (Object.prototype.hasOwnProperty.call(initialDocs, key)) {
                const docKey = key as keyof GeneratedDocs;
                const docContent = initialDocs[docKey];
                if (docContent) {
                    // We need to use a callback with setConversations to get the latest state inside this loop
                    setConversations(prev => {
                        const updatedConv = prev.find(c => c.id === newConv.id);
                        if(updatedConv) {
                            saveDocumentVersion(docKey, docContent, "İlk Oluşturma");
                        }
                        return prev;
                    });
                }
            }
        }
        
        // Refetch to get the fully populated conversation
        await fetchConversations();

        return newConv;
    }, [user.id, saveDocumentVersion, fetchConversations]);
    
     const handleNewConversation = useCallback(() => {
        setIsNewAnalysisModalOpen(true);
    }, []);

    const handleStartFromScratch = () => {
        createNewConversation();
        setIsNewAnalysisModalOpen(false);
    }
    
    const handleStartWithDocument = (documentContent: string, title: string) => {
        createNewConversation(
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
        
        // Deletion will cascade to conversation_details if set up in Supabase policies/schema
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
        docKey: 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix' | 'chat_response' | 'visualization' | 'maturity' | 'expert_run' | 'generative_suggestion'
    ) => {
        let fullResponse = "";
        let finalMessage = "";
        let finalSuggestion: GenerativeSuggestion | null = null;
        let totalTokens = 0;

        for await (const chunk of stream) {
            if (chunk.type === 'doc_stream_chunk' && activeConversationId) {
                fullResponse += chunk.chunk;
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        const tempGeneratedDocs = buildGeneratedDocs(c.documents);
                        tempGeneratedDocs[chunk.docKey] = fullResponse;
                         if (chunk.updatedReport) {
                            tempGeneratedDocs.maturityReport = chunk.updatedReport;
                        }
                        // This is a temporary UI update, the final save will happen after the stream
                        return { ...c };
                    }
                    return c;
                }));
            } else if (chunk.type === 'visualization_update' && activeConversationId) {
                const vizKey = diagramType === 'mermaid' ? 'mermaidViz' : 'bpmnViz';
                saveDocumentVersion(vizKey, { code: chunk.content, sourceHash: '' }, "AI Tarafından Oluşturuldu");
            } else if (chunk.type === 'chat_response' && activeConversationId) {
                finalMessage = chunk.content;
            } else if (chunk.type === 'generative_suggestion' && activeConversationId) {
                finalSuggestion = chunk.suggestion;
            } else if (chunk.type === 'usage_update' && activeConversationId) {
                 totalTokens += chunk.tokens;
            } else if (chunk.type === 'maturity_update' && activeConversationId) {
                 saveDocumentVersion('maturityReport', chunk.report, "AI Olgunluk Değerlendirmesi");
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

        if (totalTokens > 0) {
            addTokensToActiveConversation(totalTokens);
        }
        
        return { fullResponse, finalMessage, finalSuggestion };
    }, [activeConversationId, diagramType, addTokensToActiveConversation, saveDocumentVersion]);


    const sendMessage = useCallback(async (content: string, isSystemMessage: boolean = false) => {
        if (!content.trim()) return;
        
        setMessageToEdit(null);
    
        const now = new Date().toISOString();
        const userMessageData = {
            role: 'user' as const,
            content: content.trim(),
            timestamp: now,
            created_at: now,
        };
    
        let conversationForApi: Conversation & { generatedDocs: GeneratedDocs };
    
        if (!activeConversation) {
            // --- NEW CONVERSATION ---
            const newConv = await createNewConversation({}, content.trim());
            if (!newConv) {
                setError("Sohbet oluşturulamadı.");
                return;
            }
            
            const userMessage: Message = { ...userMessageData, id: uuidv4(), conversation_id: newConv.id };
            
            const { error: insertError } = await supabase.from('conversation_details').insert(userMessage);
            if (insertError) {
                setError("Mesajınız kaydedilemedi.");
                // Optionally revert UI update
                return;
            }
            
            // Build the state for the API call
            conversationForApi = {
                ...newConv,
                messages: [userMessage], // Add the message to the empty array from newConv
                generatedDocs: buildGeneratedDocs(newConv.documents),
            };
    
            // Update the global state based on the fetched conversation, now with the first message
            setConversations(prev => prev.map(c => c.id === newConv.id ? { ...c, messages: [userMessage] } : c));
    
        } else {
            // --- EXISTING CONVERSATION ---
            const userMessage: Message = { ...userMessageData, id: uuidv4(), conversation_id: activeConversation.id };
    
            const { error: insertError } = await supabase.from('conversation_details').insert(userMessage);
            if (insertError) {
                setError("Mesajınız gönderilemedi.");
                return;
            }
    
            // Build the state for the API call
            conversationForApi = {
                ...activeConversation,
                messages: [...activeConversation.messages, userMessage],
            };
    
            // Update the global state
            setConversations(prev => prev.map(c => 
                c.id === activeConversation.id 
                ? { ...c, messages: conversationForApi.messages } 
                : c
            ));
        }
    
        setIsProcessing(true);
        streamControllerRef.current = new AbortController();
    
        try {
            let stream;
            let finalMessageContent = "";
            let finalSuggestion: GenerativeSuggestion | null = null;
            let newChecklist: ExpertStep[] | undefined;
    
            if (isExpertMode) {
                 const MAX_CLARIFICATION_ATTEMPTS = 2;
                
                const { needsClarification, questions, confirmationRequest, checklist, tokens } = await geminiService.clarifyAndConfirmExpertMode(conversationForApi.messages, geminiModel);
                addTokensToActiveConversation(tokens);
    
                if (needsClarification && questions && expertModeClarificationAttempts.current < MAX_CLARIFICATION_ATTEMPTS) {
                    finalMessageContent = questions;
                    expertModeClarificationAttempts.current++;
                } else {
                    expertModeClarificationAttempts.current = 0;
                    const convId = conversationForApi.id;
    
                    const assistantPlaceholder: Omit<Message, 'conversation_id'> = {
                        id: uuidv4(), role: 'assistant', content: confirmationRequest || "Onay bekleniyor...", timestamp: new Date().toISOString(), created_at: new Date().toISOString(), expertRunChecklist: checklist
                    };
                    const placeholderToInsert = { ...assistantPlaceholder, conversation_id: convId! };
                    await supabase.from('conversation_details').insert(placeholderToInsert);
    
                    const messagesForExpertRun = [...conversationForApi.messages, placeholderToInsert as Message];
                    setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: messagesForExpertRun } : c));
                    newChecklist = checklist;
    
                    const userConfirmed = await new Promise(resolve => resolve(true)); // Simplified
    
                    if (userConfirmed) {
                        stream = geminiService.executeExpertRun(messagesForExpertRun, { analysis: selectedTemplates.analysis, test: selectedTemplates.test }, geminiModel);
                        const { finalMessage } = await processStream(stream, 'expert_run');
                        finalMessageContent = finalMessage;
                    } else {
                        finalMessageContent = "Anladım, devam etmeden önce eklemek istediğiniz başka bir detay var mı?";
                    }
                }
            } else {
                stream = geminiService.processAnalystMessageStream(conversationForApi.messages, conversationForApi.generatedDocs, { analysis: selectedTemplates.analysis, test: selectedTemplates.test }, geminiModel);
                const { finalMessage, finalSuggestion: suggestion } = await processStream(stream, 'chat_response');
                finalMessageContent = finalMessage;
                finalSuggestion = suggestion;
            }
    
            if ((finalMessageContent || finalSuggestion) && conversationForApi.id) {
                const convId = conversationForApi.id;
                const assistantMessageData = {
                    id: uuidv4(),
                    conversation_id: convId,
                    role: 'assistant' as const,
                    content: finalMessageContent,
                    timestamp: new Date().toISOString(),
                    expertRunChecklist: newChecklist,
                    generativeSuggestion: finalSuggestion || undefined,
                    created_at: new Date().toISOString(),
                };
    
                const { data: newMsgData, error: newMsgError } = await supabase.from('conversation_details').insert(assistantMessageData).select().single();
                
                if (newMsgError) {
                    setError("Asistan yanıtı kaydedilemedi.");
                } else {
                    setConversations(prev => prev.map(c => {
                        if (c.id === convId) {
                            const existingMessages = c.messages.filter(m => !(m.expertRunChecklist && m.content.includes("Onay bekleniyor")));
                            return { ...c, messages: [...existingMessages, newMsgData as Message] };
                        }
                        return c;
                    }));
                }
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
    }, [activeConversation, createNewConversation, isExpertMode, geminiModel, selectedTemplates, processStream, addTokensToActiveConversation]);


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
            let stream: AsyncGenerator<StreamChunk>;
            const docKey = type === 'analysis' ? 'analysisDoc' : type === 'test' ? 'testScenarios' : 'traceabilityMatrix';

            if (type === 'analysis' || type === 'test' || type === 'traceability') {
                 let rawStream;
                 if (type === 'analysis') {
                    rawStream = geminiService.generateAnalysisDocument(activeConversation.messages, currentTemplateId, geminiModel);
                 } else if (type === 'test') {
                     rawStream = geminiService.generateTestScenarios(activeConversation.generatedDocs.analysisDoc, currentTemplateId, geminiModel);
                 } else { // traceability
                     rawStream = geminiService.generateTraceabilityMatrix(activeConversation.generatedDocs.analysisDoc, activeConversation.generatedDocs.testScenarios, geminiModel);
                 }
                 stream = wrapDocStream(rawStream, docKey as any);
                 const { fullResponse } = await processStream(stream, docKey as any);
                 saveDocumentVersion(docKey as 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix', fullResponse, "AI Tarafından Oluşturuldu");

            } else { // 'viz'
                 const { code, tokens } = await geminiService.generateDiagram(activeConversation.generatedDocs.analysisDoc, currentDiagramType, geminiModel);
                 addTokensToActiveConversation(tokens);
                 const vizKey = currentDiagramType === 'mermaid' ? 'mermaidViz' : 'bpmnViz';
                 saveDocumentVersion(vizKey, { code, sourceHash: '' }, "AI Tarafından Oluşturuldu");
                 // Exit early as it's not a real stream, handle state reset manually.
                 setIsProcessing(false);
                 setGeneratingDocType(null);
                 return;
            }
            
        } catch (err) {
            if (err instanceof Error) {
                console.error(`Error generating ${type}:`, err);
                setError(err.message);
            }
        } finally {
             // This will still run for the 'viz' case, but we handle the state inside the try block for that case.
            if (type !== 'viz') {
                setIsProcessing(false);
                setGeneratingDocType(null);
            }
        }
    }, [activeConversation, geminiModel, processStream, selectedTemplates, diagramType, setActiveDocTab, saveDocumentVersion, addTokensToActiveConversation]);
    
     const handleEvaluateDocument = useCallback(async () => {
        if (!activeConversation || !activeConversation.generatedDocs.analysisDoc) return;
        
        const systemMessageContent = `[SİSTEM]: Lütfen aşağıdaki analizi değerlendir ve analizi bir sonraki adıma taşımak için en önemli eksiklikleri giderecek sorular sor. Sadece ve sadece soru sor.
        ---
        ${activeConversation.generatedDocs.analysisDoc}
        ---`;
        
        // This is a "system" message that isn't shown to the user but guides the AI
        const systemMessage: Omit<Message, 'id' | 'conversation_id' | 'created_at'> = {
            role: 'system',
            content: systemMessageContent,
            timestamp: new Date().toISOString()
        };

        const { error: insertError } = await supabase.from('conversation_details').insert({ ...systemMessage, conversation_id: activeConversation.id, id: uuidv4() });
        if (insertError) {
            setError("Sistem mesajı gönderilemedi.");
            return;
        }

        await sendMessage(
            "[KULLANICI EYLEMİ]: AI'dan mevcut dokümanı değerlendirmesini ve soru sormasını istedim.",
            true
        );

    }, [activeConversation, sendMessage]);

    const handleFeedbackUpdate = async (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => {
        if (!activeConversation) return;

        // Optimistic UI update
        const updatedMessages = activeConversation.messages.map(msg =>
            msg.id === messageId ? { ...msg, feedback: feedbackData } : msg
        );
        setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, messages: updatedMessages } : c));
        
        // Database update
        const { error } = await supabase.from('conversation_details').update({ feedback: feedbackData }).eq('id', messageId);
        if (error) {
            setError("Geri bildirim kaydedilemedi.");
            // Revert on error
            setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, messages: activeConversation.messages } : c));
        }
    };

    const handleEditLastUserMessage = async () => {
        if (!activeConversation) return;

        const allMessages = [...activeConversation.messages];
        const lastMessage = allMessages[allMessages.length - 1];
        
        if (!lastMessage || lastMessage.role !== 'user') return;

        setMessageToEdit(lastMessage.content);
        
        const idsToDelete = [lastMessage.id];
        const secondLastMessage = allMessages[allMessages.length - 2];

        // Check if the previous message was an assistant response to this user message.
        if (secondLastMessage && secondLastMessage.role === 'assistant') {
            const lastUserIndex = allMessages.map(m => m.role).lastIndexOf('user', allMessages.length - 2);
            const lastAssistantIndex = allMessages.map(m => m.role).lastIndexOf('assistant');
            if(lastAssistantIndex > lastUserIndex) {
                 // The assistant message seems to be a reply to the user message we are deleting
                 // This logic might need refinement depending on the desired behavior.
                 // For now, let's assume we delete the user message and its direct reply.
                 // In a more complex scenario (e.g., user-user-assistant), this could be tricky.
                 // Let's stick to the simple case: delete last user and its last assistant reply.
                 const lastAsstMsg = allMessages.find((_,i) => i === lastAssistantIndex);
                 if(lastAsstMsg) idsToDelete.push(lastAsstMsg.id);
            }
        }
        
        // Optimistic update
        setConversations(prev => prev.map(c => 
            c.id === activeConversation.id 
            ? { ...c, messages: c.messages.filter(m => !idsToDelete.includes(m.id)) }
            : c
        ));

        // Database update
        const { error } = await supabase.from('conversation_details').delete().in('id', idsToDelete);
        if (error) {
            setError("Mesaj silinemedi.");
            // Revert
            setConversations(prev => [...prev]); // Force re-render with original state (could be improved)
        }
    };
    
    const handleModifySelection = async (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => {
        if (!activeConversation) return;
        
        const originalContent = activeConversation.generatedDocs[docKey];
        setInlineModificationState({ docKey, originalText: selectedText });
        
        try {
            const basePrompt = promptService.getPrompt('modifySelectedText');
            const fullPrompt = `${basePrompt}\n\n**Orijinal Metin:**\n"${selectedText}"\n\n**Talimat:**\n"${userPrompt}"`;
            const { text: modifiedText, tokens } = await geminiService.continueConversation([{ role: 'user', content: fullPrompt, id: 'temp', timestamp: '', conversation_id: 'temp', created_at: '' }], geminiModel);
            addTokensToActiveConversation(tokens);

            const newContent = originalContent.replace(selectedText, modifiedText);
            
            saveDocumentVersion(docKey, newContent, "AI Metin Düzenlemesi");

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
             const { code: newCode, tokens } = await geminiService.modifyDiagram(currentCode, userPrompt, geminiModel, diagramType);
             addTokensToActiveConversation(tokens);
             const vizKey = diagramType === 'mermaid' ? 'mermaidViz' : 'bpmnViz';
             saveDocumentVersion(vizKey, { code: newCode, sourceHash: '' }, "AI Tarafından Diyagram Düzenlemesi");
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
            const { suggestions, tokens } = await geminiService.suggestNextFeature(
                activeConversation.generatedDocs.analysisDoc,
                activeConversation.messages,
                geminiModel
            );
            addTokensToActiveConversation(tokens);
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
            const docKey = docType === 'analysis' ? 'analysisDoc' : 'testScenarios';
            const currentContent = activeConversation.generatedDocs[docKey];
            const reason = "Şablon Değişikliği Öncesi Arşivlendi";
            saveDocumentVersion(docKey, currentContent, reason);
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
            // This needs to be adapted to the new data structure
            saveDocumentVersion('maturityReport', newReport, 'Kullanıcı soruyu sordu');
        }
    };

    const handleApplySuggestion = async (suggestion: GenerativeSuggestion, messageId: string) => {
        if (!activeConversation) return;

        const { targetSection, suggestions } = suggestion;
        const newContent = suggestions.join('\n\n');
        const currentDoc = activeConversation.generatedDocs.analysisDoc;

        const lines = currentDoc.split('\n');
        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // CORRECTED REGEX: Remove the end-of-line anchor '$'. This allows matching a heading
        // even if the AI's `targetSection` doesn't include extra text like '(Hipotez)'.
        const headingRegex = new RegExp(`^#{2,3}\\s*(?:\\d+\\.?\\s*)?${escapeRegExp(targetSection).trim()}`, 'i');
        const startIndex = lines.findIndex(line => headingRegex.test(line.trim()));
        
        let updatedDoc;

        if (startIndex !== -1) {
            const headingLine = lines[startIndex];
            const headingLevel = (headingLine.match(/^(#+)/)?.[1] || '').length;

            // CORRECTED ENDINDEX LOGIC: Find the next heading of the same or higher level.
            let endIndex = -1;
            if (headingLevel > 0) {
                endIndex = lines.findIndex((line, index) => {
                    if (index <= startIndex) return false;
                    const match = line.trim().match(/^(#+)/);
                    if (match) {
                        const currentLevel = match[1].length;
                        return currentLevel <= headingLevel;
                    }
                    return false;
                });
            }

            if (endIndex === -1) {
                endIndex = lines.length; // Section goes to the end of the doc
            }

            const beforeLines = lines.slice(0, startIndex);
            const afterLines = lines.slice(endIndex);
            
            updatedDoc = [
                ...beforeLines,
                headingLine,
                '', // Add a blank line for spacing
                ...newContent.split('\n'),
                ...afterLines
            ].join('\n');

        } else {
            console.warn(`Could not find section "${targetSection}" to apply suggestion. Appending to document.`);
            updatedDoc = `${currentDoc.trim()}\n\n## ${targetSection}\n${newContent}`;
        }

        const now = new Date().toISOString();
        const userMessage = {
            id: uuidv4(), conversation_id: activeConversation.id, role: 'user' as const, content: `[KULLANICI EYLEMİ]: "${targetSection}" bölümü için sunulan öneriler onaylandı.`, timestamp: now, created_at: now
        };
        const assistantMessage = {
            id: uuidv4(), conversation_id: activeConversation.id, role: 'assistant' as const, content: `Harika! "${targetSection}" bölümünü belirttiğiniz şekilde güncelledim. Başka bir konu üzerinde çalışmamı ister misiniz?`, timestamp: now, created_at: now
        };
        
        // Database operations
        await supabase.from('conversation_details').delete().eq('id', messageId);
        await supabase.from('conversation_details').insert([userMessage, assistantMessage]);

        // Optimistic UI updates
        saveDocumentVersion('analysisDoc', updatedDoc, `AI Önerisi: '${targetSection}' Güncellendi`);
        setConversations(prev => prev.map(c => {
            if (c.id === activeConversation.id) {
                return {
                    ...c,
                    messages: [
                        ...c.messages.filter(msg => msg.id !== messageId),
                        userMessage as Message,
                        assistantMessage as Message
                    ]
                }
            }
            return c;
        }));
    };
    
    const handleExpertModeChange = (isOn: boolean) => {
        if (!isOn) {
            // Reset counter when turning expert mode off
            expertModeClarificationAttempts.current = 0;
        }
        setIsExpertMode(isOn);
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
                totalTokensUsed={activeConversation?.total_tokens_used}
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
                                    onExpertModeChange={handleExpertModeChange}
                                    onApplySuggestion={handleApplySuggestion}
                                 />
                             </div>
                             {isWorkspaceVisible && activeConversation && (
                                 <div className="flex-1 h-full bg-white dark:bg-slate-800 hidden lg:flex">
                                     <DocumentWorkspace 
                                        conversation={{...activeConversation, generatedDocs: activeConversation.generatedDocs}} // Pass reconstructed docs
                                        isProcessing={isProcessing}
                                        generatingDocType={generatingDocType}
                                        onUpdateDocument={saveDocumentVersion}
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
                                        onAddTokens={addTokensToActiveConversation}
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