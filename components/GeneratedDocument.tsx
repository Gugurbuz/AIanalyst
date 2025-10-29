import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface GeneratedDocumentProps {
    content: string;
    onContentChange: (newContent: string) => void;
    placeholder?: string;
}

export const GeneratedDocument: React.FC<GeneratedDocumentProps> = ({ content, onContentChange, placeholder }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localContent, setLocalContent] = useState(content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // When the parent content changes (e.g., new doc generated),
    // update local state and switch back to view mode.
    useEffect(() => {
        setLocalContent(content);
        setIsEditing(false);
    }, [content]);
    
    const resizeTextarea = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, []);

    // Resize textarea when entering edit mode and when content changes
    useEffect(() => {
        if (isEditing) {
            resizeTextarea();
        }
    }, [isEditing, localContent, resizeTextarea]);


    const handleSave = () => {
        onContentChange(localContent);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setLocalContent(content); // Revert changes
        setIsEditing(false);
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalContent(e.target.value);
    };

    if (isEditing) {
        return (
            <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg">
                <textarea
                    ref={textareaRef}
                    value={localContent}
                    onChange={handleChange}
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md font-sans text-sm leading-relaxed focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none overflow-hidden transition-colors duration-200"
                    rows={10}
                />
                <div className="mt-4 flex items-center justify-end gap-3">
                     <button 
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition"
                    >
                        İptal
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition"
                    >
                        Değişiklikleri Kaydet
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative group">
            <div className="p-4 md:p-6 prose prose-slate dark:prose-invert max-w-none prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-700 prose-h3:mt-5 prose-h3:mb-2 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2">
                {(!content && placeholder) ? (
                    <p className="text-slate-400 dark:text-slate-500 italic">{placeholder}</p>
                ) : (
                    <MarkdownRenderer content={content} />
                )}
            </div>
            {content && (
                 <button 
                    onClick={() => setIsEditing(true)}
                    className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                    </svg>
                    Düzenle
                </button>
            )}
        </div>
    );
};