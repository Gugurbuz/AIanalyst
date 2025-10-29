import React, { useRef, useEffect } from 'react';
import type { Message } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { Feedback } from './Feedback';

interface ChatMessageHistoryProps {
    chatHistory: Message[];
    isLoading: boolean;
    onFeedbackUpdate: (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
}

export const ChatMessageHistory: React.FC<ChatMessageHistoryProps> = ({ chatHistory, isLoading, onFeedbackUpdate }) => {
    const chatEndRef = useRef<HTMLDivElement>(null);
    const visibleMessages = chatHistory.filter(msg => msg.role !== 'system');

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    return (
        <div className="w-full space-y-4 py-4">
            {visibleMessages.map((msg, index) => (
                <div key={msg.id || index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                         <div className={`max-w-xl lg:max-w-2xl px-4 py-3 rounded-2xl shadow-sm whitespace-pre-wrap ${
                            msg.role === 'user' 
                                ? 'bg-sky-600 text-white rounded-br-none' 
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                        }`}>
                            {msg.content}
                        </div>
                    </div>
                     {msg.role === 'assistant' && (
                        <div className="max-w-xl lg:max-w-2xl w-full">
                             <Feedback 
                                messageId={msg.id}
                                feedback={msg.feedback}
                                onUpdate={(feedbackData) => onFeedbackUpdate(msg.id, feedbackData)}
                            />
                        </div>
                    )}
                </div>
            ))}
            {isLoading && visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1].role === 'user' && (
                <div className="flex justify-start">
                    <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl p-4 shadow-sm rounded-bl-none">
                       <LoadingSpinner />
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>
    );
};
