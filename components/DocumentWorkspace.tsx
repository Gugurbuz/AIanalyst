// components/DocumentWorkspace.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Conversation, Template, MaturityReport, GeneratedDocs } from '../types';
import { DocumentCanvas } from './DocumentCanvas'; // Changed from GeneratedDocument
import { Visualizations } from './Visualizations';
import { MaturityCheckReport } from './MaturityCheckReport';
import { TemplateSelector } from './TemplateSelector';
import { ExportDropdown } from './ExportDropdown';
import { GanttChartSquare, Projector, RefreshCw } from 'lucide-react';
import { BacklogGenerationView } from './BacklogGenerationView';
import { geminiService } from '../services/geminiService';
import type { DocumentImpactAnalysis } from '../services/geminiService';


// A simple hook to get the previous value of a prop or state.
function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}


interface DocumentWorkspaceProps {
    conversation: Conversation;
    isProcessing: boolean; // This is now the GLOBAL processing state (e.g., for chat)
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null;
    onUpdateDocument: (docKey: 'analysisDoc' | 'testScenarios', newContent: string, reason: string) => void;
    onModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => Promise<void>;
    onModifyDiagram: (userPrompt: string) => Promise<void>;
    onGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => void;
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
    activeDocTab: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation';
    setActiveDocTab: (tab: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation') => void;
    onPrepareQuestionForAnswer: (question: string) => void;
    diagramType: 'mermaid' | 'bpmn';
    setDiagramType: (type: 'mermaid' | 'bpmn') => void;
    onAddTokens: (tokens: number) => void;
}

const StaleIndicator = ({ isStale }: { isStale?: boolean }) => {
    if (!isStale) return null;
    return (
        <span 
            className="ml-2 w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse"
            title="Bu bölüm, analiz dokümanındaki son değişiklikler nedeniyle güncel olmayabilir."
        />
    );
};

export const DocumentWorkspace: React.FC<DocumentWorkspaceProps> = ({
    conversation,
    isProcessing,
    generatingDocType,
    onUpdateDocument,
    onModifySelection,
    onModifyDiagram,
    onGenerateDoc,
    inlineModificationState,
    templates,
    selectedTemplates,
    onTemplateChange,
    activeDocTab,
    setActiveDocTab,
    onPrepareQuestionForAnswer,
    diagramType,
    setDiagramType,
    onAddTokens,
}) => {
    
    // Local state for visualization to make it non-blocking
    const [isVisualizing, setIsVisualizing] = useState(false);
    const [vizError, setVizError] = useState<string | null>(null);
    const [isAnalyzingChange, setIsAnalyzingChange] = useState(false);
    
    const { generatedDocs, id: conversationId } = conversation;
    const prevAnalysisDoc = usePrevious(generatedDocs.analysisDoc);
    
    const onUpdateConversation = (id: string, updates: Partial<Conversation>) => {
        // This is a placeholder now, the main logic is in App.tsx
        // But we need it for BacklogGenerationView
    };


    // --- AI-Powered Impact Analysis Effect ---
    useEffect(() => {
        // Run only when analysisDoc actually changes and it's not the initial load
        if (prevAnalysisDoc !== undefined && generatedDocs.analysisDoc !== prevAnalysisDoc && !isProcessing) {
            const analyze = async () => {
                setIsAnalyzingChange(true);
                try {
                    // FIX: Destructure the 'impact' object from the service call result.
                    const { impact, tokens } = await geminiService.analyzeDocumentChange(
                        prevAnalysisDoc || '', 
                        generatedDocs.analysisDoc,
                        'gemini-2.5-flash-lite' // Use a fast model for this
                    );
                    onAddTokens(tokens);

                    const newGeneratedDocs: GeneratedDocs = {
                        ...generatedDocs,
                        isVizStale: impact.isVisualizationImpacted,
                        isTestStale: impact.isTestScenariosImpacted,
                        isTraceabilityStale: impact.isTraceabilityImpacted,
                        isBacklogStale: impact.isBacklogImpacted,
                    };
                    
                    // The parent component will handle the state update and token count
                    // onUpdateConversation(conversationId, { generatedDocs: newGeneratedDocs });

                } catch (error) {
                    console.error("Impact analysis failed:", error);
                    // On failure, assume major change and mark all as stale
                    const newGeneratedDocs: GeneratedDocs = {
                        ...generatedDocs,
                        isVizStale: true,
                        isTestStale: true,
                        isTraceabilityStale: true,
                        isBacklogStale: true,
                    };
                    // onUpdateConversation(conversationId, { generatedDocs: newGeneratedDocs });
                } finally {
                    setIsAnalyzingChange(false);
                }
            };
            analyze();
        }
    }, [generatedDocs.analysisDoc, prevAnalysisDoc, conversationId, onUpdateConversation, isProcessing, onAddTokens]);


    const docTabs = [
        { id: 'analysis', name: 'İş Analizi', isStale: false },
        { id: 'viz', name: 'Görselleştirme', isStale: generatedDocs.isVizStale },
        { id: 'test', name: 'Test Senaryoları', isStale: generatedDocs.isTestStale },
        { id: 'traceability', name: 'İzlenebilirlik', isStale: generatedDocs.isTraceabilityStale },
        { id: 'backlog-generation', name: 'Backlog Oluşturma', isStale: generatedDocs.isBacklogStale },
        { id: 'maturity', name: 'Olgunluk', isStale: false },
    ];
    
    const vizContent = diagramType === 'bpmn'
        ? generatedDocs.bpmnViz?.code ?? (generatedDocs.visualizationType === 'bpmn' ? generatedDocs.visualization : '')
        : generatedDocs.mermaidViz?.code ?? (generatedDocs.visualizationType !== 'bpmn' ? generatedDocs.visualization : '');

    const isAnalysisDocReady = !!generatedDocs.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");

    const handleGenerateOrModifyViz = async (prompt?: string) => {
        setIsVisualizing(true);
        setVizError(null);
        try {
            if (prompt) {
                await onModifyDiagram(prompt);
            } else {
                await onGenerateDoc('viz', undefined, diagramType);
            }
        } catch (e: any) {
            setVizError(e.message || "Diyagram oluşturulurken bilinmeyen bir hata oluştu.");
        } finally {
            setIsVisualizing(false);
        }
    };

    const handleDiagramTypeChange = (newType: 'mermaid' | 'bpmn') => {
        if (newType === diagramType) return;
        setDiagramType(newType);
        handleGenerateOrModifyViz();
    };

    const handleDismissMaturityQuestion = (questionToRemove: string) => {
        if (!conversation.generatedDocs.maturityReport) return;

        const newReport: MaturityReport = {
            ...conversation.generatedDocs.maturityReport,
            suggestedQuestions: conversation.generatedDocs.maturityReport.suggestedQuestions.filter(
                q => q !== questionToRemove
            ),
        };
        
        onUpdateConversation(conversation.id, {
            generatedDocs: { ...conversation.generatedDocs, maturityReport: newReport }
        });
    };
    
    // Wrapper for regeneration functions to clear the stale flag
    const handleRegenerate = (docType: 'viz' | 'test' | 'traceability' | 'backlog-generation') => {
        const staleKey = `is${docType.charAt(0).toUpperCase() + docType.slice(1)}Stale`.replace('generation', '');
        const newGeneratedDocs = { ...generatedDocs, [staleKey]: false };
        onUpdateConversation(conversation.id, { generatedDocs: newGeneratedDocs });
        onGenerateDoc(docType as any);
    }
    

    return (
        <div className="flex flex-col h-full w-full">
            {/* Tabs Navigation */}
            <div className="px-4 flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {docTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveDocTab(tab.id as any)}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center ${
                                activeDocTab === tab.id
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-200 dark:hover:border-slate-500'
                            }`}
                        >
                            {tab.name}
                            <StaleIndicator isStale={tab.isStale} />
                        </button>
                    ))}
                </nav>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto relative min-h-0">
                {activeDocTab === 'analysis' && (
                    <div className="relative h-full">
                        <DocumentCanvas
                            key="analysis"
                            content={generatedDocs.analysisDoc} 
                            onContentChange={(newContent, reason) => onUpdateDocument('analysisDoc', newContent, reason)} 
                            docKey="analysisDoc" 
                            onModifySelection={onModifySelection} 
                            inlineModificationState={inlineModificationState} 
                            isGenerating={isProcessing} 
                            isStreaming={generatingDocType === 'analysis'}
                            placeholder="Henüz bir analiz dokümanı oluşturulmadı. Başlamak için 'Doküman Oluştur' butonunu kullanın."
                            templates={templates.analysis}
                            selectedTemplate={selectedTemplates.analysis}
                            onTemplateChange={onTemplateChange.analysis}
                            filename={`${conversation.title}-analiz`}
                            history={generatedDocs.analysisDocHistory}
                            onAddTokens={onAddTokens}
                        />
                    </div>
                )}
                 {activeDocTab === 'viz' && (
                    <div className="relative h-full flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Süreç Görselleştirmesi</h3>
                                <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
                                    <button onClick={() => handleDiagramTypeChange('mermaid')} disabled={isVisualizing} className={`px-2 py-1 text-xs flex items-center gap-1.5 sm:px-3 sm:py-1 sm:text-sm font-semibold rounded-md transition-colors disabled:cursor-not-allowed ${diagramType === 'mermaid' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                        <GanttChartSquare className="h-4 w-4" /> Mermaid
                                    </button>
                                    <button onClick={() => handleDiagramTypeChange('bpmn')} disabled={isVisualizing} className={`px-2 py-1 text-xs flex items-center gap-1.5 sm:px-3 sm:py-1 sm:text-sm font-semibold rounded-md transition-colors disabled:cursor-not-allowed ${diagramType === 'bpmn' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                        <Projector className="h-4 w-4" /> BPMN
                                    </button>
                                </div>
                            </div>
                           <div className="flex items-center gap-2">
                               {generatedDocs.isVizStale && (
                                    <button onClick={() => handleRegenerate('viz')} className="px-3 py-1.5 text-sm font-medium text-white bg-amber-500 rounded-md shadow-sm hover:bg-amber-600 flex items-center gap-2">
                                        <RefreshCw className="h-4 w-4" /> Şimdi Güncelle
                                    </button>
                               )}
                               <ExportDropdown content={vizContent} filename={`${conversation.title}-gorsellestirme`} visualizationType={vizContent ? diagramType : null} />
                           </div>
                        </div>
                        <Visualizations 
                            content={vizContent}
                            onModifyDiagram={(prompt) => handleGenerateOrModifyViz(prompt)}
                            onGenerateDiagram={() => handleGenerateOrModifyViz()}
                            isLoading={isVisualizing}
                            error={vizError}
                            diagramType={diagramType}
                            isAnalysisDocReady={isAnalysisDocReady}
                        />
                    </div>
                )}
                {activeDocTab === 'test' && (
                    <div className="relative h-full">
                         <DocumentCanvas
                            key="test"
                            content={generatedDocs.testScenarios} 
                            onContentChange={(newContent, reason) => onUpdateDocument('testScenarios', newContent, reason)} 
                            docKey="testScenarios" 
                            onModifySelection={onModifySelection} 
                            inlineModificationState={inlineModificationState} 
                            isGenerating={isProcessing}
                            isStreaming={generatingDocType === 'test'}
                            placeholder="Henüz test senaryosu oluşturulmadı. Önce bir analiz dokümanı oluşturun, ardından AI'dan senaryo üretmesini isteyin."
                            templates={templates.test}
                            selectedTemplate={selectedTemplates.test}
                            onTemplateChange={onTemplateChange.test}
                            filename={`${conversation.title}-test-senaryolari`}
                            isTable
                            history={generatedDocs.testScenariosHistory}
                            onAddTokens={onAddTokens}
                        />
                    </div>
                )}
                 {activeDocTab === 'traceability' && (
                     <div className="relative h-full">
                        <DocumentCanvas
                            key="traceability"
                            content={generatedDocs.traceabilityMatrix} 
                            onContentChange={() => {}} // Not editable directly
                            docKey="analysisDoc" // Dummy key, rephrase is a no-op
                            onModifySelection={async () => {}} // No-op to prevent errors
                            inlineModificationState={inlineModificationState} 
                            isGenerating={isProcessing}
                            isStreaming={generatingDocType === 'traceability'}
                            isTable
                            filename={`${conversation.title}-izlenebilirlik`}
                             onGenerate={() => onGenerateDoc('traceability')}
                            generateButtonText="Matris Oluştur"
                            isGenerationDisabled={isProcessing || !generatedDocs.analysisDoc || !generatedDocs.testScenarios}
                            generationDisabledTooltip="Matris oluşturmak için önce analiz ve test dokümanlarını oluşturmalısınız."
                            onAddTokens={onAddTokens}
                        />
                    </div>
                )}
                {activeDocTab === 'backlog-generation' && (
                    <div className="relative h-full">
                        <BacklogGenerationView
                            conversation={conversation}
                            onUpdateConversation={onUpdateConversation}
                        />
                    </div>
                )}
                 {activeDocTab === 'maturity' && (
                    <div className="relative h-full">
                        <MaturityCheckReport 
                            report={generatedDocs.maturityReport || null}
                            onPrepareQuestionForAnswer={onPrepareQuestionForAnswer}
                            onDismissQuestion={handleDismissMaturityQuestion}
                            isLoading={isProcessing && generatingDocType === 'maturity'}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};