// hooks/useConversationState.ts
import { useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
// FIX: StreamChunk is a type and should be imported from types.ts
import { geminiService } from '../services/geminiService';
import { promptService } from '../services/promptService';
import { v4 as uuidv4 } from 'uuid';
import type { AppData } from '../index';
// FIX: Import StreamChunk type
import type { User, Conversation, Message, GeneratedDocs, FeedbackItem, Template, DocumentVersion, Document, DocumentType, UserProfile, SourcedDocument, StreamChunk } from '../types';

const defaultGeneratedDocs: GeneratedDocs = {
    requestDoc: '',
    analysisDoc: '',
    testScenarios: { content: '', sourceHash: '' },
    visualization: '',
    traceabilityMatrix: { content: '', sourceHash: '' },
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
        if (!key) continue;

        if (key === 'testScenarios' || key === 'traceabilityMatrix') {
            try {
                const parsed = JSON.parse(doc.content);
                if (parsed && typeof parsed.content === 'string' && typeof parsed.sourceHash === 'string') {
                    (docs as any)[key] = parsed;
                } else {
                    (docs as any)[key] = { content: doc.content, sourceHash: 'legacy_json' };
                }
            } catch (e) {
                (docs as any)[key] = { content: doc.content, sourceHash: 'legacy_string' };
            }
        } else if (key === 'mermaidViz' || key === 'bpmnViz') {
             try {
                (docs as any)[key] = JSON.parse(doc.content);
             } catch(e) {
                (docs as any)[key] = { code: doc.content, sourceHash: 'legacy_string' };
             }
        } else if (key === 'maturityReport') {
            try {
                (docs as any)[key] = JSON.parse(doc.content);
            } catch (e) {
                console.error(`Error parsing JSON for ${key}:`, e);
                (docs as any)[key] = null;
            }
        } else {
             (docs as any)[key] = doc.content;
        }
    }
    
    docs.isVizStale = findDoc('mermaid')?.is_stale || findDoc('bpmn')?.is_stale || false;
    docs.isTestStale = findDoc('test')?.is_stale || false;
    docs.isTraceabilityStale = findDoc('traceability')?.is_stale || false;
    
    return docs;
};


interface UseConversationStateProps {
    user: User;
    initialData: AppData;
    setError: (message: string | null) => void;
}

