// components/DocumentWorkspace.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Conversation, Template, MaturityReport, GeneratedDocs, Document, DocumentType, SourcedDocument, DocumentVersion, IsBirimiTalep } from '../types';
import { DocumentCanvas } from './DocumentCanvas';
import { Visualizations } from './Visualizations';
import { MaturityCheckReport } from './MaturityCheckReport';
import { BacklogGenerationView } from './BacklogGenerationView';
import { DocumentEmptyState } from './DocumentEmptyState'; // Import the new component
import { geminiService } from '../services/geminiService';
import type { DocumentImpactAnalysis } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { GanttChartSquare, Projector, RefreshCw, Check, FileText, Beaker, GitBranch, FileInput, CheckSquare } from 'lucide-react';
import { RequestDocumentViewer } from './RequestDocumentViewer';
import { isIsBirimiTalep } from '../types';
import { ProjectMapView } from './ProjectMapView';


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
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null;
    onUpdateDocument: (docKey: keyof GeneratedDocs, newContent: string | SourcedDocument, reason: string) => Promise<void>;
    onModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => Promise<void>;
    onModifyDiagram: (userPrompt: string) => Promise<void>;
    onGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', newTemplateId?: string) => void;
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
    activeDocTab: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | 'overview';
    setActiveDocTab: (tab: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | 'overview') => void;
    onPrepareQuestionForAnswer: (question: string) => void;
    diagramType: 'bpmn';
    setDiagramType: (type: 'bpmn') => void;
    onAddTokens: (tokens: number) => void;
    onRestoreVersion: (version: DocumentVersion) => Promise<void>; // Bu prop async olmalı
}

