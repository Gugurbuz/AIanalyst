// hooks/useAppLogic.ts
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUIState } from './useUIState';
import { useConversationState } from './useConversationState';
import { geminiService, StreamChunk } from '../services/geminiService';
import { promptService } from '../services/promptService';
import { v4 as uuidv4 } from 'uuid';
import type {
    User,
    Conversation,
    Message,
    GeneratedDocs,
    GenerativeSuggestion,
    ExpertStep,
    GeminiModel,
    Template,
    DocumentVersion,
    SourcedDocument,
    DocumentType,
} from '../types';
import type { AppData } from '../index';
import { supabase } from '../services/supabaseClient';

interface UseAppLogicProps {
    user: User;
    initialData: AppData;
    onLogout: () => void;
}

const simpleHash = (str: string): string => {
    if (!str) return '0';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash.toString();
};

// FIX: Add documentTypeToKeyMap to resolve 'Cannot find name' error.
const documentTypeToKeyMap: Record<DocumentType, keyof GeneratedDocs | 'visualization'> = {
    request: 'requestDoc',
    analysis: 'analysisDoc',
    test: 'testScenarios',
    traceability: 'traceabilityMatrix',
    mermaid: 'mermaidViz',
    bpmn: 'bpmnViz',
    maturity_report: 'maturityReport',
    visualization: 'visualization',
};


