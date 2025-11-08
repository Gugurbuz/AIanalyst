import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Conversation } from '../types';
import { X, Pencil, MoreVertical, Trash2, Plus } from 'lucide-react';

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
            conv && (conv.title || '').toLowerCase().includes(searchTerm.toLowerCase())
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

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setMenuOpenForId(null);
        onDeleteConversation(id);
    };

    return (
        <aside ref={sidebarRef} className="bg-slate-50 dark:bg-slate-800 flex flex-col flex-shrink-0 h-full w-full">
            <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 h-16 flex-shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 truncate">Sohbetler</h2>
                    <button onClick={() => setIsOpen(false)} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none md:hidden" aria-label="Kenar çubuğunu kapat">
                       <X className="h-6 w-6 text-slate-600 dark:text-slate-400" />
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
                            {searchTerm ? 'Sonuç bulunamadı.' : 'Aktif sohbetiniz bulunmuyor.'}
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
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); setMenuOpenForId(conv.id === menuOpenForId ? null : conv.id); }}
                                            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600"
                                            title="Diğer seçenekler"
                                            aria-haspopup="true"
                                            aria-expanded={menuOpenForId === conv.id}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {menuOpenForId === conv.id && (
                                        <div ref={menuRef} className="absolute right-2 top-10 w-40 bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-30 animate-fade-in-up" style={{animationDuration: '0.1s'}}>
                                            <button onClick={(e) => handleDelete(e, conv.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2" role="menuitem">
                                                <Trash2 className="h-4 w-4" />
                                                <span>Sil</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
};