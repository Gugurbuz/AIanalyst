
import React, { useMemo, useState } from 'react';
import { Conversation } from '../../types';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
    conversations: Conversation[];
    searchTerm: string;
    activeConversationId: string | null;
    updateConversationTitle: (id: string, title: string) => void;
    deleteConversation: (id: string) => void;
    setActiveConversationId: (id: string) => void;
    setConfirmation: (confirmation: any) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
    conversations, searchTerm, activeConversationId, updateConversationTitle, deleteConversation, setActiveConversationId, setConfirmation
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);

    const filteredConversations = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return conversations;
        return conversations.filter(c => {
            const titleMatch = c.title.toLowerCase().includes(term);
            if (titleMatch) return true;
            const messageMatch = c.messages?.some(m => m.content && typeof m.content === 'string' && m.content.toLowerCase().includes(term));
            return messageMatch;
        });
    }, [conversations, searchTerm]);

    const handleEditStart = (conv: Conversation) => {
        setMenuOpenForId(null);
        setEditingId(conv.id);
        setEditingTitle(conv.title);
    };

    const handleEditSave = () => {
        if (editingId && editingTitle.trim()) {
            updateConversationTitle(editingId, editingTitle.trim());
        }
        setEditingId(null);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setMenuOpenForId(null);
        setConfirmation({
            title: "Analizi Sil",
            message: "Bu analizi ve tüm içeriğini kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.",
            onConfirm: () => deleteConversation(id),
        });
    };

    return (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredConversations.map(conv => (
                <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConversationId}
                    editingId={editingId}
                    editingTitle={editingTitle}
                    setEditingTitle={setEditingTitle}
                    handleEditSave={handleEditSave}
                    handleEditStart={handleEditStart}
                    handleDelete={handleDelete}
                    setActiveConversationId={setActiveConversationId}
                    menuOpenForId={menuOpenForId}
                    setMenuOpenForId={setMenuOpenForId}
                />
            ))}
        </div>
    );
};
