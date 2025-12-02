// hooks/useDocumentServices.ts
import React, { useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { promptService } from '../services/promptService';
import type { useConversationState } from './useConversationState';
import type { useUIState } from './useUIState';
import type { GeminiModel, DocumentVersion, GeneratedDocs, DocumentType } from '../types';

const simpleHash = (str: string): string => {
    if (!str) return '0';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash.toString();
};

const documentTypeToKeyMap: Record<DocumentType, keyof GeneratedDocs> = {
    request: 'requestDoc',
    analysis: 'analysisDoc',
    test: 'testScenarios',
    traceability: 'traceabilityMatrix',
    bpmn: 'bpmnViz',
    maturity_report: 'maturityReport',
};

interface DocumentServicesProps {
    conversationState: ReturnType<typeof useConversationState>;
    uiState: ReturnType<typeof useUIState>;
    isProcessing: boolean;
    setIsProcessing: (isProcessing: boolean) => void;
    generatingDocType: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null;
    setGeneratingDocType: (type: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null) => void;
    activeModel: () => GeminiModel;
    checkTokenLimit: () => boolean;
}

export const useDocumentServices = ({
    conversationState,
    uiState,
    isProcessing,
    setIsProcessing,
    generatingDocType,
    setGeneratingDocType,
    activeModel,
    checkTokenLimit,
}: DocumentServicesProps) => {

    const [inlineModificationState, setInlineModificationState] = useState<{ docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null>(null);

    const handleGenerateDoc = useCallback(async (type: 'request' | 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation', newTemplateId?: string) => {
        const activeConv = conversationState.activeConversation;
        if (!activeConv || isProcessing) return;
        if (!checkTokenLimit()) return;

        setGeneratingDocType(type);
        setIsProcessing(true);
        
        const templates = {
            analysis: conversationState.allTemplates.find(t => t.id === (newTemplateId || conversationState.selectedTemplates.analysis))?.prompt || promptService.getPrompt('generateAnalysisDocument'),
            test: conversationState.allTemplates.find(t => t.id === (newTemplateId || conversationState.selectedTemplates.test))?.prompt || promptService.getPrompt('generateTestScenarios'),
            traceability: conversationState.allTemplates.find(t => t.id === (newTemplateId || conversationState.selectedTemplates.traceability))?.prompt || promptService.getPrompt('generateTraceabilityMatrix'),
            visualization: promptService.getPrompt('generateBPMN'),
        };

        // Access content safely using the normalized structure
        const analysisContent = activeConv.generatedDocs.analysisDoc?.content || '';
        const requestContent = activeConv.generatedDocs.requestDoc?.content || '';
        const testContent = activeConv.generatedDocs.testScenarios?.content || '';

        const streamGenerators = {
            analysis: () => geminiService.generateAnalysisDocument(requestContent, activeConv.messages, templates.analysis, activeModel()),
            test: () => geminiService.generateTestScenarios(analysisContent, templates.test, activeModel()),
            traceability: () => geminiService.generateTraceabilityMatrix(analysisContent, testContent, templates.traceability, activeModel()),
        };

        try {
            if (type === 'request') {
                const historyText = activeConv.messages
                    .filter(m => m.role !== 'system')
                    .map(m => `${m.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${m.content}`)
                    .join('\n\n');
                
                const { jsonString, tokens } = await geminiService.parseTextToRequestDocument(historyText);
                conversationState.commitTokenUsage(tokens);
                await conversationState.saveDocumentVersion('requestDoc', jsonString, "Sohbet geçmişinden oluşturuldu", undefined, undefined, tokens);
            } else if (type === 'viz') {
                const { code, tokens } = await geminiService.generateDiagram(analysisContent, templates.visualization, activeModel());
                conversationState.commitTokenUsage(tokens);
                const sourceHash = simpleHash(analysisContent);
                const vizData = { code, sourceHash };
                const docKey = 'bpmnViz';
                await conversationState.saveDocumentVersion(docKey, vizData, `Diyagram oluşturuldu (BPMN)`, undefined, undefined, tokens);
            } else if (type === 'analysis' || type === 'test' || type === 'traceability') {
                const stream = streamGenerators[type]();
                let isFirstChunk = true;
                let finalTokenCount = 0;
                for await (const chunk of stream) {
                     if (chunk.type === 'doc_stream_chunk') {
                        conversationState.streamDocument(chunk.docKey, chunk.chunk, isFirstChunk);
                        isFirstChunk = false;
                    } else if (chunk.type === 'usage_update') {
                        finalTokenCount = chunk.tokens;
                    }
                }
                conversationState.commitTokenUsage(finalTokenCount);
                await conversationState.finalizeStreamedDocuments(newTemplateId, finalTokenCount);

                if (type === 'analysis') {
                    // Slight delay to ensure state update propagates
                    setTimeout(() => {
                        const currentMessages = conversationState.activeConversation?.messages || [];
                        const latestAnalysis = conversationState.activeConversation?.documents.find(d=>d.document_type === 'analysis')?.content || '';
                        
                        geminiService.checkAnalysisMaturity(
                            currentMessages, 
                            { ...activeConv.generatedDocs, analysisDoc: { content: latestAnalysis, isStale: false } as any }, 
                            activeModel()
                        ).then(({ report, tokens }) => {
                            conversationState.commitTokenUsage(tokens);
                            conversationState.saveDocumentVersion('maturityReport', report as any, 'Otomatik olgunluk değerlendirmesi');
                        }).catch(e => console.warn("Auto maturity check failed:", e));
                    }, 1000);
                }

            }
        } catch(e: any) {
            uiState.setError(e.message);
        } finally {
            setIsProcessing(false);
            setGeneratingDocType(null);
            if (newTemplateId && (type === 'analysis' || type === 'test' || type === 'traceability')) {
                conversationState.setSelectedTemplates(prev => ({ ...prev, [type]: newTemplateId }));
            }
        }
    }, [conversationState, isProcessing, checkTokenLimit, uiState, activeModel]);

    const handleModifySelection = async (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => {
        console.log('Modify selection:', { selectedText, userPrompt, docKey });
    };
    
    const handleModifyDiagram = async (userPrompt: string) => {
        console.log('Modify diagram:', { userPrompt });
    };

    const handleTemplateChange = useCallback((docType: 'analysis' | 'test' | 'traceability') => (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newTemplateId = event.target.value;
        const activeConv = conversationState.activeConversation;
        if (!activeConv) return;
        
        const docKeyMap = { analysis: 'analysisDoc', test: 'testScenarios', traceability: 'traceabilityMatrix' };
        const docKey = docKeyMap[docType] as keyof GeneratedDocs;
        
        const doc = activeConv.generatedDocs[docKey];
        const contentExists = !!doc?.content?.trim();

        if (contentExists) {
            uiState.regenerateModalData.current = { docType, newTemplateId };
            uiState.setIsRegenerateModalOpen(true);
        } else {
            conversationState.setSelectedTemplates(prev => ({ ...prev, [docType]: newTemplateId }));
            handleGenerateDoc(docType, newTemplateId);
        }
    }, [conversationState, uiState, handleGenerateDoc]);

    const handleConfirmRegenerate = (saveCurrent: boolean) => {
        const data = uiState.regenerateModalData.current;
        if (!data) return;
        const { docType, newTemplateId } = data;
        
        if (saveCurrent) {
            const docKey = { analysis: 'analysisDoc', test: 'testScenarios', traceability: 'traceabilityMatrix' }[docType] as keyof GeneratedDocs;
            const content = conversationState.activeConversation?.generatedDocs[docKey]?.content;
            if (content) {
                conversationState.saveDocumentVersion(docKey, content, "Yeni şablon seçimi öncesi arşivlendi");
            }
        }
        uiState.setIsRegenerateModalOpen(false);
        conversationState.setSelectedTemplates(prev => ({ ...prev, [docType]: newTemplateId }));
        handleGenerateDoc(docType, newTemplateId);
    };

    const handleRestoreVersion = async (version: DocumentVersion) => {
        const activeConv = conversationState.activeConversation;
        if (!activeConv) return;
        
        const docKey = documentTypeToKeyMap[version.document_type] as keyof GeneratedDocs;
        if (!docKey) return;
        
        await conversationState.saveDocumentVersion(docKey, version.content, `v${version.version_number} versiyonuna geri dönüldü`, version.template_id, undefined, 0);
    };

    return {
        inlineModificationState,
        setInlineModificationState,
        handleGenerateDoc,
        handleModifySelection,
        handleModifyDiagram,
        handleTemplateChange,
        handleConfirmRegenerate,
        handleRestoreVersion,
    };
};