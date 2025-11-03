// components/DocumentCanvas.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { StreamingIndicator } from './StreamingIndicator';
import { TemplateSelector } from './TemplateSelector';
import { ExportDropdown } from './ExportDropdown';
import { Template, DocumentVersion, LintingIssue } from '../types';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Sparkles, LoaderCircle, Edit, Eye, Wrench, X, History } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { VersionHistoryModal } from './VersionHistoryModal';

interface DocumentCanvasProps {
    content: string;
    onContentChange: (newContent: string, reason: string) => void;
    docKey: 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix';
    onModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => void;
    inlineModificationState: { docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null;
    isGenerating: boolean;
    isStreaming?: boolean;
    placeholder?: string;
    templates?: Template[];
    selectedTemplate?: string;
    onTemplateChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    filename: string;
    isTable?: boolean;
    onGenerate?: () => void;
    generateButtonText?: string;
    isGenerationDisabled?: boolean;
    generationDisabledTooltip?: string;
    documentVersions: DocumentVersion[];
    onAddTokens: (tokens: number) => void;
    onRestoreVersion: (version: DocumentVersion) => void;
}

const AiAssistantModal: React.FC<{
    selectedText: string;
    onGenerate: (prompt: string) => void;
    onClose: () => void;
    isLoading: boolean;
}> = ({ selectedText, onGenerate, onClose, isLoading }) => {
    const [prompt, setPrompt] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div
                ref={modalRef}
                className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md animate-fade-in-up"
                style={{animationDuration: '0.2s'}}
            >
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 pb-2">Seçili Metin:</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-h-24 overflow-y-auto bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md">
                    "{selectedText}"
                </p>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ne yapmak istersiniz? (Örn: 'daha resmi yap', 'bir madde ekle' vb.)"
                    className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 resize-none"
                    rows={2}
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-600 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">İptal</button>
                    <button 
                        onClick={handleGenerateClick} 
                        disabled={isLoading || !prompt.trim()}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none disabled:opacity-50 flex items-center justify-center w-28"
                    >
                        {isLoading ? <LoaderCircle className="animate-spin h-5 w-5" /> : 'Uygula'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const LintingSuggestionsBar: React.FC<{
    issues: LintingIssue[];
    onFix: (issue: LintingIssue) => void;
    onDismiss: (issue: LintingIssue) => void;
    isFixing: boolean;
}> = ({ issues, onFix, onDismiss, isFixing }) => {
    if (issues.length === 0) return null;
    const issue = issues[0]; // Show one issue at a time

    return (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl mt-2 z-20">
            <div className="bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg shadow-lg flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm font-medium">
                        "{issue.section}" bölümündeki numaralandırmada bir tutarsızlık fark ettik. Otomatik olarak düzeltmek ister misiniz?
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                     <button
                        onClick={() => onFix(issue)}
                        disabled={isFixing}
                        className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isFixing ? 'Düzeltiliyor...' : 'Düzelt'}
                    </button>
                    <button onClick={() => onDismiss(issue)} className="p-1.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}


export const DocumentCanvas: React.FC<DocumentCanvasProps> = (props) => {
    const {
        content, onContentChange, docKey, onModifySelection, inlineModificationState,
        isGenerating, isStreaming = false, placeholder, templates, selectedTemplate,
        onTemplateChange, filename, isTable, onGenerate, generateButtonText,
        isGenerationDisabled, generationDisabledTooltip, documentVersions, onAddTokens,
        onRestoreVersion
    } = props;

    const [localContent, setLocalContent] = useState(content);
    const [isEditing, setIsEditing] = useState(false);
    const [selection, setSelection] = useState<{ start: number, end: number, text: string } | null>(null);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [lintIssues, setLintIssues] = useState<LintingIssue[]>([]);
    const [isFixing, setIsFixing] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isModifyingRef = useRef(false);
    const originalContentRef = useRef<string>(content);
    
    const documentTypeMap: Record<string, DocumentVersion['document_type']> = {
        analysisDoc: 'analysis',
        testScenarios: 'test',
        traceabilityMatrix: 'traceability',
    };
    const currentDocType = documentTypeMap[docKey];
    
    const docNameMap: Record<string, string> = {
         analysisDoc: 'Analiz Dokümanı',
        testScenarios: 'Test Senaryoları',
        traceabilityMatrix: 'İzlenebilirlik Matrisi',
    };
    const documentName = docNameMap[docKey] || 'Doküman';

    // Sync local content when parent content changes
    useEffect(() => {
        if (!isModifyingRef.current) {
            setLocalContent(content);
        }
    }, [content]);
    
    // Clear lint issues when content changes from parent
    useEffect(() => {
        setLintIssues([]);
    }, [content]);

    const handleToggleEditing = async () => {
        if (isEditing) { // Finishing edit
            setIsEditing(false); // Switch to view mode immediately
            if (localContent !== originalContentRef.current) {
                setIsSummarizing(true);
                try {
                    const { summary, tokens: summaryTokens } = await geminiService.summarizeDocumentChange(originalContentRef.current, localContent);
                    onAddTokens(summaryTokens);
                    onContentChange(localContent, summary);
                    
                    // After content is updated, check for structural issues
                    const { issues, tokens: lintTokens } = await geminiService.lintDocument(localContent);
                    onAddTokens(lintTokens);
                    setLintIssues(issues);

                } catch (error) {
                    console.error("Failed to summarize or lint changes:", error);
                    onContentChange(localContent, "Manuel Düzenleme");
                } finally {
                    setIsSummarizing(false);
                }
            }
        } else { // Starting edit
            originalContentRef.current = content;
            setLintIssues([]); // Clear issues when starting to edit
            setIsEditing(true);
        }
    };
    
    const handleSelection = useCallback(() => {
        if (isEditing && !isTable) {
            const textarea = textareaRef.current;
            if (!textarea || document.activeElement !== textarea) return;
            const { selectionStart, selectionEnd } = textarea;
            const selectedText = textarea.value.substring(selectionStart, selectionEnd);
            if (selectedText.trim().length > 5) {
                setSelection({ start: selectionStart, end: selectionEnd, text: selectedText });
            } else {
                setSelection(null);
            }
        } else {
            const currentSelection = window.getSelection();
            if (currentSelection && currentSelection.toString().trim().length > 5) {
                setSelection({ start: 0, end: 0, text: currentSelection.toString() });
            } else {
                setSelection(null);
            }
        }
    }, [isEditing, isTable]);

    const applyMarkdown = (prefix: string, suffix: string = '', isBlock: boolean = false) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const { selectionStart, selectionEnd } = textarea;
        const originalText = localContent;

        let newText;
        if (isBlock) {
            const lineStart = originalText.lastIndexOf('\n', selectionStart - 1) + 1;
            const line = originalText.substring(lineStart, selectionEnd);
            const cleanedLine = line.replace(/^(#+\s|\d+\.\s|-\s|\*\s)/, '');
            const newBlock = `${prefix}${cleanedLine}`;
            newText = originalText.substring(0, lineStart) + newBlock + originalText.substring(selectionEnd);
            setTimeout(() => textarea.setSelectionRange(lineStart, lineStart + newBlock.length), 0);
        } else {
            const selectedText = originalText.substring(selectionStart, selectionEnd);
            newText = `${originalText.substring(0, selectionStart)}${prefix}${selectedText}${suffix}${originalText.substring(selectionEnd)}`;
            setTimeout(() => textarea.setSelectionRange(selectionStart + prefix.length, selectionEnd + prefix.length), 0);
        }
        
        setLocalContent(newText);
        textarea.focus();
    };
    
    const handleAiModify = async (userPrompt: string) => {
        if (!selection) return;
        isModifyingRef.current = true;
        await onModifySelection(selection.text, userPrompt, docKey as 'analysisDoc' | 'testScenarios');
        isModifyingRef.current = false;
        setIsAiModalOpen(false);
        setSelection(null);
    };
    
    const handleFixIssue = async (issue: LintingIssue) => {
        setIsFixing(true);
        try {
            const { fixedContent, tokens } = await geminiService.fixDocumentLinterIssues(content, issue);
            onAddTokens(tokens);
            onContentChange(fixedContent, `AI Tarafından Numaralandırma Düzeltildi: ${issue.section}`);
            setLintIssues([]); // Clear issues after fixing
        } catch (error) {
            console.error("Failed to fix linting issue:", error);
        } finally {
            setIsFixing(false);
        }
    };
    
    const filteredHistory = useMemo(() => {
        return (documentVersions || []).filter(v => v.document_type === currentDocType);
    }, [documentVersions, currentDocType]);

    
    // View for documents that can be generated from within the canvas (e.g., Traceability Matrix)
    if (!content && !isStreaming && onGenerate) {
        return (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 h-full flex flex-col justify-center items-center">
                <p className="mb-4">{placeholder}</p>
                <button
                    onClick={onGenerate}
                    disabled={isGenerationDisabled}
                    title={generationDisabledTooltip}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {generateButtonText}
                </button>
            </div>
        );
    }
    
    // View for documents that are generated externally (e.g., Analysis Doc, Test Scenarios)
    if (!content && !isStreaming && !onGenerate) {
        return (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 h-full flex flex-col justify-center items-center">
                <p>{placeholder}</p>
            </div>
        );
    }

    const currentVersion = filteredHistory.length > 0 ? Math.max(...filteredHistory.map(v => v.version_number)) : 0;
    
    return (
        <div className="flex flex-col h-full relative">
            <LintingSuggestionsBar 
                issues={lintIssues}
                onFix={handleFixIssue}
                onDismiss={(issue) => setLintIssues(prev => prev.filter(i => i !== issue))}
                isFixing={isFixing}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-2 md:p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 flex-wrap">
                    {(!isTable && isEditing) && (
                        <>
                            <select onChange={(e) => applyMarkdown(e.target.value, '', true)} className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-700">
                                <option value="">Başlık...</option>
                                <option value="## ">Başlık 1</option>
                                <option value="### ">Başlık 2</option>
                            </select>
                             <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                             <button onClick={() => applyMarkdown('**', '**')} title="Kalın" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"><Bold className="h-4 w-4" /></button>
                             <button onClick={() => applyMarkdown('*', '*')} title="İtalik" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"><Italic className="h-4 w-4" /></button>
                             <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                             <button onClick={() => applyMarkdown('- ', '', true)} title="Madde İşaretli Liste" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"><List className="h-4 w-4" /></button>
                             <button onClick={() => applyMarkdown('1. ', '', true)} title="Numaralı Liste" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"><ListOrdered className="h-4 w-4" /></button>
                             <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                        </>
                    )}
                     <button onClick={() => setIsAiModalOpen(true)} disabled={!selection} title="AI ile düzenle" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed">
                        <Sparkles className="h-4 w-4" /> <span className="text-sm font-semibold">Oluştur</span>
                    </button>
                </div>
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-1">
                        <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md">
                            v{currentVersion}
                        </span>
                        <button 
                            onClick={() => setIsHistoryModalOpen(true)} 
                            title="Versiyon Geçmişi"
                            className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                            disabled={filteredHistory.length === 0}
                        >
                            <History className="h-4 w-4"/>
                        </button>
                    </div>
                    {templates && selectedTemplate && onTemplateChange &&
                        <TemplateSelector label="Şablon" templates={templates} selectedValue={selectedTemplate} onChange={onTemplateChange} disabled={isGenerating} />
                    }
                     {isStreaming && (
                        <div className="flex items-center gap-2">
                            <LoaderCircle className="animate-spin h-5 w-5 text-indigo-500" />
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Oluşturuluyor</span>
                        </div>
                    )}
                     {!isTable && (
                         <button 
                            onClick={handleToggleEditing}
                            disabled={isSummarizing || isStreaming}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSummarizing ? (
                                <><LoaderCircle className="h-4 w-4 animate-spin" /> Özetleniyor...</>
                            ) : isEditing ? (
                                <><Eye className="h-4 w-4" /> Görünüm</>
                            ) : (
                                <><Edit className="h-4 w-4" /> Düzenle</>
                            )}
                        </button>
                    )}
                    <ExportDropdown content={localContent} filename={filename} isTable={isTable} />
                </div>
            </div>
            <div className="p-2 md:p-6 flex-1 relative" onMouseUp={handleSelection}>
                {(isEditing && !isTable) ? (
                    <textarea
                        ref={textareaRef}
                        value={localContent}
                        onChange={(e) => setLocalContent(e.target.value)}
                        className="w-full h-full p-2 bg-transparent border-none focus:outline-none resize-none font-sans text-base leading-relaxed"
                        placeholder={placeholder}
                    />
                ) : (
                    <div className="h-full overflow-y-auto p-2">
                        <MarkdownRenderer
                            content={localContent}
                            rephrasingText={
                                inlineModificationState && inlineModificationState.docKey === docKey
                                    ? inlineModificationState.originalText
                                    : null
                            }
                            highlightedUserSelectionText={selection?.text || null}
                        />
                    </div>
                )}
            </div>
             {isAiModalOpen && selection && (
                <AiAssistantModal
                    selectedText={selection.text}
                    onGenerate={handleAiModify}
                    onClose={() => { setIsAiModalOpen(false); setSelection(null); }}
                    isLoading={!!inlineModificationState}
                />
            )}
            {isHistoryModalOpen && (
                <VersionHistoryModal
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    versions={filteredHistory}
                    documentName={documentName}
                    onRestore={onRestoreVersion}
                />
            )}
        </div>
    );
};