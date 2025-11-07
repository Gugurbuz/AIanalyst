// components/AnalysisDocumentViewer.tsx
import React from 'react';
import '@blocknote/core/style.css';
import { BlockNoteView, useBlockNote } from "@blocknote/react";
import type { Block } from '@blocknote/core';

interface AnalysisDocumentViewerProps {
    initialContent: Block[];
    isEditable: boolean;
    onChange?: (blocks: Block[]) => void;
}

export const AnalysisDocumentViewer: React.FC<AnalysisDocumentViewerProps> = ({ initialContent, isEditable, onChange }) => {
    
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