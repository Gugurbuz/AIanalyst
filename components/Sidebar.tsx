import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Conversation } from '../types';

interface SidebarProps {
    conversations: Conversation[];
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onNewConversation: () => void;
    onUpdateConversationTitle: (id: string, newTitle: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ conversations, activeConversationId, onSelectConversation, onNewConversation, onUpdateConversationTitle, isOpen, setIsOpen }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus and select text when edit mode begins
    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    const filteredConversations = useMemo(() => {
        if (!searchTerm.trim()) {
            return conversations;
        }
        return conversations.filter(conv =>
            conv.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [conversations, searchTerm]);

    const handleEditStart = (conv: Conversation) => {
        setEditingId(conv.id);
        setEditingTitle(conv.title);
    };

    const handleEditSave = () => {
        if (editingId) {
            const newTitle = editingTitle.trim();
            if (newTitle) {
                onUpdateConversationTitle(editingId, newTitle);
            }
        }
        setEditingId(null); // Exit edit mode
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleEditSave();
        } else if (e.key === 'Escape') {
            setEditingId(null); // Cancel edit
        }
    };
    
    const handleSelect = (convId: string) => {
        onSelectConversation(convId);
        if (window.innerWidth < 768) {
            setIsOpen(false);
        }
    };


    return (
        <aside className={`transition-all duration-300 ease-in-out bg-slate-50 dark:bg-slate-800 border-r dark:border-slate-700 flex flex-col flex-shrink-0 h-screen ${isOpen ? 'w-72' : 'w-0'}`}>
            <div className={`flex flex-col flex-1 overflow-hidden ${!isOpen && 'hidden'}`}>
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 h-16 flex-shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 truncate">Geçmiş Analizler</h2>
                    <button onClick={() => setIsOpen(false)} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                </div>

                <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                    <input
                        type="text"
                        placeholder="Başlıkta ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                    />
                </div>
                
                <div className="flex-grow overflow-y-auto p-2 space-y-1">
                    {filteredConversations.length === 0 ? (
                         <div className="text-center text-slate-500 dark:text-slate-400 text-sm p-4">
                            {searchTerm ? 'Sonuç bulunamadı.' : 'Geçmiş analiziniz bulunmuyor.'}
                         </div>
                    ) : filteredConversations.map((conv) => (
                        <div key={conv.id} className="relative group">
                            {editingId === conv.id ? (
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onBlur={handleEditSave}
                                    onKeyDown={handleKeyDown}
                                    className="w-full text-left px-3 py-2.5 rounded-md text-sm bg-white dark:bg-slate-900 border border-sky-500 ring-1 ring-sky-500 focus:outline-none"
                                />
                            ) : (
                                <>
                                    <button
                                        onClick={() => handleSelect(conv.id)}
                                        className={`w-full text-left pl-3 pr-8 py-2.5 rounded-md text-sm truncate transition-colors duration-150 ${
                                            conv.id === activeConversationId
                                                ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-200 font-semibold'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                        title={conv.title}
                                    >
                                        {conv.title}
                                    </button>
                                     <button 
                                        onClick={() => handleEditStart(conv)}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-slate-300 dark:hover:bg-slate-600 transition-opacity"
                                        title="Başlığı düzenle"
                                     >
                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                        </svg>
                                     </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <button onClick={onNewConversation} className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-sky-600 rounded-lg shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        <span>Yeni Analiz</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};