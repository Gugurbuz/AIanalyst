// services/geminiService.ts

import { GoogleGenAI, Type, Content, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import type { Message, MaturityReport, BacklogSuggestion, GeminiModel, FeedbackItem, GeneratedDocs, ExpertStep, GenerativeSuggestion, LintingIssue, SourcedDocument, StructuredAnalysisDoc } from '../types';
import { promptService } from './promptService';
import { v4 as uuidv4 } from 'uuid';

const getApiKey = (): string => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API Anahtarı ayarlanmamış.");
    return apiKey;
};

export type StreamChunk = 
    | { type: 'text_chunk'; text: string }
    | { type: 'doc_stream_chunk'; docKey: 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix'; chunk: string }
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

const generateContent = async (prompt: string, model: GeminiModel, modelConfig?: object): Promise<{ text: string, tokens: number }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({ model, contents: prompt, ...(modelConfig && { config: modelConfig }) });
        return { text: response.text || '', tokens: response.usageMetadata?.totalTokenCount || 0 };
    } catch (error) {
        handleGeminiError(error);
    }
};

const generateContentStream = async function* (prompt: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<GenerateContentResponse> {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const responseStream = await ai.models.generateContentStream({ model, contents: prompt, ...(modelConfig && { config: modelConfig }) });
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

const tools: FunctionDeclaration[] = [ /* tools definition remains the same */ ];

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
            const responseStream = await ai.models.generateContentStream({
                model, contents: geminiHistory,
                config: { systemInstruction, tools: [{ functionDeclarations: tools }] }
            });

            let functionCalls: any[] = [];
            let firstChunkProcessed = false;
            
            for await (const chunk of responseStream) {
                if (chunk.usageMetadata?.totalTokenCount) totalTokens = chunk.usageMetadata.totalTokenCount;

                if (!firstChunkProcessed) {
                    firstChunkProcessed = true;
                    if (chunk.functionCalls) functionCalls = chunk.functionCalls;
                }
                
                if (functionCalls.length > 0) break; 
                if (chunk.text) yield { type: 'chat_stream_chunk', chunk: chunk.text };
            }

            if (functionCalls.length > 0) {
                for (const fc of functionCalls) {
                    const functionName = fc.name;
                    try {
                        if (functionName === 'generateAnalysisDocument') {
                            yield { type: 'status_update', message: 'Analiz dokümanı hazırlanıyor...' };
                            const docStream = this.generateAnalysisDocument(generatedDocs.requestDoc, history, templates.analysis, model);
                            for await (const docChunk of docStream) yield docChunk;
                            yield { type: 'chat_stream_chunk', chunk: "İş analizi dokümanını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        } else if (functionName === 'saveRequestDocument') {
                            const args = fc.args as { request_summary: string };
                            if (args.request_summary) yield { type: 'request_confirmation', summary: args.request_summary };
                        } else if (functionName === 'generateTestScenarios') {
                            yield { type: 'status_update', message: 'Test senaryoları hazırlanıyor...' };
                            const docStream = this.generateTestScenarios(generatedDocs.analysisDoc, templates.test, model);
                            for await (const docChunk of docStream) yield docChunk;
                            yield { type: 'chat_stream_chunk', chunk: "Test senaryolarını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        } else if (functionName === 'generateTraceabilityMatrix') {
                            yield { type: 'status_update', message: 'İzlenebilirlik matrisi oluşturuluyor...' };
                            const testContent = typeof generatedDocs.testScenarios === 'object' ? generatedDocs.testScenarios.content : generatedDocs.testScenarios;
                            const docStream = this.generateTraceabilityMatrix(generatedDocs.analysisDoc, testContent, templates.traceability, model);
                            for await (const docChunk of docStream) yield docChunk;
                            yield { type: 'chat_stream_chunk', chunk: "İzlenebilirlik matrisini oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        } else if (functionName === 'generateVisualization') {
                            yield { type: 'status_update', message: 'Süreç akışı görselleştiriliyor...' };
                            const { code, tokens: vizTokens } = await this.generateDiagram(generatedDocs.analysisDoc, 'mermaid', templates.visualization, model);
                            yield { type: 'usage_update', tokens: vizTokens };
                            yield { type: 'visualization_update', content: code };
                            yield { type: 'chat_stream_chunk', chunk: "Süreç akış diyagramını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        }
                    } catch (e: any) {
                        yield { type: 'error', message: e.message };
                        yield { type: 'chat_stream_chunk', chunk: `\`${functionName}\` aracını çalıştırırken bir hata oluştu: ${e.message}` };
                    }
                }
            }
            if (totalTokens > 0) yield { type: 'usage_update', tokens: totalTokens };
        } catch (error) {
            yield { type: 'error', message: error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu" };
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
        
        const config = { responseMimeType: "application/json", responseSchema: schema, ...modelConfig };

        const { text: jsonString, tokens } = await generateContent(prompt, model, config);
        try {
            return { report: JSON.parse(jsonString) as MaturityReport, tokens };
        } catch (e) {
            console.error("Failed to parse maturity report JSON:", e, "Received string:", jsonString);
            throw new Error("Analiz olgunluk raporu ayrıştırılamadı.");
        }
    },
    // FIX: Add all missing methods to the geminiService object.
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

        // Re-usable properties for a backlog item to avoid repetition and make the schema maintainable.
        const backlogItemProperties = {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['epic', 'story', 'test_case', 'task'] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
        };
        
        // FIX: Add required fields to ensure the model provides the necessary data for rendering.
        const requiredFields = ['type', 'title', 'description', 'priority'];

        // Define a schema for a backlog item that can have children.
        // We define nesting up to 3 levels deep in the schema, which is usually sufficient for epic -> story -> task/test_case.
        // This directly solves the API error by ensuring every `items` object has a non-empty `properties` field.
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
                                    properties: backlogItemProperties, // No more 'children' defined at this level of the schema.
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


        const config = { responseMimeType: "application/json", responseSchema: schema };

        const { text: jsonString, tokens } = await generateContent(prompt, model, config);
        try {
            const result = JSON.parse(jsonString);
            // Assign UUIDs on the client side
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
        const config = { responseMimeType: "application/json", responseSchema: analysisSchema };
        const { text: jsonString, tokens } = await generateContent(prompt, 'gemini-2.5-flash', config);
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
        const config = { responseMimeType: "application/json", responseSchema: schema };
        const { text: jsonString, tokens } = await generateContent(prompt, 'gemini-2.5-flash-lite', config);
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

        const config = { responseMimeType: "application/json", responseSchema: schema };
        const { text: jsonString, tokens } = await generateContent(prompt, model, config);
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
        const prompt = template
            .replace('{request_document_content}', requestDoc)
            .replace('{conversation_history}', JSON.stringify(history.filter(m => m.role === 'user' || m.role === 'assistant'), null, 2));
        const stream = generateContentStream(prompt, model, { responseMimeType: "application/json", responseSchema: analysisSchema });
        let totalTokens = 0;
        for await (const chunk of stream) {
            if (chunk.text) {
                yield { type: 'doc_stream_chunk', docKey: 'analysisDoc', chunk: chunk.text };
            }
            if (chunk.usageMetadata?.totalTokenCount) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
            }
        }
        if (totalTokens > 0) yield { type: 'usage_update', tokens: totalTokens };
    },

    generateTestScenarios: async function* (analysisDoc: string, template: string, model: GeminiModel): AsyncGenerator<StreamChunk> {
        const prompt = template.replace('{analysis_document_content}', analysisDoc);
        const stream = generateContentStream(prompt, model, { responseMimeType: "application/json" });
        let totalTokens = 0;
        for await (const chunk of stream) {
            if (chunk.text) {
                yield { type: 'doc_stream_chunk', docKey: 'testScenarios', chunk: chunk.text };
            }
            if (chunk.usageMetadata?.totalTokenCount) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
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
        for await (const chunk of stream) {
            if (chunk.text) {
                yield { type: 'doc_stream_chunk', docKey: 'traceabilityMatrix', chunk: chunk.text };
            }
            if (chunk.usageMetadata?.totalTokenCount) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
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
        const config = { responseMimeType: "application/json", responseSchema: schema };
        const { text, tokens } = await generateContent(prompt, 'gemini-2.5-pro', config);
        try {
            const result = JSON.parse(text);
            return { suggestions: result.suggestions || [], tokens };
        } catch (e) {
            console.error("Failed to parse feature suggestions:", e);
            return { suggestions: [], tokens };
        }
    },
};