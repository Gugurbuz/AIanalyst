// services/geminiService.ts
import * as chatService from './ai/chat';
import * as docService from './ai/documents';
import * as visualService from './ai/visuals';
import * as feedbackService from './ai/feedback';
import * as coreService from './ai/core';
import type { ExpertStep, Message, GeneratedDocs, StreamChunk, BacklogSuggestion, GeneratedDocument } from '../types';
import { generateDiagram } from './ai/visuals';

// Re-exporting types
export type DocumentImpactAnalysis = docService.DocumentImpactAnalysis;

// Expert Mode is implemented here as it orchestrates multiple services
const runExpertAnalysisStream = async function* (
    userMessage: Message,
    initialDocs: GeneratedDocs,
    templates: { analysis: string; test: string; traceability: string; visualization: string; },
    callbacks: {
        streamDocument: (docKey: keyof GeneratedDocs, chunk: string, isFirstChunk: boolean) => void;
        saveDocument: (docKey: keyof GeneratedDocs, content: any, reason: string, templateId?: string | null, conversationIdOverride?: string, tokensUsed?: number) => Promise<void>;
        commitTokens: (tokens: number) => void;
        updateConversation: (updates: { backlogSuggestions: BacklogSuggestion[] }) => void;
    }
): AsyncGenerator<StreamChunk> {
    let currentDocs = { ...initialDocs };
    let totalTokens = 0;

    const checklist: ExpertStep[] = [
        { id: 'gen_request', name: 'Talep Dokümanı Oluşturma', status: 'pending' },
        { id: 'gen_analysis', name: 'İş Analizi Dokümanı Oluşturma', status: 'pending' },
        { id: 'gen_viz', name: 'Süreç Akışını Görselleştirme', status: 'pending' },
        { id: 'gen_test', name: 'Test Senaryoları Üretme', status: 'pending' },
        { id: 'gen_trace', name: 'İzlenebilirlik Matrisi Oluşturma', status: 'pending' },
        { id: 'gen_maturity', name: 'Olgunluk Raporu Hazırlama', status: 'pending' },
        { id: 'gen_backlog', name: 'Backlog Maddeleri Oluşturma', status: 'pending' },
    ];

    function updateChecklistStatus(id: string, status: ExpertStep['status'], details?: string): ExpertStep[] {
        return checklist.map(step => step.id === id ? { ...step, status, details } : step);
    }

    yield { type: 'expert_run_update', checklist, isComplete: false };

    try {
        // Access content from normalized structure
        let requestContent = currentDocs.requestDoc?.content || '';
        let analysisContent = currentDocs.analysisDoc?.content || '';
        let testContent = currentDocs.testScenarios?.content || '';
        let traceContent = currentDocs.traceabilityMatrix?.content || '';

        // Step 0: Generate Request Document if it doesn't exist
        let updatedChecklist = updateChecklistStatus('gen_request', 'in_progress');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };
        if (!requestContent) {
            const { jsonString, tokens } = await docService.parseTextToRequestDocument(userMessage.content);
            callbacks.commitTokens(tokens);
            totalTokens += tokens;
            await callbacks.saveDocument('requestDoc', jsonString, 'Exper modu tarafından oluşturuldu', undefined, undefined, tokens);
            
            requestContent = jsonString;
            currentDocs.requestDoc = { content: requestContent, isStale: false };
            updatedChecklist = updateChecklistStatus('gen_request', 'completed');
        } else {
            updatedChecklist = updateChecklistStatus('gen_request', 'completed', "Mevcut doküman kullanıldı.");
        }
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };


        // Step 1: Generate Analysis Document
        updatedChecklist = updateChecklistStatus('gen_analysis', 'in_progress');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };
        
        const analysisStream = docService.generateAnalysisDocument(requestContent, [userMessage], templates.analysis, 'gemini-2.5-pro');
        let fullAnalysisDoc = '';
        let isFirstChunk = true;
        let analysisTokens = 0;

        for await (const chunk of analysisStream) {
            if (chunk.type === 'doc_stream_chunk') {
                callbacks.streamDocument('analysisDoc', chunk.chunk, isFirstChunk);
                fullAnalysisDoc += chunk.chunk;
                isFirstChunk = false;
            } else if (chunk.type === 'usage_update') {
                analysisTokens = chunk.tokens;
            }
        }
        await callbacks.saveDocument('analysisDoc', fullAnalysisDoc, 'Exper modu tarafından oluşturuldu', undefined, undefined, analysisTokens);
        callbacks.commitTokens(analysisTokens);
        totalTokens += analysisTokens;
        
        analysisContent = fullAnalysisDoc;
        currentDocs.analysisDoc = { content: analysisContent, isStale: false };
        updatedChecklist = updateChecklistStatus('gen_analysis', 'completed');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };

        // Step 2: Generate Visualization
        updatedChecklist = updateChecklistStatus('gen_viz', 'in_progress');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };
        const { code, tokens: vizTokens } = await generateDiagram(analysisContent, templates.visualization, 'gemini-2.5-flash');
        const sourceHash = 'expert_hash'; // Simplified for expert mode
        const vizData = { code, sourceHash };
        await callbacks.saveDocument('bpmnViz', vizData, `Exper modu tarafından oluşturuldu (BPMN)`, undefined, undefined, vizTokens);
        callbacks.commitTokens(vizTokens);
        totalTokens += vizTokens;
        currentDocs.bpmnViz = { content: code, isStale: false, metadata: { sourceHash } };
        updatedChecklist = updateChecklistStatus('gen_viz', 'completed');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };

        // Step 3: Generate Test Scenarios
        updatedChecklist = updateChecklistStatus('gen_test', 'in_progress');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };
        const testStream = docService.generateTestScenarios(analysisContent, templates.test, 'gemini-2.5-pro');
        let fullTestDoc = '';
        isFirstChunk = true;
        let testTokens = 0;
        for await (const chunk of testStream) {
            if (chunk.type === 'doc_stream_chunk') {
                callbacks.streamDocument('testScenarios', chunk.chunk, isFirstChunk);
                fullTestDoc += chunk.chunk;
                isFirstChunk = false;
            } else if (chunk.type === 'usage_update') {
                testTokens = chunk.tokens;
            }
        }
        
        testContent = fullTestDoc;
        await callbacks.saveDocument('testScenarios', { content: testContent, sourceHash }, 'Exper modu tarafından oluşturuldu', undefined, undefined, testTokens);
        callbacks.commitTokens(testTokens);
        totalTokens += testTokens;
        currentDocs.testScenarios = { content: testContent, isStale: false, metadata: { sourceHash } };
        updatedChecklist = updateChecklistStatus('gen_test', 'completed');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };

        // Step 4: Generate Traceability Matrix
        updatedChecklist = updateChecklistStatus('gen_trace', 'in_progress');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };
        const traceStream = docService.generateTraceabilityMatrix(analysisContent, testContent, templates.traceability, 'gemini-2.5-pro');
        let fullTraceDoc = '';
        isFirstChunk = true;
        let traceTokens = 0;
        for await (const chunk of traceStream) {
                if (chunk.type === 'doc_stream_chunk') {
                callbacks.streamDocument('traceabilityMatrix', chunk.chunk, isFirstChunk);
                fullTraceDoc += chunk.chunk;
                isFirstChunk = false;
            } else if (chunk.type === 'usage_update') {
                traceTokens = chunk.tokens;
            }
        }
        
        traceContent = fullTraceDoc;
        await callbacks.saveDocument('traceabilityMatrix', { content: traceContent, sourceHash }, 'Exper modu tarafından oluşturuldu', undefined, undefined, traceTokens);
        callbacks.commitTokens(traceTokens);
        totalTokens += traceTokens;
        currentDocs.traceabilityMatrix = { content: traceContent, isStale: false, metadata: { sourceHash } };
        updatedChecklist = updateChecklistStatus('gen_trace', 'completed');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };
        
        // Step 5: Generate Maturity Report
        updatedChecklist = updateChecklistStatus('gen_maturity', 'in_progress');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };
        const { report, tokens: maturityTokens } = await docService.checkAnalysisMaturity([userMessage], currentDocs, 'gemini-2.5-pro');
        await callbacks.saveDocument('maturityReport', report, 'Exper modu tarafından oluşturuldu', undefined, undefined, maturityTokens);
        callbacks.commitTokens(maturityTokens);
        totalTokens += maturityTokens;
        currentDocs.maturityReport = { content: JSON.stringify(report), isStale: false, metadata: report };
        updatedChecklist = updateChecklistStatus('gen_maturity', 'completed');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };
        
        // Step 6: Generate Backlog
        updatedChecklist = updateChecklistStatus('gen_backlog', 'in_progress');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };
        const { suggestions, tokens: backlogTokens } = await docService.generateBacklogSuggestions(
            requestContent, analysisContent, testContent, traceContent, 'gemini-2.5-pro'
        );
        callbacks.updateConversation({ backlogSuggestions: suggestions });
        callbacks.commitTokens(backlogTokens);
        totalTokens += backlogTokens;
        updatedChecklist = updateChecklistStatus('gen_backlog', 'completed');
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: false };


        // Finalization
        yield { type: 'expert_run_update', checklist: updatedChecklist, isComplete: true, finalMessage: 'Exper analizi tamamlandı. Tüm dokümanlar oluşturuldu ve çalışma alanında görüntülenebilir.' };
        yield { type: 'text_chunk', text: 'Exper analizi tamamlandı. Tüm dokümanlar oluşturuldu ve çalışma alanında görüntülenebilir.' };

    } catch (error: any) {
        console.error("Expert Mode run failed:", error);
        const activeStep = checklist.find(s => s.status === 'in_progress');
        const finalChecklist = activeStep ? updateChecklistStatus(activeStep.id, 'error', error.message) : checklist;
        yield { type: 'expert_run_update', checklist: finalChecklist, isComplete: true, finalMessage: `Exper modu bir hatayla karşılaştı: ${error.message}` };
        yield { type: 'stream_error', error: { name: "ExpertModeError", message: `Exper modu bir hatayla karşılaştı: ${error.message}` } };
    }
};

export const geminiService = {
    ...coreService,
    ...chatService,
    ...docService,
    ...visualService,
    ...feedbackService,
    runExpertAnalysisStream
};