const StaleIndicator: React.FC<{ isStale?: boolean; onUpdate: () => void }> = ({ isStale, onUpdate }) => {
    if (!isStale) return null;
    return (
        <button 
            onClick={(e) => { e.stopPropagation(); onUpdate(); }}
            className="ml-2 flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-200 rounded-full text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-800"
            title="Bu bölüm, analiz dokümanındaki son değişiklikler nedeniyle güncel olmayabilir. Güncellemek için tıklayın."
        >
            <RefreshCw className="h-3 w-3" />
            Güncelle
        </button>
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
    
    const [isVisualizing, setIsVisualizing] = useState(false);
    const [vizError, setVizError] = useState<string | null>(null);
    const [isAnalyzingChange, setIsAnalyzingChange] = useState(false);
    const [parsedRequestDoc, setParsedRequestDoc] = useState<IsBirimiTalep | null>(null);
    
    const { generatedDocs, id: conversationId } = conversation;
    const prevAnalysisDoc = usePrevious(generatedDocs.analysisDoc);
    
    const updateDocumentStaleness = async (docType: DocumentType, isStale: boolean) => {
        const { error } = await supabase
            .from('documents')
            .update({ is_stale: isStale })
            .eq('conversation_id', conversationId)
            .eq('document_type', docType);
        if (error) console.error(`Failed to update staleness for ${docType}:`, error);
    };

    useEffect(() => {
        if (generatedDocs.requestDoc) {
            try {
                const parsed = JSON.parse(generatedDocs.requestDoc);
                if (isIsBirimiTalep(parsed)) {
                    setParsedRequestDoc(parsed);
                } else {
                    setParsedRequestDoc(null);
                }
            } catch (e) {
                setParsedRequestDoc(null);
            }
        } else {
            setParsedRequestDoc(null);
        }
    }, [generatedDocs.requestDoc]);

    useEffect(() => {
        if (prevAnalysisDoc !== undefined && generatedDocs.analysisDoc !== prevAnalysisDoc && !isProcessing) {
            const analyze = async () => {
                setIsAnalyzingChange(true);
                try {
                    const { impact, tokens } = await geminiService.analyzeDocumentChange(prevAnalysisDoc || '', generatedDocs.analysisDoc, 'gemini-2.5-flash-lite');
                    onAddTokens(tokens);
                    if (impact.isVisualizationImpacted) await updateDocumentStaleness('bpmn', true);
                    if (impact.isTestScenariosImpacted) await updateDocumentStaleness('test', true);
                    if (impact.isTraceabilityImpacted) await updateDocumentStaleness('traceability', true);
                } catch (error) {
                    console.error("Impact analysis failed:", error);
                    
                    // ******** HATA DÜZELTMESİ: BAŞLANGIÇ ********
                    // Analiz başarısız olursa, bağımlı dokümanları "stale" olarak işaretlerken
                    // bu çağrıların beklenmesi (await) gerekir. Aksi takdirde, bu
                    // asenkron çağrılardan biri hata verirse "uncaught" hatası oluşur.
                    try {
                        await Promise.all([
                            updateDocumentStaleness('bpmn', true),
                            updateDocumentStaleness('test', true),
                            updateDocumentStaleness('traceability', true)
                        ]);
                    } catch (stalenessError) {
                        console.error("Failed to set documents as stale after impact analysis error:", stalenessError);
                    }
                    // ******** HATA DÜZELTMESİ: BİTİŞ ********

                } finally {
                    setIsAnalyzingChange(false);
                }
            };
            analyze(); // Bu fonksiyonu 'await' etmemize gerek yok, çünkü kendi içinde try/catch ile hata yönetimi yapıyor.
        }
    }, [generatedDocs.analysisDoc, prevAnalysisDoc, conversationId, isProcessing, onAddTokens]);

    const vizContent = generatedDocs.bpmnViz?.code ?? (generatedDocs.visualizationType === 'bpmn' ? generatedDocs.visualization : '');

    const testScenariosContent = typeof generatedDocs.testScenarios === 'object' 
        ? (generatedDocs.testScenarios as SourcedDocument).content 
        : generatedDocs.testScenarios as string;
        
    const traceabilityMatrixContent = typeof generatedDocs.traceabilityMatrix === 'object'
        ? (generatedDocs.traceabilityMatrix as SourcedDocument).content 
        : generatedDocs.traceabilityMatrix as string;

    const isAnalysisDocReady = !!generatedDocs.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");

    const handleRegenerate = (docType: 'viz' | 'test' | 'traceability' | 'backlog-generation') => {
        if (docType === 'viz') {
            const dbDocType = diagramType;
            updateDocumentStaleness(dbDocType, false);
        } else {
            const typeMap: Record<string, DocumentType> = { test: 'test', traceability: 'traceability' };
            const dbDocType = typeMap[docType];
            if (dbDocType) updateDocumentStaleness(dbDocType, false);
        }
        onGenerateDoc(docType as any);
    }

    const allTabs = [
        { id: 'overview', name: 'Proje Haritası', icon: Projector, content: true, isStale: false, onUpdate: () => {} },
        { id: 'request', name: 'Talep', icon: FileInput, content: generatedDocs.requestDoc, isStale: false, onUpdate: () => {} },
        { id: 'analysis', name: 'İş Analizi', icon: FileText, content: generatedDocs.analysisDoc, isStale: false, onUpdate: () => {} },
        { id: 'viz', name: 'Görselleştirme', icon: GanttChartSquare, content: vizContent, isStale: generatedDocs.isVizStale, onUpdate: () => handleRegenerate('viz') },
        { id: 'test', name: 'Test Senaryoları', icon: Beaker, content: testScenariosContent, isStale: generatedDocs.isTestStale, onUpdate: () => handleRegenerate('test') },
        { id: 'traceability', name: 'İzlenebilirlik', icon: GitBranch, content: traceabilityMatrixContent, isStale: generatedDocs.isTraceabilityStale, onUpdate: () => handleRegenerate('traceability') },
        { id: 'backlog-generation', name: 'Backlog', icon: CheckSquare, content: true, isStale: generatedDocs.isBacklogStale, onUpdate: () => {} }, // Always available
        { id: 'maturity', name: 'Olgunluk', icon: Check, content: true, isStale: false, onUpdate: () => {} }, // Always available
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
        if (!conversation.generatedDocs.maturityReport) return;
        const newReport: MaturityReport = {
            ...conversation.generatedDocs.maturityReport,
            suggestedQuestions: conversation.generatedDocs.maturityReport.suggestedQuestions.filter(q => q !== questionToRemove),
        };
        onUpdateDocument('maturityReport', newReport as any, 'Kullanıcı soruyu reddetti');
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
                            <StaleIndicator isStale={tab.isStale} onUpdate={tab.onUpdate} />
                        </button>
                    ))}
                </nav>
            </div>
            
            <div className="flex-1 overflow-y-auto relative min-h-0">
                 {activeDocTab === 'overview' && (
                    <ProjectMapView docs={generatedDocs} onNodeClick={setActiveDocTab} />
                )}
                {activeDocTab === 'request' && (
                    generatedDocs.requestDoc ? (
                        <DocumentCanvas
                            key="request"
                            content={generatedDocs.requestDoc}
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
                        />
                    ) : (
                        <DocumentEmptyState icon={<FileInput />} title="Talep Dokümanı" description="Yeni bir sohbete başladığınızda veya uzun bir metin yapıştırdığınızda burası otomatik olarak dolacaktır." buttonText="" onAction={()=>{}} isDisabled={true} />
                    )
                )}
                {activeDocTab === 'analysis' && (generatedDocs.analysisDoc ?
                    <DocumentCanvas key="analysis" content={generatedDocs.analysisDoc} onContentChange={(newContent, reason) => onUpdateDocument('analysisDoc', newContent, reason)} docKey="analysisDoc" onModifySelection={onModifySelection} inlineModificationState={inlineModificationState} isGenerating={isProcessing} isStreaming={generatingDocType === 'analysis'} templates={templates.analysis} selectedTemplate={selectedTemplates.analysis} onTemplateChange={onTemplateChange.analysis} filename={`${conversation.title}-analiz`} documentVersions={conversation.documentVersions} onAddTokens={onAddTokens} onRestoreVersion={onRestoreVersion} />
                    : <DocumentEmptyState icon={<FileText />} title="İş Analizi Dokümanı" description="Analistle sohbet ederek gereksinimleri olgunlaştırın. Yeterli bilgi toplandığında, AI doküman oluşturmayı önerecektir." buttonText="Analiz Dokümanı Oluştur" onAction={() => onGenerateDoc('analysis')} isDisabled={isProcessing || !generatedDocs.requestDoc} disabledTooltip="Önce bir talep dokümanı gereklidir." isLoading={generatingDocType === 'analysis'}/>
                )}
                 {activeDocTab === 'viz' && (generatedDocs.analysisDoc ?
                    <div className="relative h-full flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Süreç Görselleştirmesi (BPMN)</h3>
                            </div>
                        </div>
                        <Visualizations content={vizContent} onModifyDiagram={(prompt) => handleGenerateOrModifyViz(prompt)} onGenerateDiagram={() => handleGenerateOrModifyViz()} isLoading={isVisualizing || generatingDocType === 'viz'} error={vizError} diagramType={diagramType} isAnalysisDocReady={isAnalysisDocReady}/>
                    </div>
                    : <DocumentEmptyState icon={<GanttChartSquare />} title="Süreç Görselleştirmesi" description="Görselleştirme oluşturmak için önce bir iş analizi dokümanı gereklidir." buttonText="Analiz Dokümanı Oluştur" onAction={() => setActiveDocTab('analysis')} />
                )}
                {activeDocTab === 'test' && (testScenariosContent ?
                    <DocumentCanvas key="test" content={testScenariosContent} onContentChange={(newContent, reason) => onUpdateDocument('testScenarios', newContent, reason)} docKey="testScenarios" onModifySelection={onModifySelection} inlineModificationState={inlineModificationState} isGenerating={isProcessing} isStreaming={generatingDocType === 'test'} templates={templates.test} selectedTemplate={selectedTemplates.test} onTemplateChange={onTemplateChange.test} filename={`${conversation.title}-test-senaryolari`} isTable documentVersions={conversation.documentVersions} onAddTokens={onAddTokens} onRestoreVersion={onRestoreVersion} />
                    : <DocumentEmptyState icon={<Beaker />} title="Test Senaryoları" description="Analiz dokümanınıza dayanarak test senaryoları oluşturun." buttonText="Test Senaryoları Oluştur" onAction={() => onGenerateDoc('test')} isDisabled={isProcessing || !isAnalysisDocReady} disabledTooltip="Önce geçerli bir analiz dokümanı oluşturmalısınız." isLoading={generatingDocType === 'test'}/>
                )}
                 {activeDocTab === 'traceability' && (traceabilityMatrixContent ?
                    <DocumentCanvas key="traceability" content={traceabilityMatrixContent} onContentChange={(newContent, reason) => onUpdateDocument('traceabilityMatrix', newContent, reason)} docKey="traceabilityMatrix" onModifySelection={async () => {}} inlineModificationState={inlineModificationState} isGenerating={isProcessing} isStreaming={generatingDocType === 'traceability'} isTable filename={`${conversation.title}-izlenebilirlik`} documentVersions={conversation.documentVersions} onAddTokens={onAddTokens} templates={templates.traceability} selectedTemplate={selectedTemplates.traceability} onTemplateChange={onTemplateChange.traceability} onRestoreVersion={onRestoreVersion} />
                    : <DocumentEmptyState icon={<GitBranch />} title="İzlenebilirlik Matrisi" description="Gereksinimler ile test senaryoları arasındaki ilişkiyi kurun." buttonText="Matris Oluştur" onAction={() => onGenerateDoc('traceability')} isDisabled={isProcessing || !isAnalysisDocReady || !testScenariosContent} disabledTooltip="Önce analiz ve test dokümanları oluşturmalısınız." isLoading={generatingDocType === 'traceability'}/>
                )}
                {activeDocTab === 'backlog-generation' && <BacklogGenerationView conversation={conversation} onUpdateConversation={onUpdateConversation} />}
                {activeDocTab === 'maturity' && <MaturityCheckReport report={generatedDocs.maturityReport || null} onPrepareQuestionForAnswer={onPrepareQuestionForAnswer} onDismissQuestion={handleDismissMaturityQuestion} isLoading={isProcessing && generatingDocType === 'maturity'} />}
            </div>
        </div>
    );
};