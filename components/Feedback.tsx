import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface FeedbackProps {
    messageId: string;
    feedback?: {
        rating: 'up' | 'down' | null;
        comment?: string;
    };
    onUpdate: (feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => void;
}

export const Feedback: React.FC<FeedbackProps> = ({ messageId, feedback, onUpdate }) => {
    const [isCommenting, setIsCommenting] = useState(false);
    const [comment, setComment] = useState(feedback?.comment || '');

    useEffect(() => {
        setComment(feedback?.comment || '');
    }, [feedback?.comment]);
    
    const handleRating = (newRating: 'up' | 'down') => {
        const currentRating = feedback?.rating;
        const ratingToSend = currentRating === newRating ? null : newRating;
        onUpdate({ rating: ratingToSend, comment: feedback?.comment });
    };

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate({ rating: feedback?.rating || null, comment });
        setIsCommenting(false);
    };

    return (
        <div className="mt-2 flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <button 
                onClick={() => handleRating('up')} 
                className={`p-1.5 rounded-full transition-colors ${feedback?.rating === 'up' 
                    ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/50' 
                    : 'hover:bg-slate-300 dark:hover:bg-slate-600'}`} 
                title="İyi yanıt"
                aria-pressed={feedback?.rating === 'up'}
            >
                <ThumbsUp className="h-4 w-4" />
            </button>
            <button 
                onClick={() => handleRating('down')} 
                className={`p-1.5 rounded-full transition-colors ${feedback?.rating === 'down' 
                    ? 'text-red-600 bg-red-100 dark:bg-red-900/50' 
                    : 'hover:bg-slate-300 dark:hover:bg-slate-600'}`} 
                title="Kötü yanıt"
                aria-pressed={feedback?.rating === 'down'}
            >
                <ThumbsDown className="h-4 w-4" />
            </button>
            
            {!isCommenting && feedback?.rating && (
                 <button onClick={() => setIsCommenting(true)} className="px-2 py-1 text-xs rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                    {feedback?.comment ? 'Yorumu Düzenle' : 'Yorum Ekle'}
                </button>
            )}

            {isCommenting && (
                <form onSubmit={handleCommentSubmit} className="flex-1 flex items-center gap-2 animate-fade-in-up" style={{animationDuration: '0.2s'}}>
                    <input 
                        type="text" 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Ek geri bildirim..."
                        className="flex-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
                        autoFocus
                    />
                    <button type="submit" className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Kaydet</button>
                    <button type="button" onClick={() => { setIsCommenting(false); setComment(feedback?.comment || ''); }} className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">İptal</button>
                </form>
            )}
        </div>
    );
};