// components/Feedback.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, Copy, MoreVertical, Check, X } from 'lucide-react';
import type { Message } from '../types';

interface FeedbackProps {
    msg: Message;
    onUpdate: (feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
}

const FeedbackPopover: React.FC<{
    onClose: () => void;
    onSubmit: (comment: string) => void;
}> = ({ onClose, onSubmit }) => {
    const [text, setText] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);
    const quickFeedbackOptions = ["Hatalı Bilgi", "Eksik Analiz", "Format Kötü", "Alakasız Yanıt"];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleQuickSelect = (option: string) => {
        onSubmit(option);
    };

    const handleSubmitForm = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim()) {
            onSubmit(text);
        }
    };

    return (
        <div ref={popoverRef} className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-slate-800 p-3 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 z-10 animate-fade-in-up" style={{ animationDuration: '0.1s' }}>
            <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Geri bildiriminiz nedir?</p>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
                {quickFeedbackOptions.map(option => (
                    <button key={option} onClick={() => handleQuickSelect(option)} className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600">{option}</button>
                ))}
            </div>
            <form onSubmit={handleSubmitForm}>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Ek yorumunuz (isteğe bağlı)..."
                    className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 resize-none"
                    rows={2}
                    autoFocus
                />
                <div className="flex justify-end mt-2">
                    <button type="submit" disabled={!text.trim()} className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50">Gönder</button>
                </div>
            </form>
        </div>
    );
};

export const Feedback: React.FC<FeedbackProps> = ({ msg, onUpdate }) => {
    const [copyText, setCopyText] = useState('');
    const [rating, setRating] = useState<'up' | 'down' | null>(null);
    const [showFeedbackPopover, setShowFeedbackPopover] = useState(false);

    useEffect(() => {
        setRating(msg.feedback?.rating || null);
    }, [msg.feedback]);

    useEffect(() => {
        if (copyText) {
            const timer = setTimeout(() => setCopyText(''), 2000);
            return () => clearTimeout(timer);
        }
    }, [copyText]);

    const handleCopy = () => {
        if (!msg.content) return;
        navigator.clipboard.writeText(msg.content).then(() => {
            setCopyText('Kopyalandı!');
        }).catch(err => {
            console.error('Could not copy text: ', err);
            setCopyText('Hata');
        });
    };

    const handleUpVote = () => {
        const newRating = rating === 'up' ? null : 'up';
        setRating(newRating);
        onUpdate({ rating: newRating, comment: newRating === null ? undefined : msg.feedback?.comment });
        setShowFeedbackPopover(false);
    };

    const handleDownVote = () => {
        if (rating === 'down') {
            setRating(null);
            onUpdate({ rating: null, comment: undefined });
            setShowFeedbackPopover(false);
        } else {
            setRating('down'); // Visually activate button
            setShowFeedbackPopover(true);
        }
    };

    const handleFeedbackSubmit = (comment: string) => {
        onUpdate({ rating: 'down', comment });
        setShowFeedbackPopover(false);
    };

    const handlePopoverClose = () => {
        setShowFeedbackPopover(false);
        if (rating === 'down' && !msg.feedback?.comment) {
            setRating(null);
        }
    };

    return (
        <div className="relative">
            <div className="flex flex-col items-center gap-1 bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm p-1 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                <button
                    onClick={handleUpVote}
                    className={`p-1.5 rounded-md transition-colors ${rating === 'up' ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    title="Beğendim"
                >
                    <ThumbsUp className="h-4 w-4" />
                </button>
                <button
                    onClick={handleDownVote}
                    className={`p-1.5 rounded-md transition-colors ${rating === 'down' ? 'text-red-600 bg-red-100 dark:bg-red-900/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    title="Beğenmedim"
                >
                    <ThumbsDown className="h-4 w-4" />
                </button>
                <div className="w-full h-px bg-slate-200 dark:bg-slate-600 my-1" />
                <button 
                    onClick={handleCopy} 
                    className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-600"
                    title="Mesajı kopyala"
                >
                    {copyText ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
                 <button
                    className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-600"
                    title="Diğer seçenekler"
                >
                     <MoreVertical className="h-4 w-4" />
                </button>
            </div>

            {showFeedbackPopover && (
                <FeedbackPopover
                    onClose={handlePopoverClose}
                    onSubmit={handleFeedbackSubmit}
                />
            )}
        </div>
    );
};