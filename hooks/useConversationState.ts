// hooks/useConversationState.ts
import { useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { geminiService, StreamChunk } from '../services/geminiService';
import { promptService } from '../services/promptService';
import { v4 as uuidv4 } from 'uuid';
import type { AppData } from '../index';
import type { User, Conversation, Message, GeneratedDocs, FeedbackItem, Template, DocumentVersion, Document, DocumentType, UserProfile, SourcedDocument } from '../types';

const defaultGeneratedDocs: GeneratedDocs = {
    requestDoc: '',
    analysisDoc: '',
    testScenarios: '',
    visualization: '',
    traceabilityMatrix: '',
    isVizStale: false,
    isTestStale: false,
    isTraceabilityStale: false,
    isBacklogStale: false,
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
    isVizStale: null,
    isTestStale: null,
    isTraceabilityStale: null,
    isBacklogStale: null,
};

const buildGeneratedDocs = (documents: Document[]): GeneratedDocs => {
    const docs: GeneratedDocs = { ...defaultGeneratedDocs };
    if (!documents) return docs;

    const findDoc = (type: DocumentType) => documents.find(d => d.document_type === type);

    for (const doc of documents) {
        const key = documentTypeToKeyMap[doc.document_type];
        if (key) {
             if (key === 'mermaidViz' || key === 'bpmnViz' || key === 'maturityReport' || key === 'testScenarios' || key === 'traceabilityMatrix') {
                try {
                    (docs as any)[key] = JSON.parse(doc.content);
                } catch (e) {
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
    
    // Read staleness from the source of truth (the document objects)
    docs.isVizStale = findDoc('mermaid')?.is_stale || findDoc('bpmn')?.is_stale || false;
    docs.isTestStale = findDoc('test')?.is_stale || false;
    docs.isTraceabilityStale = findDoc('traceability')?.is_stale || false;
    
    return docs;
};


interface UseConversationStateProps {
    user: User;
    initialData: AppData;
}

export const useConversationState = ({ user, initialData }: UseConversationStateProps) => {
    const [conversations, setConversations] = useState<Conversation[]>(initialData.conversations);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(
        initialData.conversations.length > 0 ? initialData.conversations[0].id : null
    );
    const [userProfile, setUserProfile] = useState<UserProfile | null>(initialData.profile);
    const [allTemplates, setAllTemplates] = useState<Template[]>(initialData.templates);
    const [selectedTemplates, setSelectedTemplates] = useState({
        analysis: '',
        test: '',
        traceability: '',
    });
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);
    const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
    
    const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
        const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        return useCallback((...args: any[]) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => callback(...args), delay);
        }, [callback, delay]);
    };

    const saveConversation = useCallback(async (conv: Partial<Conversation> & { id: string }) => {
        setSaveStatus('saving');
        const { messages, documentVersions, documents, backlogSuggestions, ...updatePayload } = conv;
        const { error } = await supabase.from('conversations').update(updatePayload).eq('id', conv.id);
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
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        triggerSave({ id, ...updates });
    }, [triggerSave]);

    const saveProfile = useCallback(async (profile: UserProfile) => {
        const { error } = await supabase.from('user_profiles').update({ tokens_used: profile.tokens_used }).eq('id', profile.id);
        if (error) console.error('Failed to update user profile:', error.message);
    }, []);

    const triggerProfileSave = useDebounce(saveProfile, 2000);
    
    const activeConversation = useMemo(() => {
        const conv = conversations.find(c => c.id === activeConversationId);
        if (!conv) return null;
        return {
            ...conv,
            generatedDocs: buildGeneratedDocs(conv.documents),
        };
    }, [conversations, activeConversationId]);
    
    const analysisTemplates = useMemo(() => allTemplates.filter(t => t.document_type === 'analysis'), [allTemplates]);
    const testTemplates = useMemo(() => allTemplates.filter(t => t.document_type === 'test'), [allTemplates]);
    const traceabilityTemplates = useMemo(() => allTemplates.filter(t => t.document_type === 'traceability'), [allTemplates]);

    const commitTokenUsage = useCallback((tokens: number) => {
        if (tokens <= 0) return;
        setUserProfile(currentProfile => {
            if (!currentProfile) return null;
            const updatedProfile = { ...currentProfile, tokens_used: currentProfile.tokens_used + tokens };
            triggerProfileSave(updatedProfile);
            return updatedProfile;
        });
        if (activeConversationId) {
            setConversations(prevConvs => {
                const newConvs = prevConvs.map(c => {
                    if (c.id === activeConversationId) {
                        const newTotal = (c.total_tokens_used || 0) + tokens;
                        triggerSave({ id: activeConversationId, total_tokens_used: newTotal });
                        return { ...c, total_tokens_used: newTotal };
                    }
                    return c;
                });
                return newConvs;
            });
        }
    }, [activeConversationId, triggerProfileSave, triggerSave]);
    
    const saveDocumentVersion = useCallback(async (docKey: keyof GeneratedDocs, newContent: any, reason: string, templateId?: string | null) => {
        if (!activeConversationId) return Promise.reject("No active conversation");

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validTemplateId = templateId && uuidRegex.test(templateId) ? templateId : null;
        
        const document_type = keyToDocumentTypeMap[docKey];
        if (!document_type) {
            console.warn(`Unknown docKey "${String(docKey)}" passed to saveDocumentVersion. Skipping.`);
            return Promise.reject(`Unknown docKey "${String(docKey)}"`);
        }
        
        const newContentString = typeof newContent === 'string' ? newContent : JSON.stringify(newContent);
        
        let newVersionNumber = 1;
        const conv = conversations.find(c => c.id === activeConversationId);
        if (conv) {
            const versionsForDocType = (conv.documentVersions || []).filter(v => v.document_type === document_type);
            const latestVersion = versionsForDocType.reduce((max, v) => v.version_number > max ? v.version_number : max, 0);
            newVersionNumber = latestVersion + 1;
        }

        const newVersionRecord: Omit<DocumentVersion, 'id' | 'created_at'> = {
            conversation_id: activeConversationId, user_id: user.id, document_type,
            content: newContentString, version_number: newVersionNumber,
            reason_for_change: reason, template_id: validTemplateId
        };
        
        const { data: newVersionDb, error: insertError } = await supabase.from('document_versions').insert(newVersionRecord).select().single();
        if (insertError || !newVersionDb) throw new Error("Doküman versiyonu kaydedilemedi: " + (insertError?.message || 'Bilinmeyen hata'));
        
        const { error: upsertError } = await supabase.from('documents').upsert({
            conversation_id: activeConversationId, user_id: user.id, document_type: document_type,
            content: newContentString, current_version_id: newVersionDb.id, template_id: validTemplateId
        }, { onConflict: 'conversation_id, document_type' }).select().single();
        if (upsertError) throw new Error("Ana doküman kaydedilemedi: " + (upsertError?.message || 'Bilinmeyen hata'));

        // Optimistic update
        setConversations(prev => prev.map(c => {
            if (c.id === activeConversationId) {
                const existingDoc = c.documents?.find(d => d.document_type === document_type);
                const newDocOptimistic: Document = {
                    id: existingDoc?.id || `temp-doc-${document_type}`, conversation_id: c.id, user_id: user.id,
                    created_at: existingDoc?.created_at || new Date().toISOString(), updated_at: new Date().toISOString(),
                    document_type, content: newContentString, current_version_id: newVersionDb.id,
                    is_stale: false, template_id: validTemplateId,
                };
                const docIndex = (c.documents || []).findIndex(d => d.document_type === document_type);
                const updatedDocuments = docIndex > -1
                    ? c.documents.map((d, i) => i === docIndex ? newDocOptimistic : d)
                    : [...(c.documents || []), newDocOptimistic];
                
                const updatedVersions = [...(c.documentVersions || []), newVersionDb];
                return { ...c, documents: updatedDocuments, documentVersions: updatedVersions };
            }
            return c;
        }));
    }, [activeConversationId, user.id, conversations]);

    // FIX: Add missing implementations
    const streamedDocsRef = useRef<Partial<Record<keyof GeneratedDocs, string>>>({});

    const streamDocument = useCallback((docKey: keyof GeneratedDocs, chunk: string) => {
        streamedDocsRef.current[docKey] = (streamedDocsRef.current[docKey] || '') + chunk;
    }, []);

    const finalizeStreamedDocuments = useCallback(async (templateId?: string | null) => {
        if (!activeConversationId) return;
        const docsToSave = { ...streamedDocsRef.current };
        streamedDocsRef.current = {};

        for (const key in docsToSave) {
            const docKey = key as keyof GeneratedDocs;
            const content = docsToSave[docKey];
            if (content) {
                await saveDocumentVersion(docKey, content, 'AI tarafından oluşturuldu', templateId);
            }
        }
    }, [activeConversationId, saveDocumentVersion]);

    const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
        setConversations(prev => prev.map(c => {
            if (c.id === activeConversationId) {
                return {
                    ...c,
                    messages: c.messages.map(m => m.id === messageId ? { ...m, ...updates } : m)
                };
            }
            return c;
        }));
    }, [activeConversationId]);

    const getMessageById = useCallback((messageId: string): Message | undefined => {
        const conv = conversations.find(c => c.id === activeConversationId);
        return conv?.messages.find(m => m.id === messageId);
    }, [conversations, activeConversationId]);
    
    const updateStreamingMessage = useCallback((messageId: string, chunk: StreamChunk) => {
        setConversations(prev => prev.map(c => {
            if (c.id !== activeConversationId) return c;
            
            const newMessages = c.messages.map(m => {
                if (m.id !== messageId) return m;
    
                const newMessage = { ...m };
                if (chunk.type === 'chat_stream_chunk') {
                    newMessage.content = (newMessage.content || '') + chunk.chunk;
                } else if (chunk.type === 'expert_run_update') {
                    newMessage.expertRunChecklist = chunk.checklist;
                    if (chunk.isComplete && chunk.finalMessage) {
                        newMessage.content = chunk.finalMessage;
                    }
                } else if (chunk.type === 'generative_suggestion') {
                    newMessage.generativeSuggestion = chunk.suggestion;
                } else if (chunk.type === 'usage_update') {
                    commitTokenUsage(chunk.tokens);
                }
                return newMessage;
            });
            return { ...c, messages: newMessages };
        }));
    }, [activeConversationId, commitTokenUsage]);
    
    const fetchAllFeedback = useCallback(async () => {
        setIsFetchingFeedback(true);
        const { data, error } = await supabase.from('conversations').select('title, conversation_details(*)').eq('user_id', user.id);
        if (error) {
            console.error("Geri bildirim getirilirken hata:", error);
            setAllFeedback([]);
        } else if (data) {
            const feedbackItems: FeedbackItem[] = data.flatMap(conv => 
                (conv.conversation_details || []).filter(msg => msg.role === 'assistant' && msg.feedback && (msg.feedback.rating || msg.feedback.comment))
                                                .map(msg => ({ message: msg, conversationTitle: conv.title || 'Başlıksız Analiz' }))
            );
            setAllFeedback(feedbackItems);
        }
        setIsFetchingFeedback(false);
        return error;
    }, [user.id]);

    const updateConversationTitle = useCallback(async (id: string, title: string) => {
        updateConversation(id, { title });
        const { error } = await supabase.from('conversations').update({ title }).eq('id', id);
        if (error) {
            console.error("Failed to update title:", error);
            // Optionally revert UI change
        }
    }, [updateConversation]);

    const deleteConversation = useCallback(async (id: string) => {
        // Optimistic UI update
        const originalConversations = conversations;
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
            setActiveConversationId(conversations.length > 1 ? conversations.filter(c => c.id !== id)[0].id : null);
        }

        const { error } = await supabase.from('conversations').delete().eq('id', id);

        if (error) {
            console.error("Failed to delete conversation:", error);
            // Revert UI on error
            setConversations(originalConversations);
        }
    }, [conversations, activeConversationId]);
    
    return {
        user,
        userProfile,
        conversations,
        setConversations,
        activeConversationId,
        setActiveConversationId,
        activeConversation,
        allTemplates,
        setAllTemplates,
        selectedTemplates,
        setSelectedTemplates,
        saveStatus,
        setSaveStatus,
        allFeedback,
        isFetchingFeedback,
        fetchAllFeedback,
        updateConversation,
        commitTokenUsage,
        saveDocumentVersion,
        analysisTemplates,
        testTemplates,
        traceabilityTemplates,
        updateConversationTitle,
        deleteConversation,
        // FIX: Export missing methods
        streamDocument,
        updateStreamingMessage,
        getMessageById,
        finalizeStreamedDocuments,
        updateMessage,
    };
};