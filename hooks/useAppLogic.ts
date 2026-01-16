// hooks/useAppLogic.ts
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useUIState } from './useUIState';
import { useConversationState } from './useConversationState';
import { useDocumentServices } from './useDocumentServices';
import { useChatService } from './useChatService';
import { geminiService } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import type {
    User,
    Conversation,
    Message,
    GeneratedDocs,
    GeminiModel,
    Template,
    DocumentVersion,
    DocumentType
} from '../types';
import type { AppData } from '../index';
import { supabase } from '../services/supabaseClient';

interface UseAppLogicProps {
    user: User;
    initialData: AppData;
    onLogout: () => void;
    initialMessage?: string;
}

export const useAppLogic = ({ user, initialData, onLogout, initialMessage }: UseAppLogicProps) => {
    const uiState = useUIState();
    const conversationState = useConversationState({ user, initialData, setError: uiState.setError });

    const [isProcessing, setIsProcessing] = useState(false);
    const [generatingDocType, setGeneratingDocType] = useState<'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null>(null);

    const activeModel = useCallback((): GeminiModel => {
        if (uiState.isDeepAnalysisMode) return 'gemini-2.5-pro';
        return (localStorage.getItem('geminiModel') as GeminiModel) || 'gemini-2.5-flash';
    }, [uiState.isDeepAnalysisMode]);
    
    const checkTokenLimit = useCallback(() => {
        if (conversationState.userProfile && conversationState.userProfile.plan === 'free' && conversationState.userProfile.tokens_used >= conversationState.userProfile.token_limit) {
            uiState.setShowUpgradeModal(true);
            return false;
        }
        return true;
    }, [conversationState.userProfile, uiState]);

    const handleNewConversation = useCallback(async (documentContentOrEvent?: string | React.MouseEvent, title?: string) => {
        uiState.setIsNewAnalysisModalOpen(false);
        const documentContent = (typeof documentContentOrEvent === 'string') ? documentContentOrEvent : undefined;
        const isAnonymous = user.id.startsWith('anonymous-');

        setIsProcessing(true);
        let newConvId: string | null = null;
        try {
            const initialTitle = title || (documentContent ? 'Yapıştırılan Doküman' : 'Yeni Analiz');
            let finalTitle = initialTitle;

            if (!title && documentContent) {
                const { title: generatedTitle, tokens } = await geminiService.generateConversationTitle(documentContent.substring(0, 250));
                if (!isAnonymous) {
                    conversationState.commitTokenUsage(tokens);
                }
                finalTitle = generatedTitle || initialTitle;
            }

            let convData: any;

            if (isAnonymous) {
                convData = {
                    id: uuidv4(),
                    user_id: user.id,
                    title: finalTitle,
                    share_id: uuidv4(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    is_shared: false,
                };
            } else {
                const { data, error: convError } = await supabase.from('conversations').insert({ user_id: user.id, title: finalTitle, share_id: uuidv4() }).select().single();

                if (convError || !data) {
                    uiState.setError("Yeni sohbet oluşturulamadı.");
                    return { newConvId: null, initialContent: null, initialFile: null };
                }
                convData = data;
            }

            const newConversation: Conversation = {
                ...convData,
                messages: [],
                documents: [],
                documentVersions: [],
            };

            conversationState.setConversations(prev => [newConversation, ...prev]);
            conversationState.setActiveConversationId(newConversation.id);
            newConvId = newConversation.id;

            if (documentContent) {
                const { jsonString, tokens } = await geminiService.parseTextToRequestDocument(documentContent);
                if (!isAnonymous) {
                    conversationState.commitTokenUsage(tokens);
                }
                await conversationState.saveDocumentVersion('requestDoc', jsonString, "İlk doküman oluşturuldu", null, newConvId);
                return { newConvId, initialContent: `Bu dokümanı analiz etmeye başla.`, initialFile: null };
            }
            return { newConvId, initialContent: null, initialFile: null };

        } catch (e: any) {
            uiState.setError(e.message);
            return { newConvId: null, initialContent: null, initialFile: null };
        } finally {
            setIsProcessing(false);
        }
    }, [user.id, conversationState, uiState]);
    
    const documentServices = useDocumentServices({
        conversationState,
        uiState,
        isProcessing,
        setIsProcessing,
        generatingDocType,
        setGeneratingDocType,
        activeModel,
        checkTokenLimit,
    });
    
    const chatService = useChatService({
        conversationState,
        uiState,
        isProcessing,
        setIsProcessing,
        setGeneratingDocType,
        activeModel,
        checkTokenLimit,
        handleNewConversation,
        handleGenerateDoc: documentServices.handleGenerateDoc,
    });
    
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

    const handleFeedbackUpdate = async (messageId: string, feedback: { rating: 'up' | 'down' | null; comment?: string }) => {
        conversationState.updateMessage(messageId, { feedback });
        const { error } = await supabase.from('conversation_details').update({ feedback }).eq('id', messageId);
        if (error) uiState.setError("Geri bildirim kaydedilemedi.");
    };

    // FIX: Modify this wrapper to return the new conversation ID.
    const handleNewConversationAndSend = async (content?: string, file?: File | null) => {
        const { newConvId, initialContent, initialFile } = await handleNewConversation(content);
        if (newConvId && initialContent) {
            chatService.sendMessage(initialContent, initialFile, false, newConvId, uiState.isSearchEnabled);
        } else if (newConvId && file) {
             chatService.sendMessage(content || '', file, false, newConvId, uiState.isSearchEnabled);
        }
        return { newConvId };
    };

    const hasInitialMessageBeenSent = useRef(false);

    useEffect(() => {
        if (initialMessage && user.id.startsWith('anonymous-') && !hasInitialMessageBeenSent.current) {
            hasInitialMessageBeenSent.current = true;

            const sendInitialMessage = async () => {
                const { newConvId } = await handleNewConversationAndSend();
                if (newConvId) {
                    // Wait a bit for the state to update
                    setTimeout(() => {
                        chatService.sendMessage(initialMessage, null, false, newConvId, false);
                    }, 100);
                }
            };

            sendInitialMessage();
        }
    }, [initialMessage, user.id]);
    
    return {
        ...uiState,
        ...conversationState,
        ...documentServices,
        ...chatService,
        isProcessing,
        generatingDocType,
        onLogout,
        sendMessage: (text: string, file: File | null) => chatService.sendMessage(text, file, false, undefined, uiState.isSearchEnabled),
        handleNewConversation: handleNewConversationAndSend,
        handleFeedbackUpdate,
        handleSuggestNextFeature,
        handleDeepAnalysisModeChange: (isOn: boolean) => uiState.setIsDeepAnalysisMode(isOn),
        
        // Stubs for props that need full implementation
        handleEditLastUserMessage: () => {
             const { activeConversation } = conversationState;
             if (!activeConversation) return;
             const lastUserMessage = [...activeConversation.messages].reverse().find(m => m.role === 'user');
             if(lastUserMessage) {
                chatService.setMessageToEdit(lastUserMessage.content);
             }
        },
        handleApplySuggestion: () => {},
        handlePrepareQuestionForAnswer: (question: string) => {
            chatService.sendMessage(question, null, false, undefined, uiState.isSearchEnabled);
        },
        handleEvaluateDocument: () => {},
        handleConfirmReset: () => {},
        handleRetryMessage: chatService.handleRetryMessage
    };
};