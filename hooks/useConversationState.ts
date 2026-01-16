// hooks/useConversationState.ts
import { useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { geminiService } from '../services/geminiService';
import { promptService } from '../services/promptService';
import { v4 as uuidv4 } from 'uuid';
import type { AppData } from '../index';
import type { User, Conversation, Message, GeneratedDocs, FeedbackItem, Template, DocumentVersion, Document, DocumentType, UserProfile, GeneratedDocument, StreamChunk } from '../types';

const defaultGeneratedDocs: GeneratedDocs = {
    requestDoc: null,
    analysisDoc: null,
    testScenarios: null,
    bpmnViz: null,
    traceabilityMatrix: null,
    maturityReport: null,
    backlog: null,
};

const documentTypeToKeyMap: Record<DocumentType, keyof GeneratedDocs> = {
    request: 'requestDoc',
    analysis: 'analysisDoc',
    test: 'testScenarios',
    traceability: 'traceabilityMatrix',
    bpmn: 'bpmnViz',
    maturity_report: 'maturityReport',
};

const keyToDocumentTypeMap: Record<keyof GeneratedDocs, DocumentType | null> = {
    requestDoc: 'request',
    analysisDoc: 'analysis',
    testScenarios: 'test',
    traceabilityMatrix: 'traceability',
    bpmnViz: 'bpmn',
    maturityReport: 'maturity_report',
    backlog: null,
};

// Robust function to normalize DB documents into GeneratedDocument structure
const buildGeneratedDocs = (documents: Document[]): GeneratedDocs => {
    const docs: GeneratedDocs = { ...defaultGeneratedDocs };
    if (!documents) return docs;

    for (const doc of documents) {
        const key = documentTypeToKeyMap[doc.document_type];
        if (!key) continue;

        const generatedDoc: GeneratedDocument = {
            content: doc.content,
            isStale: doc.is_stale,
            metadata: {}
        };

        // Handle specific parsing needs for metadata
        try {
            if (key === 'bpmnViz') {
                // BPMN might be stored as raw XML string or JSON { code, sourceHash }
                if (doc.content.trim().startsWith('{')) {
                    const parsed = JSON.parse(doc.content);
                    generatedDoc.content = parsed.code || '';
                    generatedDoc.metadata = { sourceHash: parsed.sourceHash };
                } else {
                    generatedDoc.content = doc.content;
                }
            } else if (key === 'testScenarios' || key === 'traceabilityMatrix') {
                // These might be stored as JSON { content, sourceHash } or raw markdown string
                if (doc.content.trim().startsWith('{')) {
                    const parsed = JSON.parse(doc.content);
                    if (parsed && typeof parsed.content === 'string') {
                        generatedDoc.content = parsed.content;
                        generatedDoc.metadata = { sourceHash: parsed.sourceHash };
                    }
                }
            } else if (key === 'maturityReport') {
                // Maturity report is typically JSON string
                generatedDoc.metadata = JSON.parse(doc.content);
            }
        } catch (e) {
            console.warn(`Error parsing metadata for ${key}, using raw content.`, e);
        }

        docs[key] = generatedDoc;
    }
    
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
        const isAnonymous = user.id.startsWith('anonymous-');
        if (isAnonymous) {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
            return;
        }

        setSaveStatus('saving');
        const { messages, documentVersions, documents, backlogSuggestions, generatedDocs, ...updatePayload } = conv as any;
        const { error } = await supabase.from('conversations').update(updatePayload).eq('id', conv.id);
        if (error) {
            setSaveStatus('error');
            console.error('Save error:', error);
        } else {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }
    }, [user.id]);

    const triggerSave = useDebounce(saveConversation, 1500);

    const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        triggerSave({ id, ...updates });
    }, [triggerSave]);

    const saveProfile = useCallback(async (profile: UserProfile) => {
        const isAnonymous = user.id.startsWith('anonymous-');
        if (isAnonymous) return;

        const { error } = await supabase.from('user_profiles').update({ tokens_used: profile.tokens_used }).eq('id', profile.id);
        if (error) console.error('Failed to update user profile:', error.message);
    }, [user.id]);

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
        
        // Handle content serialization for storage if it's an object (like for BPMN Viz with hash)
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

        const isAnonymous = user.id.startsWith('anonymous-');
        let newVersionDb: any;

        if (isAnonymous) {
            newVersionDb = {
                ...newVersionRecord,
                id: uuidv4(),
                created_at: new Date().toISOString(),
            };
        } else {
            const { data, error: insertError } = await supabase.from('document_versions').insert(newVersionRecord).select().single();
            if (insertError || !data) throw new Error("Doküman versiyonu kaydedilemedi: " + (insertError?.message || 'Bilinmeyen hata'));
            newVersionDb = data;

            const { error: upsertError } = await supabase.from('documents').upsert({
                conversation_id: conversationId, user_id: user.id, document_type: document_type,
                content: newContentString, current_version_id: newVersionDb.id, template_id: validTemplateId,
                is_stale: false
            }, { onConflict: 'conversation_id, document_type' }).select().single();
            if (upsertError) throw new Error("Ana doküman kaydedilemedi: " + (upsertError?.message || 'Bilinmeyen hata'));
        }

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
                    // For streaming, we treat content as string. Complex objects are finalized later.
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
                if (chunk.type === 'text_chunk' || chunk.type === 'chat_stream_chunk') {
                    const text = chunk.type === 'text_chunk' ? chunk.text : chunk.chunk;
                    newMessage.content = (newMessage.content || '') + text;
                } else if (chunk.type === 'thought_chunk') {
                    newMessage.thought = chunk.payload;
                } else if (chunk.type === 'expert_run_update') {
                    newMessage.expertRunChecklist = chunk.checklist;
                    if (chunk.isComplete && chunk.finalMessage) {
                        newMessage.content = chunk.finalMessage;
                    }
                } else if (chunk.type === 'usage_update') {
                    commitTokenUsage(chunk.tokens);
                } else if (chunk.type === 'grounding_chunk') {
                    newMessage.groundingMetadata = [...(newMessage.groundingMetadata || []), ...chunk.payload];
                }
                return newMessage;
            });
            return { ...c, messages: newMessages };
        }));
    }, [activeConversationId, commitTokenUsage]);
    
    const fetchAllFeedback = useCallback(async () => {
        const isAnonymous = user.id.startsWith('anonymous-');
        if (isAnonymous) {
            setAllFeedback([]);
            return null;
        }

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
        const isAnonymous = user.id.startsWith('anonymous-');
        if (isAnonymous) return;

        const { error } = await supabase.from('conversations').update({ title }).eq('id', id);
        if (error) {
            console.error("Failed to update title:", error);
        }
    }, [updateConversation, user.id]);

    const deleteConversation = useCallback(async (id: string) => {
        const originalConversations = conversations;
        const originalActiveId = activeConversationId;

        setConversations(prev => prev.filter(c => c.id !== id));
        setActiveConversationId(prevActiveId => {
            if (prevActiveId !== id) return prevActiveId;
            const updatedConversations = originalConversations.filter(c => c.id !== id);
            if (updatedConversations.length === 0) return null;
            const currentIndex = originalConversations.findIndex(c => c.id === id);
            const newIndex = Math.min(currentIndex, updatedConversations.length - 1);
            return updatedConversations[newIndex].id;
        });

        const isAnonymous = user.id.startsWith('anonymous-');
        if (isAnonymous) return;

        const { error } = await supabase.from('conversations').delete().eq('id', id);

        if (error) {
            console.error("Failed to delete conversation:", error);
            setError(`Analiz silinemedi: ${error.message}`);
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