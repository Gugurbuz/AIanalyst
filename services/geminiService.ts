// services/geminiService.ts

import { GoogleGenAI, Type, Content, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import type { Message, MaturityReport, BacklogSuggestion, GeminiModel, FeedbackItem, GeneratedDocs, ExpertStep, GenerativeSuggestion, LintingIssue, SourcedDocument, StructuredAnalysisDoc, VizData } from '../types';
import { promptService } from './promptService';
import { v4 as uuidv4 } from 'uuid';

const getApiKey = (): string => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API Anahtarı ayarlanmamış.");
    return apiKey;
};

export type StreamChunk = 
    | { type: 'text_chunk'; text: string }
    | { type: 'doc_stream_chunk'; docKey: 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix' | 'requestDoc' | 'mermaidViz' | 'bpmnViz'; chunk: any }
    | { type: 'visualization_update'; content: string; }
    | { type: 'chat_response'; content: string }
    | { type: 'chat_stream_chunk'; chunk: string }
    | { type: 'status_update'; message: string }
    | { type: 'maturity_update'; report: MaturityReport }
    | { type: 'expert_run_update'; checklist: ExpertStep[]; isComplete: boolean; finalMessage?: string; }
    | { type: 'generative_suggestion'; suggestion: GenerativeSuggestion }
    | { type: 'usage_update'; tokens: number }
    | { type: 'request_confirmation'; summary: string }
    | { type: 'error'; message: string };

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

export const parseStreamingResponse = (content: string): { thinking: string | null; response: string } => {
    const response = content.replace(/<dusunce>[\s\S]*?<\/dusunce>/g, '').trim();
    return { thinking: null, response };
};

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        sections: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    subSections: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                content: { type: Type.STRING },
                                requirements: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.STRING },
                                            text: { type: Type.STRING },
                                        },
                                        required: ['id', 'text'],
                                    },
                                },
                            },
                            required: ['title'],
                        },
                    },
                },
                required: ['title'],
            },
        },
    },
    required: ['sections'],
};

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
        let totalTokens = 0;
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
            
            const result = await ai.models.generateContentStream({
                model,
                contents: geminiHistory,
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: tools }],
                },
            });

            let functionCalls: any[] = [];
            let accumulatedText = "";
            let yieldedThought = "";
            let yieldedResponse = "";
            let thoughtBlockClosed = false;
            let thoughtStepYielded = false;

            const thoughtStep: ExpertStep = {
                id: 'streaming_thought',
                name: 'Düşünce Akışı',
                status: 'in_progress',
                details: '',
            };


            for await (const chunk of result) {
                if (chunk.usageMetadata) totalTokens = chunk.usageMetadata.totalTokenCount;
                if (chunk.functionCalls) functionCalls.push(...chunk.functionCalls);
                if (!chunk.text) continue;

                accumulatedText += chunk.text;

                // Try to find the thought block
                const thoughtMatch = accumulatedText.match(/<dusunce>([\s\S]*)/);
                
                if (thoughtMatch) {
                    if (!thoughtStepYielded) {
                        yield { type: 'expert_run_update', checklist: [thoughtStep], isComplete: false };
                        thoughtStepYielded = true;
                    }
                    
                    let currentThoughtContent = thoughtMatch[1];
                    const endTagIndex = currentThoughtContent.indexOf('</dusunce>');

                    if (endTagIndex !== -1) {
                        currentThoughtContent = currentThoughtContent.substring(0, endTagIndex);
                        thoughtBlockClosed = true;
                    }

                    // Yield any new thought text
                    if (currentThoughtContent.length > yieldedThought.length) {
                        thoughtStep.details = currentThoughtContent;
                        yield { type: 'expert_run_update', checklist: [thoughtStep], isComplete: false };
                        yieldedThought = currentThoughtContent;
                    }
                }

                // Process the response part (outside or after the thought block)
                let responsePart = accumulatedText;
                if (thoughtMatch) {
                    if (thoughtBlockClosed) {
                        const endOfBlock = accumulatedText.indexOf('</dusunce>') + '</dusunce>'.length;
                        responsePart = accumulatedText.substring(endOfBlock);
                    } else {
                        // If thought block is not closed, there's no response yet
                        responsePart = "";
                    }
                }
                
                // Yield any new response text
                if (responsePart.length > yieldedResponse.length) {
                    const newResponseText = responsePart.substring(yieldedResponse.length);
                    yield { type: 'chat_stream_chunk', chunk: newResponseText };
                    yieldedResponse = responsePart;
                }
            }


            if (functionCalls.length > 0) {
                 if (yieldedResponse.trim()) { // Clear the streamed text if a tool is being called
                    yield { type: 'chat_response', content: '' };
                 }

                for (const fc of functionCalls) {
                    const functionName = fc.name;
                    let step: ExpertStep | null = null;
                    
                    try {
                        // Announce the action
                        switch (functionName) {
                            case 'generateAnalysisDocument':
                                step = { id: 'analysis', name: 'İş Analizi Dokümanı Oluşturuluyor', status: 'in_progress' };
                                break;
                            case 'generateTestScenarios':
                                step = { id: 'test', name: 'Test Senaryoları Oluşturuluyor', status: 'in_progress' };
                                break;
                            case 'generateTraceabilityMatrix':
                                step = { id: 'traceability', name: 'İzlenebilirlik Matrisi Oluşturuluyor', status: 'in_progress' };
                                break;
                            case 'generateVisualization':
                                step = { id: 'viz', name: 'Süreç Akışı Görselleştiriliyor', status: 'in_progress' };
                                break;
                        }
                        if (step) {
                            yield { type: 'expert_run_update', checklist: [step], isComplete: false };
                        }

                        // Execute the action
                        if (functionName === 'generateAnalysisDocument') {
                            const docStream = this.generateAnalysisDocument(generatedDocs.requestDoc, history, templates.analysis, model);
                            for await (const docChunk of docStream) {
                                yield docChunk; // Re-yield chunks from the sub-generator
                            }
                        } else if (functionName === 'saveRequestDocument') {
                            const args = fc.args as { request_summary: string };
                            if (args.request_summary) {
                                yield { type: 'doc_stream_chunk', docKey: 'requestDoc', chunk: args.request_summary };
                            }
                        } else if (functionName === 'generateTestScenarios') {
                            const docStream = this.generateTestScenarios(generatedDocs.analysisDoc, templates.test, model);
                            for await (const docChunk of docStream) yield docChunk;
                        } else if (functionName === 'generateTraceabilityMatrix') {
                            const testContent = typeof generatedDocs.testScenarios === 'object' ? generatedDocs.testScenarios.content : generatedDocs.testScenarios;
                            const docStream = this.generateTraceabilityMatrix(generatedDocs.analysisDoc, testContent, templates.traceability, model);
                            for await (const docChunk of docStream) yield docChunk;
                        } else if (functionName === 'generateVisualization') {
                            const { code, tokens: vizTokens } = await this.generateDiagram(generatedDocs.analysisDoc, 'mermaid', templates.visualization, model);
                            yield { type: 'usage_update', tokens: vizTokens };
                            yield { type: 'visualization_update', content: code };
                        }

                        // Announce completion
                        if (step) {
                            step.status = 'completed';
                            yield { type: 'expert_run_update', checklist: [step], isComplete: true };
                            yield { type: 'chat_stream_chunk', chunk: `İşlem tamamlandı: ${step.name}. Çalışma alanından inceleyebilirsiniz.` };
                        } else if (functionName === 'saveRequestDocument'){
                             yield { type: 'chat_stream_chunk', chunk: "Anladım. Talebinizi bir 'Talep Dokümanı' olarak özetleyip kaydettim. Çalışma alanındaki 'Talep' sekmesinden inceleyebilirsiniz."};
                        }

                    } catch (e: any) {
                        if (step) {
                            step.status = 'error';
                            step.details = e.message;
                            yield { type: 'expert_run_update', checklist: [step], isComplete: true };
                        }
                        yield { type: 'error', message: e.message };
                        yield { type: 'chat_stream_chunk', chunk: `\`${functionName}\` aracını çalıştırırken bir hata oluştu: ${e.message}` };
                    }
                }
            } else {
                 if (thoughtStepYielded) {
                    thoughtStep.status = 'completed';
                    yield { type: 'expert_run_update', checklist: [thoughtStep], isComplete: true };
                }
            }
            if (totalTokens > 0) yield { type: 'usage_update', tokens: totalTokens };
        } catch (error) {
            yield { type: 'error', message: error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu" };
        }
    },
    
    runExpertAnalysisStream: async function* (userMessage: Message, generatedDocs: GeneratedDocs, templates: { analysis: string; test: string; traceability: string; visualization: string; }, diagramType: 'mermaid' | 'bpmn'): AsyncGenerator<StreamChunk> {
        let totalTokens = 0;
        
        const checklist: ExpertStep[] = [
            { id: 'request', name: 'Talep Dokümanı Oluşturma', status: 'pending' },
            { id: 'analysis', name: 'İş Analizi Dokümanı Oluşturma', status: 'pending' },
            { id: 'viz', name: 'Süreç Akışını Görselleştirme', status: 'pending' },
            { id: 'test', name: 'Test Senaryoları Oluşturma', status: 'pending' },
            { id: 'traceability', name: 'İzlenebilirlik Matrisi Oluşturma', status: 'pending' },
        ];
    
        const updateStatus = (id: ExpertStep['id'], status: ExpertStep['status'], details?: string) => {
            const index = checklist.findIndex(step => step.id === id);
            if (index !== -1) {
                checklist[index].status = status;
                if (details) checklist[index].details = details;
            }
            return checklist;
        };
    
        try {
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: false };
            
            // Step 1: Generate Request Document
            yield { type: 'expert_run_update', checklist: updateStatus('request', 'in_progress'), isComplete: false };
            let requestDocContent = '';
            try {
                const { jsonString, tokens } = await this.parseTextToRequestDocument(userMessage.content);
                totalTokens += tokens;
                requestDocContent = jsonString;
                yield { type: 'usage_update', tokens };
                yield { type: 'doc_stream_chunk', docKey: 'requestDoc', chunk: requestDocContent };
                yield { type: 'expert_run_update', checklist: updateStatus('request', 'completed'), isComplete: false };
            } catch (e: any) {
                // If structured parsing fails, fall back to using the raw user message as the request doc.
                requestDocContent = userMessage.content;
                yield { type: 'doc_stream_chunk', docKey: 'requestDoc', chunk: requestDocContent };
                yield { type: 'expert_run_update', checklist: updateStatus('request', 'error', 'Yapısal doküman oluşturulamadı, ham metin kullanılıyor.'), isComplete: false };
            }
    
            // Step 2: Generate Analysis Document
            yield { type: 'expert_run_update', checklist: updateStatus('analysis', 'in_progress'), isComplete: false };
            let analysisDocContent = '';
            try {
                const docStream = this.generateAnalysisDocument(requestDocContent, [userMessage], templates.analysis, 'gemini-2.5-pro');
                for await (const docChunk of docStream) {
                    if (docChunk.type === 'doc_stream_chunk') {
                        analysisDocContent = docChunk.chunk;
                    }
                    yield docChunk;
                }
                yield { type: 'expert_run_update', checklist: updateStatus('analysis', 'completed'), isComplete: false };
            } catch (e: any) {
                yield { type: 'expert_run_update', checklist: updateStatus('analysis', 'error', e.message), isComplete: false };
                throw new Error(`Analiz dokümanı oluşturulurken hata: ${e.message}`);
            }
    
            // Step 3: Generate Visualization
            yield { type: 'expert_run_update', checklist: updateStatus('viz', 'in_progress'), isComplete: false };
            try {
                const vizTemplateName = diagramType === 'bpmn' ? 'generateBPMN' : 'generateVisualization';
                const vizTemplate = promptService.getPrompt(vizTemplateName);
                const { code, tokens } = await this.generateDiagram(analysisDocContent, diagramType, vizTemplate, 'gemini-2.5-pro');
                totalTokens += tokens;
                yield { type: 'usage_update', tokens };
                yield { type: 'visualization_update', content: code };
                yield { type: 'expert_run_update', checklist: updateStatus('viz', 'completed'), isComplete: false };
            } catch (e: any) {
                yield { type: 'expert_run_update', checklist: updateStatus('viz', 'error', e.message), isComplete: false };
            }
    
            // Step 4: Generate Test Scenarios
            yield { type: 'expert_run_update', checklist: updateStatus('test', 'in_progress'), isComplete: false };
            let testScenariosContent = '';
            try {
                const stream = this.generateTestScenarios(analysisDocContent, templates.test, 'gemini-2.5-pro');
                for await (const chunk of stream) {
                    if (chunk.type === 'doc_stream_chunk') testScenariosContent += chunk.chunk;
                    else if (chunk.type === 'usage_update') totalTokens += chunk.tokens;
                }
                yield { type: 'usage_update', tokens: 0 }; // Tokens are counted inside the stream
                yield { type: 'doc_stream_chunk', docKey: 'testScenarios', chunk: { content: testScenariosContent, sourceHash: '' } }; // Send as object
                yield { type: 'expert_run_update', checklist: updateStatus('test', 'completed'), isComplete: false };
            } catch (e: any) {
                yield { type: 'expert_run_update', checklist: updateStatus('test', 'error', e.message), isComplete: false };
            }
    
            // Step 5: Generate Traceability Matrix
            if (testScenariosContent) {
                yield { type: 'expert_run_update', checklist: updateStatus('traceability', 'in_progress'), isComplete: false };
                let traceabilityContent = '';
                try {
                    const stream = this.generateTraceabilityMatrix(analysisDocContent, testScenariosContent, templates.traceability, 'gemini-2.5-pro');
                    for await (const chunk of stream) {
                        if (chunk.type === 'doc_stream_chunk') traceabilityContent += chunk.chunk;
                        else if (chunk.type === 'usage_update') totalTokens += chunk.tokens;
                    }
                    yield { type: 'usage_update', tokens: 0 };
                    yield { type: 'doc_stream_chunk', docKey: 'traceabilityMatrix', chunk: { content: traceabilityContent, sourceHash: '' } }; // Send as object
                    yield { type: 'expert_run_update', checklist: updateStatus('traceability', 'completed'), isComplete: false };
                } catch (e: any) {
                    yield { type: 'expert_run_update', checklist: updateStatus('traceability', 'error', e.message), isComplete: false };
                }
            } else {
                 yield { type: 'expert_run_update', checklist: updateStatus('traceability', 'error', "Test senaryoları oluşturulamadığı için atlandı."), isComplete: false };
            }
    
            const finalMessage = "Exper modu tamamlandı. Tüm dokümanlar sizin için oluşturuldu ve çalışma alanında güncellendi. İnceleyebilirsiniz.";
            yield { type: 'expert_run_update', checklist, isComplete: true, finalMessage };
    
        } catch (error: any) {
            yield { type: 'error', message: error.message };
            yield { type: 'expert_run_update', checklist, isComplete: true, finalMessage: `Exper modu bir hatayla karşılaştı: ${error.message}` };
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

    convertHtmlToAnalysisJson: async (htmlContent: string): Promise<{ json: StructuredAnalysisDoc, tokens: number }> => {
        const prompt = promptService.getPrompt('convertHtmlToAnalysisJson') + `\n\n**HTML İçeriği:**\n${htmlContent}`;
        const generationConfig = { responseMimeType: "application/json", responseSchema: analysisSchema };
        const { text: jsonString, tokens } = await generateContent(prompt, 'gemini-2.5-flash', generationConfig);
        try {
            return { json: JSON.parse(jsonString) as StructuredAnalysisDoc, tokens };
        } catch (e) {
            console.error("Failed to parse HTML to JSON:", e, "Received string:", jsonString);
            throw new Error("HTML içeriği yapısal dokümana dönüştürülemedi.");
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
        let totalTokens = 0;
    
        // 1. Generate a plan
        const planPrompt = `Bir iş analizi dokümanı oluşturmak için gereken adımları JSON formatında listele. Sadece bir JSON dizisi döndür, her öğe { "id": "benzersiz_id", "name": "Adım Adı" } formatında olsun. Adımlar şunları içermeli: Proje Özeti, Kapsam, Gereksinimler vb.`;
        const { text: planJson, tokens: planTokens } = await generateContent(planPrompt, 'gemini-2.5-flash-lite');
        totalTokens += planTokens;
        yield { type: 'usage_update', tokens: planTokens };
    
        let planSteps: ExpertStep[];
        try {
            planSteps = JSON.parse(planJson).map((step: any) => ({ ...step, status: 'pending' }));
        } catch {
            throw new Error("Doküman oluşturma planı yapılandırılamadı.");
        }
        
        yield { type: 'expert_run_update', checklist: [...planSteps], isComplete: false };
    
        // 2. Execute the plan
        const fullDoc: StructuredAnalysisDoc = { sections: [] };
    
        for (let i = 0; i < planSteps.length; i++) {
            planSteps[i].status = 'in_progress';
            yield { type: 'expert_run_update', checklist: [...planSteps], isComplete: false };
    
            const sectionPrompt = `Bir uzman iş analisti olarak, sana verilen Talep Dokümanı ve Konuşma Geçmişi'ni kullanarak, iş analizi dokümanının SADECE "${planSteps[i].name}" bölümünü JSON formatında oluştur. Çıktın, analysisSchema'daki bir 'section' nesnesi ile uyumlu olmalıdır. Sadece tek bir bölüm nesnesi döndür.
    
            **Talep Dokümanı:**
            ---
            ${requestDoc}
            ---
            **Konuşma Geçmişi:**
            ---
            ${JSON.stringify(history, null, 2)}
            ---`;
    
            const { text: sectionJson, tokens: sectionTokens } = await generateContent(sectionPrompt, model, {
                responseMimeType: "application/json"
            });
            totalTokens += sectionTokens;
            yield { type: 'usage_update', tokens: sectionTokens };
    
            try {
                const section = JSON.parse(sectionJson);
                fullDoc.sections.push(section);
            } catch (e) {
                console.error(`Error parsing section "${planSteps[i].name}":`, e);
                // Continue with a placeholder
                fullDoc.sections.push({ title: planSteps[i].name, content: "[Bu bölüm oluşturulurken bir hata oluştu.]" });
            }
    
            planSteps[i].status = 'completed';
            yield { type: 'expert_run_update', checklist: [...planSteps], isComplete: false };
        }
    
        // 3. Yield the final document
        yield { type: 'doc_stream_chunk', docKey: 'analysisDoc', chunk: JSON.stringify(fullDoc, null, 2) };
    },

    generateTestScenarios: async function* (analysisDoc: string, template: string, model: GeminiModel): AsyncGenerator<StreamChunk> {
        const prompt = template.replace('{analysis_document_content}', analysisDoc);
        const stream = generateContentStream(prompt, model, { responseMimeType: "application/json" });
        let totalTokens = 0;
        let fullText = '';
        for await (const chunk of stream) {
            if (chunk.usageMetadata) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
            }
            const text = chunk.text;
            if (text) {
                fullText += text;
                yield { type: 'doc_stream_chunk', docKey: 'testScenarios', chunk: text };
            }
        }
        if (totalTokens > 0) yield { type: 'usage_update', tokens: totalTokens };
    },

    generateTraceabilityMatrix: async function* (analysisDoc: string, testScenarios: string, template: string, model: GeminiModel): AsyncGenerator<StreamChunk> {
        const prompt = template
            .replace('{analysis_document_content}', analysisDoc)
            .replace('{test_scenarios_content}', testScenarios);
        const stream = generateContentStream(prompt, model, { responseMimeType: "application/json" });
        let totalTokens = 0;
        let fullText = '';
        for await (const chunk of stream) {
            if (chunk.usageMetadata) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
            }
            const text = chunk.text;
            if (text) {
                fullText += text;
                yield { type: 'doc_stream_chunk', docKey: 'traceabilityMatrix', chunk: text };
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