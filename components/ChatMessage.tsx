

// components/ChatMessage.tsx
import React from 'react';
import type { Message, User } from '../types';
import { Feedback } from './Feedback';
import { ExpertRunChecklist } from './ExpertRunChecklist';
import { Bot, Edit } from 'lucide-react';

interface ChatMessageProps {
    msg: Message;
    user: User;
    onFeedbackUpdate: (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
    isEditable: boolean;
    onEdit: () => void;
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

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ msg, user, onFeedbackUpdate, isEditable, onEdit }) => {
    const userInitial = user?.email?.[0]?.toUpperCase() || 'U';

    return (
        <div className={`group flex items-start gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <AssistantAvatar />}
            
            {msg.role === 'user' && isEditable && (
                <div className="self-center flex-shrink-0">
                    <button
                        onClick={onEdit}
                        className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Düzenle ve Yeniden Gönder"
                    >
                        <Edit className="h-4 w-4" />
                    </button>
                </div>
            )}

            <div className={`flex flex-col max-w-xl lg:max-w-2xl ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl shadow-sm ${
                    msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                }`}>
                    {msg.expertRunChecklist ? (
                        <ExpertRunChecklist
                            steps={msg.expertRunChecklist}
                            initialMessage={msg.content}
                        />
                    ) : (
                        <div className="px-4 py-3 whitespace-pre-wrap">{msg.content}</div>
                    )}
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
    );
};

// Memoize the component to prevent re-renders if props haven't changed.
export const ChatMessage = React.memo(ChatMessageComponent);