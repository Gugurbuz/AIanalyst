
// components/ChatMessageHistory.tsx
import React, { useRef, useEffect } from 'react';
import type { Message, User, GenerativeSuggestion } from '../types';
import { ChatMessage } from './ChatMessage';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

interface ChatMessageHistoryProps {
  user: User;
  chatHistory: Message[];
  onFeedbackUpdate: (
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
  onFeedbackUpdate,
  onEditLastUserMessage,
  onApplySuggestion,
  onRetry,
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const visibleMessages = chatHistory.filter(
    (msg) => msg && msg.role !== 'system'
  );

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    if (virtuosoRef.current) {
        // Use setTimeout to allow render cycle to complete for accurate height
        setTimeout(() => {
            virtuosoRef.current?.scrollToIndex({
                index: visibleMessages.length - 1,
                align: 'end',
                behavior: 'smooth'
            });
        }, 100);
    }
  }, [visibleMessages.length, visibleMessages[visibleMessages.length - 1]?.content]);

  return (
    <div className="w-full h-full">
      <Virtuoso
        ref={virtuosoRef}
        data={visibleMessages}
        totalCount={visibleMessages.length}
        followOutput={'auto'}
        initialTopMostItemIndex={visibleMessages.length - 1}
        itemContent={(index, msg) => {
            const prevMessage = visibleMessages[index - 1];
            const nextMessage = visibleMessages[index + 1];

            const isFirstInGroup = !prevMessage || prevMessage.role !== msg.role;
            const isLastInGroup = !nextMessage || nextMessage.role !== msg.role;
            
            return (
              <div className="py-1">
                  <ChatMessage
                    key={msg.id || index}
                    message={msg}
                    onFeedback={onFeedbackUpdate}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                    onRetry={onRetry}
                  />
              </div>
            );
        }}
        style={{ height: '100%' }}
        // Improve performance by overscanning
        overscan={200}
      />
    </div>
  );
};