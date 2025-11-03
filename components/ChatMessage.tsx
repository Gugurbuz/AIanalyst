// components/ChatMessage.tsx
import React from 'react';
import { Message, GenerativeSuggestion, ThinkingStep } from '../types'; // GenerativeSuggestion import'u (kullanmasak da) tip için kalabilir
import { User, Bot } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Feedback } from './Feedback';
import ThinkingProcess from './ThinkingProcess';
// import { ExpertRunChecklist } from './ExpertRunChecklist'; // Orijinalde yorum satırındaydı

// HATA BURADAYDI: Bu dosya (GenerativeSuggestionCard.tsx) projede bulunmadığı için import'u yorum satırına alıyoruz.
// import { GenerativeSuggestionCard } from './GenerativeSuggestionCard';

interface ChatMessageProps {
  message: Message;
  onFeedback: (
    messageId: string,
    feedback: { rating: 'up' | 'down' | null; comment?: string }
  ) => void;
  // Eksik bileşene bağlı olan bu prop'u da arayüzden kaldırıyoruz
  // onApplySuggestion: (
  //   suggestion: GenerativeSuggestion,
  //   messageId: string
  // ) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onFeedback,
  // onApplySuggestion, // Prop kaldırıldı
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center items-center my-4">
        <div className="text-xs text-gray-500 dark:text-gray-400 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-2xl text-center shadow-inner">
          <span className="font-semibold">[SİSTEM]:</span>{' '}
          {message.content.replace('[SİSTEM]:', '').trim()}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`flex max-w-lg lg:max-w-xl ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        <div
          className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
            isUser
              ? 'bg-blue-500 text-white ml-2'
              : 'bg-gray-700 text-white mr-2'
          }`}
        >
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>
        <div
          className={`px-4 py-3 rounded-lg ${
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-white dark:bg-gray-800 dark:text-gray-200 shadow-md'
          }`}
        >
          {/* --- DEĞİŞİKLİK BURADA --- */}
          {/* FIX: Map ExpertStep[] to ThinkingStep[] and provide all required props to ThinkingProcess. */}
          {message.role === 'assistant' && message.expertRunChecklist && (
            <ThinkingProcess
              steps={message.expertRunChecklist.map(s => ({
                  ...s,
                  description: s.details || '',
                  // Map `in_progress` to `pending` as ThinkingProcess uses `pending` for spinner.
                  status: s.status === 'in_progress' ? 'pending' : s.status,
              })) as ThinkingStep[]}
              isThinking={message.expertRunChecklist.some(s => s.status === 'in_progress' || s.status === 'pending')}
              error={message.expertRunChecklist.find(s => s.status === 'error')?.details || null}
            />
          )}
          {/* ------------------------ */}

          {/* Orijinal 'thinking' string'ini gösteren satırı kaldırıyoruz (veya yorumluyoruz)
            {message.role === 'assistant' && message.thinking && (
              <ThinkingProcess content={message.thinking} />
            )}
          */}
          
          <MarkdownRenderer content={message.content} />

          {/* Orijinal dosyadaki 'generativeSuggestion' kontrolünü geri ekliyoruz */}
          {/* FIX: The props for the Feedback component were incorrect. Correctly pass `msg` and `onUpdate`. */}
          {message.role === 'assistant' && !message.generativeSuggestion && (
            <Feedback
              msg={message}
              onUpdate={(feedbackData) => onFeedback(message.id, feedbackData)}
            />
          )}

          {/* Eksik bileşen (GenerativeSuggestionCard) nedeniyle bu bölümü
            orijinaldeki gibi yorum satırında bırakıyoruz.
          {message.role === 'assistant' && message.generativeSuggestion && (
            <GenerativeSuggestionCard
              suggestion={message.generativeSuggestion}
              onApply={() => onApplySuggestion(message.generativeSuggestion!, message.id)}
            />
          )}
          */}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;