// components/DocumentWorkspace.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Conversation, Template, MaturityReport, GeneratedDocs, Document, DocumentType, SourcedDocument, DocumentVersion } from '../types';
import { DocumentCanvas } from './DocumentCanvas'; // Changed from GeneratedDocument
import { Visualizations } from './Visualizations';
import { MaturityCheckReport } from './MaturityCheckReport';
import { TemplateSelector } from './TemplateSelector';
import { ExportDropdown } from './ExportDropdown';
import { GanttChartSquare, Projector, RefreshCw, PlusCircle, Check, FileText, Beaker, GitBranch, FileInput } from 'lucide-react';
import { BacklogGenerationView } from './BacklogGenerationView';
import { geminiService } from '../services/geminiService';
import type { DocumentImpactAnalysis } from '../services/geminiService';
// FIX: Import the 'supabase' client to resolve the 'Cannot find name' error.
import { supabase } from '../services/supabaseClient';


// A simple hook to get the previous value of a prop or state.
function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

const simpleHash = (str: string): string => {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
};


interface DocumentWorkspaceProps {
    conversation: Conversation & { generatedDocs: GeneratedDocs };
    onUpdateConversation: (id: string, updates: Partial<Conversation>) => void;
    isProcessing: boolean; // This is now the GLOBAL processing state (e.g., for chat)
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null;
    onUpdateDocument: (docKey: keyof GeneratedDocs, newContent: string | SourcedDocument, reason: string) => void;
    onModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => Promise<void>;
    onModifyDiagram: (userPrompt: string) => Promise<void>;
    onGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => void;
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
    diagramType: 'mermaid' | 'bpmn';
    setDiagramType: (type: 'mermaid' | 'bpmn') => void;
    onAddTokens: (tokens: number) => void;
    onRestoreVersion: (version: DocumentVersion) => void;
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
    diagramType,
    setDiagramType,
    onAddTokens,
    onRestoreVersion,
}) => {
    
    // Local state for visualization to make it non-blocking
    const [isVisualizing, setIsVisualizing] = useState(false);
    const [vizError, setVizError] = useState<string | null>(null);
    const [isAnalyzingChange, setIsAnalyzingChange] = useState(false);
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
    const createMenuRef = useRef<HTMLDivElement>(null);
    
    const { generatedDocs, id: conversationId } = conversation;
    const prevAnalysisDoc = usePrevious(generatedDocs.analysisDoc);
    
    const updateDocumentStaleness = async (docType: DocumentType, isStale: boolean) => {
        const { error } = await supabase
            .from('documents')
            .update({ is_stale: isStale })
            .eq('conversation_id', conversationId)
            .eq('document_type', docType);
        if (error) {
            console.error(`Failed to update staleness for ${docType}:`, error);
        }
    };

    // Close create menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
                setIsCreateMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    // --- AI-Powered Impact Analysis Effect ---
    useEffect(() => {
        // Run only when analysisDoc actually changes and it's not the initial load
        if (prevAnalysisDoc !== undefined && generatedDocs.analysisDoc !== prevAnalysisDoc && !isProcessing) {
            const analyze = async () => {
                setIsAnalyzingChange(true);
                try {
                    const { impact, tokens } = await geminiService.analyzeDocumentChange(
                        prevAnalysisDoc || '', 
                        generatedDocs.analysisDoc,
                        'gemini-2.5-flash-lite' // Use a fast model for this
                    );
                    onAddTokens(tokens);

                    // Update staleness flags in the DB
                    if (impact.isVisualizationImpacted) await updateDocumentStaleness('mermaid', true);
                    if (impact.isTestScenariosImpacted) await updateDocumentStaleness('test', true);
                    if (impact.isTraceabilityImpacted) await updateDocumentStaleness('traceability', true);
                    // backlog staleness is handled in generatedDocs for now

                } catch (error) {
                    console.error("Impact analysis failed:", error);
                    // On failure, assume major change and mark all as stale
                    await Promise.all([
                        updateDocumentStaleness('mermaid', true),
                        updateDocumentStaleness('test', true),
                        updateDocumentStaleness('traceability', true)
                    ]);
                } finally {
                    setIsAnalyzingChange(false);
                }
            };
            analyze();
        }
    }, [generatedDocs.analysisDoc, prevAnalysisDoc, conversationId, isProcessing, onAddTokens]);

    const vizContent = diagramType === 'bpmn'
        ? generatedDocs.bpmnViz?.code ?? (generatedDocs.visualizationType === 'bpmn' ? generatedDocs.visualization : '')
        : generatedDocs.mermaidViz?.code ?? (generatedDocs.visualizationType !== 'bpmn' ? generatedDocs.visualization : '');

    const testScenariosContent = typeof generatedDocs.testScenarios === 'object' 
        ? generatedDocs.testScenarios.content 
        : generatedDocs.testScenarios;
        
    const traceabilityMatrixContent = typeof generatedDocs.traceabilityMatrix === 'object'
        ? generatedDocs.traceabilityMatrix.content
        : generatedDocs.traceabilityMatrix;

    const allTabs = [
        { id: 'request', name: 'Talep', isStale: false, content: generatedDocs.requestDoc, icon: <FileInput className="h-4 w-4 mr-2" /> },
        { id: 'analysis', name: 'İş Analizi', isStale: false, content: generatedDocs.analysisDoc, icon: <FileText className="h-4 w-4 mr-2" /> },
        { id: 'viz', name: 'Görselleştirme', isStale: generatedDocs.isVizStale, content: vizContent, icon: <GanttChartSquare className="h-4 w-4 mr-2" /> },
        { id: 'test', name: 'Test Senaryoları', isStale: generatedDocs.isTestStale, content: testScenariosContent, icon: <Beaker className="h-4 w-4 mr-2" /> },
        { id: 'traceability', name: 'İzlenebilirlik', isStale: generatedDocs.isTraceabilityStale, content: traceabilityMatrixContent, icon: <GitBranch className="h-4 w-4 mr-2" /> },
        { id: 'backlog-generation', name: 'Backlog Oluşturma', isStale: generatedDocs.isBacklogStale, content: (conversation.backlogSuggestions || []).length > 0, icon: <Check className="h-4 w-4 mr-2" /> },
        { id: 'maturity', name: 'Olgunluk', isStale: false, content: true, icon: <Check className="h-4 w-4 mr-2" /> }, // Always has content
    ];

    const visibleTabs = useMemo(() => {
        return allTabs.filter(tab => (tab.id === 'analysis' || tab.id === 'maturity' || tab.id === 'request') ? !!tab.content : tab.content);
    }, [conversation, vizContent]);

    const creatableDocs = useMemo(() => {
        const analysisTab = allTabs.find(t => t.id === 'analysis');
        
        const standardCreatable = allTabs.filter(tab => 
            !['analysis', 'maturity', 'request'].includes(tab.id) && !tab.content
        );

        // Conditionally add the analysis doc to the beginning of the list if it can be created
        if (generatedDocs.requestDoc && analysisTab && !analysisTab.content) {
            return [analysisTab, ...standardCreatable];
        }
        
        return standardCreatable;
    }, [conversation, allTabs, generatedDocs.requestDoc]);
    
    const handleCreateClick = (type: 'analysis' | 'viz' | 'test' | 'traceability' | 'backlog-generation') => {
        onGenerateDoc(type);
        setIsCreateMenuOpen(false);
    };

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

        // Optimistically switch the view
        setDiagramType(newType);

        // Check if regeneration is needed
        const analysisHash = simpleHash(conversation.generatedDocs.analysisDoc);
        const targetVizData = newType === 'mermaid' ? conversation.generatedDocs.mermaidViz : conversation.generatedDocs.bpmnViz;

        // If the target diagram doesn't exist or is stale (based on hash), then generate it.
        if (!targetVizData || targetVizData.sourceHash !== analysisHash) {
            onGenerateDoc('viz', undefined, newType);
        }
    };

    const handleDismissMaturityQuestion = (questionToRemove: string) => {
        if (!conversation.generatedDocs.maturityReport) return;

        const newReport: MaturityReport = {
            ...conversation.generatedDocs.maturityReport,
            suggestedQuestions: conversation.generatedDocs.maturityReport.suggestedQuestions.filter(
                q => q !== questionToRemove
            ),
        };
        
        onUpdateDocument('maturityReport', newReport as any, 'Kullanıcı soruyu reddetti');
    };
    
    // Wrapper for regeneration functions to clear the stale flag
    const handleRegenerate = (docType: 'viz' | 'test' | 'traceability' | 'backlog-generation') => {
        const typeMap: Record<string, DocumentType> = {
            viz: 'mermaid', // or bpmn, depending on current view
            test: 'test',
            traceability: 'traceability'
        };
        const dbDocType = typeMap[docType];
        if (dbDocType) {
            updateDocumentStaleness(dbDocType, false);
        }
        onGenerateDoc(docType as any);
    }
    

    return (
        <div className="flex flex-col h-full w-full min-h-0">
            {/* Tabs Navigation */}
            <div className="px-4 flex-shrink-0 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {visibleTabs.map(tab => (
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
                
                 {creatableDocs.length > 0 && (
                    <div className="relative" ref={createMenuRef}>
                        <button 
                            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-indigo-500 transition"
                        >
                            <PlusCircle className="h-4 w-4" />
                            Yeni Oluştur
                        </button>
                        {isCreateMenuOpen && (
                            <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-20 animate-fade-in-up" style={{animationDuration: '0.1s'}}>
                                <div className="py-1" role="menu">
                                    {creatableDocs.map(doc => (
                                         <button
                                            key={doc.id}
                                            onClick={() => handleCreateClick(doc.id as any)}
                                            disabled={
                                                (doc.id === 'analysis' && !generatedDocs.requestDoc) ||
                                                (doc.id === 'viz' && !isAnalysisDocReady) ||
                                                (doc.id === 'test' && !isAnalysisDocReady) ||
                                                (doc.id === 'traceability' && (!isAnalysisDocReady || !testScenariosContent)) ||
                                                (doc.id === 'backlog-generation' && (!isAnalysisDocReady || !testScenariosContent || !traceabilityMatrixContent))
                                            }
                                            title={
                                                 (doc.id === 'analysis' && !generatedDocs.requestDoc) ? "Analiz dokümanı oluşturmak için önce bir talep dokümanı gereklidir." :
                                                 (doc.id === 'viz' && !isAnalysisDocReady) ? "Görselleştirme için önce geçerli bir analiz dokümanı oluşturulmalıdır." :
                                                 (doc.id === 'test' && !isAnalysisDocReady) ? "Test senaryoları için önce geçerli bir analiz dokümanı oluşturulmalıdır." :
                                                 (doc.id === 'traceability' && (!isAnalysisDocReady || !testScenariosContent)) ? "İzlenebilirlik matrisi için önce analiz ve test dokümanları oluşturulmalıdır." :
                                                 (doc.id === 'backlog-generation' && (!isAnalysisDocReady || !testScenariosContent || !traceabilityMatrixContent)) ? "Backlog oluşturmak için önce analiz, test ve izlenebilirlik dokümanları oluşturulmalıdır." :
                                                 ""
                                            }
                                            className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            role="menuitem"
                                        >
                                           {doc.icon}
                                           {doc.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto relative min-h-0">
                 {activeDocTab === 'request' && (
                    <div className="relative h-full">
                        <DocumentCanvas
                            key="request"
                            content={generatedDocs.requestDoc} 
                            onContentChange={(newContent, reason) => onUpdateDocument('requestDoc', newContent, reason)} 
                            docKey="analysisDoc" // Use analysisDoc key for modifySelection compatibility
                            onModifySelection={onModifySelection} 
                            inlineModificationState={inlineModificationState} 
                            isGenerating={isProcessing} 
                            isStreaming={false}
                            placeholder="Henüz bir talep dokümanı oluşturulmadı. Yeni bir sohbete başladığınızda veya uzun bir metin yapıştırdığınızda burası otomatik olarak dolacaktır."
                            filename={`${conversation.title}-talep`}
                            documentVersions={conversation.documentVersions}
                            onAddTokens={onAddTokens}
                            onRestoreVersion={onRestoreVersion}
                        />
                    </div>
                )}
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
                            placeholder="Henüz bir analiz dokümanı oluşturulmadı. Analist ile sohbet ederek gereksinimleri olgunlaştırın. Yeterli bilgi toplandığında, AI doküman oluşturmayı önerecektir."
                            templates={templates.analysis}
                            selectedTemplate={selectedTemplates.analysis}
                            onTemplateChange={onTemplateChange.analysis}
                            filename={`${conversation.title}-analiz`}
                            documentVersions={conversation.documentVersions}
                            onAddTokens={onAddTokens}
                            onRestoreVersion={onRestoreVersion}
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
                            content={testScenariosContent} 
                            onContentChange={(newContent, reason) => onUpdateDocument('testScenarios', newContent, reason)} 
                            docKey="testScenarios" 
                            onModifySelection={onModifySelection} 
                            inlineModificationState={inlineModificationState} 
                            isGenerating={isProcessing}
                            isStreaming={generatingDocType === 'test'}
                            placeholder={isAnalysisDocReady 
                                ? "Henüz test senaryosu oluşturulmadı. Analiz dokümanınıza dayanarak senaryo oluşturmak için butona tıklayın." 
                                : "Önce geçerli bir analiz dokümanı oluşturmalısınız."
                            }
                            templates={templates.test}
                            selectedTemplate={selectedTemplates.test}
                            onTemplateChange={onTemplateChange.test}
                            filename={`${conversation.title}-test-senaryolari`}
                            isTable
                            documentVersions={conversation.documentVersions}
                            onAddTokens={onAddTokens}
                            onGenerate={() => onGenerateDoc('test')}
                            generateButtonText="Test Senaryoları Oluştur"
                            isGenerationDisabled={isProcessing || !isAnalysisDocReady}
                            generationDisabledTooltip={!isAnalysisDocReady ? "Senaryo oluşturmak için önce geçerli bir analiz dokümanı oluşturmalısınız." : ""}
                            onRestoreVersion={onRestoreVersion}
                        />
                    </div>
                )}
                 {activeDocTab === 'traceability' && (
                     <div className="relative h-full">
                        <DocumentCanvas
                            key="traceability"
                            content={traceabilityMatrixContent} 
                            onContentChange={(newContent, reason) => onUpdateDocument('traceabilityMatrix', newContent, reason)} 
                            docKey="traceabilityMatrix" 
                            onModifySelection={async () => {}} // No-op to prevent errors
                            inlineModificationState={inlineModificationState} 
                            isGenerating={isProcessing}
                            isStreaming={generatingDocType === 'traceability'}
                            isTable
                            filename={`${conversation.title}-izlenebilirlik`}
                             onGenerate={() => onGenerateDoc('traceability')}
                            generateButtonText="Matris Oluştur"
                            isGenerationDisabled={isProcessing || !generatedDocs.analysisDoc || !testScenariosContent}
                            generationDisabledTooltip="Matris oluşturmak için önce analiz ve test dokümanlarını oluşturmalısınız."
                            documentVersions={conversation.documentVersions}
                            onAddTokens={onAddTokens}
                            templates={templates.traceability}
                            selectedTemplate={selectedTemplates.traceability}
                            onTemplateChange={onTemplateChange.traceability}
                            onRestoreVersion={onRestoreVersion}
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