import React, { useRef, useEffect } from 'react';
import type { Message, User } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { Feedback } from './Feedback';
import { Bot, User as UserIcon } from 'lucide-react';

interface ChatMessageHistoryProps {
    user: User;
    chatHistory: Message[];
    isLoading: boolean;
    onFeedbackUpdate: (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
}

const AssistantAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
        <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
    </div>
);

const UserAvatar: React.FC<{ initial: string }> = ({ initial }) => (
    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
        {initial}
    </div>
);


export const ChatMessageHistory: React.FC<ChatMessageHistoryProps> = ({ user, chatHistory, isLoading, onFeedbackUpdate }) => {
    const chatEndRef = useRef<HTMLDivElement>(null);
    const visibleMessages = chatHistory.filter(msg => msg.role !== 'system');
    const userInitial = user.email ? user.email[0].toUpperCase() : 'U';

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory, isLoading]);

    return (
        <div className="w-full space-y-6 py-4">
            {visibleMessages.map((msg) => (
                 <div key={msg.id} className={`flex items-start gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && <AssistantAvatar />}
                    
                    <div className={`flex flex-col max-w-xl lg:max-w-2xl ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-3 rounded-2xl shadow-sm whitespace-pre-wrap ${
                            msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                        }`}>
                            {msg.content}
                        </div>
                        {msg.role === 'assistant' && (
                             <Feedback 
                                messageId={msg.id}
                                feedback={msg.feedback}
                                onUpdate={(feedbackData) => onFeedbackUpdate(msg.id, feedbackData)}
                            />
                        )}
                    </div>

                    {msg.role === 'user' && <UserAvatar initial={userInitial} />}
                </div>
            ))}
            {isLoading && (
                <div className="flex items-start gap-3.5 justify-start">
                    <AssistantAvatar />
                    <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl p-4 shadow-sm rounded-bl-none">
                       <LoadingSpinner />
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>
    );
};