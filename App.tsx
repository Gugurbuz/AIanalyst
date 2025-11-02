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
import { PromptSuggestions } from './components/PromptSuggestions';
import { ShareModal } from './components/ShareModal';
import { ProjectBoard } from './components/ProjectBoard';
import { DocumentWorkspace } from './components/DocumentWorkspace';
import { NewAnalysisModal } from './components/NewAnalysisModal';
import { FeatureSuggestionsModal } from './components/FeatureSuggestionsModal';
import { RegenerateConfirmationModal } from './components/RegenerateConfirmationModal';
import { DeveloperPanel } from './components/DeveloperPanel';
import { FeedbackDashboard } from './components/FeedbackDashboard';
import { UpgradeModal } from './components/UpgradeModal';
import { authService } from './services/authService';
import { SAMPLE_ANALYSIS_DOCUMENT } from './templates';
import type { User, Conversation, Message, Theme, AppMode, GeminiModel, GeneratedDocs, FeedbackItem, Template, VizData, ExpertStep, GenerativeSuggestion, DocumentVersion, Document, DocumentType, UserProfile, SourcedDocument } from './types';
import { v4 as uuidv4 } from 'uuid';
import { FileText, GanttChartSquare, Beaker, PlusSquare, Search, Sparkles, X, AlertTriangle } from 'lucide-react';
import type { AppData } from './index';

interface AppProps {
  user: User;
  onLogout: () => void;
  initialData: AppData;
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
        
        const hasTestScenarios = typeof generatedDocs.testScenarios === 'object' 
            ? !!generatedDocs.testScenarios.content 
            : !!generatedDocs.testScenarios;

        if (hasRealAnalysisDoc && hasVisualization && hasTestScenarios) {
            return {
                label: "Proje Görevleri Oluştur",
                action: onNavigateToBacklogGeneration,
                icon: NextActionIcons.CREATE_TASKS,
                disabled: false
            };
        }
        if (hasRealAnalysisDoc && hasVisualization && !hasTestScenarios) {
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
    isDeepAnalysisMode: boolean;
    onDeepAnalysisModeChange: (isOn: boolean) => void;
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
    isDeepAnalysisMode,
    onDeepAnalysisModeChange,
    onApplySuggestion,
}) => {
    const scrollContainerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [activeConversation?.messages]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <main ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
                 <div className="max-w-4xl mx-auto w-full px-4 pt-4">
                    {activeConversation && activeConversation.messages.filter(m => m.role !== 'system').length > 0 ? (
                        <ChatMessageHistory
                            user={user}
                            chatHistory={activeConversation.messages}
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
                <div className="max-w-4xl mx-auto w-full">
                    <ChatInterface
                        isLoading={isProcessing && !generatingDocType}
                        onSendMessage={onSendMessage}
                        activeConversationId={activeConversation?.id || null}
                        onStopGeneration={onStopGeneration}
                        initialText={messageToEdit}
                        isDeepAnalysisMode={isDeepAnalysisMode}
                        onDeepAnalysisModeChange={onDeepAnalysisModeChange}
                        onSuggestNextFeature={onSuggestNextFeature}
                        isConversationStarted={!!activeConversation && activeConversation.messages.filter(m => m.role !== 'system').length > 0}
                        nextAction={nextBestAction}
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
            if (key === 'mermaidViz' || key === 'bpmnViz' || key === 'maturityReport' || key === 'testScenarios' || key === 'traceabilityMatrix') {
                try {
                    (docs as any)[key] = JSON.parse(doc.content);
                } catch (e) {
                    // If parsing fails, it's probably an old string format.
                    const fallbackToStringKeys: (keyof GeneratedDocs)[] = ['testScenarios', 'traceabilityMatrix'];
                    if (fallbackToStringKeys.includes(key as any)) {
                        (docs as any)[key] = doc.content;
                    } else {
                         console.error(`Error parsing JSON for ${key}:`, e);
                        if (key.endsWith('Viz')) {
                            (docs as any)[key] = { code: '', sourceHash: '' };
                        } else if (key === 'maturityReport') {
                            (docs as any)[key] = null;
                        }
                    }
                }
            } else {
                 (docs as any)[key] = doc.content;
            }
        }
    }
    return docs;
};

const simpleHash = (str: string): string => {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
};

