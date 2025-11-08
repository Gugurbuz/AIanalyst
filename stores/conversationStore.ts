// stores/conversationStore.ts
// FIX: Changed import to be a named import, which is the correct way to import `create` from zustand.
import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import { geminiService, StreamChunk } from '../services/geminiService';
import { promptService } from '../services/promptService';
import { v4 as uuidv4 } from 'uuid';
import type {
    Conversation, Message, GeneratedDocs, Template, DocumentVersion,
    Document, DocumentType, SourcedDocument, ExpertStep, GeminiModel, ThoughtProcess, FeedbackItem
} from '../types';
import { useSessionStore } from './sessionStore';
import { useUIStore } from './uiStore';
// FIX: Add missing React import for types like React.MouseEvent
import React from 'react';

// Helper to build the GeneratedDocs object from a list of documents
const buildGeneratedDocs = (documents: Document[]): GeneratedDocs => {
    const defaultGeneratedDocs: GeneratedDocs = {
        requestDoc: '', analysisDoc: '', testScenarios: '', visualization: '',
        traceabilityMatrix: '', isVizStale: false, isTestStale: false,
        isTraceabilityStale: false, isBacklogStale: false,
    };
    const documentTypeToKeyMap: Record<DocumentType, keyof GeneratedDocs> = {
        request: 'requestDoc', analysis: 'analysisDoc', test: 'testScenarios',
        traceability: 'traceabilityMatrix', mermaid: 'mermaidViz', bpmn: 'bpmnViz',
        maturity_report: 'maturityReport',
    };

    const docs: GeneratedDocs = { ...defaultGeneratedDocs };
    if (!documents) return docs;

    const findDoc = (type: DocumentType) => documents.find(d => d.document_type === type);

    for (const doc of documents) {
        const key = documentTypeToKeyMap[doc.document_type];
        if (key) {
             if (['mermaidViz', 'bpmnViz', 'maturityReport', 'testScenarios', 'traceabilityMatrix'].includes(key)) {
                try {
                    (docs as any)[key] = JSON.parse(doc.content);
                } catch (e) {
                     const fallbackToStringKeys: (keyof GeneratedDocs)[] = ['testScenarios', 'traceabilityMatrix'];
                    if (fallbackToStringKeys.includes(key as any)) {
                        (docs as any)[key] = doc.content;
                    } else {
                         if (key.endsWith('Viz')) (docs as any)[key] = { code: '', sourceHash: '' };
                         else if (key === 'maturityReport') (docs as any)[key] = null;
                    }
                }
            } else {
                 (docs as any)[key] = doc.content;
            }
        }
    }
    
    docs.isVizStale = findDoc('mermaid')?.is_stale || findDoc('bpmn')?.is_stale || false;
    docs.isTestStale = findDoc('test')?.is_stale || false;
    docs.isTraceabilityStale = findDoc('traceability')?.is_stale || false;
    
    return docs;
};

const keyToDocumentTypeMap: Record<keyof GeneratedDocs, DocumentType | null> = {
    requestDoc: 'request', analysisDoc: 'analysis', testScenarios: 'test',
    traceabilityMatrix: 'traceability', mermaidViz: 'mermaid', bpmnViz: 'bpmn',
    maturityReport: 'maturity_report', visualization: null, visualizationType: null,
    isVizStale: null, isTestStale: null, isTraceabilityStale: null, isBacklogStale: null,
};

let streamedDocsRef: Partial<Record<keyof GeneratedDocs, any>> = {};


