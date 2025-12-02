// components/DocumentWorkspace.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import type { Conversation, Template, MaturityReport, GeneratedDocs, Document, DocumentType, SourcedDocument, DocumentVersion, IsBirimiTalep } from '../types';
import { DocumentCanvas } from './DocumentCanvas';
import { DocumentEmptyState } from './DocumentEmptyState'; 
import { geminiService } from '../services/geminiService';
import type { DocumentImpactAnalysis } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { GanttChartSquare, Projector, RefreshCw, Check, FileText, Beaker, GitBranch, FileInput, CheckSquare, LoaderCircle } from 'lucide-react';
import { isIsBirimiTalep } from '../types';

// Lazy load heavy components
const Visualizations = React.lazy(() => import('./Visualizations').then(m => ({ default: m.Visualizations })));
const MaturityCheckReport = React.lazy(() => import('./MaturityCheckReport').then(m => ({ default: m.MaturityCheckReport })));
const BacklogGenerationView = React.lazy(() => import('./BacklogGenerationView').then(m => ({ default: m.BacklogGenerationView })));


function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

interface DocumentWorkspaceProps {
    conversation: Conversation & { generatedDocs: GeneratedDocs };
    onUpdateConversation: (id: string, updates: Partial<Conversation>) => void;
    isProcessing: boolean;
    generatingDocType: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null;
    onUpdateDocument: (docKey: keyof GeneratedDocs, newContent: string, reason: string) => void;
    onModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => Promise<void>;
    onModifyDiagram: (userPrompt: string) => Promise<void>;
    onGenerateDoc: (type: 'request' | 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', newTemplateId?: string) => void;
    inlineModificationState: { docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null;
    templates: {
        analysis: Template[];
        test: Template[];
        traceability: Template[];
    };
    selectedTemplates: {
        analysis: string;
        test: string;
        traceability: string;
    };
    onTemplateChange: {
        analysis: (event: React.ChangeEvent<HTMLSelectElement>) => void;
        test: (event: React.ChangeEvent<HTMLSelectElement>) => void;
        traceability: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    };
    activeDocTab: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation';
    setActiveDocTab: (tab: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation') => void;
    onPrepareQuestionForAnswer: (question: string) => void;
    onAddTokens: (tokens: number) => void;
    onRestoreVersion: (version: DocumentVersion) => void;
}

const StaleIndicator: React.FC<{ isStale?: boolean }> = ({ isStale }) => {
    if (!isStale) return null;
    return (
        <span 
            className="ml-2 w-2.5 h-2.5 rounded-full bg-amber-500 stale-pulse shadow-sm"
            title="Bu bölüm, analiz dokümanındaki son değişiklikler nedeniyle güncel olmayabilir. Görüntülemek için tıkladığınızda otomatik olarak güncellenecektir."
        />
    );
};

const TabSpinner = () => (
    <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <LoaderCircle className="animate-spin h-8 w-8 mb-2" />
        <span className="text-sm">Yükleniyor...</span>
    </div>
);

export const DocumentWorkspace: React.FC<DocumentWorkspaceProps> = ({
    conversation,
    onUpdateConversation,
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
    onAddTokens,
    onRestoreVersion,
}) => {
    
    const [isVisualizing, setIsVisualizing] = useState(false);
    const [vizError, setVizError] = useState<string | null>(null);
    const [isAnalyzingChange, setIsAnalyzingChange] = useState(false);
    
    const { generatedDocs, id: conversationId } = conversation;
    const currentAnalysisContent = generatedDocs.analysisDoc?.content;
    const prevAnalysisDoc = usePrevious(currentAnalysisContent);
    
    const updateDocumentStaleness = useCallback(async (docType: DocumentType, isStale: boolean) => {
        const { error } = await supabase
            .from('documents')
            .update({ is_stale: isStale })
            .eq('conversation_id', conversationId)
            .eq('document_type', docType);
        if (error) console.error(`Failed to update staleness for ${docType}:`, error);
    }, [conversationId]);

    useEffect(() => {
        if (prevAnalysisDoc !== undefined && currentAnalysisContent !== prevAnalysisDoc && !isProcessing) {
            const analyze = async () => {
                setIsAnalyzingChange(true);
                try {
                    const { impact, tokens } = await geminiService.analyzeDocumentChange(prevAnalysisDoc || '', currentAnalysisContent || '', 'gemini-2.5-flash-lite');
                    onAddTokens(tokens);
                    if (impact.isVisualizationImpacted) await updateDocumentStaleness('bpmn', true);
                    if (impact.isTestScenariosImpacted) await updateDocumentStaleness('test', true);
                    if (impact.isTraceabilityImpacted) await updateDocumentStaleness('traceability', true);
                } catch (error) {
                    console.error("Impact analysis failed:", error);
                    await Promise.all([
                        updateDocumentStaleness('bpmn', true),
                        updateDocumentStaleness('test', true),
                        updateDocumentStaleness('traceability', true)
                    ]);
                } finally {
                    setIsAnalyzingChange(false);
                }
            };
            analyze();
        }
    }, [currentAnalysisContent, prevAnalysisDoc, conversationId, isProcessing, onAddTokens, updateDocumentStaleness]);

    const handleRegenerate = useCallback((docType: 'viz' | 'test' | 'traceability' | 'backlog-generation') => {
        if (docType === 'viz') {
            updateDocumentStaleness('bpmn', false);
        } else {
            const typeMap: Record<string, DocumentType> = { test: 'test', traceability: 'traceability' };
            const dbDocType = typeMap[docType];
            if (dbDocType) updateDocumentStaleness(dbDocType, false);
        }
        onGenerateDoc(docType as any);
    }, [onGenerateDoc, updateDocumentStaleness]);

    useEffect(() => {
        if (isProcessing) return; 

        // Auto-regenerate stale docs if user switches to their tab
        let staleAction: (() => void) | null = null;
        if (activeDocTab === 'viz' && generatedDocs.bpmnViz?.isStale) {
            staleAction = () => handleRegenerate('viz');
        } else if (activeDocTab === 'test' && generatedDocs.testScenarios?.isStale) {
            staleAction = () => handleRegenerate('test');
        } else if (activeDocTab === 'traceability' && generatedDocs.traceabilityMatrix?.isStale) {
            staleAction = () => handleRegenerate('traceability');
        }

        if (staleAction) {
            staleAction();
        }
    }, [activeDocTab, generatedDocs, isProcessing, handleRegenerate]);


    const vizContent = generatedDocs.bpmnViz?.content || '';
    const testScenariosContent = generatedDocs.testScenarios?.content || '';
    const traceabilityMatrixContent = generatedDocs.traceabilityMatrix?.content || '';
    const requestDocContent = generatedDocs.requestDoc?.content || '';
    const analysisDocContent = generatedDocs.analysisDoc?.content || '';

    const isAnalysisDocReady = !!analysisDocContent && !analysisDocContent.includes("Bu bölüme projenin temel hedefini");

    const allTabs = [
        { id: 'request', name: 'Talep', icon: FileInput, content: requestDocContent, isStale: false },
        { id: 'analysis', name: 'İş Analizi', icon: FileText, content: analysisDocContent, isStale: false },
        { id: 'viz', name: 'Görselleştirme', icon: GanttChartSquare, content: vizContent, isStale: generatedDocs.bpmnViz?.isStale },
        { id: 'test', name: 'Test Senaryoları', icon: Beaker, content: testScenariosContent, isStale: generatedDocs.testScenarios?.isStale },
        { id: 'traceability', name: 'İzlenebilirlik', icon: GitBranch, content: traceabilityMatrixContent, isStale: generatedDocs.traceabilityMatrix?.isStale },
        { id: 'backlog-generation', name: 'Backlog', icon: CheckSquare, content: true, isStale: false },
        { id: 'maturity', name: 'Olgunluk', icon: Check, content: true, isStale: false },
    ];

    const handleGenerateOrModifyViz = async (prompt?: string) => {
        setIsVisualizing(true);
        setVizError(null);
        try {
            if (prompt) await onModifyDiagram(prompt);
            else await onGenerateDoc('viz');
        } catch (e: any) {
            setVizError(e.message || "Diyagram oluşturulurken bilinmeyen bir hata oluştu.");
        } finally {
            setIsVisualizing(false);
        }
    };

    const handleDismissMaturityQuestion = (questionToRemove: string) => {
        if (!conversation.generatedDocs.maturityReport?.metadata) return;
        const currentReport = conversation.generatedDocs.maturityReport.metadata as MaturityReport;
        
        const newReport: MaturityReport = {
            ...currentReport,
            suggestedQuestions: currentReport.suggestedQuestions.filter(q => q !== questionToRemove),
        };
        onUpdateDocument('maturityReport', JSON.stringify(newReport), 'Kullanıcı soruyu reddetti');
    };
    
    const handleExplainSelection = (text: string) => {
        onPrepareQuestionForAnswer(`Bu metni açıkla: "${text}"`);
    };

    return (
        <div className="flex flex-col h-full w-full min-h-0">
            <div className="px-4 flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {allTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveDocTab(tab.id as any)}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center ${
                                activeDocTab === tab.id
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-200 dark:hover:border-slate-500'
                            }`}
                        >
                            <tab.icon className="h-5 w-5 mr-2" />
                            {tab.name}
                            <StaleIndicator isStale={tab.isStale} />
                        </button>
                    ))}
                </nav>
            </div>
            
            <div className="flex-1 overflow-y-auto relative min-h-0">
                {activeDocTab === 'request' && (
                    requestDocContent ? (
                        <DocumentCanvas
                            key="request"
                            content={requestDocContent}
                            onContentChange={(newContent, reason) => onUpdateDocument('requestDoc', newContent, reason)}
                            docKey="requestDoc"
                            onModifySelection={onModifySelection}
                            inlineModificationState={inlineModificationState}
                            isGenerating={isProcessing}
                            isStreaming={false}
                            filename={`${conversation.title}-talep`}
                            documentVersions={conversation.documentVersions}
                            onAddTokens={onAddTokens}
                            onRestoreVersion={onRestoreVersion}
                            onExplainSelection={handleExplainSelection}
                        />
                    ) : (
                        <DocumentEmptyState 
                            icon={<FileInput />} 
                            title="Talep Dokümanı" 
                            description="Henüz bir talep dokümanı yok. Sohbet geçmişini kullanarak otomatik olarak oluşturabilirsiniz." 
                            buttonText="Sohbetten Oluştur" 
                            onAction={() => onGenerateDoc('request')} 
                            isDisabled={isProcessing || conversation.messages.length <= 1}
                            isLoading={generatingDocType === 'request'}
                        />
                    )
                )}
                {activeDocTab === 'analysis' && (analysisDocContent ?
                    <DocumentCanvas key="analysis" content={analysisDocContent} onContentChange={(newContent, reason) => onUpdateDocument('analysisDoc', newContent, reason)} docKey="analysisDoc" onModifySelection={onModifySelection} inlineModificationState={inlineModificationState} isGenerating={isProcessing} isStreaming={generatingDocType === 'analysis'} templates={templates.analysis} selectedTemplate={selectedTemplates.analysis} onTemplateChange={onTemplateChange.analysis} filename={`${conversation.title}-analiz`} documentVersions={conversation.documentVersions} onAddTokens={onAddTokens} onRestoreVersion={onRestoreVersion} onExplainSelection={handleExplainSelection} />
                    : <DocumentEmptyState icon={<FileText />} title="İş Analizi Dokümanı" description="Analistle sohbet ederek gereksinimleri olgunlaştırın. Yeterli bilgi toplandığında, AI doküman oluşturmayı önerecektir." buttonText="Analiz Dokümanı Oluştur" onAction={() => onGenerateDoc('analysis')} isDisabled={isProcessing || !requestDocContent} disabledTooltip="Önce bir talep dokümanı gereklidir." isLoading={generatingDocType === 'analysis'}/>
                )}
                 {activeDocTab === 'viz' && (analysisDocContent ?
                    <Suspense fallback={<TabSpinner />}>
                        <div className="relative h-full flex flex-col">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Süreç Görselleştirmesi (BPMN)</h3>
                            </div>
                            <Visualizations content={vizContent} onModifyDiagram={(prompt) => handleGenerateOrModifyViz(prompt)} onGenerateDiagram={() => handleGenerateOrModifyViz()} isLoading={isVisualizing || generatingDocType === 'viz'} error={vizError} isAnalysisDocReady={isAnalysisDocReady}/>
                        </div>
                    </Suspense>
                    : <DocumentEmptyState icon={<GanttChartSquare />} title="Süreç Görselleştirmesi" description="Görselleştirme oluşturmak için önce bir iş analizi dokümanı gereklidir." buttonText="Analiz Dokümanı Oluştur" onAction={() => setActiveDocTab('analysis')} />
                )}
                {activeDocTab === 'test' && (testScenariosContent ?
                    <DocumentCanvas key="test" content={testScenariosContent} onContentChange={(newContent, reason) => onUpdateDocument('testScenarios', newContent, reason)} docKey="testScenarios" onModifySelection={onModifySelection} inlineModificationState={inlineModificationState} isGenerating={isProcessing} isStreaming={generatingDocType === 'test'} templates={templates.test} selectedTemplate={selectedTemplates.test} onTemplateChange={onTemplateChange.test} filename={`${conversation.title}-test-senaryolari`} isTable documentVersions={conversation.documentVersions} onAddTokens={onAddTokens} onRestoreVersion={onRestoreVersion} onExplainSelection={handleExplainSelection} />
                    : <DocumentEmptyState icon={<Beaker />} title="Test Senaryoları" description="Analiz dokümanınıza dayanarak test senaryoları oluşturun." buttonText="Test Senaryoları Oluştur" onAction={() => onGenerateDoc('test')} isDisabled={isProcessing || !isAnalysisDocReady} disabledTooltip="Önce geçerli bir analiz dokümanı oluşturmalısınız." isLoading={generatingDocType === 'test'}/>
                )}
                 {activeDocTab === 'traceability' && (traceabilityMatrixContent ?
                    <DocumentCanvas key="traceability" content={traceabilityMatrixContent} onContentChange={(newContent, reason) => onUpdateDocument('traceabilityMatrix', newContent, reason)} docKey="traceabilityMatrix" onModifySelection={async () => {}} inlineModificationState={inlineModificationState} isGenerating={isProcessing} isStreaming={generatingDocType === 'traceability'} isTable filename={`${conversation.title}-izlenebilirlik`} documentVersions={conversation.documentVersions} onAddTokens={onAddTokens} templates={templates.traceability} selectedTemplate={selectedTemplates.traceability} onTemplateChange={onTemplateChange.traceability} onRestoreVersion={onRestoreVersion} onExplainSelection={handleExplainSelection} />
                    : <DocumentEmptyState icon={<GitBranch />} title="İzlenebilirlik Matrisi" description="Gereksinimler ile test senaryoları arasındaki ilişkiyi kurun." buttonText="Matris Oluştur" onAction={() => onGenerateDoc('traceability')} isDisabled={isProcessing || !isAnalysisDocReady || !testScenariosContent} disabledTooltip="Önce analiz ve test dokümanları oluşturmalısınız." isLoading={generatingDocType === 'traceability'}/>
                )}
                {activeDocTab === 'backlog-generation' && (
                    <Suspense fallback={<TabSpinner />}>
                        <BacklogGenerationView conversation={conversation} onUpdateConversation={onUpdateConversation} />
                    </Suspense>
                )}
                {activeDocTab === 'maturity' && (
                    <Suspense fallback={<TabSpinner />}>
                        <MaturityCheckReport report={generatedDocs.maturityReport?.metadata || null} onPrepareQuestionForAnswer={onPrepareQuestionForAnswer} onDismissQuestion={handleDismissMaturityQuestion} isLoading={isProcessing && generatingDocType === 'maturity'} />
                    </Suspense>
                )}
            </div>
        </div>
    );
};