const parseStreamingResponse = (content: string): { thinking: string | null; response: string } => {
    const thinkingTagStart = '<dusunce>';
    const thinkingTagEnd = '</dusunce>';

    let thinking: string | null = null;
    let response = content;

    const thinkingStartIndex = content.indexOf(thinkingTagStart);
    const thinkingEndIndex = content.indexOf(thinkingTagEnd);
    
    // Case 1: Perfect match with <dusunce>...</dusunce>
    if (thinkingStartIndex !== -1 && thinkingEndIndex > thinkingStartIndex) {
        thinking = content.substring(thinkingStartIndex + thinkingTagStart.length, thinkingEndIndex).trim();
        response = content.substring(thinkingEndIndex + thinkingTagEnd.length).trim();
        return { thinking, response };
    }
    
    // Case 2: Fallback for malformed tags or just "dusunce" on the first line
    const separator = '\n\n';
    const separatorIndex = content.indexOf(separator);
    const firstLineEndIndex = content.indexOf('\n');
    const firstLine = (firstLineEndIndex === -1 ? content : content.substring(0, firstLineEndIndex)).trim().toLowerCase();
    
    // Check if first line indicates thinking and a separator exists
    if ((firstLine === 'dusunce' || firstLine === '<dusunce>') && separatorIndex !== -1) {
        // Find where the thinking part starts (after the first line)
        const thinkingStartIndexAfterTag = firstLineEndIndex + 1;
        thinking = content.substring(thinkingStartIndexAfterTag, separatorIndex).trim();
        response = content.substring(separatorIndex + separator.length).trim();
        return { thinking, response };
    }
    
    // Case 3: No clear thinking part found
    return { thinking: null, response: content.trim() };
};


