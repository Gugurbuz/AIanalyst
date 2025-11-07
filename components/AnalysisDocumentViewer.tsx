// components/AnalysisDocumentViewer.tsx
import React from 'react';
import '@blocknote/core/style.css';
import { BlockNoteView, useBlockNote } from "@blocknote/react";
import type { Block } from '@blocknote/core';

interface AnalysisDocumentViewerProps {
    initialContent: Block[] | null;
    isEditable: boolean;
    onChange?: (blocks: Block[]) => void;
}

export const AnalysisDocumentViewer: React.FC<AnalysisDocumentViewerProps> = ({ initialContent, isEditable, onChange }) => {
    
    // GÜVENLİK KONTROLÜ: Editörün null içerikle çökmesini önle.
    // Bu kontrol, henüz bir analiz dokümanı olmayan sohbetler yüklendiğinde
    // uygulamanın "Failed to load" hatası vermesini engeller.
    if (!initialContent) {
        return (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                Analiz dokümanı yükleniyor veya henüz oluşturulmadı...
            </div>
        );
    }

    const editor = useBlockNote({
        initialContent: initialContent,
        editable: isEditable,
        onEditorContentChange: (editor) => {
            if (onChange) {
                onChange(editor.topLevelBlocks);
            }
        },
    });

    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

    return (
        <div className="h-full overflow-y-auto">
            <BlockNoteView editor={editor} theme={theme} />
        </div>
    );
};