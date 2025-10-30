import React, { useState, useEffect } from 'react';
import type { Conversation } from '../types';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation | null;
    onUpdateShareSettings: (conversationId: string, updates: { is_shared: boolean }) => Promise<void>;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, conversation, onUpdateShareSettings }) => {
    const [isShared, setIsShared] = useState(conversation?.is_shared || false);
    const [isLoading, setIsLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');

    useEffect(() => {
        setIsShared(conversation?.is_shared || false);
    }, [conversation?.is_shared]);
    
    useEffect(() => {
        if (copySuccess) {
            const timer = setTimeout(() => setCopySuccess(''), 2000);
            return () => clearTimeout(timer);
        }
    }, [copySuccess]);

    if (!isOpen || !conversation) return null;
    
    const shareLink = `${window.location.origin}${window.location.pathname}?share=${conversation.share_id}`;

    const handleToggleSharing = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newIsShared = e.target.checked;
        setIsLoading(true);
        await onUpdateShareSettings(conversation.id, { is_shared: newIsShared });
        // The parent component will update the prop, which will trigger the useEffect
        setIsShared(newIsShared);
        setIsLoading(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareLink).then(() => {
            setCopySuccess('Link Kopyalandı!');
        }, () => {
            setCopySuccess('Kopyalama başarısız oldu.');
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-lg h-full max-h-[90vh] flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Analizi Paylaş</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="flex items-center justify-between">
                        <label htmlFor="share-toggle" className="font-semibold text-slate-700 dark:text-slate-300">
                            Link ile Paylaşım
                        </label>
                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input 
                                type="checkbox" 
                                name="share-toggle" 
                                id="share-toggle" 
                                checked={isShared}
                                onChange={handleToggleSharing}
                                disabled={isLoading}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            />
                            <label htmlFor="share-toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 dark:bg-slate-600 cursor-pointer"></label>
                        </div>
                         <style>{`
                            .toggle-checkbox:checked { right: 0; border-color: #4f46e5; }
                            .toggle-checkbox:checked + .toggle-label { background-color: #4f46e5; }
                        `}</style>
                    </div>
                     <p className="text-sm text-slate-500 dark:text-slate-400">
                        Bu ayar {isShared ? 'açıkken, linke sahip olan herkes bu analizi görüntüleyebilir.' : 'kapalıyken, sadece siz bu analizi görebilirsiniz.'}
                    </p>
                    
                    {isShared && conversation.share_id && (
                        <div className="pt-4 space-y-2 animate-fade-in-up" style={{animationDuration: '0.3s'}}>
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Paylaşılabilir Link</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    readOnly 
                                    value={shareLink} 
                                    className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none" 
                                />
                                <button
                                    onClick={handleCopy}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition w-32"
                                >
                                    {copySuccess || 'Linki Kopyala'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};