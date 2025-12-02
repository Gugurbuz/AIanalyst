import { openaiService } from './openaiService';
import { promptService } from './promptService';
import type { Message, GeneratedDocs, OpenAIModel, StreamChunk } from '../types';

const FUNCTION_DEFINITIONS = {
    saveRequestDocument: {
        name: "saveRequestDocument",
        description: "Kullanıcının talebini yapısal bir 'İş Birimi Talep Dokümanı' olarak kaydet. Bu fonksiyonu, kullanıcının talebini yeterince anladığında ve kaydetmeye hazır olduğunda çağır.",
        parameters: {
            type: "object",
            properties: {
                request_summary: {
                    type: "string",
                    description: "Kullanıcının talebinin detaylı bir özeti. Bu metin, talep dokümanına dönüştürülecektir."
                }
            },
            required: ["request_summary"]
        }
    },
    generateAnalysisDocument: {
        name: "generateAnalysisDocument",
        description: "Mevcut talep ve konuşma geçmişine dayanarak kapsamlı bir 'İş Analizi Dokümanı' oluştur.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    },
    generateTestScenarios: {
        name: "generateTestScenarios",
        description: "Mevcut analiz dokümanına dayanarak test senaryoları oluştur.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    },
    generateVisualization: {
        name: "generateVisualization",
        description: "Mevcut analiz dokümanına dayanarak süreç akışını gösteren bir görselleştirme (Mermaid veya BPMN) oluştur.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    },
    generateTraceabilityMatrix: {
        name: "generateTraceabilityMatrix",
        description: "Gereksinimler ve test senaryoları arasında izlenebilirlik matrisi oluştur.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};

const convertHistoryToText = (history: Message[]): string => {
    return history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `${m.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${m.content}`)
        .join('\n\n');
};

export const openaiWrapperService = {
    handleUserMessageStream: async function* (
        history: Message[],
        generatedDocs: GeneratedDocs,
        templates: { analysis: string; test: string; traceability: string; visualization: string },
        model: OpenAIModel
    ): AsyncGenerator<StreamChunk> {
        const hasRequestDoc = !!generatedDocs.requestDoc?.trim();
        const hasRealAnalysisDoc = !!generatedDocs.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");
        const isStartingConversation = !hasRequestDoc && !hasRealAnalysisDoc && history.filter(m => m.role !== 'system').length <= 1;

        const systemInstruction = isStartingConversation
            ? promptService.getPrompt('continueConversation')
            : promptService.getPrompt('proactiveAnalystSystemInstruction')
                .replace('{analysis_document_content}', generatedDocs.analysisDoc || "...")
                .replace('{request_document_content}', generatedDocs.requestDoc || "...");

        const tools = Object.values(FUNCTION_DEFINITIONS).map(func => ({
            type: "function" as const,
            function: func
        }));

        const messagesWithSystem: any[] = [
            { role: 'system', content: systemInstruction },
            ...history.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
                role: m.role,
                content: m.content
            }))
        ];

        try {
            const stream = openaiService.generateContentStream(messagesWithSystem, systemInstruction, model);

            let buffer = '';
            let thoughtYielded = false;

            for await (const chunk of stream) {
                if (chunk.type === 'error') {
                    yield chunk;
                    continue;
                }

                if (chunk.type === 'usage_update') {
                    yield chunk;
                    continue;
                }

                if (chunk.type === 'function_call') {
                    yield chunk;
                    continue;
                }

                if (chunk.type === 'text_chunk') {
                    buffer += chunk.text;

                    if (!thoughtYielded) {
                        const startMarker = '```thinking';
                        const endMarker = '```';
                        const startIdx = buffer.indexOf(startMarker);

                        if (startIdx !== -1) {
                            const searchStart = startIdx + startMarker.length;
                            const endIdx = buffer.indexOf(endMarker, searchStart);

                            if (endIdx !== -1) {
                                const jsonStr = buffer.substring(searchStart, endIdx).trim();
                                try {
                                    const thoughtPayload = JSON.parse(jsonStr);
                                    yield { type: 'thought_chunk', payload: thoughtPayload };
                                    thoughtYielded = true;
                                    const remainingText = buffer.substring(endIdx + endMarker.length);
                                    if (remainingText.trim()) {
                                        yield { type: 'text_chunk', text: remainingText };
                                    }
                                    buffer = '';
                                } catch (e) {
                                    console.log("Failed to parse thought JSON (incomplete):", e);
                                }
                            }
                        }
                    } else {
                        yield { type: 'text_chunk', text: buffer };
                        buffer = '';
                    }
                }
            }

            if (buffer) {
                if (!thoughtYielded) {
                    const startMarker = '```thinking';
                    const endMarker = '```';
                    const startIdx = buffer.indexOf(startMarker);

                    if (startIdx !== -1) {
                        const searchStart = startIdx + startMarker.length;
                        const endIdx = buffer.indexOf(endMarker, searchStart);

                        if (endIdx !== -1) {
                            const jsonStr = buffer.substring(searchStart, endIdx).trim();
                            try {
                                const thoughtPayload = JSON.parse(jsonStr);
                                yield { type: 'thought_chunk', payload: thoughtPayload };
                                const remainingText = buffer.substring(endIdx + endMarker.length).trim();
                                if (remainingText) {
                                    yield { type: 'text_chunk', text: remainingText };
                                }
                            } catch(e) {
                                yield { type: 'text_chunk', text: buffer };
                            }
                        } else {
                            yield { type: 'text_chunk', text: buffer };
                        }
                    } else {
                        yield { type: 'text_chunk', text: buffer };
                    }
                } else {
                    yield { type: 'text_chunk', text: buffer };
                }
            }

        } catch (error: any) {
            console.error('OpenAI Wrapper Error:', error);
            yield {
                type: 'error',
                message: error?.message || 'OpenAI ile iletişimde hata oluştu'
            };
        }
    },

    runExpertAnalysisStream: async function* (
        userMessage: Message,
        generatedDocs: GeneratedDocs,
        templates: { analysis: string; test: string; traceability: string; visualization: string },
        diagramType: 'mermaid' | 'bpmn',
        model: OpenAIModel
    ): AsyncGenerator<StreamChunk> {
        const systemPrompt = promptService.getPrompt('expertSystemInstruction')
            .replace('{request_document_content}', generatedDocs.requestDoc || "...")
            .replace('{analysis_document_content}', generatedDocs.analysisDoc || "...");

        yield {
            type: 'thought_chunk',
            payload: {
                title: "Expert Analiz Modu Başlatıldı",
                steps: [
                    { id: "init", name: "Expert mod aktif - Tüm dokümanlar otomatik oluşturulacak", status: "completed" }
                ]
            }
        };

        const steps = [
            { key: 'analysis', name: 'İş Analizi Dokümanı', template: templates.analysis },
            { key: 'viz', name: 'Süreç Görselleştirmesi', template: templates.visualization },
            { key: 'test', name: 'Test Senaryoları', template: templates.test },
            { key: 'traceability', name: 'İzlenebilirlik Matrisi', template: templates.traceability }
        ];

        for (const step of steps) {
            try {
                yield {
                    type: 'thought_chunk',
                    payload: {
                        title: "Expert Analiz",
                        steps: [{ id: step.key, name: `${step.name} oluşturuluyor...`, status: "in_progress" }]
                    }
                };

                let prompt = step.template
                    .replace('{request_document_content}', generatedDocs.requestDoc || "...")
                    .replace('{analysis_document_content}', generatedDocs.analysisDoc || "...")
                    .replace('{conversation_history}', `Kullanıcı: ${userMessage.content}`);

                if (step.key === 'test') {
                    prompt = prompt.replace('{analysis_document_content}', generatedDocs.analysisDoc || "...");
                } else if (step.key === 'traceability') {
                    prompt = prompt
                        .replace('{analysis_document_content}', generatedDocs.analysisDoc || "...")
                        .replace('{test_scenarios_content}', generatedDocs.testScenarios || "...");
                }

                const result = await openaiService.generateContent(prompt, model);

                const docKey = step.key === 'viz'
                    ? (diagramType === 'bpmn' ? 'bpmnViz' : 'mermaidViz')
                    : (step.key === 'analysis' ? 'analysisDoc'
                        : step.key === 'test' ? 'testScenarios'
                        : 'traceabilityMatrix');

                yield {
                    type: 'doc_stream_chunk',
                    docKey: docKey as any,
                    chunk: result.text
                };

                yield {
                    type: 'usage_update',
                    tokens: result.tokens
                };

                yield {
                    type: 'thought_chunk',
                    payload: {
                        title: "Expert Analiz",
                        steps: [{ id: step.key, name: `${step.name} tamamlandı`, status: "completed" }]
                    }
                };

            } catch (error: any) {
                yield {
                    type: 'thought_chunk',
                    payload: {
                        title: "Expert Analiz",
                        steps: [{ id: step.key, name: `${step.name} hatası: ${error.message}`, status: "error" }]
                    }
                };
            }
        }

        yield {
            type: 'text_chunk',
            text: 'Expert analiz tamamlandı. Tüm dokümanlar başarıyla oluşturuldu.'
        };
    }
};
