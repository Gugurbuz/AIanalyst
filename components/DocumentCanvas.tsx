// components/DocumentCanvas.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer'; // Bu artık sadece 'Dışa Aktar' için kullanılacak
import { StreamingIndicator } from './StreamingIndicator';
import { TemplateSelector } from './TemplateSelector';
import { ExportDropdown } from './ExportDropdown';
import { Template, DocumentVersion, LintingIssue, IsBirimiTalep, isIsBirimiTalep } from '../types';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Sparkles, LoaderCircle, Edit, Eye, Wrench, X, History } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { VersionHistoryModal } from './VersionHistoryModal';
import { RequestDocumentViewer } from './RequestDocumentViewer';
import { RequestDocumentEditor } from './RequestDocumentEditor';
import { TiptapEditor } from './TiptapEditor'; // ANA DEĞİŞİKLİK

interface DocumentCanvasProps {
    content: string; // Artık HTML (veya JSON string) alacak
    onContentChange: (newContent: string, reason: string) => void; // Artık HTML (veya JSON) gönderecek
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

// jsonToMarkdownTable ve requestDocToMarkdown fonksiyonları SİLİNDİ (artık gereksizler)

const AiAssistantModal: React.FC<{ 
    selectedText: string; 
    onGenerate: (prompt: string) => void; 
    onClose: () => void; 
    isLoading: boolean; 
}> = ({ selectedText, onGenerate, onClose, isLoading }) => {
    // ... (içerik aynı, değişiklik yok) ...
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

const LintingSuggestionsBar: React.FC<{ 
    issues: LintingIssue[]; 
    onFix: (issue: LintingIssue) => void; 
    onDismiss: (issue: LintingIssue) => void; 
    isFixing: boolean; 
}> = ({ issues, onFix, onDismiss, isFixing }) => {
    // ... (içerik aynı, değişiklik yok) ...
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

    // localContent artık hem HTML (Tiptap için) hem de JSON string (RequestDocumentEditor için) tutacak
    const [localContent, setLocalContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [selection, setSelection] = useState<{ start: number, end: number, text: string } | null>(null);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isProcessingSave, setIsProcessingSave] = useState(false);
    const [lintIssues, setLintIssues] = useState<LintingIssue[]>([]);
    const [isFixing, setIsFixing] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    
    const originalContentRef = useRef<string>('');
    
    const documentTypeMap: Record<string, DocumentVersion['document_type']> = { analysisDoc: 'analysis', requestDoc: 'request', testScenarios: 'test', traceabilityMatrix: 'traceability' };
    const currentDocType = documentTypeMap[docKey];
    
    const docNameMap: Record<string, string> = { analysisDoc: 'Analiz Dokümanı', requestDoc: 'Talep Dokümanı', testScenarios: 'Test Senaryoları', traceabilityMatrix: 'İzlenebilirlik Matrisi' };
    const documentName = docNameMap[docKey] || 'Doküman';

    useEffect(() => { 
        if (!isEditing) {
            setLocalContent(content || ''); 
        }
    }, [content, isEditing]);

    useEffect(() => { setLintIssues([]); }, [content]);

    const parsedRequestDoc = useMemo(() => {
        if (docKey === 'requestDoc') {
            try {
                const contentToParse = isEditing ? localContent : content;
                if (!contentToParse) return null; // Boşsa ayrıştırmayı deneme
                const parsed = JSON.parse(contentToParse);
                return isIsBirimiTalep(parsed) ? parsed : null;
            } catch { return null; }
        }
        return null;
    }, [docKey, content, localContent, isEditing]);


    const handleToggleEditing = async () => {
        if (isEditing) {
            // --- DÜZENLEMEDEN ÇIK ---
            setIsEditing(false);
            if (localContent === originalContentRef.current) return; 

            setIsProcessingSave(true);
            try {
                if (docKey === 'requestDoc') {
                    // Talep dokümanı (JSON) için özetlemeye gerek yok
                    onContentChange(localContent, "Talep dokümanı manuel olarak düzenlendi.");
                } else {
                    // Diğer dokümanlar (ARTIK HTML) için özetleme
                    // Not: Bu özetleme HTML tag'lerini de içerebilir, bu normaldir.
                    // İstenirse, özetleme için AI'a göndermeden önce metni temizleyebilirsiniz
                    // ancak şu anki hali en basit ve sağlam olanıdır.
                    const { summary, tokens } = await geminiService.summarizeDocumentChange(originalContentRef.current, localContent);
                    onAddTokens(tokens);
                    onContentChange(localContent, summary); // localContent HTML'dir
                    
                    if (docKey === 'analysisDoc') {
                        // Linting servisi artık HTML alacak, bunu işleyebilmesi gerekir.
                        // Şimdilik, linting'i basitleştirmek için devredışı bırakabilir veya
                        // geminiService.lintDocument'in HTML'i işlemesini sağlayabilirsiniz.
                        // setLintIssues(issues);
                    }
                }
            } catch (error) {
                console.error("Failed to save/convert changes:", error);
                const reason = docKey === 'requestDoc' ? "Talep Dokümanı Manuel Düzenleme" : "Manuel Düzenleme";
                onContentChange(localContent, reason);
            } finally {
                setIsProcessingSave(false);
            }
        } else {
            // --- DÜZENLEMEYE GİR ---
            originalContentRef.current = content;
            setLocalContent(content); 
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
    
    const handleAiModify = async (userPrompt: string) => {
        if (!selection) return;
        // onModifySelection'ın artık HTML ile başa çıkması gerekiyor
        await onModifySelection(selection.text, userPrompt, docKey as 'analysisDoc' | 'testScenarios');
        setIsAiModalOpen(false); setSelection(null);
    };
    
    const handleFixIssue = async (issue: LintingIssue) => {
        setIsFixing(true);
        try {
            // geminiService.fixDocumentLinterIssues'un da artık HTML alıp HTML döndürmesi gerekir
            const { fixedContent, tokens } = await geminiService.fixDocumentLinterIssues(content, issue);
            onAddTokens(tokens);
            onContentChange(fixedContent, `AI Tarafından Numaralandırma Düzeltildi: ${issue.section}`);
            setLintIssues([]);
        } catch (error) { console.error("Failed to fix linting issue:", error); } 
        finally { setIsFixing(false); }
    };
    
    const filteredHistory = useMemo(() => (documentVersions || []).filter(v => v.document_type === currentDocType), [documentVersions, currentDocType]);

    // !!!!!!!!!!!!!!! ÇÖZÜM - 3 (GÖRÜNTÜLEME) !!!!!!!!!!!!!!!
    // 'displayContent' artık 'jsonToMarkdownTable' KULLANMIYOR.
    const displayContent = useMemo(() => {
        if (docKey === 'requestDoc') return content; // requestDoc için JSON string

        // Diğer her şey için (Analiz, Test, İzlenebilirlik)
        // 'content' (veya düzenleniyorsa 'localContent') artık HTML'dir.
        const contentToDisplay = isEditing ? localContent : content;
        
        // AI'dan streaming geliyorsa, bu hâlâ Markdown'dur.
        // Tiptap'in bunu işlemesi gerekir. (Bu senaryo Tiptap'in HTML'i
        // anlık olarak ayrıştırmasına dayanır, bu da sorun çıkarabilir.
        // İdeal olan, AI'nın da HTML stream etmesidir, ancak şimdilik böyle bırakalım)
        if (isStreaming) {
             return contentToDisplay;
        }

        // isTable kontrolü artık gereksiz, Tiptap tabloları kendi içinde halleder.
        return contentToDisplay;
    }, [isEditing, isStreaming, isTable, localContent, content, docKey]);
    
    const currentVersion = filteredHistory.length > 0 ? Math.max(...filteredHistory.map(v => v.version_number)) : 0;
    const showAiButton = (docKey === 'analysisDoc' || docKey === 'testScenarios');

    return (
        <div className="flex flex-col h-full relative">
            <LintingSuggestionsBar issues={lintIssues} onFix={handleFixIssue} onDismiss={(issue) => setLintIssues(prev => prev.filter(i => i !== issue))} isFixing={isFixing} />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-2 md:p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 flex-wrap">
                     {showAiButton && (
                        <button onClick={() => setIsAiModalOpen(true)} disabled={!selection || !isEditing} title="AI ile düzenle" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed">
                            <Sparkles className="h-4 w-4" /> <span className="text-sm font-semibold">Oluştur</span>
                        </button>
                     )}
                </div>
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-1"><span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md">v{currentVersion}</span><button onClick={() => setIsHistoryModalOpen(true)} title="Versiyon Geçmişi" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" disabled={filteredHistory.length === 0}><History className="h-4 w-4"/></button></div>
                    {templates && selectedTemplate && onTemplateChange && <TemplateSelector label="Şablon" templates={templates} selectedValue={selectedTemplate} onChange={onTemplateChange} disabled={isGenerating} />}
                     {isStreaming && <div className="flex items-center gap-2"><LoaderCircle className="animate-spin h-5 w-5 text-indigo-500" /><span className="text-sm font-medium text-slate-600 dark:text-slate-400">Oluşturuluyor</span></div>}
                     <button onClick={handleToggleEditing} disabled={isProcessingSave || isStreaming} className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-2 disabled:opacity-50">{isProcessingSave ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Kaydediliyor...</> : isEditing ? <><Eye className="h-4 w-4" /> Görünüm</> : <><Edit className="h-4 w-4" /> Düzenle</>}</button>
                    {/* 'displayContent' artık HTML içeriyor. 'ExportDropdown' bunu işleyebilmeli. */}
                    <ExportDropdown content={displayContent} filename={filename} isTable={isTable} />
                </div>
            </div>
            
            <div className="flex-1 relative min-h-0">
                {docKey === 'requestDoc' ? (
                    // Talep Dokümanı (JSON): Ayrı component'ler kullanılıyor (Bu kısım doğru)
                    parsedRequestDoc ? (
                        isEditing ? (
                            <RequestDocumentEditor
                                document={parsedRequestDoc}
                                onChange={(newDoc) => setLocalContent(JSON.stringify(newDoc))}
                            />
                        ) : (
                            <RequestDocumentViewer document={parsedRequestDoc} />
                        )
                    ) : (
                        <div className="p-6 text-slate-500">Talep dokümanı yüklenemedi veya geçersiz formatta.</div>
                    )
                ) : (
                    // !!!!!!!!!!!!!!! ÇÖZÜM - 4 (RENDER) !!!!!!!!!!!!!!!
                    // Diğer Tüm Dokümanlar (Analiz, Test, İzlenebilirlik):
                    // Artık 'MarkdownRenderer' yerine 'TiptapEditor' kullanılıyor.
                    <TiptapEditor
                        content={displayContent} // 'displayContent' artık HTML içeriyor
                        onChange={setLocalContent}
                        onSelectionUpdate={handleTiptapSelection}
                        isEditable={isEditing}
                    />
                )}
            </div>

             {isAiModalOpen && selection && <AiAssistantModal selectedText={selection.text} onGenerate={handleAiModify} onClose={() => { setIsAiModalOpen(false); setSelection(null); }} isLoading={!!inlineModificationState} />}
            {isHistoryModalOpen && <VersionHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} versions={filteredHistory} documentName={documentName} onRestore={onRestoreVersion} />}
        </div>
    );
};