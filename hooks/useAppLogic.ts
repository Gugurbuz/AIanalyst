// hooks/useAppLogic.ts
import React, { useState, useCallback, useRef } from 'react';
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
}

export const useAppLogic = ({ user, initialData, onLogout }: UseAppLogicProps) => {
    const uiState = useUIState();
    const conversationState = useConversationState({ user, initialData });

    const [isProcessing, setIsProcessing] = useState(false);
    const [generatingDocType, setGeneratingDocType] = useState<'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null>(null);

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

        setIsProcessing(true);
        let newConvId: string | null = null;
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
                return { newConvId: null, initialContent: null, initialFile: null };
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
                conversationState.commitTokenUsage(tokens);
                // FIX: Pass newConvId to saveDocumentVersion to prevent race condition
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

    const handleNewConversationAndSend = async (content?: string, file?: File | null) => {
        const { newConvId, initialContent, initialFile } = await handleNewConversation(content);
        if (newConvId && initialContent) {
            chatService.sendMessage(initialContent, initialFile, false, newConvId);
        } else if (newConvId && file) {
             chatService.sendMessage(content || '', file, false, newConvId);
        }
    };
    
    return {
        ...uiState,
        ...conversationState,
        ...documentServices,
        ...chatService,
        isProcessing,
        generatingDocType,
        onLogout,
        sendMessage: chatService.sendMessage,
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
            chatService.sendMessage(question);
        },
        handleEvaluateDocument: () => {},
        handleConfirmReset: () => {},
        handleRetryMessage: chatService.handleRetryMessage
    };
};