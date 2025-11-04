// components/ChatMessage.tsx
import React, { useState, useEffect } from 'react';
import { Message, GenerativeSuggestion, ThinkingStep } from '../types';
import { User, Bot, Copy, Check } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Feedback } from './Feedback';
import ThinkingProcess from './ThinkingProcess';

interface ChatMessageProps {
  message: Message;
  onFeedback: (
    messageId: string,
    feedback: { rating: 'up' | 'down' | null; comment?: string }
  ) => void;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onFeedback,
  isFirstInGroup,
  isLastInGroup
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [copyText, setCopyText] = useState('');

  useEffect(() => {
    if (copyText) {
        const timer = setTimeout(() => setCopyText(''), 2000);
        return () => clearTimeout(timer);
    }
  }, [copyText]);

  const handleCopy = () => {
      if (!message.content) return;
      navigator.clipboard.writeText(message.content).then(() => {
          setCopyText('Kopyalandı!');
      }).catch(err => {
          console.error('Could not copy text: ', err);
          setCopyText('Hata');
      });
  };


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
  
  const bubbleStyles = {
    user: {
      container: `justify-end`,
      bubble: `bg-indigo-600 dark:bg-indigo-700 text-white`,
      corners: isLastInGroup ? 'rounded-2xl rounded-br-lg' : 'rounded-2xl',
    },
    assistant: {
      container: `justify-start`,
      bubble: `bg-white dark:bg-slate-800 dark:text-slate-200`,
      corners: isLastInGroup ? 'rounded-2xl rounded-bl-lg' : 'rounded-2xl',
    }
  };
  
  const styles = isUser ? bubbleStyles.user : bubbleStyles.assistant;
  
  const expertSteps: ThinkingStep[] = (message.expertRunChecklist || []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.details || '',
      status: s.status === 'in_progress' ? 'pending' : s.status,
  }));
  
  const allSteps = [...expertSteps];

  return (
    <div
        className={`group/row flex items-end gap-2 animate-fade-in-up ${styles.container} ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}
        style={{ animationDuration: '0.3s' }}
    >
        {/* Action Buttons: Positioned before the bubble. Flex alignment places them on the left for both user & assistant. */}
        <div className="flex-shrink-0 self-end opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 pb-2">
            {isUser ? (
                 <button 
                    onClick={handleCopy} 
                    className="p-1.5 rounded-lg text-slate-500 bg-slate-200 hover:bg-slate-300 dark:text-indigo-200 dark:bg-black/20 dark:hover:bg-black/40 transition-colors"
                    title="Mesajı kopyala"
                >
                    {copyText ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
            ) : (
                message.role === 'assistant' && !message.generativeSuggestion && (
                     <Feedback
                      msg={message}
                      onUpdate={(feedbackData) => onFeedback(message.id, feedbackData)}
                    />
                )
            )}
        </div>
        
        {/* Bubble Content */}
        <div className={`group relative max-w-lg lg:max-w-2xl w-fit flex items-start ${!isUser ? 'border-l-4 border-indigo-500 pl-3' : ''}`}>
             <div className={`relative px-4 py-3 ${styles.bubble} ${styles.corners} shadow-sm`}>
                {message.expertRunChecklist && (
                    <ThinkingProcess
                      steps={allSteps}
                      isThinking={message.expertRunChecklist?.some(s => s.status === 'in_progress' || s.status === 'pending')}
                      error={message.expertRunChecklist?.find(s => s.status === 'error')?.details || null}
                    />
                )}
                
                <div className={isUser ? "dark [--tw-prose-invert-body:theme(colors.white)] [--tw-prose-invert-headings:theme(colors.white)] [--tw-prose-invert-bold:theme(colors.white)]" : ""}>
                    <MarkdownRenderer content={message.content} />
                </div>
             </div>
        </div>
    </div>
  );
};
