// services/geminiService.ts

import { GoogleGenAI, Type, Content, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
// FIX: Import StreamChunk from the central types file and remove the local definition.
import type { Message, MaturityReport, BacklogSuggestion, GeminiModel, FeedbackItem, GeneratedDocs, ExpertStep, GenerativeSuggestion, LintingIssue, SourcedDocument, VizData, ThoughtProcess, StreamChunk } from '../types';
import { promptService } from './promptService';
import { v4 as uuidv4 } from 'uuid';

const getApiKey = (): string => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API Anahtarı ayarlanmamış.");
    return apiKey;
};

// This type is now imported from types.ts to avoid duplication.

export interface DocumentImpactAnalysis {
    changeType: 'minor' | 'major';
    summary: string;
    isVisualizationImpacted: boolean;
    isTestScenariosImpacted: boolean;
    isTraceabilityImpacted: boolean;
    isBacklogImpacted: boolean;
}

function handleGeminiError(error: any): never {
    console.error("Gemini API Hatası:", error);
    const message = (error?.message || String(error)).toLowerCase();
    if (message.includes('429') || message.includes('quota')) throw new Error("API Kota Limiti Aşıldı.");
    if (message.includes('api key not valid')) throw new Error("Geçersiz API Anahtarı.");
    if (message.includes('internal error')) throw new Error("Gemini API'sinde geçici bir iç hata oluştu.");
    if (message.includes('network error')) throw new Error("Ağ bağlantı hatası.");
    throw new Error(`Beklenmedik bir hata oluştu: ${error?.message || error}`);
}

const generateContent = async (prompt: string, model: GeminiModel, modelConfig?: any): Promise<{ text: string, tokens: number }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const config = modelConfig?.generationConfig || modelConfig;
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config,
        });
        const text = response.text;
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        return { text, tokens };
    } catch (error) {
        handleGeminiError(error);
    }
};

const generateContentStream = async function* (prompt: string, model: GeminiModel, modelConfig?: any): AsyncGenerator<GenerateContentResponse> {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const config = modelConfig?.generationConfig || modelConfig;
        const responseStream = await ai.models.generateContentStream({
            model,
            contents: prompt,
            config,
        });
        for await (const chunk of responseStream) yield chunk;
    } catch (error) {
        handleGeminiError(error);
    }
};

const convertMessagesToGeminiFormat = (history: Message[]): Content[] => {
    const relevantMessages = history.filter(msg => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string' && msg.content.trim() !== '');
    if (relevantMessages.length === 0) return [];
    
    const processedMessages: Message[] = [];
    let currentMessage = { ...relevantMessages[0] }; 
    for (let i = 1; i < relevantMessages.length; i++) {
        const message = relevantMessages[i];
        if (message.role === currentMessage.role) currentMessage.content += "\n\n" + message.content;
        else { processedMessages.push(currentMessage); currentMessage = { ...message }; }
    }
    processedMessages.push(currentMessage);

    return processedMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));
};

const tools: FunctionDeclaration[] = [
    {
        name: 'generateAnalysisDocument',
        description: 'Kullanıcı bir dokümanı "güncelle", "oluştur", "yeniden yaz" veya "yeniden oluştur" gibi bir komut verdiğinde BU ARACI KULLAN. Araç, mevcut konuşma geçmişini ve talebi kullanarak tam bir iş analizi dokümanı JSON nesnesi üretir.',
        parameters: {
            type: Type.OBJECT,
            properties: {}, // No parameters needed, it uses context
        },
    },
    {
        name: 'saveRequestDocument',
        description: 'Kullanıcının ilk talebi netleştiğinde, bu talebi özetlemek ve "Talep Dokümanı" olarak OTOMATİK OLARAK KAYDETMEK için kullanılır. Kullanıcıdan onay isteme, doğrudan bu aracı çağır. Bu araç, sadece sohbetin başında, ilk talep oluşturulurken kullanılmalıdır.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                request_summary: {
                    type: Type.STRING,
                    description: 'Kullanıcının ilk talebinin kısa ve net bir özeti.'
                }
            },
            required: ['request_summary'],
        },
    },
    {
        name: 'generateTestScenarios',
        description: 'Kullanıcı test senaryoları oluşturulmasını istediğinde veya analiz dokümanı yeterince olgunlaştığında bu aracı kullan. Mevcut analiz dokümanından test senaryoları oluşturur.',
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: 'generateTraceabilityMatrix',
        description: 'Kullanıcı gereksinimler ve testler arasında bir izlenebilirlik matrisi istediğinde veya hem analiz hem de test dokümanları mevcut olduğunda bu aracı kullan.',
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: 'generateVisualization',
        description: 'Kullanıcı süreç akışını görselleştirmek istediğinde veya bir süreci "çiz", "görselleştir" veya "diyagramını yap" dediğinde bu aracı kullan.',
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    }
];


