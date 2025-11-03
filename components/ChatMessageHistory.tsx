// components/ChatMessageHistory.tsx
import React from 'react';
import type { Message, User, GenerativeSuggestion } from '../types';
import ChatMessage from './ChatMessage'; // Bu import artık doğru (parantezsiz)

interface ChatMessageHistoryProps {
  user: User;
  chatHistory: Message[];
  onFeedbackUpdate: ( // Prop'un adı 'onFeedbackUpdate'
    messageId: string,
    feedback: { rating: 'up' | 'down' | null; comment?: string }
  ) => void;
  onEditLastUserMessage: () => void;
  onApplySuggestion: (suggestion: GenerativeSuggestion, messageId: string) => void;
}

export const ChatMessageHistory: React.FC<ChatMessageHistoryProps> = ({
  user,
  chatHistory,
  onFeedbackUpdate, // Prop'u burada alıyoruz
  onEditLastUserMessage,
  onApplySuggestion,
}) => {
  // 1. DÜZELTME:
  // Tanımsız (undefined) mesajları filtreleyerek "Cannot read 'role'" hatasını en başta engelliyoruz.
  const visibleMessages = chatHistory.filter(
    (msg) => msg && msg.role !== 'system'
  );

  return (
    <div className="w-full space-y-6 py-4">
      {visibleMessages.map((msg, index) => {
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

        // 2. DÜZELTME:
        // İç içe geçmiş 'map' döngüsü kaldırıldı.
        // 'onFeedback' prop'u 'onFeedbackUpdate' olarak düzeltildi.
        return (
          <ChatMessage
            key={msg.id || index}
            message={msg}
            onFeedback={onFeedbackUpdate} // Hata burada 'onFeedback' idi
            onApplySuggestion={onApplySuggestion}
          />
        );
      })}
    </div>
  );
};

// Not: Bu dosya 'export const' (isimli) kullandığı için,
// onu import eden dosyada 'import { ChatMessageHistory } from ...'
// (süslü parantezli) kullanılması gerekir.