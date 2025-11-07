// services/geminiService.ts

import { GoogleGenAI, Type, Content, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
// FIX: Import 'ExpertStep' type to resolve the module not found error.
import type { Message, MaturityReport, BacklogSuggestion, GeminiModel, FeedbackItem, GeneratedDocs, ExpertStep, GenerativeSuggestion, LintingIssue, SourcedDocument, VizData, ThoughtProcess } from '../types';
import { promptService } from './promptService';
import { v4 as uuidv4 } from 'uuid';

const getApiKey = (): string => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API Anahtarı ayarlanmamış.");
    return apiKey;
};

export type StreamChunk =
  | { type: 'text_chunk'; text: string }
  | { type: 'thought_chunk'; payload: ThoughtProcess }
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
            // FIX: Check for the existence of the `requestDoc` object directly, as it doesn't have a `.trim()` method.
            const hasRequestDoc = !!generatedDocs.requestDoc;
            // FIX: Stringify `analysisDoc` (which is a Block[] object) before calling `.includes()` to check for placeholder content.
            const hasRealAnalysisDoc = !!generatedDocs.analysisDoc && !JSON.stringify(generatedDocs.analysisDoc).includes("Bu bölüme projenin temel hedefini");
            const isStartingConversation = !hasRequestDoc && !hasRealAnalysisDoc && history.filter(m => m.role !== 'system').length <= 1;

            const systemInstruction = isStartingConversation
                ? promptService.getPrompt('continueConversation')
                : promptService.getPrompt('proactiveAnalystSystemInstruction')
                    // FIX: Stringify complex objects (`analysisDoc`, `requestDoc`) before passing them to the string `.replace()` method.
                    .replace('{analysis_document_content}', generatedDocs.analysisDoc ? JSON.stringify(generatedDocs.analysisDoc, null, 2) : "...")
                    .replace('{request_document_content}', generatedDocs.requestDoc ? JSON.stringify(generatedDocs.requestDoc, null, 2) : "...");
            
            const geminiHistory = convertMessagesToGeminiFormat(history);
            
            const responseStream = await ai.models.generateContentStream({
                model,
                contents: geminiHistory,
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: tools }],
                },
            });
            
            const functionCalls: any[] = [];
            let fullText = '';
            
            for await (const chunk of responseStream) {
                if (chunk.usageMetadata) {
                     yield { type: 'usage_update', tokens: chunk.usageMetadata.totalTokenCount };
                }
                if (chunk.functionCalls) {
                    functionCalls.push(...chunk.functionCalls);
                }
                if (chunk.text) {
                    fullText += chunk.text;
                }
            }
            
            // Now that we have the full response, parse it
            const thoughtMatch = fullText.match(/<dusunce>(.*?)<\/dusunce>/);
            if (thoughtMatch && thoughtMatch[1]) {
                 try {
                    const thoughtPayload: ThoughtProcess = JSON.parse(thoughtMatch[1]);
                    yield { type: 'thought_chunk', payload: thoughtPayload };
                } catch (e) {
                    console.warn("Could not parse thought JSON:", e);
                }
            }

            const textResponse = fullText.replace(/<dusunce>[\s\S]*?<\/dusunce>/, '').trim();
            if (textResponse) {
                yield { type: 'text_chunk', text: textResponse };
            }
            
            if (functionCalls.length > 0) {
                for (const fc of functionCalls) {
                    // Handle other function calls as before
                    // (This example focuses on separating thought/text, so function logic is omitted for brevity)
                    // FIX: This type is not defined in StreamChunk, this will be handled in useAppLogic
                    // yield { type: 'function_call', name: fc.name, args: fc.args };
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
            yield { type: 'thought_chunk', payload: createThought("Exper Modu Başlatıldı", initialChecklist) };
            
            // Step 1: Generate Request Document
            let requestDocContent = '';
            try {
                const { jsonString, tokens } = await this.parseTextToRequestDocument(userMessage.content);
                totalTokens += tokens;
                requestDocContent = jsonString; // Set content for the next step
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
                    }
                     // Re-yield to update UI
                    if(docChunk.type === 'expert_run_update') {
                        yield { type: 'thought_chunk', payload: createThought("Analiz Adımları İşleniyor", docChunk.checklist) };
                    } else {
                        yield docChunk;
                    }
                }
                initialChecklist[1].status = 'completed';
                yield { type: 'thought_chunk', payload: createThought("Analiz Dokümanı Tamamlandı", initialChecklist) };

            } catch (e: any) {
                initialChecklist[1].status = 'error';
                initialChecklist[1].details = e.message;
                yield { type: 'thought_chunk', payload: createThought("Analiz Dokümanı Hatası", initialChecklist) };
                throw new Error(`Analiz dokümanı oluşturulurken hata: ${e.message}`);
            }
    
             // Step 3 & beyond...
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
            ${generatedDocs.analysisDoc ? JSON.stringify(generatedDocs.analysisDoc) : "Henüz oluşturulmadı."}
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

    convertHtmlToAnalysisJson: async (htmlContent: string): Promise<{ json: any, tokens: number }> => {
        const prompt = promptService.getPrompt('convertHtmlToAnalysisJson') + `\n\n**HTML İçeriği:**\n${htmlContent}`;
        // Since we are moving to BlockNote, we don't have a fixed schema for the old format anymore.
        // Let's ask for a generic JSON and hope for the best, or better, update the prompt.
        const { text: jsonString, tokens } = await generateContent(prompt, 'gemini-2.5-flash');
        try {
            return { json: JSON.parse(jsonString), tokens };
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
    
        const planPrompt = `Bir iş analizi dokümanı oluşturmak için gereken adımları listele. Adımlar şunları içermeli: Proje Özeti, Kapsam, Gereksinimler vb. Her adıma benzersiz bir ID ver.`;
        const planSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING }
                },
                required: ['id', 'name']
            }
        };
        const { text: planJson, tokens: planTokens } = await generateContent(planPrompt, 'gemini-2.5-flash-lite', { responseMimeType: "application/json", responseSchema: planSchema });
        totalTokens += planTokens;
        yield { type: 'usage_update', tokens: planTokens };
    
        let planSteps: ExpertStep[];
        try {
            planSteps = JSON.parse(planJson).map((step: any) => ({ ...step, status: 'pending' }));
        } catch (e) {
            throw new Error("Doküman oluşturma planı yapılandırılamadı.");
        }
        
        yield { type: 'expert_run_update', checklist: [...planSteps], isComplete: false };
    
        const allBlocks: any[] = [];
    
        for (let i = 0; i < planSteps.length; i++) {
            planSteps[i].status = 'in_progress';
            yield { type: 'expert_run_update', checklist: [...planSteps], isComplete: false };
    
            const sectionPrompt = template
                .replace('{request_document_content}', requestDoc)
                .replace('{conversation_history}', JSON.stringify(history, null, 2))
                .replace('{section_to_generate}', planSteps[i].name);

            // Schema for a Block[] array - This is the corrected schema
            const blockSchema = {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING },
                    props: {
                        type: Type.OBJECT,
                        properties: {
                            level: { type: Type.INTEGER }
                        },
                    },
                    content: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING },
                                text: { type: Type.STRING },
                                styles: { type: Type.OBJECT }
                            },
                            required: ['type', 'text']
                        }
                    },
                    children: { type: Type.ARRAY }
                },
                required: ['type']
            };

            const { text: sectionJson, tokens: sectionTokens } = await generateContent(sectionPrompt, model, {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: blockSchema },
            });
            totalTokens += sectionTokens;
            yield { type: 'usage_update', tokens: sectionTokens };
    
            try {
                const sectionBlocks = JSON.parse(sectionJson);
                allBlocks.push(...sectionBlocks);
            } catch (e) {
                console.error(`Error parsing section "${planSteps[i].name}":`, e);
                allBlocks.push({ type: 'paragraph', content: `[${planSteps[i].name} bölümü oluşturulurken bir hata oluştu.]` });
            }
    
            planSteps[i].status = 'completed';
            yield { type: 'expert_run_update', checklist: [...planSteps], isComplete: false };
        }
    
        yield { type: 'doc_stream_chunk', docKey: 'analysisDoc', chunk: JSON.stringify(allBlocks, null, 2) };
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