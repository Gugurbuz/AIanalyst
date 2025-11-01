import React from 'react';
import type { Message, User, GenerativeSuggestion } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { ChatMessage } from './ChatMessage'; // Import the new component
import { Bot } from 'lucide-react';

interface ChatMessageHistoryProps {
    user: User;
    chatHistory: Message[];
    isLoading: boolean;
    onFeedbackUpdate: (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
    onEditLastUserMessage: () => void;
    onApplySuggestion: (suggestion: GenerativeSuggestion, messageId: string) => void;
}

const AssistantAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
        <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
    </div>
);

export const ChatMessageHistory: React.FC<ChatMessageHistoryProps> = ({ user, chatHistory, isLoading, onFeedbackUpdate, onEditLastUserMessage, onApplySuggestion }) => {
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
            {isLoading && (
                <div className="flex items-start gap-3.5 justify-start">
                    <AssistantAvatar />
                    <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl p-4 shadow-sm rounded-bl-none">
                       <LoadingSpinner />
                    </div>
                </div>
            )}
        </div>
    );
};