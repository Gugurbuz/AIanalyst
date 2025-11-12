// hooks/useDocumentServices.ts
import React, { useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { promptService } from '../services/promptService';
import type { useConversationState } from './useConversationState';
import type { useUIState } from './useUIState';
// YENİ Importlar
import { supabase } from '../services/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import type { GeminiModel, DocumentVersion, SourcedDocument, GeneratedDocs, DocumentType, Message } from '../types';

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
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null;
    setGeneratingDocType: (type: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation' | null) => void;
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
    
    // YENİ FONKSİYON: Sohbet geçmişine sessiz eylem mesajları ekler
    const addMessagesForSilentAction = async (
        userMessageText: string, 
        assistantMessageText: string
    ) => {
        const activeConv = conversationState.activeConversation;
        if (!activeConv) return;

        const userMessage: Message = {
            id: uuidv4(),
            conversation_id: activeConv.id,
            role: 'user',
            content: userMessageText,
            created_at: new Date().toISOString(),
        };
        
        const assistantMessage: Message = {
            id: uuidv4(),
            conversation_id: activeConv.id,
            role: 'assistant',
            content: assistantMessageText,
            created_at: new Date().toISOString(),
            isStreaming: false
        };

        // 1. State'i güncelle
        conversationState.updateConversation(activeConv.id, {
            messages: [...activeConv.messages, userMessage, assistantMessage]
        });

        // 2. Veritabanına kaydet
        try {
            // FIX: Create plain objects for insertion to avoid sending client-side properties like 'isStreaming' to the DB.
            const messagesToInsert = [
                { id: userMessage.id, conversation_id: userMessage.conversation_id, role: userMessage.role, content: userMessage.content, created_at: userMessage.created_at },
                { id: assistantMessage.id, conversation_id: assistantMessage.conversation_id, role: assistantMessage.role, content: assistantMessage.content, created_at: assistantMessage.created_at }
            ];
            const { error } = await supabase.from('conversation_details').insert(messagesToInsert);
            if (error) {
                uiState.setError(`Sohbet geçmişi kaydedilemedi: ${error.message}`);
                // Not: Hata olsa bile state güncellendiği için AI bağlamı kaybolmaz
            }
        } catch (e: any) {
            uiState.setError(`Sohbet geçmişi kaydetme hatası: ${e.message}`);
        }
    };


    const handleGenerateDoc = useCallback(async (type: 'analysis' | 'test' | 'viz' | 'traceability' | 'backlog-generation' | 'maturity', newTemplateId?: string) => {
        const activeConv = conversationState.activeConversation;
        if (!activeConv || isProcessing) return;
        if (!checkTokenLimit()) return;

        setGeneratingDocType(type);
        setIsProcessing(true);
        
        // YENİ: Hangi eylemin tetiklendiğini belirlemek için mesaj map'i
        const actionMessages = {
            analysis: {
                user: "(Sistem) 'Analiz Dokümanı Oluştur' eylemi tetiklendi.",
                assistant: "Analiz dokümanını 'Analiz' sekmesinde oluşturdum. İnceleyebilirsiniz.",
            },
            test: {
                user: "(Sistem) 'Test Senaryoları Oluştur' eylemi tetiklendi.",
                assistant: "Test senaryolarını 'Test' sekmesinde oluşturdum. İnceleyebilirsiniz.",
            },
            viz: {
                user: "(Sistem) 'Süreç Görselleştirme' eylemi tetiklendi.",
                assistant: `Süreç diyagramını (bpmn) 'Görselleştirme' sekmesinde oluşturdum.`,
            },
            traceability: {
                user: "(Sistem) 'İzlenebilirlik Matrisi Oluştur' eylemi tetiklendi.",
                assistant: "İzlenebilirlik matrisini 'İzlenebilirlik' sekmesinde oluşturdum.",
            },
            maturity: {
                user: "(Sistem) 'Olgunluk Raporunu Yeniden Değerlendir' eylemi tetiklendi.",
                assistant: "Proje olgunluk raporunu 'Olgunluk' sekmesinde güncelledim.",
            },
            'backlog-generation': {
                user: "(Sistem) 'Backlog Önerileri Oluştur' eylemi tetiklendi.",
                assistant: "Backlog önerilerini 'Backlog' sekmesinde oluşturdum.",
            }
        };

        const diagramTypeToUse = 'bpmn';
        const templates = {
            analysis: conversationState.allTemplates.find(t => t.id === (newTemplateId || conversationState.selectedTemplates.analysis))?.prompt || promptService.getPrompt('generateAnalysisDocument'),
            test: conversationState.allTemplates.find(t => t.id === (newTemplateId || conversationState.selectedTemplates.test))?.prompt || promptService.getPrompt('generateTestScenarios'),
            traceability: conversationState.allTemplates.find(t => t.id === (newTemplateId || conversationState.selectedTemplates.traceability))?.prompt || promptService.getPrompt('generateTraceabilityMatrix'),
            visualization: promptService.getPrompt('generateBPMN'),
        };

        const streamGenerators = {
            analysis: () => geminiService.generateAnalysisDocument(activeConv.generatedDocs.requestDoc, activeConv.messages, templates.analysis, activeModel()),
            test: () => geminiService.generateTestScenarios(activeConv.generatedDocs.analysisDoc, templates.test, activeModel()),
            traceability: () => geminiService.generateTraceabilityMatrix(activeConv.generatedDocs.analysisDoc, (activeConv.generatedDocs.testScenarios as SourcedDocument)?.content || activeConv.generatedDocs.testScenarios as string, templates.traceability, activeModel()),
        };

        try {
            if (type === 'viz') {
                const { code, tokens } = await geminiService.generateDiagram(activeConv.generatedDocs.analysisDoc, diagramTypeToUse, templates.visualization, activeModel());
                conversationState.commitTokenUsage(tokens);
                const sourceHash = simpleHash(activeConv.generatedDocs.analysisDoc);
                const vizData = { code, sourceHash };
                const docKey = 'bpmnViz';
                await conversationState.saveDocumentVersion(docKey, vizData, `Diyagram oluşturuldu (bpmn)`);
            } else if (type === 'analysis' || type === 'test' || type === 'traceability') {
                const stream = streamGenerators[type]();
                for await (const chunk of stream) {
                     if (chunk.type === 'doc_stream_chunk') {
                        conversationState.streamDocument(chunk.docKey, chunk.chunk);
                    } else if (chunk.type === 'usage_update') {
                        conversationState.commitTokenUsage(chunk.tokens);
                    }
                }
                await conversationState.finalizeStreamedDocuments(newTemplateId);
            } else if (type === 'maturity') {
                // Olgunluk raporunu manuel tetikleme
                const { report, tokens } = await geminiService.checkAnalysisMaturity(activeConv.messages, activeConv.generatedDocs, activeModel());
                conversationState.commitTokenUsage(tokens);
                await conversationState.saveDocumentVersion('maturityReport', report as any, 'Rapor manuel olarak yeniden değerlendirildi');
            } else if (type === 'backlog-generation') {
                // Backlog oluşturmayı manuel tetikleme
                const { suggestions, reasoning, tokens } = await geminiService.generateBacklogSuggestions(
                    activeConv.generatedDocs.requestDoc,
                    activeConv.generatedDocs.analysisDoc,
                    (activeConv.generatedDocs.testScenarios as SourcedDocument)?.content || activeConv.generatedDocs.testScenarios as string,
                    (activeConv.generatedDocs.traceabilityMatrix as SourcedDocument)?.content || activeConv.generatedDocs.traceabilityMatrix as string,
                    'gemini-2.5-pro'
                );
                conversationState.commitTokenUsage(tokens);
                conversationState.updateConversation(activeConv.id, { backlogSuggestions: suggestions });
            }

            // --- YENİ BÖLÜM: EYLEMİ SOHBET GEÇMİŞİNE EKLE ---
            if (actionMessages[type]) {
                await addMessagesForSilentAction(
                    actionMessages[type].user,
                    actionMessages[type].assistant
                );
            }
            // --- YENİ BÖLÜM SONU ---

        } catch(e: any) {
            uiState.setError(e.message);
            // Hata durumunda da AI'a bir mesaj ekleyebiliriz
             if (actionMessages[type]) {
                await addMessagesForSilentAction(
                    actionMessages[type].user,
                    `'${type}' dokümanı oluşturulurken bir hata oluştu: ${e.message}`
                );
            }
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
        const docKey = docKeyMap[docType];
        
        const docContent = activeConv.generatedDocs[docKey];
        const contentExists = typeof docContent === 'string' ? docContent.trim() !== '' : !!(docContent as SourcedDocument)?.content?.trim();

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
            const docKey = { analysis: 'analysisDoc', test: 'testScenarios', traceability: 'traceabilityMatrix' }[docType];
            const content = conversationState.activeConversation?.generatedDocs[docKey as keyof GeneratedDocs];
            if (content) {
                conversationState.saveDocumentVersion(docKey as keyof GeneratedDocs, content, "Yeni şablon seçimi öncesi arşivlendi");
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
        
        const reason = `v${version.version_number} versiyonuna geri dönüldü`;
        await conversationState.saveDocumentVersion(docKey, version.content, reason, version.template_id);
        
        // YENİ: Geri yüklemeyi sohbet geçmişine ekle
        const docNameMap: Record<string, string> = { analysisDoc: 'Analiz Dokümanı', requestDoc: 'Talep Dokümanı', testScenarios: 'Test Senaryoları', traceabilityMatrix: 'İzlenebilirlik Matrisi' };
        const documentName = docNameMap[docKey] || docKey;

        await addMessagesForSilentAction(
            `(Sistem) '${documentName}' dokümanı bir önceki versiyona geri yüklendi.`,
            `'${documentName}' dokümanı, "${reason}" açıklamasıyla ${version.version_number} numaralı versiyona başarıyla geri yüklendi.`
        );
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