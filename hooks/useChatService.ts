
// hooks/useChatService.ts
import { useState, useCallback, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { promptService } from '../services/promptService';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabaseClient';
import type { useConversationState } from './useConversationState';
import type { useUIState } from './useUIState';
import type { Message, GeminiModel, ThoughtProcess, StreamChunk, BacklogSuggestion } from '../types';
import confetti from 'canvas-confetti';

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

const triggerSuccessConfetti = () => {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
};


interface ChatServiceProps {
    conversationState: ReturnType<typeof useConversationState>;
    uiState: ReturnType<typeof useUIState>;
    isProcessing: boolean;
    setIsProcessing: (isProcessing: boolean) => void;
    setGeneratingDocType: (type: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null) => void;
    activeModel: () => GeminiModel;
    checkTokenLimit: () => boolean;
    handleNewConversation: (content?: string, title?: string) => Promise<{newConvId: string | null, initialContent: string | null, initialFile: File | null}>;
    handleGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', newTemplateId?: string) => Promise<void>;
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
                triggerSuccessConfetti(); // Celebration!
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
    
    const sendMessage = useCallback(async (text: string, file: File | null = null, isRetry = false, forceConversationId?: string, isSearchEnabled?: boolean) => {
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
        let base64Image: string | null = null;

        if (isImageMessage) {
            try {
                base64Image = await fileToBase64(file);
            } catch(e) {
                uiState.setError("Görsel işlenirken bir hata oluştu.");
                setIsProcessing(false);
                return;
            }
        }

        let messageContent = text;
        if (file && !isImageMessage) { // It's a text file
            try {
                const fileContent = await readFileAsText(file);
                messageContent = `[EK DOSYA İÇERİĞİ: ${file.name}]\n\n---\n\n${fileContent}\n\n---\n\n${text}`;
            } catch (error) {
                uiState.setError("Dosya okunurken hata oluştu.");
                setIsProcessing(false);
                return;
            }
        }
        
        const userMessage: any = { 
            id: uuidv4(), 
            conversation_id: activeId, 
            role: 'user', 
            content: messageContent, 
            created_at: new Date().toISOString() 
        };

        if (isImageMessage && base64Image) {
            userMessage.imageUrl = URL.createObjectURL(file);
            userMessage.base64Image = base64Image;
            userMessage.imageMimeType = file.type;
        }
        
        let historyForApi: Message[];
        
        const currentConv = conversationState.conversations.find(c => c.id === activeId);
        if (!isRetry) {
            historyForApi = [...(currentConv?.messages || []), userMessage];
            conversationState.updateConversation(activeId, { messages: historyForApi });
            
            const dbMessage = { ...userMessage };
            delete dbMessage.base64Image;
            delete dbMessage.imageMimeType;

            supabase.from('conversation_details').insert(dbMessage).then(({error}) => {
                if(error) uiState.setError(`Mesajınız kaydedilemedi: ${error.message}`);
            });
        } else {
            historyForApi = [...(currentConv?.messages || [])];
        }

        const assistantMessageId = uuidv4();
        const assistantMessage: Message = { id: assistantMessageId, conversation_id: activeId, role: 'assistant', content: '', created_at: new Date().toISOString(), isStreaming: true };
        conversationState.updateConversation(activeId, { messages: [...historyForApi, assistantMessage] });
        
        try {
            const streamConv = conversationState.conversations.find(c => c.id === activeId);
            const streamGeneratedDocs = streamConv?.generatedDocs || { requestDoc: null, analysisDoc: null, testDoc: null, traceabilityDoc: null };

            const stream = uiState.isExpertMode 
                ? geminiService.runExpertAnalysisStream(userMessage, streamGeneratedDocs, {
                    analysis: promptService.getPrompt('generateAnalysisDocument'),
                    test: promptService.getPrompt('generateTestScenarios'),
                    traceability: promptService.getPrompt('generateTraceabilityMatrix'),
                    visualization: promptService.getPrompt('generateBPMN'),
                }, {
                    streamDocument: conversationState.streamDocument,
                    saveDocument: (docKey, content, reason, template, convIdOverride, tokens) => 
                        conversationState.saveDocumentVersion(docKey, content, reason, template, activeId, tokens),
                    commitTokens: conversationState.commitTokenUsage,
                    updateConversation: (updates: { backlogSuggestions: BacklogSuggestion[] }) => {
                        conversationState.updateConversation(activeId, updates);
                    },
                })
                : geminiService.handleUserMessageStream(historyForApi, streamGeneratedDocs, {
                    analysis: conversationState.allTemplates.find(t => t.id === conversationState.selectedTemplates.analysis)?.prompt || promptService.getPrompt('generateAnalysisDocument'),
                    test: conversationState.allTemplates.find(t => t.id === conversationState.selectedTemplates.test)?.prompt || promptService.getPrompt('generateTestScenarios'),
                    traceability: conversationState.allTemplates.find(t => t.id === conversationState.selectedTemplates.traceability)?.prompt || promptService.getPrompt('generateTraceabilityMatrix'),
                    visualization: promptService.getPrompt('generateBPMN'),
                }, activeModel(), isSearchEnabled);
            
            let functionCallHandled = false;
            
            for await (const chunk of stream) {
                if (generationController.current?.signal.aborted) break;

                conversationState.updateStreamingMessage(assistantMessageId, chunk);

                // Handle expert mode completion
                if (chunk.type === 'expert_run_update' && chunk.isComplete && !chunk.finalMessage?.includes('hata')) {
                    triggerSuccessConfetti();
                }

                if (chunk.type === 'function_call' && !functionCallHandled) {
                    const responseText = await handleFunctionCall(chunk.name, chunk.args, assistantMessageId);
                    if (responseText) {
                        conversationState.updateStreamingMessage(assistantMessageId, { type: 'text_chunk', text: responseText });
                    }
                    functionCallHandled = true;
                }
            }
        } catch (e: any) {
            console.error("Streaming error:", e);
            const errorMessage = `Bir hata oluştu: ${e.message}`;
            conversationState.updateMessage(assistantMessageId, { 
                error: { name: "StreamError", message: errorMessage },
                isStreaming: false
            });
        } finally {
            if (generationController.current?.signal.aborted) {
                const finalContent = (conversationState.getMessageById(assistantMessageId)?.content || "") + "\n\nKullanıcı tarafından durduruldu.";
                conversationState.updateMessage(assistantMessageId, { isStreaming: false, content: finalContent });
            }
            
            setIsProcessing(false);
            setGeneratingDocType(null);

            const finalAssistantMessage = conversationState.getMessageById(assistantMessageId);
            
            if (finalAssistantMessage) {
                const finalUpdates: Partial<Message> = { isStreaming: false };
                if (finalAssistantMessage.thought && Array.isArray(finalAssistantMessage.thought.steps)) {
                    finalUpdates.thought = {
                        ...finalAssistantMessage.thought,
                        steps: finalAssistantMessage.thought.steps.map(step => ({ ...step, status: step.status === 'error' ? 'error' : 'completed' }))
                    };
                }
                conversationState.updateMessage(assistantMessageId, finalUpdates);

                if (!finalAssistantMessage.error) {
                    await supabase.from('conversation_details').insert({
                        id: finalAssistantMessage.id,
                        conversation_id: finalAssistantMessage.conversation_id,
                        role: finalAssistantMessage.role,
                        content: finalAssistantMessage.content,
                        created_at: finalAssistantMessage.created_at,
                        thought: finalAssistantMessage.thought || null,
                        feedback: finalAssistantMessage.feedback || null,
                        grounding_metadata: finalAssistantMessage.groundingMetadata || null
                    });
                    
                    await conversationState.finalizeStreamedDocuments();
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