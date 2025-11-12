// components/DocumentCanvas.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { StreamingIndicator } from './StreamingIndicator';
import { TemplateSelector } from './TemplateSelector';
import { ExportDropdown } from './ExportDropdown';
import { Template, DocumentVersion, LintingIssue, IsBirimiTalep, isIsBirimiTalep } from '../types';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Sparkles, LoaderCircle, Edit, Eye, Wrench, X, History } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { VersionHistoryModal } from './VersionHistoryModal';
import { RequestDocumentViewer } from './RequestDocumentViewer';
import { TiptapEditor } from './TiptapEditor';

interface DocumentCanvasProps {
    content: string;
    onContentChange: (newContent: string, reason: string) => void;
    docKey: 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix' | 'requestDoc';
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

// --- Helper Functions for Structured Document Conversion ---

const jsonToMarkdownTable = (content: string): string => {
    const trimmedContent = (content || '').trim();
    try {
        const cleanedJsonString = trimmedContent.replace(/^```json\s*|```\s*$/g, '').trim();
        if (!cleanedJsonString) return "";
        const data = JSON.parse(cleanedJsonString);
        if (!Array.isArray(data) || data.length === 0) return "";
        
        // Add "Sıra No" to headers
        const originalHeaders = Object.keys(data[0]);
        const headers = ["Sıra No", ...originalHeaders];

        const headerLine = `| ${headers.join(' | ')} |`;
        const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
        
        // Add row number to each body line
        const bodyLines = data.map((row, index) => {
            const rowNumber = index + 1;
            const rowData = originalHeaders.map(header => {
                const cellData = row[header];
                if (Array.isArray(cellData)) {
                    return cellData.join('<br/>');
                }
                const stringData = (cellData === null || cellData === undefined) ? '' : String(cellData);
                return stringData.replace(/\n/g, '<br/>');
            });
            return `| ${rowNumber} | ${rowData.join(' | ')} |`;
        });
        
        return [headerLine, separatorLine, ...bodyLines].join('\n');
    } catch (error) {
        console.warn("Could not parse table content as JSON, returning as is.", error);
        return content;
    }
};

const markdownTableToJson = (markdown: string): string => {
    const trimmedMarkdown = (markdown || '').trim();
    if (!trimmedMarkdown.startsWith('|')) {
        // If it's not a markdown table but looks like JSON, return it as is.
        if (trimmedMarkdown.startsWith('[')) {
            try {
                JSON.parse(trimmedMarkdown);
                return trimmedMarkdown;
            } catch (e) { /* fall through */ }
        }
        return '[]'; // Default to empty array if not a table
    }

    const lines = trimmedMarkdown.split('\n');
    const headerLine = lines[0];
    const separatorLine = lines[1];
    const bodyLines = lines.slice(2);

    if (!headerLine || !separatorLine || !headerLine.includes('|') || !separatorLine.includes('---')) {
        return '[]'; // Not a valid markdown table
    }

    const allHeaders = headerLine.split('|').map(h => h.trim()).filter(Boolean);
    
    // Check for and slice off the "Sıra No" column
    const hasRowNumberColumn = allHeaders[0] === 'Sıra No';
    const headers = hasRowNumberColumn ? allHeaders.slice(1) : allHeaders;
    
    const data = bodyLines.map(line => {
        const allCells = line.split('|').slice(1, -1).map(cell => cell.trim());
        const cells = hasRowNumberColumn ? allCells.slice(1) : allCells;
        
        const row: { [key: string]: any } = {};
        headers.forEach((header, index) => {
            const cellValue = (cells[index] || '').replace(/<br\s*\/?>/gi, '\n');
            // Attempt to parse arrays for fields like "Test Adımları"
            if (header === "Test Adımları" && cellValue.includes('\n')) {
                 row[header] = cellValue.split('\n').map(s => s.trim()).filter(Boolean);
            } else {
                 row[header] = cellValue;
            }
        });
        return row;
    }).filter(row => Object.values(row).some(val => val)); 

    return JSON.stringify(data, null, 2);
};


function requestDocToMarkdown(doc: IsBirimiTalep): string {
    if (!doc) return '';
    let md = `# ${doc.talepAdi}\n\n`;
    md += `**Doküman No:** ${doc.dokumanNo}  \n`;
    md += `**Revizyon:** ${doc.revizyon}  \n`;
    md += `**Tarih:** ${doc.tarih}  \n`;
    md += `**Talep Sahibi:** ${doc.talepSahibi}\n\n---\n\n`;
    md += `## Mevcut Durum & Problem\n\n${doc.mevcutDurumProblem}\n\n`;
    md += `## Talebin Amacı ve Gerekçesi\n\n${doc.talepAmaciGerekcesi}\n\n`;
    md += `## Kapsam\n\n### Kapsam Dahili\n${doc.kapsam.inScope.map(item => `- ${item}`).join('\n')}\n\n`;
    md += `### Kapsam Dışı\n${doc.kapsam.outOfScope.map(item => `- ${item}`).join('\n')}\n\n`;
    md += `## Beklenen İş Faydaları\n\n${doc.beklenenIsFaydalari.map(item => `- ${item}`).join('\n')}\n\n`;
    return md;
}


const AiAssistantModal: React.FC<{ selectedText: string; onGenerate: (prompt: string) => void; onClose: () => void; isLoading: boolean; }> = ({ selectedText, onGenerate, onClose, isLoading }) => {
    const [prompt, setPrompt] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (modalRef.current && !modalRef.current.contains(event.target as Node)) onClose(); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);
    const handleGenerateClick = () => { if (prompt.trim()) onGenerate(prompt); };
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div ref={modalRef} className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md animate-fade-in-up" style={{animationDuration: '0.2s'}}>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 pb-2">Seçili Metin:</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-h-24 overflow-y-auto bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md">"{selectedText}"</p>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ne yapmak istersiniz? (Örn: 'daha resmi yap', 'bir madde ekle' vb.)" className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 resize-none" rows={2} autoFocus />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-600 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">İptal</button>
                    <button onClick={handleGenerateClick} disabled={isLoading || !prompt.trim()} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none disabled:opacity-50 flex items-center justify-center w-28">
                        {isLoading ? <LoaderCircle className="animate-spin h-5 w-5" /> : 'Uygula'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const LintingSuggestionsBar: React.FC<{ issues: LintingIssue[]; onFix: (issue: LintingIssue) => void; onDismiss: (issue: LintingIssue) => void; isFixing: boolean; }> = ({ issues, onFix, onDismiss, isFixing }) => {
    if (issues.length === 0) return null;
    const issue = issues[0];
    return (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl mt-2 z-20">
            <div className="bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg shadow-lg flex items-center justify-between gap-4">
                <div className="flex items-center gap-2"><Wrench className="h-5 w-5 flex-shrink-0" /><p className="text-sm font-medium">"{issue.section}" bölümündeki numaralandırmada bir tutarsızlık fark ettik. Otomatik olarak düzeltmek ister misiniz?</p></div>
                <div className="flex items-center gap-2 flex-shrink-0">
                     <button onClick={() => onFix(issue)} disabled={isFixing} className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">{isFixing ? 'Düzeltiliyor...' : 'Düzelt'}</button>
                    <button onClick={() => onDismiss(issue)} className="p-1.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800"><X className="h-4 w-4" /></button>
                </div>
            </div>
        </div>
    );
};

export const DocumentCanvas: React.FC<DocumentCanvasProps> = (props) => {
    const { content, onContentChange, docKey, onModifySelection, inlineModificationState, isGenerating, isStreaming = false, placeholder, templates, selectedTemplate, onTemplateChange, filename, isTable, documentVersions, onAddTokens, onRestoreVersion } = props;

    const [isEditing, setIsEditing] = useState(false);
    const [selection, setSelection] = useState<{ start: number, end: number, text: string } | null>(null);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isProcessingSave, setIsProcessingSave] = useState(false);
    const [lintIssues, setLintIssues] = useState<LintingIssue[]>([]);
    const [isFixing, setIsFixing] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    
    // State for editor content management
    const [viewContent, setViewContent] = useState(''); // Markdown for display
    const [editContent, setEditContent] = useState(''); // Markdown for editing
    
    const documentTypeMap: Record<string, DocumentVersion['document_type']> = { analysisDoc: 'analysis', requestDoc: 'request', testScenarios: 'test', traceabilityMatrix: 'traceability' };
    const currentDocType = documentTypeMap[docKey];
    
    const docNameMap: Record<string, string> = { analysisDoc: 'Analiz Dokümanı', requestDoc: 'Talep Dokümanı', testScenarios: 'Test Senaryoları', traceabilityMatrix: 'İzlenebilirlik Matrisi' };
    const documentName = docNameMap[docKey] || 'Doküman';

    const tableData = useMemo(() => {
        if (!isTable || !content) return [];
        try {
            const trimmedContent = (content || '').trim();
            const cleanedJsonString = trimmedContent.replace(/^```json\s*|```\s*$/g, '').trim();
            if (!cleanedJsonString.startsWith('[') && !cleanedJsonString.startsWith('{')) return [];
            if (!cleanedJsonString) return [];
            return JSON.parse(cleanedJsonString);
        } catch {
            return [];
        }
    }, [content, isTable]);

    // Effect to derive view/edit content from the main `content` prop
    useEffect(() => {
        let markdownContent = content || '';
        
        const trimmedContent = (content || '').trim();
        const cleanedJsonString = trimmedContent.replace(/^```json\s*|```\s*$/g, '').trim();
        const isJson = cleanedJsonString.startsWith('[') || cleanedJsonString.startsWith('{');

        if (isTable && isJson) {
            markdownContent = jsonToMarkdownTable(content);
        } else if (docKey === 'requestDoc' && isJson) {
            try {
                const parsed = JSON.parse(cleanedJsonString);
                if (isIsBirimiTalep(parsed)) {
                    markdownContent = requestDocToMarkdown(parsed);
                }
            } catch (e) { /* Not a JSON request doc, treat as plain markdown */ }
        }

        setViewContent(markdownContent);
        // Only update edit content if not currently editing, to avoid overwriting user changes
        if (!isEditing) {
            setEditContent(markdownContent);
        }
    }, [content, isTable, docKey, isEditing]);


    const parsedRequestDoc = useMemo(() => {
        if (docKey === 'requestDoc') {
            try {
                const parsed = JSON.parse(content);
                return isIsBirimiTalep(parsed) ? parsed : null;
            } catch { return null; }
        }
        return null;
    }, [docKey, content]);


    const handleToggleEditing = async () => {
        if (isEditing) {
            // --- EXITING EDIT MODE ---
            setIsProcessingSave(true);
            try {
                 if (editContent === viewContent) {
                    setIsEditing(false);
                    return;
                }

                const { summary, tokens } = await geminiService.summarizeDocumentChange(viewContent, editContent);
                onAddTokens(tokens);

                let finalContentToSave = editContent;
                if (isTable) {
                    finalContentToSave = markdownTableToJson(editContent);
                } else if (docKey === 'requestDoc') {
                    const { jsonString: reqJson, tokens: reqTokens } = await geminiService.convertMarkdownToRequestJson(editContent);
                    onAddTokens(reqTokens);
                    finalContentToSave = reqJson;
                }
                
                onContentChange(finalContentToSave, summary || "Manuel olarak düzenlendi.");
                setIsEditing(false);

                if (docKey === 'analysisDoc') {
                    const { issues, tokens: lintTokens } = await geminiService.lintDocument(editContent);
                    onAddTokens(lintTokens);
                    setLintIssues(issues);
                }
            } catch (error: any) {
                console.error("Failed to save changes:", error);
                alert(`Değişiklikler kaydedilemedi: ${error.message}\n\Lütfen metni gözden geçirip tekrar deneyin.`);
            } finally {
                setIsProcessingSave(false);
            }
        } else {
            // --- ENTERING EDIT MODE ---
            setEditContent(viewContent); // Prime the editor with the current view content
            setIsEditing(true);
        }
    };
    
    const handleTiptapSelection = (text: string) => {
        if (docKey !== 'requestDoc' && text && text.trim().length > 5) {
            setSelection({ start: 0, end: 0, text: text });
        } else {
            setSelection(null);
        }
    };
    
    const handleAiModifyFromModal = async (userPrompt: string) => {
        if (!selection) return;
        await onModifySelection(selection.text, userPrompt, docKey as 'analysisDoc' | 'testScenarios');
        setIsAiModalOpen(false); setSelection(null);
    };

    const handleAiAction = (action: 'summarize' | 'expand' | 'rephrase' | 'fix_grammar') => {
        if (!selection) return;

        const prompts = {
            summarize: "Bu metni özetle.",
            expand: "Bu metni genişleterek daha detaylı anlat.",
            rephrase: "Bu metni daha basit ve anlaşılır bir dille yeniden yaz.",
            fix_grammar: "Bu metindeki dilbilgisi ve yazım hatalarını düzelt.",
        };

        const userPrompt = prompts[action];
        onModifySelection(selection.text, userPrompt, docKey as 'analysisDoc' | 'testScenarios');
        setSelection(null);
    };
    
    const handleFixIssue = async (issue: LintingIssue) => {
        setIsFixing(true);
        try {
            const { fixedContent, tokens } = await geminiService.fixDocumentLinterIssues(viewContent, issue);
            onAddTokens(tokens);
            onContentChange(fixedContent, `AI Tarafından Numaralandırma Düzeltildi: ${issue.section}`);
            setLintIssues([]);
        } catch (error) { console.error("Failed to fix linting issue:", error); } 
        finally { setIsFixing(false); }
    };
    
    const filteredHistory = useMemo(() => (documentVersions || []).filter(v => v.document_type === currentDocType), [documentVersions, currentDocType]);
    
    const currentVersion = filteredHistory.length > 0 ? Math.max(...filteredHistory.map(v => v.version_number)) : 0;

    const showAiButton = (docKey === 'analysisDoc' || docKey === 'testScenarios');

    return (
        <div className="flex flex-col h-full relative">
            <LintingSuggestionsBar issues={lintIssues} onFix={handleFixIssue} onDismiss={(issue) => setLintIssues(prev => prev.filter(i => i !== issue))} isFixing={isFixing} />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-2 md:p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 flex-wrap">
                     {/* AI Button Removed from here */}
                </div>
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-1"><span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md">v{currentVersion}</span><button onClick={() => setIsHistoryModalOpen(true)} title="Versiyon Geçmişi" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" disabled={filteredHistory.length === 0}><History className="h-4 w-4"/></button></div>
                    {templates && selectedTemplate && onTemplateChange && <TemplateSelector label="Şablon" templates={templates} selectedValue={selectedTemplate} onChange={onTemplateChange} disabled={isGenerating} />}
                     {isStreaming && <div className="flex items-center gap-2"><LoaderCircle className="animate-spin h-5 w-5 text-indigo-500" /><span className="text-sm font-medium text-slate-600 dark:text-slate-400">Oluşturuluyor</span></div>}
                     <button onClick={handleToggleEditing} disabled={isProcessingSave || isStreaming} className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-2 disabled:opacity-50">{isProcessingSave ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Kaydediliyor...</> : isEditing ? <><Eye className="h-4 w-4" /> Görünüm</> : <><Edit className="h-4 w-4" /> Düzenle</>}</button>
                    <ExportDropdown content={isEditing ? editContent : viewContent} filename={filename} isTable={isTable} />
                </div>
            </div>
            
             {isTable && tableData.length > 0 && (
                <div className="px-4 md:px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{documentName} Özeti</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Toplam {tableData.length} kayıt bulunmaktadır.</p>
                </div>
            )}

            <div className="flex-1 relative min-h-0">
                {docKey === 'requestDoc' && !isEditing && parsedRequestDoc ? (
                    <RequestDocumentViewer document={parsedRequestDoc} />
                ) : (
                    <TiptapEditor
                        content={isEditing ? editContent : viewContent}
                        onChange={setEditContent}
                        onSelectionUpdate={handleTiptapSelection}
                        isEditable={isEditing}
                        onAiAction={handleAiAction}
                        onCustomAiCommand={() => showAiButton && selection && setIsAiModalOpen(true)}
                    />
                )}
            </div>

             {isAiModalOpen && selection && <AiAssistantModal selectedText={selection.text} onGenerate={handleAiModifyFromModal} onClose={() => { setIsAiModalOpen(false); setSelection(null); }} isLoading={!!inlineModificationState} />}
            {isHistoryModalOpen && <VersionHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} versions={filteredHistory} documentName={documentName} onRestore={onRestoreVersion} />}
        </div>
    );
};