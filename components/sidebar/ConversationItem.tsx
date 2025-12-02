
import React, { useRef, useState, useEffect } from 'react';
import { Conversation } from '../../types';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface ConversationItemProps {
    conv: Conversation;
    isActive: boolean;
    editingId: string | null;
    editingTitle: string;
    setEditingTitle: (title: string) => void;
    handleEditSave: () => void;
    handleEditStart: (conv: Conversation) => void;
    handleDelete: (e: React.MouseEvent, id: string) => void;
    setActiveConversationId: (id: string) => void;
    menuOpenForId: string | null;
    setMenuOpenForId: (id: string | null) => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
    conv, isActive, editingId, editingTitle, setEditingTitle, handleEditSave, handleEditStart, handleDelete, setActiveConversationId, menuOpenForId, setMenuOpenForId
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editingId === conv.id && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId, conv.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpenForId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setMenuOpenForId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleEditSave();
    };

    return (
        <div className="relative group">
            {editingId === conv.id ? (
                <input ref={inputRef} type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onBlur={handleEditSave} onKeyDown={handleKeyDown} className="w-full text-left px-3 py-2.5 rounded-md text-sm bg-white dark:bg-slate-900 border border-indigo-500 ring-1 ring-indigo-500 focus:outline-none" />
            ) : (
                <>
                    <button onClick={() => setActiveConversationId(conv.id)} className={`w-full text-left pl-3 pr-16 py-2.5 rounded-md text-sm truncate transition-colors duration-150 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`} title={conv.title}>
                        {conv.title}
                    </button>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpenForId(conv.id === menuOpenForId ? null : conv.id); }} className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600" title="Diğer seçenekler"><MoreVertical className="h-4 w-4" /></button>
                    </div>
                    {menuOpenForId === conv.id && (
                        <div ref={menuRef} className="absolute right-2 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-30 animate-fade-in-up" style={{animationDuration: '0.1s'}}>
                            <button onClick={() => handleEditStart(conv)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"><Pencil className="h-4 w-4" /><span>Yeniden Adlandır</span></button>
                            <button onClick={(e) => handleDelete(e, conv.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"><Trash2 className="h-4 w-4" /><span>Sil</span></button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
