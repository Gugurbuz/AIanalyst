// components/ChatMessage.tsx
import React from 'react';
import type { Message, User, GenerativeSuggestion } from '../types';
import { Feedback } from './Feedback';
import { ExpertRunChecklist } from './ExpertRunChecklist';
import { Bot, Edit, Sparkles, Check, X } from 'lucide-react';

interface ChatMessageProps {
    msg: Message;
    user: User;
    onFeedbackUpdate: (messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
    isEditable: boolean;
    onEdit: () => void;
    onApplySuggestion?: (suggestion: GenerativeSuggestion, messageId: string) => void;
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

const GenerativeSuggestionCard: React.FC<{ suggestion: GenerativeSuggestion, onApply: () => void, onReject: () => void }> = ({ suggestion, onApply, onReject }) => {
    return (
        <div className="p-4 space-y-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                {suggestion.title}
            </h4>
            <ul className="space-y-2 border-t border-slate-300 dark:border-slate-600 pt-3">
                {suggestion.suggestions.map((s, index) => (
                    <li key={index} className="text-sm p-2 bg-slate-100 dark:bg-slate-800/50 rounded-md">{s}</li>
                ))}
            </ul>
            <div className="flex justify-end gap-2 pt-2">
                <button 
                    onClick={onReject}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-300 dark:bg-slate-600 rounded-md hover:bg-slate-400 dark:hover:bg-slate-500 flex items-center gap-1.5"
                >
                    <X className="h-4 w-4" /> Reddet
                </button>
                 <button 
                    onClick={onApply}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 flex items-center gap-1.5"
                >
                    <Check className="h-4 w-4" /> Değişiklikleri Uygula
                </button>
            </div>
        </div>
    );
};


const ChatMessageComponent: React.FC<ChatMessageProps> = ({ msg, user, onFeedbackUpdate, isEditable, onEdit, onApplySuggestion }) => {
    const userInitial = user?.email?.[0]?.toUpperCase() || 'U';

    const handleApply = () => {
        if (msg.generativeSuggestion && onApplySuggestion) {
            onApplySuggestion(msg.generativeSuggestion, msg.id);
        }
    };
    
    // For now, reject just hides the card (a more complex implementation could send feedback to the model)
    // We'll achieve this by setting the suggestion to null on the message object in the parent state.
    const handleReject = () => {
        // This is a placeholder for potential future logic.
        // The card will be removed once the next message comes in.
        // A more robust solution would involve updating the message state to remove the suggestion.
    };

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
                    ) : msg.generativeSuggestion ? (
                        <GenerativeSuggestionCard 
                            suggestion={msg.generativeSuggestion}
                            onApply={handleApply}
                            onReject={handleReject}
                        />
                    ) : (
                        <div className="px-4 py-3 whitespace-pre-wrap">{msg.content}</div>
                    )}
                </div>
                {msg.role === 'assistant' && !msg.generativeSuggestion && (
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