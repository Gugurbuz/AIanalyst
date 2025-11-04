// hooks/useAppLogic.ts
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { geminiService, parseStreamingResponse } from '../services/geminiService';
import { promptService } from '../services/promptService';
import type { StreamChunk } from '../services/geminiService';
import { SAMPLE_ANALYSIS_DOCUMENT } from '../templates';
import type { User, Conversation, Message, Theme, AppMode, GeminiModel, GeneratedDocs, FeedbackItem, Template, ExpertStep, GenerativeSuggestion, DocumentVersion, Document, DocumentType, UserProfile, SourcedDocument } from '../types';
import { v4 as uuidv4 } from 'uuid';
import type { AppData } from '../index';


const defaultGeneratedDocs: GeneratedDocs = {
    requestDoc: '',
    analysisDoc: '',
    testScenarios: '',
    visualization: '',
    traceabilityMatrix: '',
};

const documentTypeToKeyMap: Record<DocumentType, keyof GeneratedDocs> = {
    request: 'requestDoc',
    analysis: 'analysisDoc',
    test: 'testScenarios',
    traceability: 'traceabilityMatrix',
    mermaid: 'mermaidViz',
    bpmn: 'bpmnViz',
    maturity_report: 'maturityReport',
};

const keyToDocumentTypeMap: Record<keyof GeneratedDocs, DocumentType | null> = {
    requestDoc: 'request',
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

interface UseAppLogicProps {
    user: User;
    onLogout: () => void;
    initialData: AppData;
}

export const useAppLogic = ({ user, onLogout, initialData }: UseAppLogicProps) => {
    // --- Core State ---
    const [conversations, setConversations] = useState<Conversation[]>(initialData.conversations);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(
        initialData.conversations.length > 0 ? initialData.conversations[0].id : null
    );
    const [userProfile, setUserProfile] = useState<UserProfile | null>(initialData.profile);
    const [isProcessing, setIsProcessing] = useState(false);
    const [generatingDocType, setGeneratingDocType] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- UI & Mode State ---
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark'); // Set default to 'dark'
    const [currentView, setCurrentView] = useState<'analyst' | 'backlog'>('analyst'); // New state for main navigation
    const [appMode, setAppMode] = useState<AppMode>('analyst'); // Kept for compatibility, but currentView is preferred
    const [isConversationListOpen, setIsConversationListOpen] = useState(false);
    const [isWorkspaceVisible, setIsWorkspaceVisible] = useState(true);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isFeatureSuggestionsModalOpen, setIsFeatureSuggestionsModalOpen] = useState(false);
    const [featureSuggestions, setFeatureSuggestions] = useState<string[]>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
    const regenerateModalData = useRef<{ docType: 'analysis' | 'test' | 'traceability', newTemplateId: string } | null>(null);
    const [activeDocTab, setActiveDocTab] = useState<'request' |'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation'>('analysis');
    const [longTextPrompt, setLongTextPrompt] = useState<{ content: string; callback: (choice: 'analyze' | 'save') => void } | null>(null);
    const [requestConfirmation, setRequestConfirmation] = useState<{ summary: string } | null>(null);

    
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
    // FIX: Add isExpertMode state to be used by the Header and ExpertModeToggle components.
    const [isExpertMode, setIsExpertMode] = useState(false);
    const expertModeClarificationAttempts = useRef(0);
    const [diagramType, setDiagramType] = useState<'mermaid' | 'bpmn'>('mermaid');
    const [allTemplates, setAllTemplates] = useState<Template[]>([]);
    const [selectedTemplates, setSelectedTemplates] = useState({
        analysis: '',
        test: '',
        traceability: '',
    });
    
    const [displayedMaturityScore, setDisplayedMaturityScore] = useState<{ score: number; justification: string } | null>(null);
    const maturityScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const streamControllerRef = useRef<AbortController | null>(null);
    
    // --- Refs for fixing infinite loops ---
    const conversationsRef = useRef(conversations);
    conversationsRef.current = conversations;
    const activeIdRef = useRef(activeConversationId);
    activeIdRef.current = activeConversationId;


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
        return {
            ...conv,
            generatedDocs: buildGeneratedDocs(conv.documents),
        };
    }, [conversations, activeConversationId]);
    
    // --- Theme Management ---
    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark';
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
        const systemTemplates = promptService.getSystemDocumentTemplates();
        const dbTemplates = initialData.templates;
        
        const systemTemplateIds = new Set(systemTemplates.map(t => t.id));
        const uniqueDbTemplates = dbTemplates.filter(t => !systemTemplateIds.has(t.id));
        const allAvailableTemplates = [...systemTemplates, ...uniqueDbTemplates];
        
        setAllTemplates(allAvailableTemplates);

        if (allAvailableTemplates.length > 0) {
            const defaultAnalysisTpl = allAvailableTemplates.find(t => t.name === 'Enerjisa' && t.document_type === 'analysis') || allAvailableTemplates.find(t => t.document_type === 'analysis' && t.is_system_template);
            const defaultTestTpl = allAvailableTemplates.find(t => t.document_type === 'test' && t.is_system_template);
            const defaultTraceabilityTpl = allAvailableTemplates.find(t => t.document_type === 'traceability' && t.is_system_template);
            
            setSelectedTemplates({
                analysis: defaultAnalysisTpl?.id || '',
                test: defaultTestTpl?.id || '',
                traceability: defaultTraceabilityTpl?.id || '',
            });
        }
    }, [initialData.templates]);
    
    useEffect(() => {
        expertModeClarificationAttempts.current = 0;
    }, [activeConversationId]);

    const isInitialRender = useRef(true);


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
    const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
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
    
    const saveConversation = useCallback(async (conv: Partial<Conversation> & { id: string }) => {
        setSaveStatus('saving');
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
    }, []);

    const triggerSave = useDebounce(saveConversation, 1500);
    
    const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
        setConversations(prev =>
            prev.map(c => c.id === id ? { ...c, ...updates } : c)
        );
        triggerSave({ id, ...updates });
    }, [triggerSave]);

    const saveProfile = useCallback(async (profile: UserProfile) => {
        const { error } = await supabase
            .from('user_profiles')
            .update({ tokens_used: profile.tokens_used })
            .eq('id', profile.id);

        if (error) {
            setError('Kullanıcı profili güncellenemedi: ' + error.message);
        }
    }, []);

    const triggerProfileSave = useDebounce(saveProfile, 2000);

    const commitTokenUsage = useCallback((tokens: number) => {
        if (tokens <= 0) return;
    
        setUserProfile(currentProfile => {
            if (!currentProfile) return null;
            const updatedProfile = {
                ...currentProfile,
                tokens_used: currentProfile.tokens_used + tokens,
            };
            triggerProfileSave(updatedProfile);
            return updatedProfile;
        });
    
        if (activeConversationId) {
            setConversations(prevConvs => {
                const convIndex = prevConvs.findIndex(c => c.id === activeConversationId);
                if (convIndex === -1) return prevConvs;
    
                const currentConv = prevConvs[convIndex];
                const newTotal = (currentConv.total_tokens_used || 0) + tokens;
                
                const updatedConv = { ...currentConv, total_tokens_used: newTotal };
                
                const newConvs = [...prevConvs];
                newConvs[convIndex] = updatedConv;
    
                triggerSave({ id: activeConversationId, total_tokens_used: newTotal });
    
                return newConvs;
            });
        }
    }, [activeConversationId, triggerProfileSave, triggerSave]);

    const saveDocumentVersion = useCallback(async (
        docKey: keyof GeneratedDocs,
        newContent: any,
        reason: string,
        templateId?: string | null
    ) => {
        if (!activeConversationId) return;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validTemplateId = templateId && uuidRegex.test(templateId) ? templateId : null;

        setConversations(prev => {
            const conv = prev.find(c => c.id === activeConversationId);
            if (!conv) return prev;

            const document_type = keyToDocumentTypeMap[docKey];
            if (!document_type) {
                console.warn(`Unknown docKey "${docKey}" passed to saveDocumentVersion. Skipping.`);
                return prev;
            }

            const newContentString = typeof newContent === 'string' ? newContent : JSON.stringify(newContent);
            
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
                template_id: validTemplateId
            };

            (async () => {
                const { data: newVersionDb, error: insertError } = await supabase
                    .from('document_versions')
                    .insert(newVersionRecord)
                    .select()
                    .single();

                if (insertError || !newVersionDb) {
                    setError("Doküman versiyonu kaydedilemedi: " + (insertError?.message || 'Bilinmeyen hata'));
                    return;
                }

                const { error: upsertError } = await supabase
                    .from('documents')
                    .upsert({
                        conversation_id: conv.id,
                        user_id: user.id,
                        document_type: document_type,
                        content: newContentString,
                        current_version_id: newVersionDb.id,
                        template_id: validTemplateId
                    }, { onConflict: 'conversation_id, document_type' })
                    .select()
                    .single();

                if (upsertError) {
                    setError("Ana doküman kaydedilemedi: " + (upsertError?.message || 'Bilinmeyen hata'));
                }
            })();

            const tempVersionId = `temp-version-${Date.now()}`;
            const tempDocId = `temp-doc-${document_type}`;
            
            const newVersionOptimistic = { ...newVersionRecord, id: tempVersionId, created_at: new Date().toISOString() };

            const existingDoc = conv.documents?.find(d => d.document_type === document_type);
            const newDocOptimistic: Document = {
                id: existingDoc?.id || tempDocId,
                conversation_id: conv.id,
                user_id: user.id,
                created_at: existingDoc?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                document_type,
                content: newContentString,
                current_version_id: tempVersionId,
                is_stale: false,
                template_id: validTemplateId,
            };

            return prev.map(c => {
                if (c.id === activeConversationId) {
                    const existingDocs = c.documents || [];
                    const docIndex = existingDocs.findIndex(d => d.document_type === document_type);
                    
                    let updatedDocuments;
                    if (docIndex > -1) {
                        updatedDocuments = [...existingDocs];
                        updatedDocuments[docIndex] = newDocOptimistic;
                    } else {
                        updatedDocuments = [...existingDocs, newDocOptimistic];
                    }

                    const updatedVersions = [...(c.documentVersions || []), newVersionOptimistic];
                    return { ...c, documents: updatedDocuments, documentVersions: updatedVersions };
                }
                return c;
            });
        });
    }, [activeConversationId, user.id]);

    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }

        const runMaturityCheck = async () => {
            const currentConversations = conversationsRef.current;
            const currentActiveId = activeIdRef.current;
            const activeConversation = currentConversations.find(c => c.id === currentActiveId);
            
            if (!activeConversation) return;

            const hasInteraction = activeConversation.messages.filter(m => m.role !== 'system').length > 0 ||
                                   activeConversation.documents.length > 0;
            if (!hasInteraction) return;

            try {
                console.log("Document change detected, re-running maturity check...");
                const generatedDocs = buildGeneratedDocs(activeConversation.documents);
                const { report, tokens } = await geminiService.checkAnalysisMaturity(
                    activeConversation.messages,
                    generatedDocs,
                    'gemini-2.5-flash-lite'
                );
                // The calls that update state and cause re-renders are removed from this automatic check
                // to prevent potential infinite loops. Token usage for this background task will not be counted,
                // and the maturity report is saved via a separate, more stable mechanism.
                // commitTokenUsage(tokens);
                saveDocumentVersion('maturityReport', report, "Doküman değişikliği sonrası otomatik değerlendirme");
            } catch (maturityError) {
                console.warn("Arka plan olgunluk kontrolü (doküman değişikliği sonrası) başarısız oldu:", maturityError);
            }
        };

        const timer = setTimeout(runMaturityCheck, 1000);
        return () => clearTimeout(timer);
    }, [
        activeConversation?.generatedDocs.analysisDoc,
        typeof activeConversation?.generatedDocs.testScenarios === 'object' ? activeConversation?.generatedDocs.testScenarios.content : activeConversation?.generatedDocs.testScenarios,
        typeof activeConversation?.generatedDocs.traceabilityMatrix === 'object' ? activeConversation?.generatedDocs.traceabilityMatrix.content : activeConversation?.generatedDocs.traceabilityMatrix,
        saveDocumentVersion // Add saveDocumentVersion to the dependency array
    ]);


    const switchActiveDocument = useCallback(async (version: DocumentVersion) => {
        if (!activeConversationId) return;
    
        const docType = version.document_type;
        
        setConversations(prev => {
            return prev.map(c => {
                if (c.id === activeConversationId) {
                    const docIndex = (c.documents || []).findIndex(d => d.document_type === docType);
                    if (docIndex === -1) {
                        const newDoc: Document = {
                            id: `temp-doc-${docType}`,
                            conversation_id: c.id,
                            user_id: user.id,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            document_type: docType,
                            content: version.content,
                            current_version_id: version.id,
                            is_stale: false,
                            template_id: version.template_id
                        };
                        return {...c, documents: [...(c.documents || []), newDoc]};
                    }
    
                    const updatedDocuments = [...(c.documents || [])];
                    updatedDocuments[docIndex] = {
                        ...updatedDocuments[docIndex],
                        content: version.content,
                        current_version_id: version.id,
                        template_id: version.template_id,
                        updated_at: new Date().toISOString(),
                    };
    
                    return { ...c, documents: updatedDocuments };
                }
                return c;
            });
        });
    
        if (version.template_id && (docType === 'analysis' || docType === 'test' || docType === 'traceability')) {
            setSelectedTemplates(prev => ({ ...prev, [docType]: version.template_id! }));
        }
    
        const { error } = await supabase
            .from('documents')
            .update({
                content: version.content,
                current_version_id: version.id,
                template_id: version.template_id,
            })
            .eq('conversation_id', activeConversationId)
            .eq('document_type', docType);
    
        if (error) {
            setError(`Aktif doküman versiyonu değiştirilemedi: ${error.message}`);
            console.error("Failed to switch active document in DB:", error);
        }
    }, [activeConversationId, user.id]);

    const createNewConversation = useCallback(async (initialDocs: Partial<GeneratedDocs> = {}, customTitleOrFirstMessage: string | null = null) => {
        let title: string;
        let tokensUsed = 0;
        
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

        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);

        for (const key in initialDocs) {
            if (Object.prototype.hasOwnProperty.call(initialDocs, key)) {
                const docKey = key as keyof GeneratedDocs;
                const docContent = initialDocs[docKey];
                if (docContent) {
                    const templateId = docKey === 'analysisDoc' ? selectedTemplates.analysis : docKey === 'testScenarios' ? selectedTemplates.test : null;
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
        
        return newConv;
    }, [user.id, saveDocumentVersion, commitTokenUsage, selectedTemplates]);
    
    const handleNewConversation = useCallback(() => {
        createNewConversation();
    }, [createNewConversation]);
    
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
            } else if (chunk.type === 'request_confirmation' && activeConversationId) {
                setRequestConfirmation({ summary: chunk.summary });
            } else if (chunk.type === 'chat_stream_chunk' && activeConversationId) {
                accumulatedMessage += chunk.chunk;
                const { thinking, response } = parseStreamingResponse(accumulatedMessage);
                
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        return {
                            ...c,
                            messages: c.messages.map(m => {
                                if (m.id === assistantMessageId) {
                                    const newMsg = { ...m, thoughts: thinking ?? undefined };
                                    if (response) {
                                        (newMsg as Message).content = response;
                                    }
                                    return newMsg;
                                }
                                return m;
                            })
                        };
                    }
                    return c;
                }));

            } else if (chunk.type === 'chat_response' && activeConversationId) {
                accumulatedMessage = chunk.content;
                const { thinking, response } = parseStreamingResponse(accumulatedMessage);
                setConversations(prev => prev.map(c => {
                    if (c.id === activeConversationId) {
                        return { ...c, messages: c.messages.map(m => m.id === assistantMessageId ? { ...m, content: response, thoughts: thinking ?? undefined } : m) };
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

    const _saveLongTextAsAnalysisDocument = async (content: string) => {
        setIsProcessing(true);
        let convId = activeConversationId;

        if (!convId) {
            const newConv = await createNewConversation(undefined, "Yapıştırılan Doküman");
            if (!newConv) {
                setError("Sohbet oluşturulamadı.");
                setIsProcessing(false);
                return;
            }
            convId = newConv.id;
        }

        const templateId = selectedTemplates.analysis;
        await saveDocumentVersion('analysisDoc', content, "Kullanıcı tarafından yapıştırıldı", templateId);

        const assistantMessageId = uuidv4();
        const feedbackMessage: Message = {
            id: assistantMessageId,
            conversation_id: convId,
            role: 'system',
            content: "[SİSTEM]: Uzun metin, 'İş Analizi Dokümanı' olarak kaydedildi. Çalışma alanından inceleyebilirsiniz.",
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
        };

        setConversations(prev =>
            prev.map(c =>
                c.id === convId
                    ? { ...c, messages: [...c.messages, feedbackMessage] }
                    : c
            )
        );
        await supabase.from('conversation_details').insert(feedbackMessage);

        setIsProcessing(false);
        setActiveDocTab('analysis');
    };
    
    const _saveLongTextAsRequestAndStartAnalysis = async (content: string) => {
        setIsProcessing(true);
        let convId = activeConversationId;
    
        if (!convId || (activeConversation && activeConversation.messages.length > 0)) {
            const newConv = await createNewConversation(undefined, "Yeni Talep Analizi");
            if (!newConv) {
                setError("Yeni sohbet oluşturulamadı.");
                setIsProcessing(false);
                return;
            }
            convId = newConv.id;
        }
    
        await saveDocumentVersion('requestDoc', content, "Kullanıcı tarafından yapıştırıldı");
    
        setActiveDocTab('request');
        setIsProcessing(false);
    
        // Send a system message to kick off the analysis
        await sendMessage("[SİSTEM]: Kullanıcının talebi 'Talep' dokümanına kaydedildi. Lütfen bu talebi analiz etmeye başla ve netleştirici sorular sor.", true);
    };

    const _processSendMessage = useCallback(async (content: string, isSystemMessage: boolean = false) => {
        setMessageToEdit(null);

        let conversationForApi: Conversation & { generatedDocs: GeneratedDocs };
        let currentConversationId: string | null = activeConversationId;
        
        const now = new Date().toISOString();
        const userMessageData = {
            role: (isSystemMessage ? 'system' : 'user') as 'system' | 'user',
            content: content.trim(),
            timestamp: now,
            created_at: now,
        };


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
            
            const currentConv = conversations.find(c => c.id === currentConversationId);
            if (!currentConv) {
                setError("Aktif sohbet bulunamadı.");
                return;
            }

            conversationForApi = {
                ...currentConv,
                messages: [...currentConv.messages, userMessage],
                generatedDocs: buildGeneratedDocs(currentConv.documents),
            };

            const assistantMessageId = uuidv4();
            const assistantPlaceholder: Message = {
                id: assistantMessageId,
                conversation_id: currentConversationId,
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString(),
                created_at: new Date().toISOString(),
            };

            setConversations(prev =>
                prev.map(c =>
                    c.id === currentConversationId
                        ? { ...c, messages: [...c.messages, userMessage, assistantPlaceholder] }
                        : c
                )
            );

            const { error: insertError } = await supabase.from('conversation_details').insert(userMessage);
            if (insertError) {
                setError("Mesajınız gönderilemedi.");
                setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: c.messages.filter(m => m.id !== userMessage.id && m.id !== assistantPlaceholder.id) } : c));
                return;
            }

            setIsProcessing(true);
            streamControllerRef.current = new AbortController();

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
        
                const { thinking, response } = parseStreamingResponse(finalMessage);
                const finalAssistantMessageData: Message = {
                    ...assistantPlaceholder,
                    content: response,
                    thoughts: thinking ?? null,
                    generativeSuggestion: finalSuggestion || undefined,
                };
        
                setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: c.messages.map(m => m.id === assistantMessageId ? finalAssistantMessageData : m) } : c));
                
                if (finalAssistantMessageData.content.trim() || finalAssistantMessageData.generativeSuggestion || finalAssistantMessageData.expertRunChecklist || (finalAssistantMessageData.thoughts && finalAssistantMessageData.thoughts.trim())) {
                    const { error: newMsgError } = await supabase.from('conversation_details').upsert(finalAssistantMessageData);
                    if (newMsgError) { setError("Asistan yanıtı kaydedilemedi."); }
                } else {
                    console.warn("Boş asistan mesajı kaydedilmedi.");
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
            return;
        }
    }, [activeConversationId, conversations, createNewConversation, isDeepAnalysisMode, selectedTemplates, processStream, allTemplates]);


    const sendMessage = useCallback(async (content: string, isSystemMessage: boolean = false) => {
        if (!content.trim()) return;

        if (!userProfile || userProfile.tokens_used >= userProfile.token_limit) {
            if (streamControllerRef.current) streamControllerRef.current.abort('Token limit reached');
            setShowUpgradeModal(true);
            return;
        }
        
        const LONG_MESSAGE_THRESHOLD = 1500;
        if (content.trim().length > LONG_MESSAGE_THRESHOLD && !isSystemMessage) {
            setLongTextPrompt({
                content: content.trim(),
                callback: (choice) => {
                    if (choice === 'analyze') {
                        _saveLongTextAsRequestAndStartAnalysis(content.trim());
                    } else if (choice === 'save') {
                        _saveLongTextAsAnalysisDocument(content.trim());
                    }
                    setLongTextPrompt(null);
                },
            });
            return;
        }
        
        await _processSendMessage(content, isSystemMessage);

    }, [_processSendMessage, _saveLongTextAsAnalysisDocument, _saveLongTextAsRequestAndStartAnalysis, userProfile?.tokens_used, userProfile?.token_limit]);
    
    const handleConfirmRequest = async () => {
        if (!requestConfirmation || !activeConversationId) return;

        await saveDocumentVersion('requestDoc', requestConfirmation.summary, "AI tarafından özetlenen talep onayı");
        
        // Send a system message to continue the flow
        await sendMessage("[SİSTEM]: Kullanıcı talep özetini onayladı ve 'Talep' dokümanına kaydedildi. Şimdi bu talebe dayanarak analizi derinleştirmeye devam et.", true);

        setRequestConfirmation(null); // Close modal
    };

    const handleRejectRequest = async () => {
        if (!requestConfirmation || !activeConversationId) return;

        // Send a system message to get the AI to re-evaluate
        await sendMessage("[SİSTEM]: Kullanıcı sunulan talep özetini reddetti. Lütfen daha fazla soru sorarak veya farklı bir açıdan yaklaşarak talebi daha doğru anlamaya çalış.", true);

        setRequestConfirmation(null); // Close modal
    };


     const handleGenerateDoc = useCallback(async (
        type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', 
        newTemplateId?: string,
        newDiagramType?: 'mermaid' | 'bpmn'
    ) => {
        const conv = activeConversation;
        if (!conv) return;

        if (!userProfile || userProfile.tokens_used >= userProfile.token_limit) {
            setShowUpgradeModal(true);
            return;
        }

        if (type === 'backlog-generation') {
            setActiveDocTab('backlog-generation');
            return;
        }

        if (type === 'test') {
            const analysisHash = simpleHash(conv.generatedDocs.analysisDoc);
            const currentTestDoc = conv.generatedDocs.testScenarios;
            if (typeof currentTestDoc === 'object' && currentTestDoc.content && currentTestDoc.sourceHash === analysisHash) {
                setActiveDocTab('test');
                return;
            }
        }
        
        if (type === 'traceability') {
            const analysisDoc = conv.generatedDocs.analysisDoc;
            const testDoc = conv.generatedDocs.testScenarios;
            const testDocContent = typeof testDoc === 'object' ? testDoc.content : testDoc;
        
            if (!analysisDoc || !testDocContent) return;
            
            const combinedHash = simpleHash(analysisDoc + testDocContent);
            const currentTraceabilityDoc = conv.generatedDocs.traceabilityMatrix;
        
            if (typeof currentTraceabilityDoc === 'object' && currentTraceabilityDoc.content && currentTraceabilityDoc.sourceHash === combinedHash) {
                setActiveDocTab('traceability');
                return;
            }
        }

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
                 const testDoc = conv.generatedDocs.testScenarios;
                 const testScenariosContent = typeof testDoc === 'object' ? testDoc.content : testDoc;

                 if (type === 'analysis') {
                    rawStream = geminiService.generateAnalysisDocument(conv.messages, templatePrompt, modelForGeneration);
                 } else if (type === 'test') {
                     rawStream = geminiService.generateTestScenarios(conv.generatedDocs.analysisDoc, templatePrompt, modelForGeneration);
                 } else { // traceability
                     rawStream = geminiService.generateTraceabilityMatrix(conv.generatedDocs.analysisDoc, testScenariosContent, templatePrompt, modelForGeneration);
                 }
                 stream = (async function* () { for await (const chunk of rawStream) { yield chunk; } })();
                 const { docResponses } = await processStream(stream, '');
                 const fullResponse = docResponses[docKey as keyof GeneratedDocs];
                 if (fullResponse) {
                     if (docKey === 'testScenarios') {
                        const analysisHash = simpleHash(conv.generatedDocs.analysisDoc);
                        await saveDocumentVersion(docKey, { content: fullResponse, sourceHash: analysisHash }, "AI Tarafından Oluşturuldu", currentTemplateId);
                    } else if (docKey === 'traceabilityMatrix') {
                        const analysisDoc = conv.generatedDocs.analysisDoc;
                        const combinedHash = simpleHash(analysisDoc + testScenariosContent);
                        await saveDocumentVersion(docKey, { content: fullResponse, sourceHash: combinedHash }, "AI Tarafından Oluşturuldu", currentTemplateId);
                    } else {
                        await saveDocumentVersion(docKey as 'analysisDoc', fullResponse, "AI Tarafından Oluşturuldu", currentTemplateId);
                    }
                 }

            } else { // 'viz'
                 const analysisHash = simpleHash(conv.generatedDocs.analysisDoc);
                 const { code, tokens } = await geminiService.generateDiagram(conv.generatedDocs.analysisDoc, currentDiagramType, templatePrompt, 'gemini-2.5-flash');
                 commitTokenUsage(tokens);
                 const vizKey = currentDiagramType === 'mermaid' ? 'mermaidViz' : 'bpmnViz';
                 saveDocumentVersion(vizKey, { code, sourceHash: analysisHash }, "AI Tarafından Oluşturuldu");
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
            if (type !== 'viz') {
                setIsProcessing(false);
                setGeneratingDocType(null);
            }
        }
    }, [processStream, selectedTemplates, diagramType, setActiveDocTab, saveDocumentVersion, commitTokenUsage, userProfile, allTemplates, activeConversation]);
    
     const handleEvaluateDocument = useCallback(async () => {
        const conv = activeConversation;
        if (!conv || !conv.generatedDocs.analysisDoc) return;
        
        const systemMessageContent = `[SİSTEM]: Lütfen aşağıdaki analizi değerlendir ve analizi bir sonraki adıma taşımak için en önemli eksiklikleri giderecek sorular sor. Sadece ve sadece soru sor.
        ---
        ${conv.generatedDocs.analysisDoc}
        ---`;
        
        const systemMessage: Omit<Message, 'id' | 'conversation_id' | 'created_at'> = {
            role: 'system',
            content: systemMessageContent,
            timestamp: new Date().toISOString()
        };

        const { error: insertError } = await supabase.from('conversation_details').insert({ ...systemMessage, conversation_id: conv.id, id: uuidv4() });
        if (insertError) {
            setError("Sistem mesajı gönderilemedi.");
            return;
        }

        await sendMessage(
            "[KULLANICI EYLEMİ]: AI'dan mevcut dokümanı değerlendirmesini ve soru sormasını istedim.",
            true
        );

    }, [sendMessage, activeConversation]);

    const handleFeedbackUpdate = async (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => {
        if (!activeConversation) return;

        const updatedMessages = activeConversation.messages.map(msg =>
            msg.id === messageId ? { ...msg, feedback: feedbackData } : msg
        );
        setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, messages: updatedMessages } : c));
        
        const { error } = await supabase.from('conversation_details').update({ feedback: feedbackData }).eq('id', messageId);
        if (error) {
            setError("Geri bildirim kaydedilemedi.");
            setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, messages: activeConversation.messages } : c));
        }
    };

    const handleEditLastUserMessage = async () => {
        if (!activeConversation) return;

        const allMessages = [...activeConversation.messages];
        const lastUserMessageIndex = allMessages.map(m => m.role).lastIndexOf('user');
        
        if (lastUserMessageIndex === -1) return;

        const userMessageToDelete = allMessages[lastUserMessageIndex];
        setMessageToEdit(userMessageToDelete.content);

        const assistantMessagesToDelete = allMessages.slice(lastUserMessageIndex + 1)
            .filter(m => m.role === 'assistant');
        
        const idsToDelete = [userMessageToDelete.id, ...assistantMessagesToDelete.map(m => m.id)];
        
        setConversations(prev => prev.map(c => 
            c.id === activeConversation.id 
            ? { ...c, messages: c.messages.filter(m => !idsToDelete.includes(m.id)) }
            : c
        ));

        if (idsToDelete.length > 0) {
            const { error } = await supabase.from('conversation_details').delete().in('id', idsToDelete);
            if (error) {
                setError("Mesajlar silinemedi: " + error.message);
                console.error("Failed to delete messages from DB:", error);
            }
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

    const handleTemplateChange = (type: 'analysis' | 'test' | 'traceability') => async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newTemplateId = event.target.value;
        const docKey = type === 'analysis' ? 'analysisDoc' : type === 'test' ? 'testScenarios' : 'traceabilityMatrix';
        const documentType = keyToDocumentTypeMap[docKey];
    
        if (!activeConversation || !documentType) return;
    
        const versionsForTemplate = (activeConversation.documentVersions || [])
            .filter(v => v.document_type === documentType && v.template_id === newTemplateId)
            .sort((a, b) => b.version_number - a.version_number);
    
        if (versionsForTemplate.length > 0) {
            const latestVersionForTemplate = versionsForTemplate[0];
            await switchActiveDocument(latestVersionForTemplate);
        } else {
            const currentDoc = activeConversation.generatedDocs[docKey];
            const docContent = typeof currentDoc === 'object' ? (currentDoc as SourcedDocument).content : currentDoc;
    
            if (docContent && docContent !== SAMPLE_ANALYSIS_DOCUMENT) {
                regenerateModalData.current = { docType: type, newTemplateId: newTemplateId };
                setIsRegenerateModalOpen(true);
            } else {
                setSelectedTemplates(prev => ({ ...prev, [type]: newTemplateId }));
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

    const handlePrepareQuestionForAnswer = (question: string) => {
        sendMessage(question);
        if (activeConversation?.generatedDocs.maturityReport) {
            const newReport = {
                ...activeConversation.generatedDocs.maturityReport,
                suggestedQuestions: activeConversation.generatedDocs.maturityReport.suggestedQuestions.filter(q => q !== question)
            };
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

        const headingRegex = new RegExp(`^#{2,3}\\s*(?:\\d+\\.?\\s*)?${escapeRegExp(targetSection).trim()}`, 'i');
        const startIndex = lines.findIndex(line => headingRegex.test(line.trim()));
        
        let updatedDoc;

        if (startIndex !== -1) {
            const headingLine = lines[startIndex];
            const headingLevel = (headingLine.match(/^(#+)/)?.[1] || '').length;

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
                endIndex = lines.length;
            }

            const beforeLines = lines.slice(0, startIndex);
            const afterLines = lines.slice(endIndex);
            
            updatedDoc = [
                ...beforeLines,
                headingLine,
                '',
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
        
        await supabase.from('conversation_details').delete().eq('id', messageId);
        await supabase.from('conversation_details').insert([userMessage, assistantMessage]);

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

        if (version.template_id) {
            const docType = version.document_type;
            if (docType === 'analysis' || docType === 'test' || docType === 'traceability') {
                setSelectedTemplates(prev => ({ ...prev, [docType]: version.template_id! }));
            }
        }
    };

    const analysisTemplates = useMemo(() => allTemplates.filter(t => t.document_type === 'analysis'), [allTemplates]);
    const testTemplates = useMemo(() => allTemplates.filter(t => t.document_type === 'test'), [allTemplates]);
    const traceabilityTemplates = useMemo(() => allTemplates.filter(t => t.document_type === 'traceability'), [allTemplates]);

    return {
        // State
        user,
        userProfile,
        conversations,
        activeConversationId,
        activeConversation,
        isProcessing,
        generatingDocType,
        error,
        theme,
        appMode,
        currentView,
        isConversationListOpen,
        isWorkspaceVisible,
        isShareModalOpen,
        showUpgradeModal,
        isFeatureSuggestionsModalOpen,
        featureSuggestions,
        isFetchingSuggestions,
        suggestionError,
        isRegenerateModalOpen,
        regenerateModalData,
        activeDocTab,
        isDeveloperPanelOpen,
        isFeedbackDashboardOpen,
        allFeedback,
        isFetchingFeedback,
        messageToEdit,
        inlineModificationState,
        saveStatus,
        isDeepAnalysisMode,
        isExpertMode,
        diagramType,
        allTemplates,
        selectedTemplates,
        displayedMaturityScore,
        analysisTemplates,
        testTemplates,
        traceabilityTemplates,
        longTextPrompt,
        requestConfirmation,
        
        // Handlers
        onLogout,
        setActiveConversationId,
        setError,
        handleThemeChange,
        setAppMode,
        setCurrentView,
        setIsConversationListOpen,
        setIsWorkspaceVisible,
        setIsShareModalOpen,
        setShowUpgradeModal,
        setIsFeatureSuggestionsModalOpen,
        setIsRegenerateModalOpen,
        setActiveDocTab,
        handleToggleDeveloperPanel,
        handleToggleFeedbackDashboard,
        handleNewConversation,
        updateConversationTitle,
        deleteConversation,
        updateConversation,
        sendMessage,
        handleGenerateDoc,
        handleEvaluateDocument,
        handleModifySelection,
        handleModifyDiagram,
        handleSuggestNextFeature,
        handleTemplateChange,
        handleConfirmRegenerate,
        handleRestoreVersion,
        commitTokenUsage,
        saveDocumentVersion,
        setDiagramType,
        handleFeedbackUpdate,
        handleEditLastUserMessage,
        handleStopGeneration,
        handlePrepareQuestionForAnswer,
        handleApplySuggestion,
        handleDeepAnalysisModeChange,
        setIsExpertMode,
        setLongTextPrompt,
        setRequestConfirmation,
        handleConfirmRequest,
        handleRejectRequest,
    };
};