// hooks/useChatService.ts
import { useState, useCallback, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { promptService } from '../services/promptService';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabaseClient';
import type { useConversationState } from './useConversationState';
import type { useUIState } from './useUIState';
import type { Message, GeminiModel, ThoughtProcess, StreamChunk, Document, GeneratedDocs, SourcedDocument } from '../types';

const buildGeneratedDocs = (documents: Document[]): GeneratedDocs => {
    const defaultGeneratedDocs: GeneratedDocs = {
        requestDoc: '', analysisDoc: '', testScenarios: '', visualization: '',
        traceabilityMatrix: '', isVizStale: false, isTestStale: false,
        isTraceabilityStale: false, isBacklogStale: false,
    };
    const documentTypeToKeyMap = {
        request: 'requestDoc', analysis: 'analysisDoc', test: 'testScenarios',
        traceability: 'traceabilityMatrix', mermaid: 'mermaidViz', bpmn: 'bpmnViz',
        maturity_report: 'maturityReport',
    };
    
    const docs: GeneratedDocs = { ...defaultGeneratedDocs };
    if (!documents) return docs;

    const findDoc = (type: any) => documents.find(d => d.document_type === type);

    for (const doc of documents) {
        const key = documentTypeToKeyMap[doc.document_type as keyof typeof documentTypeToKeyMap];
        if (key) {
             if (['mermaidViz', 'bpmnViz', 'maturityReport', 'testScenarios', 'traceabilityMatrix'].includes(key)) {
                try {
                    (docs as any)[key] = JSON.parse(doc.content);
                } catch (e) {
                    if (['testScenarios', 'traceabilityMatrix'].includes(key)) {
                        (docs as any)[key] = doc.content;
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

// Helper to read file content as a promise
const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};


interface ChatServiceProps {
    conversationState: ReturnType<typeof useConversationState>;
    uiState: ReturnType<typeof useUIState>;
    isProcessing: boolean;
    setIsProcessing: (isProcessing: boolean) => void;
    setGeneratingDocType: (type: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null) => void;
    activeModel: () => GeminiModel;
    checkTokenLimit: () => boolean;
    handleNewConversation: (content?: string, title?: string) => Promise<{newConvId: string | null, initialContent: string | null, initialFile: File | null}>;
    handleGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => Promise<void>;
}


export const useChatService = ({
    conversationState,
    uiState,
    isProcessing,
    setIsProcessing,
    setGeneratingDocType,
    activeModel,
    checkTokenLimit,
    handleNewConversation,
    handleGenerateDoc,
}: ChatServiceProps) => {

    const generationController = useRef<AbortController | null>(null);
    const [messageToEdit, setMessageToEdit] = useState<string | null>(null);

    const handleFunctionCall = useCallback(async (name: string, args: any, assistantMessageId: string): Promise<string | null> => {
        if (name === 'saveRequestDocument') {
            const summary = args.request_summary;

            if (!summary || typeof summary !== 'string') {
                const errorMessage = "Talep dokümanı oluşturulamadı çünkü AI, talebin bir özetini sağlamadı.";
                conversationState.updateMessage(assistantMessageId, {
                    error: { name: 'FunctionCallError', message: errorMessage }
                });
                return errorMessage;
            }

            try {
                const { jsonString, tokens } = await geminiService.parseTextToRequestDocument(summary);
                conversationState.commitTokenUsage(tokens);
                await conversationState.saveDocumentVersion('requestDoc', jsonString, "İlk talep AI tarafından oluşturuldu");
                return "Talebinizi anladım ve 'Talep Dokümanı' olarak kaydettim. Çalışma alanındaki 'Talep' sekmesinden inceleyebilirsiniz. Şimdi analizi derinleştirmek için devam edelim mi?";
            } catch (e: any) {
                console.error("Error handling saveRequestDocument:", e);
                const errorMessage = `Talep dokümanı oluşturulurken bir hata oluştu: ${e.message}`;
                conversationState.updateMessage(assistantMessageId, {
                    error: { name: 'FunctionCallError', message: errorMessage }
                });
                return errorMessage;
            }
        }
        
        if (name === 'generateAnalysisDocument') {
            handleGenerateDoc('analysis');
            return "Elbette, iş analizi dokümanını oluşturmaya başlıyorum. Lütfen çalışma alanını kontrol edin.";
        }
        if (name === 'generateTestScenarios') {
            handleGenerateDoc('test');
            return "Test senaryolarını hazırlıyorum. Lütfen çalışma alanını kontrol edin.";
        }
        if (name === 'generateVisualization') {
            handleGenerateDoc('viz');
            return "Süreç akışını görselleştiriyorum. Lütfen çalışma alanını kontrol edin.";
        }
        if (name === 'generateTraceabilityMatrix') {
            handleGenerateDoc('traceability');
            return "İzlenebilirlik matrisini oluşturuyorum. Lütfen çalışma alanını kontrol edin.";
        }
        
        return null;
    }, [conversationState, handleGenerateDoc]);
    
    const sendMessage = useCallback(async (text: string, file: File | null = null, isRetry = false, forceConversationId?: string) => {
        if (!checkTokenLimit()) return;
        
        let activeId = forceConversationId || conversationState.activeConversationId;

        if (!activeId) {
             const { newConvId } = await handleNewConversation(text);
             if (!newConvId) return;
             activeId = newConvId;
        }

        setIsProcessing(true);
        setMessageToEdit(null);
        generationController.current = new AbortController();

        const isImageMessage = file && file.type.startsWith('image/');
        
        // --- IMAGE MESSAGE LOGIC ---
        if (isImageMessage) {
            const userImageUrl = URL.createObjectURL(file);
            const userMessage: Message = { id: uuidv4(), conversation_id: activeId, role: 'user', content: text, imageUrl: userImageUrl, created_at: new Date().toISOString() };
            conversationState.updateConversation(activeId, { messages: [...(conversationState.activeConversation?.messages || []), userMessage] });
            supabase.from('conversation_details').insert(userMessage).then(({error}) => { if(error) uiState.setError(`Mesajınız kaydedilemedi: ${error.message}`); });

            const assistantMessageId = uuidv4();
            const assistantMessage: Message = { id: assistantMessageId, conversation_id: activeId, role: 'assistant', content: '', created_at: new Date().toISOString(), isStreaming: true };
            conversationState.updateConversation(activeId, { messages: [...(conversationState.activeConversation?.messages || []), assistantMessage] });
            
            try {
                const base64Data = await fileToBase64(file);
                const { base64Image, tokens } = await geminiService.editImage(base64Data, file.type, text);
                conversationState.commitTokenUsage(tokens);

                const finalAssistantMessage: Partial<Message> = { content: `data:image/png;base64,${base64Image}`, isStreaming: false };
                conversationState.updateMessage(assistantMessageId, finalAssistantMessage);
                supabase.from('conversation_details').insert({ ...assistantMessage, ...finalAssistantMessage }).then(({error}) => { if(error) uiState.setError(`AI yanıtı kaydedilemedi: ${error.message}`); });
            } catch (e: any) {
                 conversationState.updateMessage(assistantMessageId, { error: { name: 'ImageGenerationError', message: e.message }, isStreaming: false });
            } finally {
                setIsProcessing(false);
            }
            return;
        }

        // --- TEXT MESSAGE LOGIC ---
        let messageContent = text;
        if (file) { // It's a text file
            try {
                const fileContent = await readFileAsText(file);
                messageContent = `[EK DOSYA İÇERİĞİ: ${file.name}]\n\n---\n\n${fileContent}\n\n---\n\n${text}`;
            } catch (error) {
                uiState.setError("Dosya okunurken hata oluştu.");
                setIsProcessing(false);
                return;
            }
        }
        
        const userMessage: Message = { id: uuidv4(), conversation_id: activeId, role: 'user', content: messageContent, created_at: new Date().toISOString() };
        let historyForApi: Message[];
        
        const currentConv = conversationState.conversations.find(c => c.id === activeId);
        if (!isRetry) {
            historyForApi = [...(currentConv?.messages || []), userMessage];
            conversationState.updateConversation(activeId, { messages: historyForApi });
            supabase.from('conversation_details').insert(userMessage).then(({error}) => {
                if(error) uiState.setError(`Mesajınız kaydedilemedi: ${error.message}`);
            });
        } else {
            historyForApi = [...(currentConv?.messages || [])];
        }

        const assistantMessageId = uuidv4();
        const assistantMessage: Message = { id: assistantMessageId, conversation_id: activeId, role: 'assistant', content: '', created_at: new Date().toISOString(), isStreaming: true };
        conversationState.updateConversation(activeId, { messages: [...historyForApi, assistantMessage] });
        
        const finalAssistantMessage: Message = { ...assistantMessage };
        
        try {
            const streamConv = conversationState.conversations.find(c => c.id === activeId)!;
            const streamGeneratedDocs = buildGeneratedDocs(streamConv.documents);

            const stream = uiState.isExpertMode 
                ? geminiService.runExpertAnalysisStream(userMessage, streamGeneratedDocs, {
                    analysis: promptService.getPrompt('generateAnalysisDocument'),
                    test: promptService.getPrompt('generateTestScenarios'),
                    traceability: promptService.getPrompt('generateTraceabilityMatrix'),
                    visualization: promptService.getPrompt(uiState.diagramType === 'bpmn' ? 'generateBPMN' : 'generateVisualization'),
                }, uiState.diagramType)
                : geminiService.handleUserMessageStream(historyForApi, streamGeneratedDocs, {
                    analysis: conversationState.allTemplates.find(t => t.id === conversationState.selectedTemplates.analysis)?.prompt || promptService.getPrompt('generateAnalysisDocument'),
                    test: conversationState.allTemplates.find(t => t.id === conversationState.selectedTemplates.test)?.prompt || promptService.getPrompt('generateTestScenarios'),
                    traceability: conversationState.allTemplates.find(t => t.id === conversationState.selectedTemplates.traceability)?.prompt || promptService.getPrompt('generateTraceabilityMatrix'),
                    visualization: promptService.getPrompt(uiState.diagramType === 'bpmn' ? 'generateBPMN' : 'generateVisualization'),
                }, activeModel());
            
            let accumulatedContent = '';
            let accumulatedThought: ThoughtProcess | null = null;
            let functionCallHandled = false;
            
            for await (const chunk of stream) {
                if (generationController.current?.signal.aborted) break;

                switch (chunk.type) {
                    case 'thought_chunk':
                        accumulatedThought = chunk.payload;
                        finalAssistantMessage.thought = accumulatedThought;
                        conversationState.updateStreamingMessage(assistantMessageId, chunk);
                        break;
                    
                    case 'text_chunk':
                        accumulatedContent += chunk.text;
                        finalAssistantMessage.content = accumulatedContent;
                        conversationState.updateStreamingMessage(assistantMessageId, { type: 'chat_stream_chunk', chunk: chunk.text });
                        break;
                    
                    case 'function_call':
                        if (!functionCallHandled) {
                             const responseText = await handleFunctionCall(chunk.name, chunk.args, assistantMessageId);
                            if (responseText) {
                                accumulatedContent += responseText;
                                finalAssistantMessage.content = accumulatedContent;
                                conversationState.updateStreamingMessage(assistantMessageId, { type: 'chat_stream_chunk', chunk: responseText });
                            }
                            functionCallHandled = true;
                        }
                        break;

                    case 'doc_stream_chunk':
                        conversationState.streamDocument(chunk.docKey, chunk.chunk);
                        break;
                    case 'usage_update':
                        conversationState.commitTokenUsage(chunk.tokens);
                        break;
                    case 'error':
                        throw new Error(chunk.message);
                }
            }
        } catch (e: any) {
            console.error("Streaming error:", e);
            finalAssistantMessage.error = { name: "StreamError", message: e.message };
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
            finalAssistantMessage.isStreaming = false;
            
            if (finalAssistantMessage.thought && Array.isArray(finalAssistantMessage.thought.steps)) {
                finalAssistantMessage.thought.steps.forEach(step => step.status = step.status === 'error' ? 'error' : 'completed');
            }

            conversationState.updateMessage(assistantMessageId, { ...finalAssistantMessage });
            
            if (!finalAssistantMessage.error) {
                await supabase.from('conversation_details').insert({
                    id: finalAssistantMessage.id, conversation_id: finalAssistantMessage.conversation_id,
                    role: finalAssistantMessage.role, content: finalAssistantMessage.content,
                    created_at: finalAssistantMessage.created_at, thought: finalAssistantMessage.thought || null,
                    feedback: finalAssistantMessage.feedback || null,
                });
                
                await conversationState.finalizeStreamedDocuments();
                if (!uiState.isExpertMode) {
                    const updatedConv = conversationState.conversations.find(c => c.id === activeId);
                    if (updatedConv) {
                        const currentDocs = buildGeneratedDocs(updatedConv.documents);
                        const hasRealAnalysisDoc = !!currentDocs.analysisDoc && !currentDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");
                        if (hasRealAnalysisDoc) {
                             geminiService.checkAnalysisMaturity(updatedConv.messages, currentDocs, activeModel())
                                .then(({ report, tokens }) => {
                                    conversationState.commitTokenUsage(tokens);
                                    conversationState.saveDocumentVersion('maturityReport', report as any, 'AI tarafından olgunluk değerlendirmesi yapıldı');
                                }).catch(maturityError => {
                                    console.warn("Maturity check failed in the background:", maturityError);
                                });
                        }
                    }
                }
            }
        }
    }, [conversationState, checkTokenLimit, uiState, activeModel, handleNewConversation, handleFunctionCall]);

    const handleRetryMessage = (failedAssistantMessageId: string) => {
        const activeConv = conversationState.activeConversation;
        if (!activeConv) return;
        const failedMsgIndex = activeConv.messages.findIndex(m => m.id === failedAssistantMessageId);
        if (failedMsgIndex > 0) {
            const userMessageToRetry = activeConv.messages[failedMsgIndex - 1];
            if (userMessageToRetry && userMessageToRetry.role === 'user') {
                conversationState.updateConversation(activeConv.id, {
                    messages: activeConv.messages.filter(m => m.id !== failedAssistantMessageId)
                });
                sendMessage(userMessageToRetry.content, undefined, true);
            }
        }
    };

    const handleStopGeneration = () => { generationController.current?.abort(); };
    
    return {
        messageToEdit,
        setMessageToEdit,
        sendMessage,
        handleRetryMessage,
        handleStopGeneration,
        generationController,
    };
};