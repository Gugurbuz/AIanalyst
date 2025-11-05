// components/ChatMessageHistory.tsx
import React from 'react';
import type { Message, User, GenerativeSuggestion } from '../types';
import { ChatMessage } from './ChatMessage';

interface ChatMessageHistoryProps {
  user: User;
  chatHistory: Message[];
  onFeedbackUpdate: ( // Prop'un adı 'onFeedbackUpdate'
    messageId: string,
    feedback: { rating: 'up' | 'down' | null; comment?: string }
  ) => void;
  onEditLastUserMessage: () => void;
  onApplySuggestion: (suggestion: GenerativeSuggestion, messageId: string) => void;
  onRetry: (failedAssistantMessageId: string) => void;
}

export const ChatMessageHistory: React.FC<ChatMessageHistoryProps> = ({
  user,
  chatHistory,
  onFeedbackUpdate, // Prop'u burada alıyoruz
  onEditLastUserMessage,
  onApplySuggestion,
  onRetry,
}) => {
  const visibleMessages = chatHistory.filter(
    (msg) => msg && msg.role !== 'system'
  );

  return (
    <div className="w-full space-y-1 py-4">
      {visibleMessages.map((msg, index) => {
        const prevMessage = visibleMessages[index - 1];
        const nextMessage = visibleMessages[index + 1];

        const isFirstInGroup = !prevMessage || prevMessage.role !== msg.role;
        const isLastInGroup = !nextMessage || nextMessage.role !== msg.role;
        
        // 'isEditable' mantığınız burada (bunu koruyoruz)
        const isLastMessage = index === visibleMessages.length - 1;
        const isSecondToLast = index === visibleMessages.length - 2;

        let isEditable = false;
        if (msg.role === 'user') {
          if (isLastMessage) {
            isEditable = true;
          } else if (
            isSecondToLast &&
            visibleMessages[index + 1].role === 'assistant'
          ) {
            isEditable = true;
          }
        }
        
        return (
          <ChatMessage
            key={msg.id || index}
            message={msg}
            onFeedback={onFeedbackUpdate}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            onRetry={onRetry}
          />
        );
      })}
    </div>
  );
};