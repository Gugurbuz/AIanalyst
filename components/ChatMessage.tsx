
// components/ChatMessage.tsx
import React, { useState, useEffect, memo } from 'react';
import { Message, GenerativeSuggestion, ThinkingStep, ThoughtProcess, GroundingChunk } from '../types';
import { User, Bot, Copy, Check, ExternalLink } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Feedback } from './Feedback';
import ThinkingProcess from './ThinkingProcess';
import { LoadingSpinner } from './LoadingSpinner';

interface ChatMessageProps {
  message: Message;
  onFeedback: (
    messageId: string,
    feedback: { rating: 'up' | 'down' | null; comment?: string }
  ) => void;
  onRetry: (failedAssistantMessageId: string) => void;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

const Sources: React.FC<{ chunks?: GroundingChunk[] }> = ({ chunks }) => {
    if (!chunks || chunks.length === 0) return null;
    
    // Filter out potential non-web chunks if the type is expanded later
    const webChunks = chunks.filter(chunk => chunk.web);

    if (webChunks.length === 0) return null;

    return (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/50">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Kaynaklar</h4>
            <ol className="space-y-1.5">
                {webChunks.map((chunk, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-slate-400 dark:text-slate-500 text-xs font-medium mt-0.5">{index + 1}.</span>
                        <a 
                            href={chunk.web.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-indigo-600 hover:underline dark:text-indigo-400 group/link inline-flex items-center gap-1.5"
                            title={chunk.web.title}
                        >
                            <span className="truncate">{chunk.web.title || new URL(chunk.web.uri).hostname}</span>
                            <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                        </a>
                    </li>
                ))}
            </ol>
        </div>
    );
};


export const ChatMessage = memo(({
  message,
  onFeedback,
  onRetry,
  isFirstInGroup,
  isLastInGroup
}: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [copyText, setCopyText] = useState('');
  const contentIsImage = message.content?.startsWith('data:image/');

  useEffect(() => {
    if (copyText) {
        const timer = setTimeout(() => setCopyText(''), 2000);
        return () => clearTimeout(timer);
    }
  }, [copyText]);

  const handleCopy = () => {
      if (!message.content || contentIsImage) return;
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
  
  const thoughtProcess = message.thought;
  // Safer check: ensure thoughtProcess and its 'steps' property (which must be an array) exist.
  const hasThought = thoughtProcess && Array.isArray(thoughtProcess.steps) && thoughtProcess.steps.length > 0;
  

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
                message.role === 'assistant' && !message.generativeSuggestion && !message.isStreaming && !message.error && message.content && (
                     <Feedback
                      msg={message}
                      onUpdate={(feedbackData) => onFeedback(message.id, feedbackData)}
                    />
                )
            )}
        </div>
        
        {/* Bubble Content */}
        <div className={`group relative max-w-lg lg:max-w-2xl w-fit flex items-start ${!isUser && !contentIsImage ? 'border-l-4 border-indigo-500 pl-3' : ''}`}>
             <div className={`relative px-4 py-3 ${styles.bubble} ${styles.corners} shadow-sm`}>
                {hasThought && (
                    <ThinkingProcess
                      title={thoughtProcess.title}
                      steps={thoughtProcess.steps}
                      isThinking={message.isStreaming && !message.content}
                      error={message.error?.message || null}
                    />
                )}
                
                {message.role === 'assistant' && message.isStreaming && !message.content && !hasThought && (
                    <LoadingSpinner />
                )}

                {message.error && !hasThought && (
                    <div className="text-red-700 dark:text-red-300">
                        <p className="font-semibold">Bir Hata Oluştu</p>
                        <p className="text-sm mt-1">{message.error.message}</p>
                        <button
                            onClick={() => onRetry(message.id)}
                            className="mt-3 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            Tekrar Dene
                        </button>
                    </div>
                )}
                
                {message.imageUrl && (
                    <div className="mb-2">
                        <img src={message.imageUrl} alt="Kullanıcı tarafından yüklendi" className="max-w-xs rounded-lg border dark:border-slate-700" />
                    </div>
                )}

                {contentIsImage ? (
                    <div className="p-1">
                        <img src={message.content} alt="AI tarafından oluşturuldu" className="max-w-sm rounded-lg border dark:border-slate-700" />
                    </div>
                ) : (
                    message.content && (
                        <div className={isUser ? "dark [--tw-prose-invert-body:theme(colors.white)] [--tw-prose-invert-headings:theme(colors.white)] [--tw-prose-invert-bold:theme(colors.white)]" : ""}>
                            <MarkdownRenderer content={message.content} />
                        </div>
                    )
                )}
                 <Sources chunks={message.groundingMetadata} />
             </div>
        </div>
    </div>
  );
});