export async function* parseStreamingResponse(stream: AsyncGenerator<GenerateContentResponse>): AsyncGenerator<StreamChunk> {
    let buffer = '';
    let thoughtYielded = false;

    for await (const chunk of stream) {
        if (chunk.usageMetadata) {
            yield { type: 'usage_update', tokens: chunk.usageMetadata.totalTokenCount };
        }
        if (!chunk.text) continue;

        buffer += chunk.text;
        
        // If we haven't found the thought yet, keep looking.
        if (!thoughtYielded) {
            const startTag = '<dusunce>';
            const endTag = '</dusunce>';
            const startIdx = buffer.indexOf(startTag);
            const endIdx = buffer.indexOf(endTag);

            if (startIdx !== -1 && endIdx !== -1) {
                const jsonStr = buffer.substring(startIdx + startTag.length, endIdx);
                try {
                    const thoughtPayload: ThoughtProcess = JSON.parse(jsonStr);
                    yield { type: 'thought_chunk', payload: thoughtPayload };
                    thoughtYielded = true;

                    // Yield the text that came after the thought block
                    const remainingText = buffer.substring(endIdx + endTag.length);
                    if (remainingText) {
                        yield { type: 'text_chunk', text: remainingText };
                    }
                    buffer = ''; // Clear buffer after processing
                } catch (e) {
                    // JSON might be incomplete, wait for more chunks
                }
            }
        } else {
            // If thought was already yielded, everything else is a text chunk.
            yield { type: 'text_chunk', text: buffer };
            buffer = ''; // Clear buffer
        }
    }

    // If stream ends and there's still content in buffer (e.g., no thought block was found)
    if (buffer) {
        yield { type: 'text_chunk', text: buffer };
    }
}


