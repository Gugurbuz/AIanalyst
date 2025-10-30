import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Conversation } from '../types';

interface SidebarProps {
    conversations: Conversation[];
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onNewConversation: () => void;
    onUpdateConversationTitle: (id: string, title: string) => void;
    onDeleteConversation: (id: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ conversations, activeConversationId, onSelectConversation, onNewConversation, onUpdateConversationTitle, onDeleteConversation, isOpen, setIsOpen }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);

    // Focus and select text when edit mode begins
    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);
    
    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpenForId(null);
            }
            // Close sidebar if clicking outside of it on mobile
            if (isOpen && window.innerWidth < 768 && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, setIsOpen]);


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
        if (window.innerWidth < 768) { // Close sidebar on mobile after selecting conversation
            setIsOpen(false);
        }
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setMenuOpenForId(null);
        onDeleteConversation(id);
    };

    return (
        <>
            {/* Backdrop for mobile sidebar */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsOpen(false)} aria-hidden="true"></div>
            )}
            <aside ref={sidebarRef} className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-50 dark:bg-slate-800 border-r dark:border-slate-700 flex flex-col flex-shrink-0 h-screen transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 h-16 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <svg width="24" height="24" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                <path fill="currentColor" className="text-indigo-600 dark:text-indigo-500" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
                                <circle fill="currentColor" className="text-indigo-300 dark:text-indigo-400" cx="50" cy="58" r="10"/>
                            </svg>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 truncate">Sohbetler</h2>
                        </div>
                        {/* Close button for mobile sidebar */}
                        <button onClick={() => setIsOpen(false)} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none md:hidden" aria-label="Kenar çubuğunu kapat">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                        <input
                            type="text"
                            placeholder="Başlıkta ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                            aria-label="Sohbet başlığında ara"
                        />
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-2 space-y-1">
                        {filteredConversations.length === 0 ? (
                             <div className="text-center text-slate-500 dark:text-slate-400 text-sm p-4">
                                {searchTerm 
                                    ? 'Sonuç bulunamadı.' 
                                    : 'Aktif sohbetiniz bulunmuyor.'
                                }
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
                                        className="w-full text-left px-3 py-2.5 rounded-md text-sm bg-white dark:bg-slate-900 border border-indigo-500 ring-1 ring-indigo-500 focus:outline-none"
                                        aria-label={`Sohbet başlığını düzenle: ${conv.title}`}
                                    />
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleSelect(conv.id)}
                                            className={`w-full text-left pl-3 pr-16 py-2.5 rounded-md text-sm truncate transition-colors duration-150 ${
                                                conv.id === activeConversationId
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-semibold'
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                            title={conv.title}
                                            aria-current={conv.id === activeConversationId ? 'page' : undefined}
                                        >
                                            {conv.title}
                                        </button>
                                         <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditStart(conv) }}
                                                className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600"
                                                title="Başlığı düzenle"
                                                aria-label={`Başlığı düzenle: ${conv.title}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); setMenuOpenForId(conv.id === menuOpenForId ? null : conv.id); }}
                                                className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600"
                                                title="Diğer seçenekler"
                                                aria-haspopup="true"
                                                aria-expanded={menuOpenForId === conv.id}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                            </button>
                                        </div>
                                        {menuOpenForId === conv.id && (
                                            <div ref={menuRef} className="absolute right-2 top-10 w-40 bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-30 animate-fade-in-up" style={{animationDuration: '0.1s'}}>
                                                <button onClick={(e) => handleDelete(e, conv.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2" role="menuitem">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    <span>Sil</span>
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <button onClick={onNewConversation} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Yeni Analiz Başlat
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};