export const App: React.FC<AppProps> = ({ user, onLogout, initialData }) => {
    // --- Core State ---
    const [conversations, setConversations] = useState<Conversation[]>(initialData.conversations);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(
        initialData.conversations.length > 0 ? initialData.conversations[0].id : null
    );
    const [userProfile, setUserProfile] = useState<UserProfile | null>(initialData.profile);
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
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isFeatureSuggestionsModalOpen, setIsFeatureSuggestionsModalOpen] = useState(false);
    const [featureSuggestions, setFeatureSuggestions] = useState<string[]>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
    // FIX: Removed a misplaced assignment to regenerateModalData.current. It was causing a ReferenceError because
    // it was called before the ref was declared and used variables ('type', 'newTemplateId') that were not in scope.
    const regenerateModalData = useRef<{ docType: 'analysis' | 'test' | 'traceability', newTemplateId: string } | null>(null);
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
    const [isDeepAnalysisMode, setIsDeepAnalysisMode] = useState(false);
    const expertModeClarificationAttempts = useRef(0);
    const [diagramType, setDiagramType] = useState<'mermaid' | 'bpmn'>('mermaid');
    const [allTemplates, setAllTemplates] = useState<Template[]>(initialData.templates);
    const [selectedTemplates, setSelectedTemplates] = useState({
        analysis: '',
        test: '',
        traceability: '',
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
    // Find the conversation that matches the current ID. This might be null briefly during a transition.
    const nextConversation = useMemo(() => {
        const conv = conversations.find(c => c.id === activeConversationId);
        if (!conv) return null;
        // The rest of the app expects `generatedDocs`, so we build it here.
        return {
            ...conv,
            generatedDocs: buildGeneratedDocs(conv.documents),
        };
    }, [conversations, activeConversationId]);

    // Use a ref to hold the last valid conversation. This prevents the UI from flickering
    // to an empty state if `nextConversation` is momentarily null during a re-render.
    const activeConversationRef = useRef(nextConversation);
    if (nextConversation) {
        activeConversationRef.current = nextConversation;
    }

    // For rendering, always use the value in the ref. It will either be the new
    // conversation or the previous one, but never null during a switch.
    const activeConversation = activeConversationRef.current;
    
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
    useEffect(() => {
        if (initialData.templates.length > 0) {
            const defaultAnalysisTpl = initialData.templates.find(t => t.document_type === 'analysis' && t.is_system_template);
            const defaultTestTpl = initialData.templates.find(t => t.document_type === 'test' && t.is_system_template);
            const defaultTraceabilityTpl = initialData.templates.find(t => t.document_type === 'traceability' && t.is_system_template);
            setSelectedTemplates({
                analysis: defaultAnalysisTpl?.id || '',
                test: defaultTestTpl?.id || '',
                traceability: defaultTraceabilityTpl?.id || '',
            });
        }
    }, [initialData.templates]);
    
    // Reset expert mode attempt counter when switching conversations
    useEffect(() => {
        expertModeClarificationAttempts.current = 0;
    }, [activeConversationId]);

    const isInitialRender = useRef(true);

    // Effect to re-run maturity check when documents change (e.g., after manual save)
    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }

        const runMaturityCheck = async () => {
            if (!activeConversation) return;

            // Only run if there's been some interaction
            const hasInteraction = activeConversation.messages.filter(m => m.role !== 'system').length > 0 ||
                                   activeConversation.documents.length > 0;
            if (!hasInteraction) return;

            try {
                console.log("Document change detected, re-running maturity check...");
                const { report, tokens } = await geminiService.checkAnalysisMaturity(
                    activeConversation.messages,
                    activeConversation.generatedDocs,
                    'gemini-2.5-flash-lite'
                );
                commitTokenUsage(tokens);
                saveDocumentVersion('maturityReport', report, "Doküman değişikliği sonrası otomatik değerlendirme");
            } catch (maturityError) {
                console.warn("Arka plan olgunluk kontrolü (doküman değişikliği sonrası) başarısız oldu:", maturityError);
            }
        };

        // Debounce the check slightly to avoid running it multiple times for rapid saves
        const timer = setTimeout(runMaturityCheck, 1000);
        return () => clearTimeout(timer);

    }, [
        activeConversation?.generatedDocs.analysisDoc,
        // Using content properties to avoid triggering on sourceHash changes
        typeof activeConversation?.generatedDocs.testScenarios === 'object' ? activeConversation?.generatedDocs.testScenarios.content : activeConversation?.generatedDocs.testScenarios,
        typeof activeConversation?.generatedDocs.traceabilityMatrix === 'object' ? activeConversation?.generatedDocs.traceabilityMatrix.content : activeConversation?.generatedDocs.traceabilityMatrix,
        activeConversation?.messages
    ]);


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

    const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
        // FIX: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility.
        const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
        return useCallback((...args: any[]) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                callback(...args);
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

    const debouncedProfileSave = useRef<(profile: UserProfile) => void>();
    useEffect(() => {
        debouncedProfileSave.current = (profile: UserProfile) => {
            const save = async () => {
                const { error } = await supabase
                    .from('user_profiles')
                    .update({ tokens_used: profile.tokens_used })
                    .eq('id', profile.id);

                if (error) {
                    setError('Kullanıcı profili güncellenemedi: ' + error.message);
                }
            };
            save();
        };
    }, []);

    const triggerProfileSave = useDebounce((profile: UserProfile) => {
        if (debouncedProfileSave.current) {
            debouncedProfileSave.current(profile);
        }
    }, 2000);

    const commitTokenUsage = useCallback((tokens: number) => {
        if (tokens <= 0) return;

        // Update user profile
        if (userProfile) {
            const updatedProfile = {
                ...userProfile,
                tokens_used: userProfile.tokens_used + tokens,
            };
            setUserProfile(updatedProfile);
            triggerProfileSave(updatedProfile);
        }

        // Update conversation tokens (for info)
        if (activeConversationId) {
            const currentConv = conversations.find(c => c.id === activeConversationId);
            const currentTokens = currentConv?.total_tokens_used || 0;
            const newTotal = currentTokens + tokens;
            updateConversation(activeConversationId, { total_tokens_used: newTotal });
        }
    }, [userProfile, activeConversationId, conversations, updateConversation, triggerProfileSave]);

    const saveDocumentVersion = useCallback(async (
        docKey: keyof GeneratedDocs,
        newContent: any, // Can be string or object
        reason: string,
        templateId?: string | null
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
            reason_for_change: reason,
            template_id: templateId
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
                template_id: templateId
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
        
        commitTokenUsage(tokensUsed);

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
                    const templateId = docKey === 'analysisDoc' ? selectedTemplates.analysis : docKey === 'testScenarios' ? selectedTemplates.test : null;
                    // We need to use a callback with setConversations to get the latest state inside this loop
                    setConversations(prev => {
                        const updatedConv = prev.find(c => c.id === newConv.id);
                        if(updatedConv) {
                            saveDocumentVersion(docKey, docContent, "İlk Oluşturma", templateId);
                        }
                        return prev;
                    });
                }
            }
        }
        
        // Refetch to get the fully populated conversation
        // await fetchConversations(); // This is now handled by the main data fetcher.

        return newConv;
    }, [user.id, saveDocumentVersion, commitTokenUsage, selectedTemplates]);
    
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
            // FIX: Pass an argument to abort() to resolve the "Expected 1 arguments, but got 0" error.
            streamControllerRef.current.abort('User stopped generation');
            setIsProcessing(false);
            setGeneratingDocType(null);
            console.log("Stream stopped by user.");
        }
    };
    
    const processStream = useCallback(async (stream: AsyncGenerator<StreamChunk>, assistantMessageId: string) => {
        let docResponses: { [key in keyof GeneratedDocs]?: string } = {};
        let accumulatedMessage = "";
        let finalSuggestion: GenerativeSuggestion | null = null;
    
        for await (const chunk of stream) {
            if (chunk.type === 'doc_stream_chunk' && activeConversationId) {
                const docKey = chunk.docKey;
                if (!docResponses[docKey]) {
                    docResponses[docKey] = '';
                }
                docResponses[docKey]! += chunk.chunk;
    
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        const docType = keyToDocumentTypeMap[docKey];
                        if (!docType) return c;
    
                        const existingDocs = c.documents || [];
                        const docIndex = existingDocs.findIndex(d => d.document_type === docType);
    
                        let updatedDocuments;
                        if (docIndex > -1) {
                            updatedDocuments = [...existingDocs];
                            updatedDocuments[docIndex] = { ...updatedDocuments[docIndex], content: docResponses[docKey]! };
                        } else {
                            const tempDoc: Document = {
                                id: `temp-${docType}`,
                                conversation_id: c.id,
                                user_id: user.id,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                document_type: docType,
                                content: docResponses[docKey]!,
                                current_version_id: null,
                                is_stale: false,
                            };
                            updatedDocuments = [...existingDocs, tempDoc];
                        }
    
                        return { ...c, documents: updatedDocuments };
                    }
                    return c;
                }));
    
            } else if (chunk.type === 'visualization_update' && activeConversationId) {
                const vizKey = diagramType === 'mermaid' ? 'mermaidViz' : 'bpmnViz';
                saveDocumentVersion(vizKey, { code: chunk.content, sourceHash: '' }, "AI Tarafından Oluşturuldu");
            } else if (chunk.type === 'chat_stream_chunk' && activeConversationId) {
                accumulatedMessage += chunk.chunk;
                const { thinking, response } = parseStreamingResponse(accumulatedMessage);
                
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        return {
                            ...c,
                            messages: c.messages.map(m =>
                                m.id === assistantMessageId
                                    ? { ...m, content: response, thinking: thinking ?? undefined }
                                    : m
                            )
                        };
                    }
                    return c;
                }));

            } else if (chunk.type === 'chat_response' && activeConversationId) {
                accumulatedMessage = chunk.content;
                const { thinking, response } = parseStreamingResponse(accumulatedMessage);
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        return { ...c, messages: c.messages.map(m => m.id === assistantMessageId ? { ...m, content: response, thinking: thinking ?? undefined } : m) };
                    }
                    return c;
                }));
            } else if (chunk.type === 'generative_suggestion' && activeConversationId) {
                finalSuggestion = chunk.suggestion;
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        return { ...c, messages: c.messages.map(m => m.id === assistantMessageId ? { ...m, generativeSuggestion: finalSuggestion! } : m) };
                    }
                    return c;
                }));
            } else if (chunk.type === 'usage_update' && activeConversationId) {
                commitTokenUsage(chunk.tokens);
            } else if (chunk.type === 'maturity_update' && activeConversationId) {
                saveDocumentVersion('maturityReport', chunk.report, "AI Olgunluk Değerlendirmesi");
                if (maturityScoreTimerRef.current) clearTimeout(maturityScoreTimerRef.current);
                setDisplayedMaturityScore({ score: chunk.report.overallScore, justification: chunk.report.justification });
                maturityScoreTimerRef.current = setTimeout(() => setDisplayedMaturityScore(null), 5000);
            } else if (chunk.type === 'expert_run_update' && activeConversationId) {
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        const lastMessage = c.messages[c.messages.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                            return { ...c, messages: [ ...c.messages.slice(0, -1), { ...lastMessage, expertRunChecklist: chunk.checklist } ] };
                        }
                    }
                    return c;
                }));
                if (chunk.isComplete) {
                    accumulatedMessage = chunk.finalMessage || "Süreç tamamlandı.";
                }
            } else if (chunk.type === 'error') {
                setError(chunk.message);
                break;
            }
        }
    
        return { docResponses, finalMessage: accumulatedMessage, finalSuggestion };
    }, [activeConversationId, diagramType, commitTokenUsage, saveDocumentVersion, user.id]);


    const sendMessage = useCallback(async (content: string, isSystemMessage: boolean = false) => {
        if (!content.trim()) return;

        if (!userProfile || userProfile.tokens_used >= userProfile.token_limit) {
            if (streamControllerRef.current) {
                streamControllerRef.current.abort('Token limit reached');
            }
            setShowUpgradeModal(true);
            return;
        }
        
        setMessageToEdit(null);
    
        const now = new Date().toISOString();
        const userMessageData = {
            role: 'user' as const,
            content: content.trim(),
            timestamp: now,
            created_at: now,
        };
    
        let conversationForApi: Conversation & { generatedDocs: GeneratedDocs };
        let currentConversationId: string | null = activeConversationId;
    
        if (!currentConversationId) {
            const newConv = await createNewConversation(undefined, content.trim());
            if (!newConv) {
                setError("Sohbet oluşturulamadı.");
                return;
            }
            currentConversationId = newConv.id;
            const userMessage: Message = { ...userMessageData, id: uuidv4(), conversation_id: newConv.id };
            await supabase.from('conversation_details').insert(userMessage);
            conversationForApi = { ...newConv, messages: [userMessage], generatedDocs: buildGeneratedDocs(newConv.documents) };
            setConversations(prev => prev.map(c => c.id === newConv.id ? { ...c, messages: [userMessage] } : c));
        } else {
            const userMessage: Message = { ...userMessageData, id: uuidv4(), conversation_id: currentConversationId };
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: [...c.messages, userMessage] } : c));
            const { error: insertError } = await supabase.from('conversation_details').insert(userMessage);
            if (insertError) {
                setError("Mesajınız gönderilemedi.");
                setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: c.messages.filter(m => m.id !== userMessage.id) } : c));
                return;
            }
            const currentConv = conversations.find(c => c.id === currentConversationId);
            if (!currentConv) return;
            conversationForApi = { ...currentConv, messages: [...currentConv.messages, userMessage], generatedDocs: buildGeneratedDocs(currentConv.documents) };
        }
    
        setIsProcessing(true);
        streamControllerRef.current = new AbortController();

        const assistantMessageId = uuidv4();
        const assistantPlaceholder: Message = {
            id: assistantMessageId,
            conversation_id: currentConversationId!,
            role: 'assistant',
            content: '',
            thinking: '',
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
        };
        setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: [...c.messages, assistantPlaceholder] } : c));
    
        try {
            const analysisTemplatePrompt = allTemplates.find(t => t.id === selectedTemplates.analysis)?.prompt || '';
            const testTemplatePrompt = allTemplates.find(t => t.id === selectedTemplates.test)?.prompt || '';
            const traceabilityTemplatePrompt = allTemplates.find(t => t.id === selectedTemplates.traceability)?.prompt || '';
            const vizTemplate = allTemplates.find(t => t.document_type === 'visualization' && t.name.includes('Mermaid'));
            const vizTemplatePrompt = vizTemplate?.prompt || '';
            const modelForChat: GeminiModel = isDeepAnalysisMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

            const stream = geminiService.processAnalystMessageStream(conversationForApi.messages, conversationForApi.generatedDocs, { analysis: analysisTemplatePrompt, test: testTemplatePrompt, traceability: traceabilityTemplatePrompt, visualization: vizTemplatePrompt }, modelForChat);
            const { docResponses, finalMessage, finalSuggestion } = await processStream(stream, assistantMessageId);
        
            if (docResponses) {
                for (const key in docResponses) {
                    if (Object.prototype.hasOwnProperty.call(docResponses, key)) {
                        const docKey = key as keyof GeneratedDocs;
                        const docContent = docResponses[docKey];
                        if (docContent) {
                             const templateId = docKey === 'analysisDoc' ? selectedTemplates.analysis : docKey === 'testScenarios' ? selectedTemplates.test : docKey === 'traceabilityMatrix' ? selectedTemplates.traceability : null;
                            await saveDocumentVersion(docKey, docContent, "AI Tarafından Sohbet Üzerinden Oluşturuldu", templateId);
                        }
                    }
                }
            }
    
            if ((finalMessage || finalSuggestion) && conversationForApi.id) {
                const convId = conversationForApi.id;
                const { thinking, response } = parseStreamingResponse(finalMessage);

                const finalAssistantMessageData: Message = {
                    ...assistantPlaceholder,
                    content: response,
                    thinking: thinking ?? undefined,
                    generativeSuggestion: finalSuggestion || undefined,
                };
    
                setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: c.messages.map(m => m.id === assistantMessageId ? finalAssistantMessageData : m) } : c));
                const { error: newMsgError } = await supabase.from('conversation_details').insert(finalAssistantMessageData);
                if (newMsgError) { setError("Asistan yanıtı kaydedilemedi."); }
            } else {
                 setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessageId) } : c));
            }
    
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                console.error("Stream processing error:", err);
                setError(err.message);
                setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessageId) } : c));
            }
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
            streamControllerRef.current = null;
        }
    }, [activeConversationId, conversations, createNewConversation, isDeepAnalysisMode, selectedTemplates, processStream, userProfile, saveDocumentVersion, allTemplates]);


     const handleGenerateDoc = useCallback(async (
        type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', 
        newTemplateId?: string,
        newDiagramType?: 'mermaid' | 'bpmn'
    ) => {
        if (!activeConversation) return;

        if (!userProfile || userProfile.tokens_used >= userProfile.token_limit) {
            setShowUpgradeModal(true);
            return;
        }

        if (type === 'backlog-generation') {
            setActiveDocTab('backlog-generation');
            return;
        }

        // --- Caching Logic ---
        if (type === 'test') {
            const analysisHash = simpleHash(activeConversation.generatedDocs.analysisDoc);
            const currentTestDoc = activeConversation.generatedDocs.testScenarios;
            if (typeof currentTestDoc === 'object' && currentTestDoc.content && currentTestDoc.sourceHash === analysisHash) {
                setActiveDocTab('test');
                return; // Skip regeneration
            }
        }
        
        if (type === 'traceability') {
            const analysisDoc = activeConversation.generatedDocs.analysisDoc;
            const testDoc = activeConversation.generatedDocs.testScenarios;
            const testDocContent = typeof testDoc === 'object' ? testDoc.content : testDoc;
        
            if (!analysisDoc || !testDocContent) return;
            
            const combinedHash = simpleHash(analysisDoc + testDocContent);
            const currentTraceabilityDoc = activeConversation.generatedDocs.traceabilityMatrix;
        
            if (typeof currentTraceabilityDoc === 'object' && currentTraceabilityDoc.content && currentTraceabilityDoc.sourceHash === combinedHash) {
                setActiveDocTab('traceability');
                return; // Skip regeneration
            }
        }
        // --- End Caching Logic ---

        setIsProcessing(true);
        setGeneratingDocType(type);
        setActiveDocTab(type);

        let currentTemplateId;
        let template;
        let templatePrompt: string | undefined;

        if (type === 'viz') {
            const currentDiagramType = newDiagramType || diagramType;
            if (newDiagramType) setDiagramType(newDiagramType);
            const templateIdentifier = currentDiagramType === 'bpmn' ? 'BPMN' : 'Mermaid';
            template = allTemplates.find(t => t.document_type === 'visualization' && t.name.includes(templateIdentifier));
            
            if (template) {
                currentTemplateId = template.id;
                templatePrompt = template.prompt;
            } else {
                const fallbackPromptId = currentDiagramType === 'bpmn' ? 'generateBPMN' : 'generateVisualization';
                templatePrompt = promptService.getPrompt(fallbackPromptId);
                if(!templatePrompt) console.error(`Fallback prompt not found for ID: ${fallbackPromptId}`);
            }
        } else {
            switch (type) {
                case 'analysis': currentTemplateId = newTemplateId || selectedTemplates.analysis; break;
                case 'test': currentTemplateId = newTemplateId || selectedTemplates.test; break;
                case 'traceability': currentTemplateId = newTemplateId || selectedTemplates.traceability; break;
                default: currentTemplateId = '';
            }
            template = allTemplates.find(t => t.id === currentTemplateId);
            templatePrompt = template?.prompt;
        }

        if (!templatePrompt) {
            setError(`${type} için geçerli şablon bulunamadı.`);
            setIsProcessing(false);
            setGeneratingDocType(null);
            return;
        }

        const currentDiagramType = newDiagramType || diagramType;

        try {
            let stream: AsyncGenerator<StreamChunk>;
            const docKey = type === 'analysis' ? 'analysisDoc' : type === 'test' ? 'testScenarios' : 'traceabilityMatrix';
            const modelForGeneration: GeminiModel = type === 'analysis' || type === 'traceability' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

            if (type === 'analysis' || type === 'test' || type === 'traceability') {
                 let rawStream;
                 const testDoc = activeConversation.generatedDocs.testScenarios;
                 const testScenariosContent = typeof testDoc === 'object' ? testDoc.content : testDoc;

                 if (type === 'analysis') {
                    rawStream = geminiService.generateAnalysisDocument(activeConversation.messages, templatePrompt, modelForGeneration);
                 } else if (type === 'test') {
                     rawStream = geminiService.generateTestScenarios(activeConversation.generatedDocs.analysisDoc, templatePrompt, modelForGeneration);
                 } else { // traceability
                     rawStream = geminiService.generateTraceabilityMatrix(activeConversation.generatedDocs.analysisDoc, testScenariosContent, templatePrompt, modelForGeneration);
                 }
                 stream = wrapDocStream(rawStream, docKey as any);
                 const { docResponses } = await processStream(stream, ''); // Pass empty assistantId as this is not a chat response
                 const fullResponse = docResponses[docKey as keyof GeneratedDocs];
                 if (fullResponse) {
                     if (docKey === 'testScenarios') {
                        const analysisHash = simpleHash(activeConversation.generatedDocs.analysisDoc);
                        await saveDocumentVersion(docKey, { content: fullResponse, sourceHash: analysisHash }, "AI Tarafından Oluşturuldu", currentTemplateId);
                    } else if (docKey === 'traceabilityMatrix') {
                        const analysisDoc = activeConversation.generatedDocs.analysisDoc;
                        const combinedHash = simpleHash(analysisDoc + testScenariosContent);
                        await saveDocumentVersion(docKey, { content: fullResponse, sourceHash: combinedHash }, "AI Tarafından Oluşturuldu", currentTemplateId);
                    } else {
                        await saveDocumentVersion(docKey as 'analysisDoc', fullResponse, "AI Tarafından Oluşturuldu", currentTemplateId);
                    }
                 }

            } else { // 'viz'
                 const analysisHash = simpleHash(activeConversation.generatedDocs.analysisDoc);
                 const { code, tokens } = await geminiService.generateDiagram(activeConversation.generatedDocs.analysisDoc, currentDiagramType, templatePrompt, 'gemini-2.5-flash');
                 commitTokenUsage(tokens);
                 const vizKey = currentDiagramType === 'mermaid' ? 'mermaidViz' : 'bpmnViz';
                 saveDocumentVersion(vizKey, { code, sourceHash: analysisHash }, "AI Tarafından Oluşturuldu");
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
    }, [activeConversation, processStream, selectedTemplates, diagramType, setActiveDocTab, saveDocumentVersion, commitTokenUsage, userProfile, allTemplates]);
    
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
        if (!userProfile || userProfile.tokens_used >= userProfile.token_limit) {
            setShowUpgradeModal(true);
            return;
        }
        
        const originalContent = activeConversation.generatedDocs[docKey];
        const originalStringContent = typeof originalContent === 'object' ? (originalContent as SourcedDocument).content : originalContent;

        setInlineModificationState({ docKey, originalText: selectedText });
        
        try {
            const basePrompt = promptService.getPrompt('modifySelectedText');
            const fullPrompt = `${basePrompt}\n\n**Orijinal Metin:**\n"${selectedText}"\n\n**Talimat:**\n"${userPrompt}"`;
            const { text: modifiedText, tokens } = await geminiService.continueConversation([{ role: 'user', content: fullPrompt, id: 'temp', timestamp: '', conversation_id: 'temp', created_at: '' }], 'gemini-2.5-flash');
            commitTokenUsage(tokens);

            const newContent = originalStringContent.replace(selectedText, modifiedText);
            
            const currentDoc = activeConversation.documents.find(d => d.document_type === keyToDocumentTypeMap[docKey]);

            if (docKey === 'testScenarios') {
                const analysisHash = simpleHash(activeConversation.generatedDocs.analysisDoc);
                saveDocumentVersion(docKey, { content: newContent, sourceHash: analysisHash }, "AI Metin Düzenlemesi", currentDoc?.template_id);
            } else {
                 saveDocumentVersion(docKey, newContent, "AI Metin Düzenlemesi", currentDoc?.template_id);
            }

        } catch (err) {
            console.error("Modification error:", err);
            setError(err instanceof Error ? err.message : "Metin değiştirilemedi.");
        } finally {
            setInlineModificationState(null);
        }
    };
    
    const handleModifyDiagram = async (userPrompt: string) => {
        if (!activeConversation) return;
        if (!userProfile || userProfile.tokens_used >= userProfile.token_limit) {
            setShowUpgradeModal(true);
            return;
        }
        
        const currentCode = (diagramType === 'bpmn' ? activeConversation.generatedDocs.bpmnViz?.code : activeConversation.generatedDocs.mermaidViz?.code) || '';
        if (!currentCode) {
            setError("Değiştirilecek mevcut bir diyagram bulunamadı.");
            return;
        }

        setIsProcessing(true);
        setGeneratingDocType('viz');
        
        try {
             const { code: newCode, tokens } = await geminiService.modifyDiagram(currentCode, userPrompt, 'gemini-2.5-flash', diagramType);
             commitTokenUsage(tokens);
             const vizKey = diagramType === 'mermaid' ? 'mermaidViz' : 'bpmnViz';
             const analysisHash = simpleHash(activeConversation.generatedDocs.analysisDoc);
             saveDocumentVersion(vizKey, { code: newCode, sourceHash: analysisHash }, "AI Tarafından Diyagram Düzenlemesi");
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
        if (!userProfile || userProfile.tokens_used >= userProfile.token_limit) {
            setShowUpgradeModal(true);
            return;
        }

        setIsFeatureSuggestionsModalOpen(true);
        setIsFetchingSuggestions(true);
        setSuggestionError(null);

        try {
            const { suggestions, tokens } = await geminiService.suggestNextFeature(
                activeConversation.generatedDocs.analysisDoc,
                activeConversation.messages,
                'gemini-2.5-flash'
            );
            commitTokenUsage(tokens);
            setFeatureSuggestions(suggestions);
        } catch (e) {
            setSuggestionError(e instanceof Error ? e.message : 'Öneriler alınamadı.');
        } finally {
            setIsFetchingSuggestions(false);
        }
    };

    const handleTemplateChange = (type: 'analysis' | 'test' | 'traceability') => (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newTemplateId = event.target.value;
        const docKey = type === 'analysis' ? 'analysisDoc' : type === 'test' ? 'testScenarios' : 'traceabilityMatrix';
        const currentDoc = activeConversation?.generatedDocs[docKey];
        const docContent = typeof currentDoc === 'object' ? (currentDoc as SourcedDocument).content : currentDoc;


        if (docContent && docContent !== SAMPLE_ANALYSIS_DOCUMENT) {
            regenerateModalData.current = { docType: type, newTemplateId: newTemplateId };
            setIsRegenerateModalOpen(true);
        } else {
             setSelectedTemplates(prev => ({ ...prev, [type]: newTemplateId }));
             if (docContent) {
                 handleGenerateDoc(type, newTemplateId);
             }
        }
    };
    
    const handleConfirmRegenerate = (saveCurrent: boolean) => {
        const { docType, newTemplateId } = regenerateModalData.current!;
        if (saveCurrent && activeConversation) {
            const docKey = docType === 'analysis' ? 'analysisDoc' : docType === 'test' ? 'testScenarios' : 'traceabilityMatrix';
            const currentDoc = activeConversation.documents.find(d => d.document_type === keyToDocumentTypeMap[docKey]);
            const currentContent = activeConversation.generatedDocs[docKey];
            const reason = "Şablon Değişikliği Öncesi Arşivlendi";
            saveDocumentVersion(docKey, currentContent, reason, currentDoc?.template_id);
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
        const currentAnalysisDoc = activeConversation.documents.find(d => d.document_type === 'analysis');
        saveDocumentVersion('analysisDoc', updatedDoc, `AI Önerisi: '${targetSection}' Güncellendi`, currentAnalysisDoc?.template_id);
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
    
    const handleDeepAnalysisModeChange = (isOn: boolean) => {
        if (!isOn) {
            // Reset counter when turning expert mode off
            expertModeClarificationAttempts.current = 0;
        }
        setIsDeepAnalysisMode(isOn);
    };

    const handleRestoreVersion = async (version: DocumentVersion) => {
        if (!activeConversationId) return;
        
        const docKey = Object.keys(documentTypeToKeyMap).find(
            key => documentTypeToKeyMap[key as keyof GeneratedDocs] === version.document_type
        ) as keyof GeneratedDocs | undefined;

        if (!docKey) {
            setError(`Bilinmeyen doküman tipi: ${version.document_type}`);
            return;
        }

        let contentToRestore: string | object = version.content;
        // Try to parse if it's a type that is stored as a JSON string
        const jsonDocKeys: (keyof GeneratedDocs)[] = ['testScenarios', 'traceabilityMatrix', 'mermaidViz', 'bpmnViz', 'maturityReport'];
        if (jsonDocKeys.includes(docKey)) {
            try {
                contentToRestore = JSON.parse(version.content);
            } catch (e) {
                console.warn(`Could not parse version content for ${docKey}, using as raw string.`);
            }
        }
        
        await saveDocumentVersion(
            docKey,
            contentToRestore,
            `v${version.version_number} versiyonuna geri dönüldü`,
            version.template_id
        );
    };

    const analysisTemplates = useMemo(() => allTemplates.filter(t => t.document_type === 'analysis'), [allTemplates]);
    const testTemplates = useMemo(() => allTemplates.filter(t => t.document_type === 'test'), [allTemplates]);
    const traceabilityTemplates = useMemo(() => allTemplates.filter(t => t.document_type === 'traceability'), [allTemplates]);

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
                userProfile={userProfile}
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
                                    isDeepAnalysisMode={isDeepAnalysisMode}
                                    onDeepAnalysisModeChange={handleDeepAnalysisModeChange}
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
                                        templates={{ analysis: analysisTemplates, test: testTemplates, traceability: traceabilityTemplates }}
                                        selectedTemplates={selectedTemplates}
                                        onTemplateChange={{
                                            analysis: handleTemplateChange('analysis'),
                                            test: handleTemplateChange('test'),
                                            traceability: handleTemplateChange('traceability'),
                                        }}
                                        activeDocTab={activeDocTab}
                                        setActiveDocTab={setActiveDocTab}
                                        onPrepareQuestionForAnswer={handlePrepareQuestionForAnswer}
                                        diagramType={diagramType}
                                        setDiagramType={setDiagramType}
                                        onAddTokens={commitTokenUsage}
                                        onRestoreVersion={handleRestoreVersion}
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
            {showUpgradeModal && <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />}
            {isFeatureSuggestionsModalOpen && <FeatureSuggestionsModal isOpen={isFeatureSuggestionsModalOpen} onClose={() => setIsFeatureSuggestionsModalOpen(false)} isLoading={isFetchingSuggestions} suggestions={featureSuggestions} onSelectSuggestion={(s) => sendMessage(s)} error={suggestionError} onRetry={handleSuggestNextFeature} />}
            {isRegenerateModalOpen && regenerateModalData.current && (
                <RegenerateConfirmationModal 
                    isOpen={isRegenerateModalOpen}
                    onClose={() => setIsRegenerateModalOpen(false)}
                    onConfirm={handleConfirmRegenerate}
                    documentName={regenerateModalData.current.docType === 'analysis' ? 'Analiz Dokümanı' : regenerateModalData.current.docType === 'test' ? 'Test Senaryoları' : 'İzlenebilirlik Matrisi'}
                    // FIX: The 'templates' variable was not defined. Use the imported constants instead.
                    templateName={(regenerateModalData.current.docType === 'analysis' ? analysisTemplates : regenerateModalData.current.docType === 'test' ? testTemplates : traceabilityTemplates).find(t => t.id === regenerateModalData.current!.newTemplateId)?.name || ''}
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