export const useConversationState = ({ user, initialData, setError }: UseConversationStateProps) => {
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
    
    // FIX: Add optional `conversationIdOverride` parameter to handle new conversations correctly and prevent race conditions.
    const saveDocumentVersion = useCallback(async (docKey: keyof GeneratedDocs, newContent: any, reason: string, templateId?: string | null, conversationIdOverride?: string, tokensUsed?: number) => {
        const conversationId = conversationIdOverride || activeConversationId;
        if (!conversationId) return Promise.reject("No active conversation");

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validTemplateId = templateId && uuidRegex.test(templateId) ? templateId : null;
        
        const document_type = keyToDocumentTypeMap[docKey];
        if (!document_type) {
            console.warn(`Unknown docKey "${String(docKey)}" passed to saveDocumentVersion. Skipping.`);
            return Promise.reject(`Unknown docKey "${String(docKey)}"`);
        }
        
        const newContentString = typeof newContent === 'string' ? newContent : JSON.stringify(newContent);
        
        let newVersionNumber = 1;
        const conv = conversations.find(c => c.id === conversationId);
        if (conv) {
            const versionsForDocType = (conv.documentVersions || []).filter(v => v.document_type === document_type);
            const latestVersion = versionsForDocType.reduce((max, v) => v.version_number > max ? v.version_number : max, 0);
            newVersionNumber = latestVersion + 1;
        }

        const newVersionRecord: Omit<DocumentVersion, 'id' | 'created_at'> = {
            conversation_id: conversationId, user_id: user.id, document_type,
            content: newContentString, version_number: newVersionNumber,
            reason_for_change: reason, template_id: validTemplateId,
            tokens_used: tokensUsed || 0
        };
        
        const { data: newVersionDb, error: insertError } = await supabase.from('document_versions').insert(newVersionRecord).select().single();
        if (insertError || !newVersionDb) throw new Error("Doküman versiyonu kaydedilemedi: " + (insertError?.message || 'Bilinmeyen hata'));
        
        const { error: upsertError } = await supabase.from('documents').upsert({
            conversation_id: conversationId, user_id: user.id, document_type: document_type,
            content: newContentString, current_version_id: newVersionDb.id, template_id: validTemplateId
        }, { onConflict: 'conversation_id, document_type' }).select().single();
        if (upsertError) throw new Error("Ana doküman kaydedilemedi: " + (upsertError?.message || 'Bilinmeyen hata'));

        // Optimistic update
        setConversations(prev => prev.map(c => {
            if (c.id === conversationId) {
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

    const streamedDocsRef = useRef<Partial<Record<keyof GeneratedDocs, string>>>({});

    const streamDocument = useCallback((docKey: keyof GeneratedDocs, chunk: string, isFirstChunk: boolean) => {
        const document_type = keyToDocumentTypeMap[docKey];
        if (!document_type) {
            console.warn(`Unknown docKey "${String(docKey)}" passed to streamDocument. Skipping.`);
            return;
        }
    
        setConversations(prev => prev.map(c => {
            if (c.id !== activeConversationId) return c;
    
            const updatedConv = { ...c };
            let docFound = false;
            
            const updatedDocuments = (updatedConv.documents || []).map(doc => {
                if (doc.document_type === document_type) {
                    docFound = true;
                    const newContent = isFirstChunk ? chunk : (doc.content || '') + chunk;
                    return { ...doc, content: newContent, updated_at: new Date().toISOString() };
                }
                return doc;
            });
    
            if (!docFound) {
                const newDoc: Document = {
                    id: `temp-doc-${document_type}-${uuidv4()}`,
                    conversation_id: c.id,
                    user_id: user.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    document_type,
                    content: chunk,
                    current_version_id: null,
                    is_stale: false,
                };
                updatedDocuments.push(newDoc);
            }
            
            updatedConv.documents = updatedDocuments;
            return updatedConv;
        }));
    
        if (isFirstChunk) {
            streamedDocsRef.current[docKey] = chunk;
        } else {
            streamedDocsRef.current[docKey] = (streamedDocsRef.current[docKey] || '') + chunk;
        }
    }, [activeConversationId, user.id]);

    const finalizeStreamedDocuments = useCallback(async (templateId?: string | null, tokensUsed?: number) => {
        if (!activeConversationId) return;
        const docsToSave = { ...streamedDocsRef.current };
        streamedDocsRef.current = {};

        for (const key in docsToSave) {
            const docKey = key as keyof GeneratedDocs;
            const content = docsToSave[docKey];
            if (content) {
                await saveDocumentVersion(docKey, content, 'AI tarafından oluşturuldu', templateId, undefined, tokensUsed);
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
                if (chunk.type === 'text_chunk') {
                    newMessage.content = (newMessage.content || '') + chunk.text;
                } else if (chunk.type === 'thought_chunk') {
                    newMessage.thought = chunk.payload;
                } else if (chunk.type === 'expert_run_update') {
                    newMessage.expertRunChecklist = chunk.checklist;
                    if (chunk.isComplete && chunk.finalMessage) {
                        newMessage.content = chunk.finalMessage;
                    }
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
        // Keep original states for potential revert on error
        const originalConversations = conversations;
        const originalActiveId = activeConversationId;

        // Perform optimistic UI updates using functional forms
        setConversations(prev => prev.filter(c => c.id !== id));
        setActiveConversationId(prevActiveId => {
            // If the deleted conversation was not the active one, do nothing
            if (prevActiveId !== id) {
                return prevActiveId;
            }
            
            // If the active conversation was deleted, find a new one
            const updatedConversations = originalConversations.filter(c => c.id !== id);
            
            // If no conversations are left, set active to null
            if (updatedConversations.length === 0) {
                return null;
            }

            // Otherwise, select a new active conversation
            const currentIndex = originalConversations.findIndex(c => c.id === id);
            const newIndex = Math.min(currentIndex, updatedConversations.length - 1);
            return updatedConversations[newIndex].id;
        });

        // Perform the async database operation
        const { error } = await supabase.from('conversations').delete().eq('id', id);

        // Handle error case by reverting the optimistic updates
        if (error) {
            console.error("Failed to delete conversation:", error);
            setError(`Analiz silinemedi: ${error.message}. Bu genellikle veritabanı izinlerinden (RLS) kaynaklanır.`);
            
            // Revert UI changes
            setConversations(originalConversations);
            setActiveConversationId(originalActiveId);
        }
    }, [conversations, activeConversationId, setError]);
    
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
        streamDocument,
        updateStreamingMessage,
        getMessageById,
        finalizeStreamedDocuments,
        updateMessage,
    };
};