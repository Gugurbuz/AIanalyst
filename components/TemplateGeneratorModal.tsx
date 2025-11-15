// components/TemplateGeneratorModal.tsx
import React, { useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import type { Prompt, DocumentType } from '../types';
import { TiptapEditor } from './TiptapEditor';
import { FileUp, LoaderCircle, Sparkles, X, AlertTriangle } from 'lucide-react';

interface TemplateGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newPrompt: Omit<Prompt, 'id' | 'versions' | 'activeVersionId'> & { prompt: string }) => void;
}

export const TemplateGeneratorModal: React.FC<TemplateGeneratorModalProps> = ({ isOpen, onClose, onSave }) => {
    const [step, setStep] = useState<'upload' | 'edit'>('upload');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState('');
    
    // Edit state
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [templateContent, setTemplateContent] = useState('');
    const [documentType, setDocumentType] = useState<DocumentType>('analysis');

    const handleFileDrop = useCallback(async (file: File) => {
        if (!file.type.startsWith('text/')) {
            setError('Geçersiz dosya tipi. Lütfen bir metin dosyası (.txt, .md) yükleyin.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setFileName(file.name);
        setTemplateName(file.name.replace(/\.[^/.]+$/, "")); // Use filename as default name

        try {
            const fileContent = await file.text();
            const { template, tokens } = await geminiService.generateTemplateFromText(fileContent);
            setTemplateContent(template);
            setStep('edit');
        } catch (e: any) {
            setError(`Şablon oluşturulurken bir hata oluştu: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            handleFileDrop(event.dataTransfer.files[0]);
            event.dataTransfer.clearData();
        }
    }, [handleFileDrop]);

    const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            handleFileDrop(event.target.files[0]);
        }
    };

    const handleSave = () => {
        if (!templateName.trim() || !templateContent.trim()) {
            alert("Lütfen şablon için bir isim ve içerik girin.");
            return;
        }
        onSave({
            name: templateName,
            description: templateDescription,
            document_type: documentType,
            prompt: templateContent,
        });
    };
    
    const resetState = () => {
        setStep('upload');
        setIsLoading(false);
        setError(null);
        setFileName('');
        setTemplateName('');
        setTemplateDescription('');
        setTemplateContent('');
        setDocumentType('analysis');
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-70 flex items-center justify-center p-4" onClick={handleClose}>
            <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Dosyadan Şablon Oluştur</h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </button>
                </header>
                
                <div className="flex-1 p-6 overflow-y-auto min-h-0">
                    {step === 'upload' && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={onDrop}
                                className="w-full max-w-2xl p-10 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
                                onClick={() => document.getElementById('file-upload')?.click()}
                            >
                                <input type="file" id="file-upload" className="hidden" accept=".txt,.md,text/plain,text/markdown" onChange={onFileInputChange} />
                                {isLoading ? (
                                    <>
                                        <LoaderCircle className="mx-auto h-12 w-12 text-indigo-500 animate-spin" />
                                        <p className="mt-4 font-semibold text-slate-700 dark:text-slate-300">"{fileName}" analiz ediliyor...</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">AI şablon taslağını oluşturuyor.</p>
                                    </>
                                ) : (
                                    <>
                                        <FileUp className="mx-auto h-12 w-12 text-slate-400" />
                                        <p className="mt-4 font-semibold text-slate-700 dark:text-slate-300">Dosyayı sürükleyip bırakın veya tıklayıp seçin</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Desteklenen formatlar: .txt, .md</p>
                                    </>
                                )}
                            </div>
                            {error && (
                                <div className="mt-4 p-3 max-w-2xl text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600 flex items-start gap-2">
                                    <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {step === 'edit' && (
                        <div className="flex flex-col h-full gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="template-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Şablon Adı</label>
                                    <input id="template-name" type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} required className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700" />
                                </div>
                                <div>
                                    <label htmlFor="document-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Doküman Tipi</label>
                                    <select id="document-type" value={documentType} onChange={e => setDocumentType(e.target.value as DocumentType)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700">
                                        <option value="analysis">İş Analizi</option>
                                        <option value="test">Test Senaryoları</option>
                                        <option value="traceability">İzlenebilirlik</option>
                                        <option value="mermaid">Mermaid Diyagram</option>
                                        <option value="bpmn">BPMN Diyagram</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="template-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Açıklama (İsteğe bağlı)</label>
                                <input id="template-desc" type="text" value={templateDescription} onChange={e => setTemplateDescription(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700" />
                            </div>
                            <div className="flex-1 flex flex-col min-h-0">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Şablon İçeriği (Markdown)</label>
                                <div className="flex-1 border border-slate-300 dark:border-slate-600 rounded-md overflow-hidden min-h-[300px]">
                                    <TiptapEditor
                                        content={templateContent}
                                        onChange={setTemplateContent}
                                        isEditable={true}
                                        onSelectionUpdate={() => {}}
                                        onEditWithAI={() => {}}
                                        onExplainSelection={() => {}}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {step === 'edit' && (
                    <footer className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                         <button onClick={resetState} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600">Baştan Başla</button>
                        <div className="flex gap-3">
                            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600">İptal</button>
                            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700">Şablonu Kaydet</button>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
};