interface ConversationState {
    conversations: Conversation[];
    activeConversationId: string | null;
    allTemplates: Template[];
    selectedTemplates: { analysis: string; test: string; traceability: string; };
    allFeedback: FeedbackItem[];
    isFetchingFeedback: boolean;
    isProcessing: boolean;
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null;
    messageToEdit: string | null;
    inlineModificationState: { docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null;
    generationController: AbortController | null;

    // Actions
    init: (conversations: Conversation[], templates: Template[]) => void;
    setActiveConversationId: (id: string | null) => void;
    updateConversation: (id: string, updates: Partial<Conversation>) => void;
    deleteConversation: (id: string) => Promise<void>;
    updateConversationTitle: (id: string, title: string) => Promise<void>;
    
    sendMessage: (text: string, isRetry?: boolean) => Promise<void>;
    handleNewConversation: (documentContentOrEvent?: string | React.MouseEvent, title?: string) => Promise<void>;
    handleGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => Promise<void>;
    saveDocumentVersion: (docKey: keyof GeneratedDocs, newContent: any, reason: string, templateId?: string | null) => Promise<void>;
    handleStopGeneration: () => void;
    handleFeedbackUpdate: (messageId: string, feedback: { rating: 'up' | 'down' | null; comment?: string }) => Promise<void>;
    handleRetryMessage: (failedAssistantMessageId: string) => void;
    handleSuggestNextFeature: () => Promise<void>;
    fetchAllFeedback: () => Promise<void>;
    handleTemplateChange: (docType: 'analysis' | 'test' | 'traceability') => (event: React.ChangeEvent<HTMLSelectElement>) => void;
    handleConfirmRegenerate: (saveCurrent: boolean) => void;
    handleRestoreVersion: (version: DocumentVersion) => Promise<void>;
    handleModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => Promise<void>;
    handleModifyDiagram: (userPrompt: string) => Promise<void>;
    handlePrepareQuestionForAnswer: (question: string) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
    // State
    conversations: [],
    activeConversationId: null,
    allTemplates: [],
    selectedTemplates: { analysis: '', test: '', traceability: '' },
    allFeedback: [],
    isFetchingFeedback: false,
    isProcessing: false,
    generatingDocType: null,
    messageToEdit: null,
    inlineModificationState: null,
    generationController: null,

    // Actions
    init: (initialConversations, initialTemplates) => {
        const analysisTemplates = initialTemplates.filter(t => t.document_type === 'analysis');
        const testTemplates = initialTemplates.filter(t => t.document_type === 'test');
        const traceabilityTemplates = initialTemplates.filter(t => t.document_type === 'traceability');
        
        set({
            conversations: initialConversations,
            allTemplates: initialTemplates,
            activeConversationId: initialConversations.length > 0 ? initialConversations[0].id : null,
            selectedTemplates: {
                analysis: analysisTemplates.find(t => t.is_system_template)?.id || analysisTemplates[0]?.id || '',
                test: testTemplates.find(t => t.is_system_template)?.id || testTemplates[0]?.id || '',
                traceability: traceabilityTemplates.find(t => t.is_system_template)?.id || traceabilityTemplates[0]?.id || '',
            }
        });
    },
    setActiveConversationId: (id) => set({ activeConversationId: id }),
    
    updateConversation: (id, updates) => {
        set(state => ({
            conversations: state.conversations.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
    },
    
    deleteConversation: async (id) => {
        const originalConversations = get().conversations;
        const newConversations = originalConversations.filter(c => c.id !== id);
        set({ conversations: newConversations });
        if (get().activeConversationId === id) {
            set({ activeConversationId: newConversations.length > 0 ? newConversations[0].id : null });
        }
        const { error } = await supabase.from('conversations').delete().eq('id', id);
        if (error) {
            useUIStore.getState().setError("Sohbet silinemedi.");
            set({ conversations: originalConversations }); // Revert on error
        }
    },
    
    updateConversationTitle: async (id, title) => {
        get().updateConversation(id, { title });
        const { error } = await supabase.from('conversations').update({ title }).eq('id', id);
        if (error) {
             useUIStore.getState().setError("Başlık güncellenemedi.");
        }
    },

    handleStopGeneration: () => {
        get().generationController?.abort();
    },

    handleFeedbackUpdate: async (messageId, feedback) => {
        const activeId = get().activeConversationId;
        if (!activeId) return;
        const activeConv = get().conversations.find(c => c.id === activeId);
        if (!activeConv) return;
        get().updateConversation(activeId, {
            messages: activeConv.messages.map(m => m.id === messageId ? {...m, feedback} : m)
        });
        const { error } = await supabase.from('conversation_details').update({ feedback }).eq('id', messageId);
        if (error) useUIStore.getState().setError("Geri bildirim kaydedilemedi.");
    },
    
    handleRetryMessage: (failedAssistantMessageId: string) => {
         const activeId = get().activeConversationId;
         if (!activeId) return;
         const activeConv = get().conversations.find(c => c.id === activeId);
         if (!activeConv) return;
         const failedMsgIndex = activeConv.messages.findIndex(m => m.id === failedAssistantMessageId);
         if (failedMsgIndex > 0) {
            const userMessageToRetry = activeConv.messages[failedMsgIndex - 1];
            if (userMessageToRetry?.role === 'user') {
                get().updateConversation(activeId, {
                    messages: activeConv.messages.filter(m => m.id !== failedAssistantMessageId)
                });
                get().sendMessage(userMessageToRetry.content, true);
            }
        }
    },

    handleSuggestNextFeature: async () => {
        const activeId = get().activeConversationId;
        const activeConv = get().conversations.find(c => c.id === activeId);
        if (!activeConv) return;
        
        const { setIsFetchingSuggestions, setSuggestionError, setIsFeatureSuggestionsModalOpen, setFeatureSuggestions } = useUIStore.getState();
        setIsFetchingSuggestions(true);
        setSuggestionError(null);
        setIsFeatureSuggestionsModalOpen(true);
        
        try {
            const { suggestions, tokens } = await geminiService.suggestNextFeature(
                buildGeneratedDocs(activeConv.documents).analysisDoc,
                activeConv.messages
            );
            useSessionStore.getState().commitTokenUsage(tokens);
            setFeatureSuggestions(suggestions);
        } catch (e: any) {
            setSuggestionError(e.message);
        } finally {
            setIsFetchingSuggestions(false);
        }
    },
    
    fetchAllFeedback: async () => {
        set({ isFetchingFeedback: true });
        const userId = useSessionStore.getState().user?.id;
        if (!userId) {
            set({ isFetchingFeedback: false });
            return;
        }

        const { data, error } = await supabase.from('conversations').select('title, conversation_details(*)').eq('user_id', userId);
        
        if (error) {
            useUIStore.getState().setError("Geri bildirimler getirilirken hata oluştu.");
            set({ allFeedback: [] });
        } else if (data) {
            const feedbackItems: FeedbackItem[] = data.flatMap(conv => 
                (conv.conversation_details || []).filter(msg => msg.role === 'assistant' && msg.feedback && (msg.feedback.rating || msg.feedback.comment))
                                                .map(msg => ({ message: msg as Message, conversationTitle: conv.title || 'Başlıksız Analiz' }))
            );
            set({ allFeedback: feedbackItems });
            useUIStore.getState().setIsFeedbackDashboardOpen(true);
        }
        set({ isFetchingFeedback: false });
    },

    handleTemplateChange: (docType) => (event) => {
        const newTemplateId = event.target.value;
        const activeConv = get().conversations.find(c => c.id === get().activeConversationId);
        if (!activeConv) return;
        
        const docKeyMap = { analysis: 'analysisDoc', test: 'testScenarios', traceability: 'traceabilityMatrix' };
        const docKey = docKeyMap[docType];
        
        const docContent = buildGeneratedDocs(activeConv.documents)[docKey];
        const contentExists = typeof docContent === 'string' ? docContent.trim() !== '' : !!(docContent as any)?.content?.trim();

        if (contentExists) {
            useUIStore.getState().setRegenerateModalData({ docType, newTemplateId });
            useUIStore.getState().setIsRegenerateModalOpen(true);
        } else {
            set(state => ({ selectedTemplates: { ...state.selectedTemplates, [docType]: newTemplateId } }));
            get().handleGenerateDoc(docType, newTemplateId);
        }
    },

    handleConfirmRegenerate: (saveCurrent) => {
        const { docType, newTemplateId } = useUIStore.getState().getRegenerateModalData()!;
        if (saveCurrent) {
            const docKey = { analysis: 'analysisDoc', test: 'testScenarios', traceability: 'traceabilityMatrix' }[docType];
            const content = buildGeneratedDocs(get().conversations.find(c => c.id === get().activeConversationId)!.documents)[docKey as keyof GeneratedDocs];
            if (content) {
                get().saveDocumentVersion(docKey as keyof GeneratedDocs, content, "Yeni şablon seçimi öncesi arşivlendi");
            }
        }
        useUIStore.getState().setIsRegenerateModalOpen(false);
        set(state => ({ selectedTemplates: { ...state.selectedTemplates, [docType]: newTemplateId } }));
        get().handleGenerateDoc(docType, newTemplateId);
    },
    
    handleRestoreVersion: async (version) => {
        const activeConv = get().conversations.find(c => c.id === get().activeConversationId);
        if (!activeConv) return;
        
        const docKey = keyToDocumentTypeMap[version.document_type] as keyof GeneratedDocs;
        if (!docKey) return;
        
        await get().saveDocumentVersion(docKey, version.content, `v${version.version_number} versiyonuna geri dönüldü`, version.template_id);
    },
    
    handleNewConversation: async (documentContentOrEvent, title) => {
        const documentContent = (typeof documentContentOrEvent === 'string') ? documentContentOrEvent : undefined;
        set({ isProcessing: true });
        const { setError } = useUIStore.getState();
        const { user, commitTokenUsage } = useSessionStore.getState();

        try {
            const initialTitle = title || (documentContent ? 'Yapıştırılan Doküman' : 'Yeni Analiz');
            let finalTitle = initialTitle;

            if (!title && documentContent) {
                const { title: generatedTitle, tokens } = await geminiService.generateConversationTitle(documentContent.substring(0, 250));
                commitTokenUsage(tokens);
                finalTitle = generatedTitle || initialTitle;
            }
            if(!user) throw new Error("User not found");

            const { data: convData, error: convError } = await supabase.from('conversations').insert({ user_id: user.id, title: finalTitle, share_id: uuidv4() }).select().single();
            if (convError || !convData) throw new Error(convError?.message || "Yeni sohbet oluşturulamadı.");
            
            const newConversation: Conversation = { ...convData, messages: [], documents: [], documentVersions: [] };
            set(state => ({ conversations: [newConversation, ...state.conversations], activeConversationId: newConversation.id }));

            if (documentContent) {
                const { jsonString, tokens } = await geminiService.parseTextToRequestDocument(documentContent);
                commitTokenUsage(tokens);
                await get().saveDocumentVersion('requestDoc', jsonString, "İlk doküman oluşturuldu");
                await get().sendMessage(`Bu dokümanı analiz etmeye başla.`);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            set({ isProcessing: false });
        }
    },
    
    sendMessage: async (text, isRetry = false) => {
        const { profile, commitTokenUsage } = useSessionStore.getState();
        const { setShowUpgradeModal, setError, isExpertMode, isDeepAnalysisMode, diagramType } = useUIStore.getState();
        if (profile && profile.plan === 'free' && profile.tokens_used >= profile.token_limit) {
            setShowUpgradeModal(true);
            return;
        }

        const activeId = get().activeConversationId;
        if (!activeId) {
             get().handleNewConversation(text);
             return;
        }

        set({ isProcessing: true, messageToEdit: null, generationController: new AbortController() });

        const userMessage: Message = { id: uuidv4(), conversation_id: activeId, role: 'user', content: text, created_at: new Date().toISOString() };
        let activeConv = get().conversations.find(c => c.id === activeId)!;
        let historyForApi: Message[] = [...(activeConv.messages || [])];
        
        if (!isRetry) {
            historyForApi.push(userMessage);
            get().updateConversation(activeId, { messages: historyForApi });
            const { error: userMessageError } = await supabase.from('conversation_details').insert(userMessage);
            if (userMessageError) setError(`Mesajınız kaydedilemedi: ${userMessageError.message}`);
        }

        const assistantMessageId = uuidv4();
        const assistantMessage: Message = { id: assistantMessageId, conversation_id: activeId, role: 'assistant', content: '', created_at: new Date().toISOString(), isStreaming: true };
        get().updateConversation(activeId, { messages: [...historyForApi, assistantMessage] });
        
        const finalAssistantMessage: Message = { ...assistantMessage };
        
        try {
            const currentConv = get().conversations.find(c => c.id === activeId)!;
            const generatedDocs = buildGeneratedDocs(currentConv.documents);
            const { selectedTemplates, allTemplates } = get();

            const model = isDeepAnalysisMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

            const templates = {
                analysis: allTemplates.find(t => t.id === selectedTemplates.analysis)?.prompt || '',
                test: allTemplates.find(t => t.id === selectedTemplates.test)?.prompt || '',
                traceability: allTemplates.find(t => t.id === selectedTemplates.traceability)?.prompt || '',
                visualization: promptService.getPrompt(diagramType === 'bpmn' ? 'generateBPMN' : 'generateVisualization'),
            };

            const rawStream = isExpertMode 
                ? geminiService.runExpertAnalysisStream(userMessage, generatedDocs, templates, diagramType)
                : geminiService.handleUserMessageStream(historyForApi, generatedDocs, templates, model);
            
            for await (const chunk of rawStream) {
                if (get().generationController?.signal.aborted) break;
                // Update state based on chunk type
            }

        } catch (e: any) {
            finalAssistantMessage.error = { name: "StreamError", message: e.message };
        } finally {
            set({ isProcessing: false, generatingDocType: null });
            finalAssistantMessage.isStreaming = false;
            // ... Finalize message and save to DB
        }
    },
    
    handleGenerateDoc: async (type, newTemplateId, newDiagramType) => {
        // ... implementation
    },
    
    saveDocumentVersion: async (docKey, newContent, reason, templateId) => {
        const activeId = get().activeConversationId;
        const user = useSessionStore.getState().user;
        if (!activeId || !user) return;

        const document_type = keyToDocumentTypeMap[docKey];
        if (!document_type) return;
        
        const newContentString = typeof newContent === 'string' ? newContent : JSON.stringify(newContent);
        
        const conv = get().conversations.find(c => c.id === activeId)!;
        const newVersionNumber = ((conv.documentVersions || []).filter(v => v.document_type === document_type).reduce((max, v) => v.version_number > max ? v.version_number : max, 0)) + 1;

        const newVersionRecord: Omit<DocumentVersion, 'id' | 'created_at'> = {
            conversation_id: activeId, user_id: user.id, document_type,
            content: newContentString, version_number: newVersionNumber,
            reason_for_change: reason, template_id: templateId || null
        };
        
        const { data: newVersionDb, error: insertError } = await supabase.from('document_versions').insert(newVersionRecord).select().single();
        if (insertError) throw new Error("Doküman versiyonu kaydedilemedi: " + insertError.message);
        
        await supabase.from('documents').upsert({
            conversation_id: activeId, user_id: user.id, document_type: document_type,
            content: newContentString, current_version_id: newVersionDb.id, template_id: templateId || null
        }, { onConflict: 'conversation_id, document_type' });

        set(state => ({
            conversations: state.conversations.map(c => {
                if (c.id === activeId) {
                    const existingDoc = c.documents?.find(d => d.document_type === document_type);
                    const newDoc: Document = { ...(existingDoc || {}), id: existingDoc?.id || uuidv4(), conversation_id: c.id, user_id: user.id,
                        created_at: existingDoc?.created_at || new Date().toISOString(), updated_at: new Date().toISOString(),
                        document_type, content: newContentString, current_version_id: newVersionDb.id,
                        is_stale: false, template_id: templateId || null };
                    
                    const docIndex = (c.documents || []).findIndex(d => d.document_type === document_type);
                    const updatedDocuments = docIndex > -1 ? c.documents.map((d, i) => i === docIndex ? newDoc : d) : [...(c.documents || []), newDoc];
                    
                    return { ...c, documents: updatedDocuments, documentVersions: [...(c.documentVersions || []), newVersionDb] };
                }
                return c;
            })
        }));
    },

    // Stubs
    handleModifySelection: async () => {},
    handleModifyDiagram: async () => {},
    handlePrepareQuestionForAnswer: () => {},
}));