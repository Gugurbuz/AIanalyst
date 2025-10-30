import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

// A simple hook to get the previous value of a prop or state.
const usePrevious = <T,>(value: T): T | undefined => {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
};


interface GeneratedDocumentProps {
    content: string;
    onContentChange: (newContent: string) => void;
    docKey: 'analysisDoc' | 'testScenarios';
    onModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => void;
    inlineModificationState: { docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null;
    isGenerating: boolean;
    placeholder?: string;
}

const MagicAssistantPopover: React.FC<{
    selectedText: string;
    position: { top: number, left: number };
    onGenerate: (prompt: string) => void;
    onClose: () => void;
    isLoading: boolean;
}> = ({ selectedText, position, onGenerate, onClose, isLoading }) => {
    const [prompt, setPrompt] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleGenerateClick = () => {
        if (prompt.trim()) {
            onGenerate(prompt);
        }
    };

    return (
        <div
            ref={popoverRef}
            className="absolute z-20 flex flex-col gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-80 animate-fade-in-up"
            style={{ top: `${position.top}px`, left: `${position.left}px`, transform: 'translate(-50%, -100%)', marginTop: '-10px' }}
        >
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 pb-2">Seçili Metin:</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-h-20 overflow-y-auto bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md">
                "{selectedText}"
            </p>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ne yapmak istersiniz? (Örn: 'daha resmi yap', 'bir madde ekle' vb.)"
                className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 resize-none"
                rows={2}
            />
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-600 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">İptal</button>
                <button 
                    onClick={handleGenerateClick} 
                    disabled={isLoading || !prompt.trim()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none disabled:opacity-50 flex items-center justify-center w-24"
                >
                    {isLoading ? (
                         <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : 'Uygula'}
                </button>
            </div>
        </div>
    );
};

export const GeneratedDocument: React.FC<GeneratedDocumentProps> = ({ content, onContentChange, docKey, onModifySelection, inlineModificationState, isGenerating, placeholder }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localContent, setLocalContent] = useState(content);
    const [selectionState, setSelectionState] = useState<{ text: string, position: { top: number, left: number } } | null>(null);
    const [isAssistantPopoverOpen, setIsAssistantPopoverOpen] = useState(false);
    
    const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevContent = usePrevious(content);

    // --- Diffing and Highlighting Logic ---
    useEffect(() => {
        if (prevContent && content !== prevContent) {
            const oldLines = prevContent.split('\n');
            const newLines = content.split('\n');
            const changedLineNumbers: number[] = [];

            // Simple line-by-line diff
            for (let i = 0; i < newLines.length; i++) {
                if (i >= oldLines.length || newLines[i] !== oldLines[i]) {
                    changedLineNumbers.push(i);
                }
            }
            
            if (changedLineNumbers.length > 0) {
                setHighlightedLines(changedLineNumbers);

                // Auto-scroll to the first change
                setTimeout(() => {
                    const firstHighlight = containerRef.current?.querySelector('.highlight-new');
                    if (firstHighlight) {
                        firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100); // Delay to allow rendering

                // Clear highlights after animation
                const timer = setTimeout(() => {
                    setHighlightedLines([]);
                }, 3100); // A bit longer than the animation duration
                
                return () => clearTimeout(timer);
            }
        }
    }, [content, prevContent]);


    // When the parent content changes, update local state and switch back to view mode.
    useEffect(() => {
        setLocalContent(content);
        setIsEditing(false);
        // Clear selection when content from parent changes to avoid stale highlights
        setSelectionState(null);
        setIsAssistantPopoverOpen(false);
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
    
    const handleMouseUp = () => {
        // Debounce or delay to prevent race conditions with click events
        setTimeout(() => {
            // Don't show assistant if busy, editing, or if a popover is already open
            if (isGenerating || inlineModificationState || isEditing || isAssistantPopoverOpen) return;

            const selection = window.getSelection();
            const text = selection?.toString().trim() ?? '';

            if (text.length > 10) {
                const range = selection!.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const containerRect = containerRef.current?.getBoundingClientRect();

                if (containerRect) {
                    setSelectionState({
                        text: text,
                        position: {
                            top: rect.top - containerRect.top + containerRef.current.scrollTop,
                            left: rect.left - containerRect.left + rect.width / 2,
                        }
                    });
                }
            } else {
                setSelectionState(null);
            }
        }, 10);
    };
    
    const closeAndClearSelection = useCallback(() => {
        setIsAssistantPopoverOpen(false);
        setSelectionState(null);
        // This is a bit of a workaround to ensure the browser selection is cleared
        // after our custom highlight is removed, preventing a "flash" of the native selection.
        if (window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
    }, []);
    
    const handleAssistantGenerate = (userPrompt: string) => {
        if (selectionState) {
            onModifySelection(selectionState.text, userPrompt, docKey);
            // The selection state is now cleared inside closeAndClearSelection,
            // but we need to call it after the modification starts.
            // The `rephrasingState` will take over the highlighting.
            closeAndClearSelection();
        }
    }
    
    const isCurrentlyModifying = inlineModificationState?.docKey === docKey && inlineModificationState.originalText === selectionState?.text;
    const rephrasingTextForRenderer = inlineModificationState?.docKey === docKey ? inlineModificationState.originalText : null;

    if (isEditing) {
        return (
            <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg">
                <textarea
                    ref={textareaRef}
                    value={localContent}
                    onChange={handleChange}
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md font-sans text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none overflow-hidden transition-colors duration-200"
                    rows={10}
                />
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-end gap-3">
                     <button 
                        onClick={handleCancel}
                        className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition"
                    >
                        İptal
                    </button>
                    <button 
                        onClick={handleSave}
                        className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition"
                    >
                        Değişiklikleri Kaydet
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative group" ref={containerRef}>
            <div onMouseUp={handleMouseUp} className="p-4 md:p-6">
                {(!content && placeholder) ? (
                    <p className="text-slate-400 dark:text-slate-500 italic">{placeholder}</p>
                ) : (
                    <MarkdownRenderer 
                        content={content} 
                        highlightedLines={highlightedLines}
                        rephrasingText={rephrasingTextForRenderer}
                        highlightedUserSelectionText={selectionState?.text ?? null}
                    />
                )}
            </div>
            {content && (
                 <button 
                    onClick={() => setIsEditing(true)}
                    disabled={isGenerating || !!inlineModificationState}
                    className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="odd" />
                    </svg>
                    Düzenle
                </button>
            )}
            {selectionState && !isAssistantPopoverOpen && (
                 <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent mouseup from firing on parent again
                        setIsAssistantPopoverOpen(true);
                    }}
                    className="absolute z-10 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-500 transition-transform hover:scale-110 animate-fade-in-up"
                    style={{ 
                        top: `${selectionState.position.top}px`, 
                        left: `${selectionState.position.left}px`, 
                        transform: 'translate(-50%, -100%)', 
                        marginTop: '-8px'
                    }}
                    title="AI ile Düzenle"
                >
                    <svg width="16" height="16" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <path fill="currentColor" d="M50 5L0 95h25l25-50 25 50h25L50 5z" opacity="0.7"/>
                        <circle fill="currentColor" cx="50" cy="58" r="10"/>
                    </svg>
                </button>
            )}
            {isAssistantPopoverOpen && selectionState && (
                <MagicAssistantPopover
                    selectedText={selectionState.text}
                    position={selectionState.position}
                    onGenerate={handleAssistantGenerate}
                    onClose={closeAndClearSelection}
                    isLoading={isCurrentlyModifying}
                />
            )}
        </div>
    );
};