export const useAppLogic = ({ user, initialData, onLogout }: UseAppLogicProps) => {
    const uiState = useUIState();
    const conversationState = useConversationState({ user, initialData });

    const [isProcessing, setIsProcessing] = useState(false);
    const [generatingDocType, setGeneratingDocType] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null>(null);
    const [messageToEdit, setMessageToEdit] = useState<string | null>(null);
    const [inlineModificationState, setInlineModificationState] = useState<{ docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null>(null);
    const generationController = useRef<AbortController | null>(null);

    const activeModel = (): GeminiModel => {
        if (uiState.isDeepAnalysisMode) return 'gemini-2.5-pro';
        return (localStorage.getItem('geminiModel') as GeminiModel) || 'gemini-2.5-flash';
    };
    
    const checkTokenLimit = useCallback(() => {
        if (conversationState.userProfile && conversationState.userProfile.plan === 'free' && conversationState.userProfile.tokens_used >= conversationState.userProfile.token_limit) {
            uiState.setShowUpgradeModal(true);
            return false;
        }
        return true;
    }, [conversationState.userProfile, uiState]);
    
    const handleNewConversation = useCallback(async (documentContentOrEvent?: string | React.MouseEvent, title?: string) => {
        // FIX: The NewAnalysisModal is not being used, so this state setter is not available and not needed.
        // uiState.setIsNewAnalysisModalOpen(false); // Close modal on action
        const documentContent = (typeof documentContentOrEvent === 'string') ? documentContentOrEvent : undefined;

        setIsProcessing(true);
        try {
            const initialTitle = title || (documentContent ? 'Yapıştırılan Doküman' : 'Yeni Analiz');
            let finalTitle = initialTitle;

            if (!title && documentContent) {
                const { title: generatedTitle, tokens } = await geminiService.generateConversationTitle(documentContent.substring(0, 250));
                conversationState.commitTokenUsage(tokens);
                finalTitle = generatedTitle || initialTitle;
            }

            const { data: convData, error: convError } = await supabase.from('conversations').insert({ user_id: user.id, title: finalTitle, share_id: uuidv4() }).select().single();

            if (convError || !convData) {
                uiState.setError("Yeni sohbet oluşturulamadı.");
                return;
            }

            const newConversation: Conversation = {
                ...convData,
                messages: [],
                documents: [],
                documentVersions: [],
            };
            
            conversationState.setConversations(prev => [newConversation, ...prev]);
            conversationState.setActiveConversationId(newConversation.id);

            if (documentContent) {
                 const { jsonString, tokens } = await geminiService.parseTextToRequestDocument(documentContent);
                conversationState.commitTokenUsage(tokens);
                await conversationState.saveDocumentVersion('requestDoc', jsonString, "İlk doküman oluşturuldu");
                await sendMessage(`Bu dokümanı analiz etmeye başla.`);
            }
        } catch (e: any) {
            uiState.setError(e.message);
        } finally {
            setIsProcessing(false);
        }
    }, [user.id, conversationState, uiState]);
    
    const sendMessage = useCallback(async (text: string, isRetry = false) => {
        if (!checkTokenLimit()) return;
        const activeId = conversationState.activeConversationId;
        if (!activeId) {
             handleNewConversation(text);
             return;
        }

        setIsProcessing(true);
        setMessageToEdit(null);
        generationController.current = new AbortController();

        const userMessage: Message = { id: uuidv4(), conversation_id: activeId, role: 'user', content: text, created_at: new Date().toISOString(), timestamp: new Date().toISOString() };
        let historyForApi: Message[] = [...(conversationState.activeConversation?.messages || [])];
        
        if (!isRetry) {
            historyForApi.push(userMessage);
            conversationState.updateConversation(activeId, { messages: historyForApi });
            const { error: userMessageError } = await supabase.from('conversation_details').insert(userMessage);
            if (userMessageError) uiState.setError(`Mesajınız kaydedilemedi: ${userMessageError.message}`);
        }

        const assistantMessageId = uuidv4();
        const assistantMessage: Message = { id: assistantMessageId, conversation_id: activeId, role: 'assistant', content: '', created_at: new Date().toISOString(), timestamp: new Date().toISOString(), isStreaming: true };
        conversationState.updateConversation(activeId, { messages: [...historyForApi, assistantMessage] });
        
        const finalAssistantMessage = { ...assistantMessage };
        
        try {
            const stream = uiState.isExpertMode 
                ? geminiService.runExpertAnalysisStream(userMessage, conversationState.activeConversation!.generatedDocs, {
                    analysis: promptService.getPrompt('generateAnalysisDocument'),
                    test: promptService.getPrompt('generateTestScenarios'),
                    traceability: promptService.getPrompt('generateTraceabilityMatrix'),
                    visualization: promptService.getPrompt(uiState.diagramType === 'bpmn' ? 'generateBPMN' : 'generateVisualization'),
                }, uiState.diagramType)
                : geminiService.handleUserMessageStream(historyForApi, conversationState.activeConversation!.generatedDocs, {
                    analysis: conversationState.allTemplates.find(t => t.id === conversationState.selectedTemplates.analysis)?.prompt || promptService.getPrompt('generateAnalysisDocument'),
                    test: conversationState.allTemplates.find(t => t.id === conversationState.selectedTemplates.test)?.prompt || promptService.getPrompt('generateTestScenarios'),
                    traceability: conversationState.allTemplates.find(t => t.id === conversationState.selectedTemplates.traceability)?.prompt || promptService.getPrompt('generateTraceabilityMatrix'),
                    visualization: promptService.getPrompt(uiState.diagramType === 'bpmn' ? 'generateBPMN' : 'generateVisualization'),
                }, activeModel());

            for await (const chunk of stream) {
                if (generationController.current?.signal.aborted) break;
                
                // Update UI for streaming effect
                conversationState.updateStreamingMessage(assistantMessageId, chunk);

                // Also update a local variable to have the definitive final state, avoiding async state issues.
                if (chunk.type === 'chat_stream_chunk') {
                    finalAssistantMessage.content = (finalAssistantMessage.content || '') + chunk.chunk;
                } else if (chunk.type === 'expert_run_update') {
                    finalAssistantMessage.expertRunChecklist = chunk.checklist;
                    if (chunk.isComplete && chunk.finalMessage) {
                        finalAssistantMessage.content = chunk.finalMessage;
                    }
                } else if (chunk.type === 'generative_suggestion') {
                    finalAssistantMessage.generativeSuggestion = chunk.suggestion;
                } else if (chunk.type === 'usage_update') {
                    conversationState.commitTokenUsage(chunk.tokens);
                } else if (chunk.type === 'doc_stream_chunk') {
                    conversationState.streamDocument(chunk.docKey, chunk.chunk);
                }
            }

        } catch (e: any) {
            console.error("Streaming error:", e);
            finalAssistantMessage.error = { message: e.message };
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
            finalAssistantMessage.isStreaming = false;

            conversationState.setConversations(prev => prev.map(c => {
                if (c.id === activeId) {
                    const finalMessages = c.messages.map(m => m.id === assistantMessageId ? finalAssistantMessage : m);
                    return { ...c, messages: finalMessages };
                }
                return c;
            }));
            
            if (!finalAssistantMessage.error) {
                // Prepare payload for DB
                const { isStreaming, expertRunChecklist, ...messageToSave } = finalAssistantMessage;
                const dbPayload = { ...messageToSave } as Partial<Message>;

                if (expertRunChecklist && expertRunChecklist.length > 0) {
                    dbPayload.thoughts = JSON.stringify(expertRunChecklist);
                } else {
                    dbPayload.thoughts = null;
                }

                if(dbPayload.content?.trim() || dbPayload.thoughts) {
                     const { error: assistantMessageError } = await supabase.from('conversation_details').insert(dbPayload);
                     if (assistantMessageError) uiState.setError(`Asistan yanıtı kaydedilemedi: ${assistantMessageError.message}`);
                }
                
                await conversationState.finalizeStreamedDocuments();
            } else {
                // Remove placeholder on error if it's empty
                if (!finalAssistantMessage.content?.trim() && !finalAssistantMessage.expertRunChecklist) {
                     conversationState.setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessageId) } : c));
                }
            }
        }
    }, [conversationState, checkTokenLimit, uiState, activeModel, handleNewConversation]);

    const handleFeedbackUpdate = async (messageId: string, feedback: { rating: 'up' | 'down' | null; comment?: string }) => {
        conversationState.updateMessage(messageId, { feedback });
        const { error } = await supabase.from('conversation_details').update({ feedback }).eq('id', messageId);
        if (error) uiState.setError("Geri bildirim kaydedilemedi.");
    };

    const handleRetryMessage = (failedAssistantMessageId: string) => {
        const activeConv = conversationState.activeConversation;
        if (!activeConv) return;
        const failedMsgIndex = activeConv.messages.findIndex(m => m.id === failedAssistantMessageId);
        if (failedMsgIndex > 0) {
            const userMessageToRetry = activeConv.messages[failedMsgIndex - 1];
            if (userMessageToRetry && userMessageToRetry.role === 'user') {
                // Remove the failed assistant message before retrying
                conversationState.updateConversation(activeConv.id, {
                    messages: activeConv.messages.filter(m => m.id !== failedAssistantMessageId)
                });
                sendMessage(userMessageToRetry.content, true);
            }
        }
    };
    
    const handleStopGeneration = () => { generationController.current?.abort(); };
    const handleDeepAnalysisModeChange = (isOn: boolean) => uiState.setIsDeepAnalysisMode(isOn);

    const handleSuggestNextFeature = async () => {
        if (!conversationState.activeConversation) return;
        uiState.setIsFetchingSuggestions(true);
        uiState.setSuggestionError(null);
        uiState.setIsFeatureSuggestionsModalOpen(true);
        try {
            const { suggestions, tokens } = await geminiService.suggestNextFeature(
                conversationState.activeConversation.generatedDocs.analysisDoc,
                conversationState.activeConversation.messages
            );
            conversationState.commitTokenUsage(tokens);
            uiState.setFeatureSuggestions(suggestions);
        } catch (e: any) {
            uiState.setSuggestionError(e.message);
        } finally {
            uiState.setIsFetchingSuggestions(false);
        }
    };

    const handleGenerateDoc = async (type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => {
        const activeConv = conversationState.activeConversation;
        if (!activeConv || isProcessing) return;
        if (!checkTokenLimit()) return;

        setGeneratingDocType(type);
        setIsProcessing(true);
        
        const diagramTypeToUse = newDiagramType || uiState.diagramType;
        const templates = {
            analysis: conversationState.allTemplates.find(t => t.id === (newTemplateId || conversationState.selectedTemplates.analysis))?.prompt || promptService.getPrompt('generateAnalysisDocument'),
            test: conversationState.allTemplates.find(t => t.id === (newTemplateId || conversationState.selectedTemplates.test))?.prompt || promptService.getPrompt('generateTestScenarios'),
            traceability: conversationState.allTemplates.find(t => t.id === (newTemplateId || conversationState.selectedTemplates.traceability))?.prompt || promptService.getPrompt('generateTraceabilityMatrix'),
            visualization: promptService.getPrompt(diagramTypeToUse === 'bpmn' ? 'generateBPMN' : 'generateVisualization'),
        };

        const streamGenerators = {
            analysis: () => geminiService.generateAnalysisDocument(activeConv.generatedDocs.requestDoc, activeConv.messages, templates.analysis, activeModel()),
            test: () => geminiService.generateTestScenarios(activeConv.generatedDocs.analysisDoc, templates.test, activeModel()),
            traceability: () => geminiService.generateTraceabilityMatrix(activeConv.generatedDocs.analysisDoc, (activeConv.generatedDocs.testScenarios as SourcedDocument)?.content || activeConv.generatedDocs.testScenarios as string, templates.traceability, activeModel()),
        };

        try {
            if (type === 'viz') {
                const { code, tokens } = await geminiService.generateDiagram(activeConv.generatedDocs.analysisDoc, diagramTypeToUse, templates.visualization, activeModel());
                conversationState.commitTokenUsage(tokens);
                const sourceHash = simpleHash(activeConv.generatedDocs.analysisDoc);
                const vizData = { code, sourceHash };
                const docKey = diagramTypeToUse === 'bpmn' ? 'bpmnViz' : 'mermaidViz';
                await conversationState.saveDocumentVersion(docKey, vizData, `Diyagram oluşturuldu (${diagramTypeToUse})`);
            } else if (type === 'analysis' || type === 'test' || type === 'traceability') {
                const stream = streamGenerators[type]();
                for await (const chunk of stream) {
                     if (chunk.type === 'doc_stream_chunk') {
                        conversationState.streamDocument(chunk.docKey, chunk.chunk);
                    } else if (chunk.type === 'usage_update') {
                        conversationState.commitTokenUsage(chunk.tokens);
                    }
                }
                await conversationState.finalizeStreamedDocuments(newTemplateId);
            }
        } catch(e: any) {
            uiState.setError(e.message);
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
            if (newTemplateId) {
                conversationState.setSelectedTemplates(prev => ({ ...prev, [type]: newTemplateId }));
            }
        }
    };
    
    const handleTemplateChange = (docType: 'analysis' | 'test' | 'traceability') => (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newTemplateId = event.target.value;
        const activeConv = conversationState.activeConversation;
        if (!activeConv) return;
        
        const docKeyMap = { analysis: 'analysisDoc', test: 'testScenarios', traceability: 'traceabilityMatrix' };
        const docKey = docKeyMap[docType];
        
        const docContent = activeConv.generatedDocs[docKey];
        const contentExists = typeof docContent === 'string' ? docContent.trim() !== '' : !!docContent?.content?.trim();

        if (contentExists) {
            uiState.regenerateModalData.current = { docType, newTemplateId };
            uiState.setIsRegenerateModalOpen(true);
        } else {
            conversationState.setSelectedTemplates(prev => ({ ...prev, [docType]: newTemplateId }));
            handleGenerateDoc(docType, newTemplateId);
        }
    };

    const handleConfirmRegenerate = (saveCurrent: boolean) => {
        const { docType, newTemplateId } = uiState.regenerateModalData.current!;
        if (saveCurrent) {
            const docKey = { analysis: 'analysisDoc', test: 'testScenarios', traceability: 'traceabilityMatrix' }[docType];
            const content = conversationState.activeConversation?.generatedDocs[docKey];
            if (content) {
                conversationState.saveDocumentVersion(docKey, content, "Yeni şablon seçimi öncesi arşivlendi");
            }
        }
        uiState.setIsRegenerateModalOpen(false);
        conversationState.setSelectedTemplates(prev => ({ ...prev, [docType]: newTemplateId }));
        handleGenerateDoc(docType, newTemplateId);
    };

    const handleRestoreVersion = async (version: DocumentVersion) => {
        const activeConv = conversationState.activeConversation;
        if (!activeConv) return;
        
        const docKey = documentTypeToKeyMap[version.document_type] as keyof GeneratedDocs;
        if (!docKey) return;
        
        await conversationState.saveDocumentVersion(docKey, version.content, `v${version.version_number} versiyonuna geri dönüldü`, version.template_id);
    };

    return {
        ...uiState,
        ...conversationState,
        isProcessing,
        generatingDocType,
        messageToEdit,
        inlineModificationState,
        onLogout,
        sendMessage,
        handleNewConversation,
        handleFeedbackUpdate,
        handleRetryMessage,
        handleStopGeneration,
        handleSuggestNextFeature,
        handleDeepAnalysisModeChange,
        handleGenerateDoc,
        handleTemplateChange,
        handleConfirmRegenerate,
        handleRestoreVersion,
        
        // Stubs for props that need full implementation but are not the cause of the current bug
        handleEditLastUserMessage: () => {},
        handleApplySuggestion: () => {},
        handleModifySelection: async () => {},
        handleModifyDiagram: async () => {},
        handlePrepareQuestionForAnswer: () => {},
        handleEvaluateDocument: () => {},
        handleConfirmReset: () => {},
    };
};