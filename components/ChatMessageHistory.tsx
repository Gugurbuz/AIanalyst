import React from 'react';
import type { Message, User, GenerativeSuggestion } from '../types';
import { ChatMessage } from './ChatMessage';

interface ChatMessageHistoryProps {
    user: User;
    chatHistory: Message[];
    onFeedbackUpdate: (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
    onEditLastUserMessage: () => void;
    onApplySuggestion: (suggestion: GenerativeSuggestion, messageId: string) => void;
}

export const ChatMessageHistory: React.FC<ChatMessageHistoryProps> = ({ user, chatHistory, onFeedbackUpdate, onEditLastUserMessage, onApplySuggestion }) => {
    const visibleMessages = chatHistory.filter(msg => msg.role !== 'system');
    
    return (
        <div className="w-full space-y-6 py-4">
            {visibleMessages.map((msg, index) => {
                const isLastMessage = index === visibleMessages.length - 1;
                const isSecondToLast = index === visibleMessages.length - 2;
                
                let isEditable = false;
                if (msg.role === 'user') {
                    // It's editable if it's the last message overall
                    if (isLastMessage) {
                        isEditable = true;
                    // Or if it's the second to last and the last one is an assistant message
                    } else if (isSecondToLast && visibleMessages[index + 1].role === 'assistant') {
                        isEditable = true;
                    }
                }

                return (
                    <ChatMessage 
                        key={msg.id}
                        msg={msg}
                        user={user}
                        onFeedbackUpdate={onFeedbackUpdate}
                        isEditable={isEditable}
                        onEdit={onEditLastUserMessage}
                        onApplySuggestion={onApplySuggestion}
                    />
                );
            })}
        </div>
    );
};