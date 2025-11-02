import React, { useState, useEffect } from 'react';
import { Clipboard } from 'lucide-react';
import type { Message } from '../types';

interface FeedbackProps {
    msg: Message;
    onUpdate: (feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
}

export const Feedback: React.FC<FeedbackProps> = ({ msg, onUpdate }) => {
    const [copyText, setCopyText] = useState('');

    useEffect(() => {
        if (copyText) {
            const timer = setTimeout(() => {
                setCopyText('');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [copyText]);

    const handleCopy = () => {
        if (!msg.content) return;
        navigator.clipboard.writeText(msg.content)
            .then(() => {
                setCopyText('Kopyalandı!');
            })
            .catch(err => {
                console.error('Could not copy text: ', err);
                setCopyText('Hata');
            });
    };

    return (
        <div className="mt-2 flex items-center gap-2 text-slate-500 dark:text-slate-400 h-8">
            {copyText ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-fade-in-up">{copyText}</span>
            ) : (
                <>
                    <button 
                        onClick={handleCopy} 
                        className="p-1.5 rounded-full transition-colors hover:bg-slate-300 dark:hover:bg-slate-600"
                        title="Mesajı kopyala"
                    >
                        <Clipboard className="h-4 w-4" />
                    </button>
                    <button
                        className="p-1.5 rounded-full transition-colors hover:bg-slate-300 dark:hover:bg-slate-600"
                        title="Diğer seçenekler"
                    >
                         <div className="w-4 h-4 flex items-center justify-center">
                            <div className="w-1 h-1 bg-current rounded-full"></div>
                        </div>
                    </button>
                </>
            )}
        </div>
    );
};