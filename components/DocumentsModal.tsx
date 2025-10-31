// components/DocumentsModal.tsx
import React from 'react';
import type { Conversation, Template } from '../types';
import { DocumentWorkspace } from './DocumentWorkspace';

interface DocumentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    isGenerating: boolean;
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null;
    onUpdateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
    onModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => Promise<void>;
    onModifyDiagram: (userPrompt: string) => Promise<void>;
    onGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => void;
    inlineModificationState: { docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null;
    templates: {
        analysis: Template[];
        test: Template[];
    };
    selectedTemplates: {
        analysis: string;
        test: string;
    };
    onTemplateChange: {
        analysis: (event: React.ChangeEvent<HTMLSelectElement>) => void;
        test: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    };
    activeDocTab: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability';
    setActiveDocTab: (tab: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability') => void;
    onSelectMaturityQuestion: (question: string) => void;
    onRecheckMaturity: () => void;
    diagramType: 'mermaid' | 'bpmn';
    setDiagramType: (type: 'mermaid' | 'bpmn') => void;
}

export const DocumentsModal: React.FC<DocumentsModalProps> = (props) => {
    if (!props.isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }} onClick={props.onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Doküman Çalışma Alanı</h2>
                    <button onClick={props.onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <div className="flex-1 min-h-0">
                    <DocumentWorkspace {...props} />
                </div>
            </div>
        </div>
    );
};