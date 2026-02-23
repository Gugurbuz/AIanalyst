
// components/DocumentCanvas.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Template, DocumentVersion, LintingIssue, IsBirimiTalep, isIsBirimiTalep } from '../types';
import { LoaderCircle } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { VersionHistoryModal } from './VersionHistoryModal';
import { TiptapEditor } from './TiptapEditor';
import { DocumentToolbar } from './document/DocumentToolbar';
import { LintingSuggestionsBar } from './document/LintingSuggestionsBar';
import { DocumentSkeleton } from './DocumentSkeleton';

interface DocumentCanvasProps {
    content: string;
    onContentChange: (newContent: string, reason: string, tokensUsed?: number) => void;
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
    onExplainSelection: (text: string) => void;
}

const jsonToMarkdownTable = (content: string): string => {
    const trimmedContent = (content || '').trim();
    if (!trimmedContent.startsWith('[') && !trimmedContent.startsWith('{')) return content;
    try {
        const cleanedJsonString = trimmedContent.replace(/^```json\s*|```\s*$/g, '').trim();
        if (!cleanedJsonString) return "";
        const data = JSON.parse(cleanedJsonString);
        if (!Array.isArray(data) || data.length === 0) return "";
        const headers = Object.keys(data[0]);
        const headerLine = `| ${headers.join(' | ')} |`;
        const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
        const bodyLines = data.map(row => `| ${headers.map(header => (row[header] === null || row[header] === undefined ? '' : row[header]).toString().replace(/\n/g, '<br/>')).join(' | ')} |`);
        return [headerLine, separatorLine, ...bodyLines].join('\n');
    } catch (error) {
        return content;
    }
};

const extractJsonFromText = (text: string): any | null => {
    if (!text || typeof text !== 'string') return null;

    let jsonToParse = text.trim();

    const codeBlockMatch = jsonToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        jsonToParse = codeBlockMatch[1].trim();
    }

    const firstBrace = jsonToParse.indexOf('{');
    const lastBrace = jsonToParse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonToParse = jsonToParse.substring(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(jsonToParse);
    } catch {
        return null;
    }
};

const convertRequestJsonToMarkdown = (json: any): string => {
    const val = (v: any) => {
        if (v === null || v === undefined || v === '') return 'Belirtilmemiş';
        return String(v).trim();
    };
    const list = (arr: any[]) => {
        if (!Array.isArray(arr) || arr.length === 0) return '- Belirtilmemiş';
        return arr.filter(item => item && String(item).trim()).map(item => `- ${String(item).trim()}`).join('\n') || '- Belirtilmemiş';
    };

    const title = val(json.talepAdi);
    const docNo = val(json.dokumanNo);
    const date = val(json.tarih);
    const revision = val(json.revizyon);
    const owner = val(json.talepSahibi);
    const problem = val(json.mevcutDurumProblem);
    const purpose = val(json.talepAmaciGerekcesi);
    const inScope = list(json.kapsam?.inScope);
    const outScope = list(json.kapsam?.outOfScope);
    const benefits = list(json.beklenenIsFaydalari);

    return `# ${title}

| Doküman Bilgileri | Detay |
| :--- | :--- |
| **Doküman No** | ${docNo} |
| **Tarih** | ${date} |
| **Revizyon** | ${revision} |
| **Talep Sahibi** | ${owner} |

---

## 1. Mevcut Durum ve Problem

${problem}

## 2. Talebin Amacı ve Gerekçesi

${purpose}

## 3. Kapsam

### 3.1. Kapsam Dahili

${inScope}

### 3.2. Kapsam Dışı

${outScope}

## 4. Beklenen İş Faydaları

${benefits}`;
};

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