const isBirimiTalepSchema = {
    type: Type.OBJECT,
    properties: {
        dokumanTipi: { type: Type.STRING, enum: ["IsBirimiTalep"] },
        dokumanNo: { type: Type.STRING },
        tarih: { type: Type.STRING },
        revizyon: { type: Type.STRING },
        talepAdi: { type: Type.STRING },
        talepSahibi: { type: Type.STRING },
        mevcutDurumProblem: { type: Type.STRING },
        talepAmaciGerekcesi: { type: Type.STRING },
        kapsam: {
            type: Type.OBJECT,
            properties: {
                inScope: { type: Type.ARRAY, items: { type: Type.STRING } },
                outOfScope: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['inScope', 'outOfScope']
        },
        beklenenIsFaydalari: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: [
        'dokumanTipi', 'dokumanNo', 'tarih', 'revizyon', 'talepAdi', 'talepSahibi',
        'mevcutDurumProblem', 'talepAmaciGerekcesi', 'kapsam', 'beklenenIsFaydalari'
    ]
};


export const geminiService = {
    handleUserMessageStream: async function* (history: Message[], generatedDocs: GeneratedDocs, templates: { analysis: string; test: string; traceability: string; visualization: string; }, model: GeminiModel): AsyncGenerator<StreamChunk> {
        try {
            const ai = new GoogleGenAI({ apiKey: getApiKey() });
            const hasRequestDoc = !!generatedDocs.requestDoc?.trim();
            const hasRealAnalysisDoc = !!generatedDocs.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");
            const isStartingConversation = !hasRequestDoc && !hasRealAnalysisDoc && history.filter(m => m.role !== 'system').length <= 1;

            const systemInstruction = isStartingConversation
                ? promptService.getPrompt('continueConversation')
                : promptService.getPrompt('proactiveAnalystSystemInstruction')
                    .replace('{analysis_document_content}', generatedDocs.analysisDoc || "...")
                    .replace('{request_document_content}', generatedDocs.requestDoc || "...");
            
            const geminiHistory = convertMessagesToGeminiFormat(history);
            
            const responseStream = await ai.models.generateContentStream({
                model,
                contents: geminiHistory,
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: tools }],
                },
            });

            let buffer = '';
            let thoughtYielded = false;
            
            for await (const chunk of responseStream) {
                 if (chunk.usageMetadata) {
                     yield { type: 'usage_update', tokens: chunk.usageMetadata.totalTokenCount };
                }
                if (chunk.functionCalls) {
                    for (const fc of chunk.functionCalls) {
                        yield { type: 'function_call', name: fc.name, args: fc.args };
                    }
                }
                
                const text = chunk.text;
                if (text) {
                    buffer += text;

                    if (!thoughtYielded) {
                        const startTag = '<dusunce>';
                        const endTag = '</dusunce>';
                        const startIdx = buffer.indexOf(startTag);
                        const endIdx = buffer.indexOf(endTag);

                        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                            const jsonStr = buffer.substring(startIdx + startTag.length, endIdx);
                            try {
                                const thoughtPayload: ThoughtProcess = JSON.parse(jsonStr);
                                yield { type: 'thought_chunk', payload: thoughtPayload };
                                thoughtYielded = true;

                                const remainingText = buffer.substring(endIdx + endTag.length);
                                if (remainingText) {
                                    yield { type: 'text_chunk', text: remainingText };
                                }
                                buffer = ''; // Clear buffer
                            } catch (e) {
                                // Incomplete JSON, wait for more chunks
                            }
                        }
                    } else {
                        yield { type: 'text_chunk', text: buffer };
                        buffer = ''; // Clear buffer
                    }
                }
            }

            // After the loop, process any remaining content in the buffer
            if (buffer) {
                if (!thoughtYielded) {
                     const startTag = '<dusunce>';
                    const endTag = '</dusunce>';
                    const startIdx = buffer.indexOf(startTag);
                    const endIdx = buffer.indexOf(endTag);

                     if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                        // This logic is duplicated, but it's a safeguard for thoughts at the very end
                        const jsonStr = buffer.substring(startIdx + startTag.length, endIdx);
                        try {
                            const thoughtPayload: ThoughtProcess = JSON.parse(jsonStr);
                            yield { type: 'thought_chunk', payload: thoughtPayload };
                            const remainingText = buffer.substring(endIdx + endTag.length);
                            if (remainingText) {
                                yield { type: 'text_chunk', text: remainingText };
                            }
                        } catch(e) {
                             yield { type: 'text_chunk', text: buffer.substring(endIdx + endTag.length) };
                        }
                    } else {
                         yield { type: 'text_chunk', text: buffer };
                    }
                } else {
                    yield { type: 'text_chunk', text: buffer };
                }
            }

        } catch (error) {
            yield { type: 'error', message: error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu" };
        }
    },
    
    runExpertAnalysisStream: async function* (userMessage: Message, generatedDocs: GeneratedDocs, templates: { analysis: string; test: string; traceability: string; visualization: string; }, diagramType: 'mermaid' | 'bpmn'): AsyncGenerator<StreamChunk> {
        let totalTokens = 0;
        
        const initialChecklist: ExpertStep[] = [
            { id: 'request', name: 'Talep Dokümanı Oluşturma', status: 'pending' },
            { id: 'analysis', name: 'İş Analizi Dokümanı Oluşturma', status: 'pending' },
            { id: 'viz', name: 'Süreç Akışını Görselleştirme', status: 'pending' },
            { id: 'test', name: 'Test Senaryoları Oluşturma', status: 'pending' },
            { id: 'traceability', name: 'İzlenebilirlik Matrisi Oluşturma', status: 'pending' },
        ];
        
        const createThought = (title: string, steps: ExpertStep[]): ThoughtProcess => ({ title, steps });
    
        try {
            yield { type: 'thought_chunk', payload: createThought("Exper Modu Analiz Ediliyor...", initialChecklist) };
            
            // Step 1: Generate Request Document
            initialChecklist[0].status = 'in_progress';
            yield { type: 'thought_chunk', payload: createThought("Talep Dokümanı Oluşturuluyor", initialChecklist) };
            let requestDocContent = '';
            try {
                const { jsonString, tokens } = await this.parseTextToRequestDocument(userMessage.content);
                totalTokens += tokens;
                requestDocContent = jsonString;
                yield { type: 'usage_update', tokens };
                yield { type: 'doc_stream_chunk', docKey: 'requestDoc', chunk: requestDocContent };
                initialChecklist[0].status = 'completed';
                yield { type: 'thought_chunk', payload: createThought("Talep Dokümanı Tamamlandı", initialChecklist) };
            } catch (e: any) {
                requestDocContent = userMessage.content;
                yield { type: 'doc_stream_chunk', docKey: 'requestDoc', chunk: requestDocContent };
                initialChecklist[0].status = 'error';
                initialChecklist[0].details = 'Yapısal doküman oluşturulamadı, ham metin kullanılıyor.';
                yield { type: 'thought_chunk', payload: createThought("Talep Dokümanı Hatası", initialChecklist) };
            }
    
            // Step 2: Generate Analysis Document
            initialChecklist[1].status = 'in_progress';
            yield { type: 'thought_chunk', payload: createThought("Analiz Dokümanı Oluşturuluyor", initialChecklist) };
            let analysisDocContent = '';
            try {
                const docStream = this.generateAnalysisDocument(requestDocContent, [userMessage], templates.analysis, 'gemini-2.5-pro');
                for await (const docChunk of docStream) {
                    if (docChunk.type === 'doc_stream_chunk') {
                        analysisDocContent = docChunk.chunk;
                        yield docChunk;
                    } else if (docChunk.type === 'usage_update') {
                        totalTokens += docChunk.tokens;
                        yield docChunk;
                    } else if (docChunk.type === 'expert_run_update') {
                        const subStepInProgress = docChunk.checklist.find(s => s.status === 'in_progress');
                        if (subStepInProgress) {
                            initialChecklist[1].details = `Oluşturuluyor: ${subStepInProgress.name}...`;
                        }
                        yield { type: 'thought_chunk', payload: createThought("Analiz Adımları İşleniyor", initialChecklist) };
                    }
                }
                initialChecklist[1].status = 'completed';
                initialChecklist[1].details = undefined;
                yield { type: 'thought_chunk', payload: createThought("Analiz Dokümanı Tamamlandı", initialChecklist) };

            } catch (e: any) {
                initialChecklist[1].status = 'error';
                initialChecklist[1].details = e.message;
                yield { type: 'thought_chunk', payload: createThought("Analiz Dokümanı Hatası", initialChecklist) };
                throw new Error(`Analiz dokümanı oluşturulurken hata: ${e.message}`);
            }

            // Step 3: Generate Visualization
            initialChecklist[2].status = 'in_progress';
            initialChecklist[2].details = "Oluşturuluyor...";
            yield { type: 'thought_chunk', payload: createThought("Süreç Görselleştiriliyor", initialChecklist) };
            try {
                const { code, tokens } = await this.generateDiagram(analysisDocContent, diagramType, templates.visualization, 'gemini-2.5-flash');
                totalTokens += tokens;
                yield { type: 'usage_update', tokens };
                const sourceHash = uuidv4(); // Use a unique hash for expert mode runs
                const vizData = { code, sourceHash };
                const vizKey = diagramType === 'bpmn' ? 'bpmnViz' : 'mermaidViz';
                yield { type: 'doc_stream_chunk', docKey: vizKey, chunk: vizData };
                initialChecklist[2].status = 'completed';
                initialChecklist[2].details = undefined;
                yield { type: 'thought_chunk', payload: createThought("Süreç Görselleştirildi", initialChecklist) };
            } catch(e: any) {
                initialChecklist[2].status = 'error';
                initialChecklist[2].details = e.message;
                yield { type: 'thought_chunk', payload: createThought("Görselleştirme Hatası", initialChecklist) };
            }

            // Step 4: Generate Test Scenarios
            initialChecklist[3].status = 'in_progress';
            initialChecklist[3].details = "Oluşturuluyor...";
            yield { type: 'thought_chunk', payload: createThought("Test Senaryoları Oluşturuluyor", initialChecklist) };
            let testScenariosContent = '';
            try {
                const testStream = this.generateTestScenarios(analysisDocContent, templates.test, 'gemini-2.5-flash');
                 for await (const chunk of testStream) {
                    if(chunk.type === 'doc_stream_chunk') testScenariosContent = chunk.chunk;
                    yield chunk;
                }
                initialChecklist[3].status = 'completed';
                initialChecklist[3].details = undefined;
                yield { type: 'thought_chunk', payload: createThought("Test Senaryoları Tamamlandı", initialChecklist) };
            } catch(e: any) {
                initialChecklist[3].status = 'error';
                initialChecklist[3].details = e.message;
                yield { type: 'thought_chunk', payload: createThought("Test Senaryosu Hatası", initialChecklist) };
            }

             // Step 5: Generate Traceability Matrix
            if (testScenariosContent) {
                initialChecklist[4].status = 'in_progress';
                initialChecklist[4].details = "Oluşturuluyor...";
                yield { type: 'thought_chunk', payload: createThought("İzlenebilirlik Matrisi Oluşturuluyor", initialChecklist) };
                try {
                    const matrixStream = this.generateTraceabilityMatrix(analysisDocContent, testScenariosContent, templates.traceability, 'gemini-2.5-flash');
                    for await (const chunk of matrixStream) {
                        yield chunk;
                    }
                    initialChecklist[4].status = 'completed';
                    initialChecklist[4].details = undefined;
                    yield { type: 'thought_chunk', payload: createThought("İzlenebilirlik Matrisi Tamamlandı", initialChecklist) };
                } catch(e: any) {
                    initialChecklist[4].status = 'error';
                    initialChecklist[4].details = e.message;
                    yield { type: 'thought_chunk', payload: createThought("İzlenebilirlik Hatası", initialChecklist) };
                }
            } else {
                 initialChecklist[4].status = 'error';
                 initialChecklist[4].details = "Test senaryoları oluşturulamadığı için atlandı.";
                 yield { type: 'thought_chunk', payload: createThought("İzlenebilirlik Atlandı", initialChecklist) };
            }
    
            const finalMessage = "Exper modu tamamlandı. Tüm dokümanlar sizin için oluşturuldu ve çalışma alanında güncellendi. İnceleyebilirsiniz.";
            yield { type: 'text_chunk', text: finalMessage };
    
        } catch (error: any) {
            yield { type: 'error', message: error.message };
            yield { type: 'text_chunk', text: `Exper modu bir hatayla karşılaştı: ${error.message}` };
        } finally {
             if (totalTokens > 0) yield { type: 'usage_update', tokens: totalTokens };
        }
    },

    checkAnalysisMaturity: async (history: Message[], generatedDocs: GeneratedDocs, model: GeminiModel, modelConfig?: object): Promise<{ report: MaturityReport, tokens: number }> => {
        const schema = {
            type: Type.OBJECT,
            properties: {
                isSufficient: { type: Type.BOOLEAN },
                summary: { type: Type.STRING },
                missingTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                scores: {
                    type: Type.OBJECT,
                    properties: {
                        scope: { type: Type.INTEGER },
                        technical: { type: Type.INTEGER },
                        userFlow: { type: Type.INTEGER },
                        nonFunctional: { type: Type.INTEGER },
                    },
                    required: ['scope', 'technical', 'userFlow', 'nonFunctional']
                },
                overallScore: { type: Type.INTEGER },
                justification: { type: Type.STRING },
                maturity_level: { type: Type.STRING, enum: ['Zayıf', 'Gelişime Açık', 'İyi', 'Mükemmel'] },
            },
            required: ['isSufficient', 'summary', 'missingTopics', 'suggestedQuestions', 'scores', 'overallScore', 'justification', 'maturity_level']
        };
        
        const basePrompt = promptService.getPrompt('checkAnalysisMaturity');
        
        const testScenariosContent = typeof generatedDocs.testScenarios === 'object' 
            ? generatedDocs.testScenarios.content 
            : generatedDocs.testScenarios;

        const traceabilityMatrixContent = typeof generatedDocs.traceabilityMatrix === 'object'
            ? generatedDocs.traceabilityMatrix.content
            : generatedDocs.traceabilityMatrix;
            
        const documentsContext = `
            **Mevcut Proje Dokümanları:**
            ---
            **1. İş Analizi Dokümanı:**
            ${generatedDocs.analysisDoc || "Henüz oluşturulmadı."}
            ---
            **2. Test Senaryoları:**
            ${testScenariosContent || "Henüz oluşturulmadı."}
            ---
            **3. İzlenebilirlik Matrisi:**
            ${traceabilityMatrixContent || "Henüz oluşturulmadı."}
            ---
        `;

        const formatHistory = (h: Message[]): string => h.map(m => `${m.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${m.content}`).join('\n');
        const prompt = `${basePrompt}\n\n${documentsContext}\n\n**Değerlendirilecek Konuşma Geçmişi:**\n${formatHistory(history)}`;
        
        const generationConfig = { responseMimeType: "application/json", responseSchema: schema };

        const { text: jsonString, tokens } = await generateContent(prompt, model, { ...generationConfig, ...modelConfig });
        try {
            return { report: JSON.parse(jsonString) as MaturityReport, tokens };
        } catch (e) {
            console.error("Failed to parse maturity report JSON:", e, "Received string:", jsonString);
            throw new Error("Analiz olgunluk raporu ayrıştırılamadı.");
        }
    },
    generateConversationTitle: async (firstMessage: string): Promise<{ title: string, tokens: number }> => {
        const prompt = promptService.getPrompt('generateConversationTitle') + `: "${firstMessage}"`;
        const { text, tokens } = await generateContent(prompt, 'gemini-2.5-flash');
        return { title: text.replace(/"/g, ''), tokens };
    },

    analyzeFeedback: async (feedbackData: FeedbackItem[]): Promise<{ analysis: string, tokens: number }> => {
        const prompt = promptService.getPrompt('analyzeFeedback') + `\n\n**Geri Bildirim Verisi:**\n${JSON.stringify(feedbackData, null, 2)}`;
        const { text, tokens } = await generateContent(prompt, 'gemini-2.5-pro');
        return { analysis: text, tokens };
    },

    generateBacklogSuggestions: async (requestDoc: string, analysisDoc: string, testScenarios: string, traceabilityMatrix: string, model: GeminiModel): Promise<{ suggestions: BacklogSuggestion[], reasoning: string, tokens: number }> => {
        const prompt = promptService.getPrompt('generateBacklogFromArtifacts')
            .replace('{main_request}', requestDoc)
            .replace('{analysis_document}', analysisDoc)
            .replace('{test_scenarios}', testScenarios)
            .replace('{traceability_matrix}', traceabilityMatrix);

        const backlogItemProperties = {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['epic', 'story', 'test_case', 'task'] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
        };
        
        const requiredFields = ['type', 'title', 'description', 'priority'];

        const recursiveBacklogItemSchema = {
            type: Type.OBJECT,
            properties: {
                ...backlogItemProperties,
                children: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            ...backlogItemProperties,
                            children: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: backlogItemProperties,
                                    required: requiredFields
                                },
                            },
                        },
                        required: requiredFields
                    },
                },
            },
            required: requiredFields
        };

        const schema = {
            type: Type.OBJECT,
            properties: {
                suggestions: {
                    type: Type.ARRAY,
                    items: recursiveBacklogItemSchema
                },
                reasoning: { type: Type.STRING }
            },
            required: ['suggestions', 'reasoning']
        };


        const generationConfig = { responseMimeType: "application/json", responseSchema: schema };

        const { text: jsonString, tokens } = await generateContent(prompt, model, generationConfig);
        try {
            const result = JSON.parse(jsonString);
            const assignIds = (items: BacklogSuggestion[]): BacklogSuggestion[] => {
                return items.map(item => ({
                    ...item,
                    id: uuidv4(),
                    children: item.children ? assignIds(item.children) : []
                }));
            };
            return { suggestions: assignIds(result.suggestions || []), reasoning: result.reasoning || '', tokens };
        } catch (e) {
            console.error("Failed to parse backlog suggestions JSON:", e, "Received string:", jsonString);
            throw new Error("Backlog önerileri ayrıştırılamadı.");
        }
    },

    convertMarkdownToRequestJson: async (markdownContent: string): Promise<{ jsonString: string, tokens: number }> => {
        const prompt = promptService.getPrompt('convertMarkdownToRequestJson').replace('{markdown_content}', markdownContent);
        const generationConfig = { responseMimeType: "application/json", responseSchema: isBirimiTalepSchema };
        const { text: jsonString, tokens } = await generateContent(prompt, 'gemini-2.5-flash', generationConfig);
        try {
            JSON.parse(jsonString); // Validate JSON
            return { jsonString, tokens };
        } catch (e) {
            console.error("Failed to parse Markdown to Request JSON:", e, "Received string:", jsonString);
            throw new Error("Markdown içeriği yapısal talep dokümanına dönüştürülemedi.");
        }
    },

    summarizeDocumentChange: async (oldContent: string, newContent: string): Promise<{ summary: string, tokens: number }> => {
        const prompt = promptService.getPrompt('summarizeChange') + `\n\n**ESKİ:**\n${oldContent}\n\n**YENİ:**\n${newContent}`;
        const { text, tokens } = await generateContent(prompt, 'gemini-2.5-flash-lite');
        return { summary: text, tokens };
    },

    lintDocument: async (content: string): Promise<{ issues: LintingIssue[], tokens: number }> => {
        const prompt = promptService.getPrompt('lintDocument') + `\n\n**Doküman İçeriği:**\n${content}`;
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['BROKEN_SEQUENCE'] },
                    section: { type: Type.STRING },
                    details: { type: Type.STRING }
                },
                required: ['type', 'section', 'details']
            }
        };
        const generationConfig = { responseMimeType: "application/json", responseSchema: schema };
        const { text: jsonString, tokens } = await generateContent(prompt, 'gemini-2.5-flash-lite', generationConfig);
        try {
            return { issues: JSON.parse(jsonString) as LintingIssue[], tokens };
        } catch (e) {
            console.error("Failed to parse linter issues JSON:", e, "Received string:", jsonString);
            return { issues: [], tokens }; // Return empty array on parse error
        }
    },

    fixDocumentLinterIssues: async (content: string, issue: LintingIssue): Promise<{ fixedContent: string, tokens: number }> => {
        const instruction = `Lütfen "${issue.section}" bölümündeki şu hatayı düzelt: ${issue.details}`;
        const prompt = promptService.getPrompt('fixLinterIssues').replace('{instruction}', instruction) + `\n\n**Doküman İçeriği:**\n${content}`;
        const { text, tokens } = await generateContent(prompt, 'gemini-2.5-flash');
        return { fixedContent: text, tokens };
    },
    
    analyzeDocumentChange: async (oldContent: string, newContent: string, model: GeminiModel): Promise<{ impact: DocumentImpactAnalysis, tokens: number }> => {
        const schema = {
            type: Type.OBJECT,
            properties: {
                changeType: { type: Type.STRING, enum: ['minor', 'major'] },
                summary: { type: Type.STRING },
                isVisualizationImpacted: { type: Type.BOOLEAN },
                isTestScenariosImpacted: { type: Type.BOOLEAN },
                isTraceabilityImpacted: { type: Type.BOOLEAN },
                isBacklogImpacted: { type: Type.BOOLEAN }
            },
            required: ['changeType', 'summary', 'isVisualizationImpacted', 'isTestScenariosImpacted', 'isTraceabilityImpacted', 'isBacklogImpacted']
        };
        const prompt = `Bir iş analizi dokümanının iki versiyonu aşağıdadır. Değişikliğin etkisini analiz et.
        
        **DEĞİŞİKLİK ETKİ ANALİZİ KURALLARI:**
        - Eğer sadece metinsel düzeltmeler, yeniden ifade etmeler veya küçük eklemeler yapıldıysa, bu 'minor' bir değişikliktir.
        - Eğer yeni bir fonksiyonel gereksinim (FR) eklendiyse, mevcut bir FR'nin mantığı tamamen değiştiyse veya bir bölüm silindiyse, bu 'major' bir değişikliktir.
        - 'major' bir değişiklik genellikle görselleştirmeyi, test senaryolarını ve izlenebilirliği etkiler.
        - 'summary' alanına değişikliği tek bir cümleyle özetle.
        
        **ESKİ VERSİYON:**
        ---
        ${oldContent}
        ---
        
        **YENİ VERSİYON:**
        ---
        ${newContent}
        ---
        
        Lütfen değişikliğin etkisini JSON formatında analiz et.`;

        const generationConfig = { responseMimeType: "application/json", responseSchema: schema };
        const { text: jsonString, tokens } = await generateContent(prompt, model, generationConfig);
        try {
            return { impact: JSON.parse(jsonString) as DocumentImpactAnalysis, tokens };
        } catch (e) {
            console.error("Failed to parse impact analysis JSON:", e, "Received string:", jsonString);
            throw new Error("Değişiklik etki analizi ayrıştırılamadı.");
        }
    },

    generateDiagram: async (analysisDoc: string, type: 'mermaid' | 'bpmn', template: string, model: GeminiModel): Promise<{ code: string, tokens: number }> => {
        const prompt = template.replace('{analysis_document_content}', analysisDoc);
        const { text, tokens } = await generateContent(prompt, model);
        const codeBlockRegex = type === 'mermaid' ? /```mermaid\n([\s\S]*?)\n```/ : /```xml\n([\s\S]*?)\n```/;
        const match = text.match(codeBlockRegex);
        return { code: match ? match[1].trim() : text, tokens };
    },

    generateAnalysisDocument: async function* (requestDoc: string, history: Message[], template: string, model: GeminiModel): AsyncGenerator<StreamChunk> {
        const historyString = history.map(m => `${m.role}: ${m.content}`).join('\n');
        
        const prompt = template
            .replace('{request_document_content}', requestDoc || "[Talep Dokümanı Yok]")
            .replace('{conversation_history}', historyString);

        const stream = generateContentStream(prompt, model);

        let totalTokens = 0;
        let fullText = '';
        for await (const chunk of stream) {
            if (chunk.usageMetadata) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
            }
            const text = chunk.text;
            if (text) {
                fullText += text;
                yield { type: 'doc_stream_chunk', docKey: 'analysisDoc', chunk: fullText };
            }
        }
        
        if (totalTokens > 0) yield { type: 'usage_update', tokens: totalTokens };
    },

    generateTestScenarios: async function* (analysisDoc: string, template: string, model: GeminiModel): AsyncGenerator<StreamChunk> {
        const prompt = template.replace('{analysis_document_content}', analysisDoc);
        const stream = generateContentStream(prompt, model);
        let totalTokens = 0;
        let fullText = '';
        for await (const chunk of stream) {
            if (chunk.usageMetadata) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
            }
            const text = chunk.text;
            if (text) {
                fullText += text;
                yield { type: 'doc_stream_chunk', docKey: 'testScenarios', chunk: fullText };
            }
        }
        if (totalTokens > 0) yield { type: 'usage_update', tokens: totalTokens };
    },

    generateTraceabilityMatrix: async function* (analysisDoc: string, testScenarios: string, template: string, model: GeminiModel): AsyncGenerator<StreamChunk> {
        const prompt = template
            .replace('{analysis_document_content}', analysisDoc)
            .replace('{test_scenarios_content}', testScenarios);
        const stream = generateContentStream(prompt, model);
        let totalTokens = 0;
        let fullText = '';
        for await (const chunk of stream) {
            if (chunk.usageMetadata) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
            }
            const text = chunk.text;
            if (text) {
                fullText += text;
                yield { type: 'doc_stream_chunk', docKey: 'traceabilityMatrix', chunk: fullText };
            }
        }
        if (totalTokens > 0) yield { type: 'usage_update', tokens: totalTokens };
    },

    suggestNextFeature: async (analysisDoc: string, history: Message[]): Promise<{ suggestions: string[], tokens: number }> => {
        const prompt = promptService.getPrompt('suggestNextFeature')
            .replace('{analysis_document}', analysisDoc)
            .replace('{conversation_history}', JSON.stringify(history, null, 2));
        const schema = {
            type: Type.OBJECT,
            properties: {
                suggestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ['suggestions']
        };
        const generationConfig = { responseMimeType: "application/json", responseSchema: schema };
        const { text, tokens } = await generateContent(prompt, 'gemini-2.5-pro', generationConfig);
        try {
            const result = JSON.parse(text);
            return { suggestions: result.suggestions || [], tokens };
        } catch (e) {
            console.error("Failed to parse feature suggestions:", e);
            return { suggestions: [], tokens };
        }
    },
    
    parseTextToRequestDocument: async (rawText: string): Promise<{ jsonString: string, tokens: number }> => {
        const prompt = promptService.getPrompt('parseTextToRequestDocument').replace('{raw_text}', rawText);
        const generationConfig = { responseMimeType: "application/json", responseSchema: isBirimiTalepSchema };
        const { text: jsonString, tokens } = await generateContent(prompt, 'gemini-2.5-flash', generationConfig);
        try {
            // Validate that the output is valid JSON before returning
            JSON.parse(jsonString);
            return { jsonString, tokens };
        } catch (e) {
            console.error("Failed to parse IsBirimiTalep JSON:", e, "Received string:", jsonString);
            // Fallback to just saving the raw text if parsing fails
            throw new Error("AI, metni yapısal bir talep dokümanına dönüştüremedi.");
        }
    },
};