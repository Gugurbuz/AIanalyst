import React, { useState, useEffect } from 'react';

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
                className={`p-1 rounded-full transition-colors ${feedback?.rating === 'up' 
                    ? 'text-sky-600 bg-sky-100 dark:bg-sky-900/50' 
                    : 'hover:bg-slate-300 dark:hover:bg-slate-600'}`} 
                title="İyi yanıt"
                aria-pressed={feedback?.rating === 'up'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333V17a1 1 0 001 1h6.758a1 1 0 00.97-1.22l-1.95-6.147a1 1 0 00-.97-.78h-3.51V6.5a1 1 0 00-2 0v3.833z" />
                </svg>
            </button>
            <button 
                onClick={() => handleRating('down')} 
                className={`p-1 rounded-full transition-colors ${feedback?.rating === 'down' 
                    ? 'text-red-600 bg-red-100 dark:bg-red-900/50' 
                    : 'hover:bg-slate-300 dark:hover:bg-slate-600'}`} 
                title="Kötü yanıt"
                aria-pressed={feedback?.rating === 'down'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                     <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667V3a1 1 0 00-1-1H6.242a1 1 0 00-.97 1.22l1.95 6.147a1 1 0 00.97.78h3.51v3.5a1 1 0 002 0v-3.833z" />
                </svg>
            </button>
            
            {!isCommenting && (
                <button onClick={() => setIsCommenting(true)} className="text-xs hover:underline">
                    {feedback?.comment ? 'Geri bildirimi düzenle' : 'Geri bildirim ekle'}
                </button>
            )}

            {isCommenting && (
                <form onSubmit={handleCommentSubmit} className="flex-1 flex items-center gap-2">
                    <input 
                        type="text" 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Ek geri bildirim (isteğe bağlı)..."
                        className="flex-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors"
                    />
                    <button type="submit" className="px-2 py-1 text-xs bg-sky-600 text-white rounded-md hover:bg-sky-700">Kaydet</button>
                    <button type="button" onClick={() => { setIsCommenting(false); setComment(feedback?.comment || ''); }} className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">İptal</button>
                </form>
            )}
        </div>
    );
};