export const DocumentCanvas: React.FC<DocumentCanvasProps> = (props) => {
    const { content, onContentChange, docKey, onModifySelection, inlineModificationState, isGenerating, isStreaming = false, placeholder, templates, selectedTemplate, onTemplateChange, filename, isTable, documentVersions, onAddTokens, onRestoreVersion, onExplainSelection } = props;

    const [localContent, setLocalContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [selection, setSelection] = useState<{ start: number, end: number, text: string } | null>(null);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [lintIssues, setLintIssues] = useState<LintingIssue[]>([]);
    const [isFixing, setIsFixing] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    
    const originalContentRef = useRef<string>('');
    
    const documentTypeMap: Record<string, DocumentVersion['document_type']> = { analysisDoc: 'analysis', requestDoc: 'request', testScenarios: 'test', traceabilityMatrix: 'traceability' };
    const currentDocType = documentTypeMap[docKey];
    
    const docNameMap: Record<string, string> = { analysisDoc: 'Analiz Dokümanı', requestDoc: 'Talep Dokümanı', testScenarios: 'Test Senaryoları', traceabilityMatrix: 'İzlenebilirlik Matrisi' };
    const documentName = docNameMap[docKey] || 'Doküman';

    const processedContent = useMemo(() => {
        const rawContent = isEditing ? localContent : content;

        if (docKey === 'requestDoc' && rawContent) {
            const parsed = extractJsonFromText(rawContent);
            if (parsed && (parsed.talepAdi || parsed.mevcutDurumProblem || parsed.kapsam || parsed.talepAmaciGerekcesi)) {
                return convertRequestJsonToMarkdown(parsed);
            }
        }

        if (isTable && !isStreaming) {
            return jsonToMarkdownTable(rawContent);
        }

        return rawContent;
    }, [content, isEditing, localContent, docKey, isTable, isStreaming]);


    useEffect(() => { 
        if (!isEditing) {
            setLocalContent(content || ''); 
        }
    }, [content, isEditing]);

    useEffect(() => { setLintIssues([]); }, [content]);

    const handleToggleEditing = async () => {
        if (isEditing) {
            setIsEditing(false);
            if (localContent === originalContentRef.current) return;

            setSaveState('saving');
            try {
                // For Request Doc, we simply save the text changes. 
                // We NO LONGER convert back to JSON. The source of truth becomes the text.
                if (docKey === 'requestDoc') {
                    onContentChange(localContent, "Talep dokümanı manuel olarak düzenlendi.", 0);
                } else {
                    const { summary: aiSummary, tokens } = await geminiService.summarizeDocumentChange(originalContentRef.current, localContent);
                    onAddTokens(tokens);
                    
                    let cleanSummary = aiSummary.replace(/^(Manuel Düzenleme:\s*|AI Tarafından Düzeltme:\s*)/i, '');
                    const finalReason = `Manuel Düzenleme: ${cleanSummary}`;

                    onContentChange(localContent, finalReason, tokens);

                    if (docKey === 'analysisDoc') {
                        const { issues, tokens: lintTokens } = await geminiService.lintDocument(localContent);
                        onAddTokens(lintTokens);
                        setLintIssues(issues);
                    }
                }
            } catch (error) {
                console.error("Failed to save/convert changes:", error);
                const reason = docKey === 'requestDoc' ? "Talep Dokümanı Manuel Düzenleme" : "Manuel Düzenleme";
                onContentChange(localContent, reason, 0);
            } finally {
                setSaveState('saved');
                setTimeout(() => setSaveState('idle'), 2000);
            }
        } else {
            originalContentRef.current = processedContent;
            setLocalContent(processedContent); 
            setIsEditing(true);
        }
    };
    
    const handleTiptapSelection = (text: string) => {
        if (text && text.trim().length > 5) {
            setSelection({ start: 0, end: 0, text: text });
        } else {
            setSelection(null);
        }
    };
    
    const handleEditSelectionWithAI = (text: string) => {
        if (!isEditing) {
            handleToggleEditing(); 
        }
        setSelection({ start: 0, end: 0, text });
        setIsAiModalOpen(true);
    };

    const handleAiModify = async (userPrompt: string) => {
        if (!selection) return;
        await onModifySelection(selection.text, userPrompt, docKey as 'analysisDoc' | 'testScenarios');
        setIsAiModalOpen(false); setSelection(null);
    };
    
    const handleFixIssue = async (issue: LintingIssue) => {
        setIsFixing(true);
        try {
            const { fixedContent, tokens } = await geminiService.fixDocumentLinterIssues(content, issue);
            onAddTokens(tokens);
            onContentChange(fixedContent, `AI Tarafından Numaralandırma Düzeltildi: ${issue.section}`);
            setLintIssues([]);
        } catch (error) { console.error("Failed to fix linting issue:", error); } 
        finally { setIsFixing(false); }
    };
    
    const filteredHistory = useMemo(() => (documentVersions || []).filter(v => v.document_type === currentDocType), [documentVersions, currentDocType]);

    const latestVersion = useMemo(() => {
        if (!filteredHistory || filteredHistory.length === 0) return null;
        return filteredHistory.reduce((latest, v) => (v.version_number > latest.version_number ? v : latest), filteredHistory[0]);
    }, [filteredHistory]);
    
    const showAiButton = (docKey === 'analysisDoc' || docKey === 'testScenarios');

    // Determine if we should show the skeleton loader
    // Show skeleton ONLY if we are generating AND there is no content yet (first chunk hasn't arrived)
    const showSkeleton = isGenerating && (!processedContent || processedContent.trim() === '');

    return (
        <div className="flex flex-col h-full relative">
            <LintingSuggestionsBar issues={lintIssues} onFix={handleFixIssue} onDismiss={(issue) => setLintIssues(prev => prev.filter(i => i !== issue))} isFixing={isFixing} />
            
            <DocumentToolbar
                latestVersion={latestVersion}
                filteredHistory={filteredHistory}
                onHistoryClick={() => setIsHistoryModalOpen(true)}
                templates={templates}
                selectedTemplate={selectedTemplate}
                onTemplateChange={onTemplateChange}
                isGenerating={isGenerating}
                isStreaming={!!isStreaming}
                saveState={saveState}
                isEditing={isEditing}
                onToggleEditing={handleToggleEditing}
                onAiEditClick={() => setIsAiModalOpen(true)}
                hasSelection={!!selection}
                showAiButton={showAiButton}
                content={processedContent}
                filename={filename}
                isTable={isTable}
            />
            
            <div className="flex-1 relative min-h-0">
                {showSkeleton ? (
                    <DocumentSkeleton />
                ) : (
                    <TiptapEditor
                        content={processedContent}
                        onChange={setLocalContent}
                        onSelectionUpdate={handleTiptapSelection}
                        isEditable={isEditing}
                        onExplainSelection={onExplainSelection}
                        onEditWithAI={handleEditSelectionWithAI}
                        isStreaming={isStreaming}
                    />
                )}
            </div>

             {isAiModalOpen && selection && <AiAssistantModal selectedText={selection.text} onGenerate={handleAiModify} onClose={() => { setIsAiModalOpen(false); setSelection(null); }} isLoading={!!inlineModificationState} />}
            {isHistoryModalOpen && <VersionHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} versions={filteredHistory} documentName={documentName} onRestore={onRestoreVersion} />}
        </div>
    );
};
