// components/DocumentWorkspace.tsx
import React from 'react';
import type { Conversation, Template } from '../types';
import { GeneratedDocument } from './GeneratedDocument';
import { Visualizations } from './Visualizations';
import { MaturityCheckReport } from './MaturityCheckReport';
import { TemplateSelector } from './TemplateSelector';
import { ExportDropdown } from './ExportDropdown';

interface DocumentWorkspaceProps {
    conversation: Conversation;
    isGenerating: boolean;
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null;
    onUpdateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
    onModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => Promise<void>;
    onGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability') => void;
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
}

const DocLoadingSpinner: React.FC = () => (
    <div className="absolute inset-0 bg-white/70 dark:bg-slate-800/70 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Doküman güncelleniyor...</p>
    </div>
);


export const DocumentWorkspace: React.FC<DocumentWorkspaceProps> = ({
    conversation,
    isGenerating,
    generatingDocType,
    onUpdateConversation,
    onModifySelection,
    onGenerateDoc,
    inlineModificationState,
    templates,
    selectedTemplates,
    onTemplateChange,
    activeDocTab,
    setActiveDocTab,
    onSelectMaturityQuestion,
    onRecheckMaturity,
}) => {
    
    const docTabs = [
        { id: 'analysis', name: 'İş Analizi' },
        { id: 'viz', name: 'Görselleştirme' },
        { id: 'test', name: 'Test Senaryoları' },
        { id: 'traceability', name: 'İzlenebilirlik' },
        { id: 'maturity', name: 'Olgunluk' },
    ];

    const { generatedDocs } = conversation;

    return (
        <div className="flex flex-col h-full w-full">
            {/* Tabs Navigation */}
            <div className="px-4 flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {docTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveDocTab(tab.id as any)}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeDocTab === tab.id
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-200 dark:hover:border-slate-500'
                            }`}
                        >
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {activeDocTab === 'analysis' && (
                    <div className="relative h-full">
                        {isGenerating && generatingDocType === 'analysis' && <DocLoadingSpinner />}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                             <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">İş Analizi Dokümanı</h3>
                            <div className="flex items-center gap-2">
                                <TemplateSelector label="Şablon" templates={templates.analysis} selectedValue={selectedTemplates.analysis} onChange={onTemplateChange.analysis} disabled={isGenerating} />
                                <ExportDropdown content={generatedDocs.analysisDoc} filename={`${conversation.title}-analiz`} />
                            </div>
                        </div>
                        <GeneratedDocument 
                            content={generatedDocs.analysisDoc} 
                            onContentChange={(newContent) => onUpdateConversation(conversation.id, { generatedDocs: { ...generatedDocs, analysisDoc: newContent } })} 
                            docKey="analysisDoc" 
                            onModifySelection={onModifySelection} 
                            inlineModificationState={inlineModificationState} 
                            isGenerating={isGenerating} 
                            placeholder="Henüz bir analiz dokümanı oluşturulmadı. Başlamak için 'Doküman Oluştur' butonunu kullanın."
                        />
                    </div>
                )}
                 {activeDocTab === 'viz' && (
                    <div className="relative h-full">
                        {isGenerating && generatingDocType === 'viz' && <DocLoadingSpinner />}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Süreç Görselleştirmesi</h3>
                            <ExportDropdown content={generatedDocs.visualization} filename={`${conversation.title}-gorsellestirme`} isVisualization={true} />
                        </div>
                        <Visualizations content={generatedDocs.visualization} onContentChange={(newContent) => onUpdateConversation(conversation.id, { generatedDocs: { ...generatedDocs, visualization: newContent } })} />
                    </div>
                )}
                {activeDocTab === 'test' && (
                    <div className="relative h-full">
                        {isGenerating && generatingDocType === 'test' && <DocLoadingSpinner />}
                         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Test Senaryoları</h3>
                            <div className="flex items-center gap-2">
                                <TemplateSelector label="Şablon" templates={templates.test} selectedValue={selectedTemplates.test} onChange={onTemplateChange.test} disabled={isGenerating} />
                                <ExportDropdown content={generatedDocs.testScenarios} filename={`${conversation.title}-test-senaryolari`} isTable={true} />
                            </div>
                        </div>
                        <GeneratedDocument 
                            content={generatedDocs.testScenarios} 
                            onContentChange={(newContent) => onUpdateConversation(conversation.id, { generatedDocs: { ...generatedDocs, testScenarios: newContent } })} 
                            docKey="testScenarios" 
                            onModifySelection={onModifySelection} 
                            inlineModificationState={inlineModificationState} 
                            isGenerating={isGenerating}
                            placeholder="Henüz test senaryosu oluşturulmadı. Önce bir analiz dokümanı oluşturun, ardından AI'dan senaryo üretmesini isteyin."
                        />
                    </div>
                )}
                 {activeDocTab === 'traceability' && (
                    <div className="relative h-full">
                        {isGenerating && generatingDocType === 'traceability' && <DocLoadingSpinner />}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">İzlenebilirlik Matrisi</h3>
                            <ExportDropdown content={generatedDocs.traceabilityMatrix} filename={`${conversation.title}-izlenebilirlik`} isTable={true} />
                        </div>
                        {generatedDocs.traceabilityMatrix ? (
                            <GeneratedDocument 
                                content={generatedDocs.traceabilityMatrix} 
                                onContentChange={(newContent) => onUpdateConversation(conversation.id, { generatedDocs: { ...generatedDocs, traceabilityMatrix: newContent } })} 
                                docKey="analysisDoc" // Dummy key, rephrase is a no-op
                                onModifySelection={() => {}} // No-op to prevent errors
                                inlineModificationState={inlineModificationState} 
                                isGenerating={isGenerating}
                            />
                        ) : (
                            <div className="p-6 text-center">
                                <p className="text-slate-500 dark:text-slate-400">Henüz bir izlenebilirlik matrisi oluşturulmadı. Bu matris, gereksinimlerle test senaryolarını eşleştirir.</p>
                                <button 
                                    onClick={() => onGenerateDoc('traceability')} 
                                    disabled={isGenerating || !generatedDocs.analysisDoc || !generatedDocs.testScenarios}
                                    title={(!generatedDocs.analysisDoc || !generatedDocs.testScenarios) ? "Matris oluşturmak için önce analiz ve test dokümanlarını oluşturmalısınız." : "Gereksinimleri ve test senaryolarını eşleştir"}
                                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Matris Oluştur
                                </button>
                            </div>
                        )}
                    </div>
                )}
                 {activeDocTab === 'maturity' && (
                    <div className="relative h-full">
                        {isGenerating && generatingDocType === 'maturity' && <DocLoadingSpinner />}
                        <MaturityCheckReport 
                            report={generatedDocs.maturityReport || null}
                            onSelectQuestion={onSelectMaturityQuestion}
                            onRecheck={onRecheckMaturity}
                            isLoading={isGenerating && generatingDocType === 'maturity'}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};