// services/geminiService.ts

import { GoogleGenAI, Type, Content, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import type { Message, MaturityReport, BacklogSuggestion, GeminiModel, FeedbackItem, GeneratedDocs, ExpertStep, GenerativeSuggestion, LintingIssue, SourcedDocument } from '../types';
// GÜNCELLEME: 'promptService' artık '.ts' olmadan import ediliyor.
// Projenizdeki diğer import'larla tutarlı olması için
import { promptService } from './promptService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gets the effective API key from environment variables.
 * @returns The API key.
 * @throws An error if no aPI key is found.
 */
const getApiKey = (): string => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API Anahtarı ayarlanmamış. Lütfen `.env` dosyanıza `API_KEY` veya `GEMINI_API_KEY` ekleyin.");
    }
    return apiKey;
};

/**
 * A type for the structured data yielded by the streaming service.
 */
export type StreamChunk = 
    | { type: 'text_chunk'; text: string }
    | { type: 'doc_stream_chunk'; docKey: 'analysisDoc' | 'testScenarios' | 'traceabilityMatrix'; chunk: string; updatedReport?: MaturityReport | null }
    | { type: 'visualization_update'; content: string; }
    | { type: 'chat_response'; content: string }
    | { type: 'chat_stream_chunk'; chunk: string }
    | { type: 'status_update'; message: string }
    | { type: 'maturity_update'; report: MaturityReport }
    | { type: 'expert_run_update'; checklist: ExpertStep[]; isComplete: boolean; finalMessage?: string; }
    | { type: 'generative_suggestion'; suggestion: GenerativeSuggestion }
    | { type: 'usage_update'; tokens: number }
    | { type: 'error'; message: string };


/**
 * Represents the structured output of the document change analysis.
 */
export interface DocumentImpactAnalysis {
    changeType: 'minor' | 'major';
    summary: string;
    isVisualizationImpacted: boolean;
    isTestScenariosImpacted: boolean;
    isTraceabilityImpacted: boolean;
    isBacklogImpacted: boolean;
}


/**
 * Parses Gemini API errors and throws a user-friendly error message.
 * @param error The original error caught from the API call.
 */
function handleGeminiError(error: any): never {
    console.error("Gemini API Hatası:", error);
    const errorMessage = error?.message || String(error);

    // 1. Check for the most specific error: Quota/Rate limit
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        throw new Error("API Kota Limiti Aşıldı: Mevcut kotanızı aştınız. Lütfen planınızı ve fatura detaylarınızı kontrol edin veya bir süre sonra tekrar deneyin. Daha fazla bilgi için: https://ai.google.dev/gemini-api/docs/rate-limits");
    }

    // 2. Check for other specific known errors
    if (errorMessage.includes('API key not valid')) {
        throw new Error("Geçersiz API Anahtarı. Lütfen Geliştirici Panelindeki ayarları kontrol edin veya ortam değişkenlerini yapılandırın.");
    }
    
    // 3. Generic fallback
    throw new Error(`Gemini API ile iletişim kurulamadı: ${errorMessage}`);
}


const generateContent = async (prompt: string, model: GeminiModel, modelConfig?: object): Promise<{ text: string, tokens: number }> => {
    try {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            ...(modelConfig && { config: modelConfig }),
        });
        
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const text = response.text || '';
        
        return { text, tokens };
    } catch (error) {
        handleGeminiError(error);
    }
};

const generateContentStream = async function* (prompt: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<GenerateContentResponse> {
    try {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const responseStream = await ai.models.generateContentStream({
            model: model,
            contents: prompt,
            ...(modelConfig && { config: modelConfig }),
        });

        for await (const chunk of responseStream) {
            yield chunk;
        }
    } catch (error) {
        handleGeminiError(error);
    }
};


const formatHistory = (history: Message[]): string => {
    return history.map(m => `${m.role === 'user' ? 'Kullanıcı' : m.role === 'assistant' ? 'Asistan' : 'Sistem'}: ${m.content}`).join('\n');
}

const convertMessagesToGeminiFormat = (history: Message[]): Content[] => {
    // Filter for relevant roles AND ensure content exists and is not just whitespace.
    const relevantMessages = history.filter(msg => 
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string' && 
        msg.content.trim() !== ''
    );

    if (relevantMessages.length === 0) {
        return [];
    }
    
    // The merging logic remains the same, but now it operates on clean data.
    const processedMessages: Message[] = [];
    let currentMessage = { ...relevantMessages[0] }; 

    for (let i = 1; i < relevantMessages.length; i++) {
        const message = relevantMessages[i];
        if (message.role === currentMessage.role) {
            currentMessage.content += "\n\n" + message.content;
        } else {
            processedMessages.push(currentMessage);
            currentMessage = { ...message };
        }
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
        description: 'Mevcut konuşma geçmişine dayanarak iş analizi dokümanını oluşturur veya günceller.',
        parameters: { 
            type: Type.OBJECT, 
            properties: {
                force: {
                    type: Type.BOOLEAN,
                    description: "Eğer `true` olarak ayarlanırsa, analiz olgunluk kontrolünü atlar ve kullanıcı ısrar ettiğinde doküman oluşturmayı zorlar."
                },
                incrementalUpdate: {
                    type: Type.BOOLEAN,
                    description: "Eğer `true` olarak ayarlanırsa, bu bir artımlı güncellemedir ve olgunluk kontrolü atlanmalıdır. Yalnızca proaktif AI akışının bir parçası olarak kullanılmalıdır."
                }
            } 
        }
    },
    {
        name: 'generateTestScenarios',
        description: 'Mevcut iş analizi dokümanına dayanarak test senaryoları oluşturur veya günceller.',
        parameters: { type: Type.OBJECT, properties: {} } // No parameters needed
    },
    {
        name: 'generateVisualization',
        description: 'Mevcut iş analizi dokümanına dayanarak süreç akışını açıklayan bir metin oluşturur veya günceller.',
        parameters: { type: Type.OBJECT, properties: {} } // No parameters needed
    },
    {
        name: 'generateTraceabilityMatrix',
        description: 'Mevcut iş analizi ve test senaryolarına dayanarak izlenebilirlik matrisi oluşturur.',
        parameters: { type: Type.OBJECT, properties: {} }
    },
    {
        name: 'performGenerativeTask',
        description: "Kullanıcı, dokümanın bir bölümünü 'genişlet', 'iyileştir', 'detaylandır' gibi bir komutla değiştirmek istediğinde bu aracı kullan. Bu araç, AI'nın proaktif olarak öneriler sunmasını sağlar.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                task_description: {
                    type: Type.STRING,
                    description: "Kullanıcının orijinal komutu. Örn: 'hedefleri genişlet', 'kapsam dışı maddeleri netleştir'."
                },
                target_section: {
                    type: Type.STRING,
                    description: "Dokümanda hedeflenen bölümün başlığı. Örn: 'Amaç', 'Kapsam Dışındaki Maddeler', 'Fonksiyonel Gereksinimler'."
                }
            },
            required: ['task_description', 'target_section']
        }
    }
];

// --- GÜNCELLENMİŞ FONKSİYON ---
// Bu fonksiyon artık BİRDEN FAZLA <dusunce> etiketini bulup
// birleştirecek şekilde güncellendi.
const parseStreamingResponse = (content: string): { thinking: string | null; response: string } => {
    const thinkingTagRegex = /<dusunce>([\s\S]*?)<\/dusunce>/g;
    const thoughts: string[] = [];
    let match;
    let lastIndex = 0;

    // 1. Regex kullanarak TÜM düşünce etiketlerini bul
    while ((match = thinkingTagRegex.exec(content)) !== null) {
        thoughts.push(match[1].trim());
        // Son etiketin bittiği indeksi kaydet
        lastIndex = match.index + match[0].length;
    }

    // 2. Hiç düşünce etiketi bulunamadı
    if (thoughts.length === 0) {
        // Stream hala devam ediyor olabilir, yarım etiketi kontrol et
        // Örn: "<dusunce>Kullanıcı..."
        const partialMatch = content.match(/<dusunce>([\s\S]*)/);
        if (partialMatch) {
            // Sadece düşünce var, henüz cevap yok
            return { thinking: partialMatch[1].trim(), response: '' };
        }
        // Düşünce etiketi yoksa, tüm içerik yanıttır
        return { thinking: null, response: content.trim() };
    }

    // 3. Bulunan tüm düşünceleri birleştir (UI'da alt alta göstermek için)
    const combinedThoughts = thoughts.join('\n');

    // 4. Yanıt, son düşünce etiketinden sonraki tüm içeriktir
    const response = content.substring(lastIndex).trim();

    return { thinking: combinedThoughts, response };
};

export const geminiService = {
    processAnalystMessageStream: async function* (history: Message[], generatedDocs: GeneratedDocs, templates: { analysis: string; test: string; traceability: string; visualization: string; }, model: GeminiModel): AsyncGenerator<StreamChunk> {
        let responseGenerated = false;
        try {
            const apiKey = getApiKey();
            const ai = new GoogleGenAI({ apiKey });

            const analysisDocContent = generatedDocs.analysisDoc || "Henüz bir doküman oluşturulmadı.";
            
            // Check if a real analysis document exists to decide which system prompt to use.
            const hasRealAnalysisDoc = !!generatedDocs.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");
            
            // promptService'den GÜNCELLENMİŞ prompt'ları alıyoruz
            const systemInstruction = !hasRealAnalysisDoc
                ? promptService.getPrompt('continueConversation')
                : promptService.getPrompt('proactiveAnalystSystemInstruction').replace('{analysis_document_content}', analysisDocContent);
            
            const geminiHistory = convertMessagesToGeminiFormat(history);

            const responseStream = await ai.models.generateContentStream({
                model: model,
                contents: geminiHistory,
                config: {
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: tools }]
                }
            });

            let firstChunk = true;
            let hasFunctionCall = false;
            let totalTokens = 0;

            for await (const chunk of responseStream) {
                if (chunk.usageMetadata?.totalTokenCount) {
                    totalTokens = chunk.usageMetadata.totalTokenCount;
                }

                if (firstChunk) {
                    firstChunk = false;
                    const functionCalls = chunk.functionCalls;

                    if (functionCalls && functionCalls.length > 0) {
                        hasFunctionCall = true;
                        for (const fc of functionCalls) {
                            const functionName = fc.name;
                            if (functionName === 'performGenerativeTask') {
                                const args = fc.args as { task_description: string, target_section: string };
                                yield { type: 'status_update', message: `"${args.target_section}" bölümü için öneriler hazırlanıyor...` };
                                
                                const suggestionPrompt = promptService.getPrompt('generateSectionSuggestions')
                                    .replace('{task_description}', args.task_description)
                                    .replace('{target_section_name}', args.target_section)
                                    .replace('{analysis_document}', analysisDocContent);
                                
                                const schema = {
                                    type: Type.OBJECT,
                                    properties: { new_content_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } } },
                                    required: ['new_content_suggestions']
                                };
                                const config = { responseMimeType: "application/json", responseSchema: schema };

                                const { text: jsonString, tokens } = await generateContent(suggestionPrompt, 'gemini-2.5-pro', config);
                                yield { type: 'usage_update', tokens };
                                const result = JSON.parse(jsonString);

                                const suggestionPayload: GenerativeSuggestion = {
                                    title: `"${args.target_section}" Bölümünü Geliştirmek İçin Önerilerim`,
                                    suggestions: result.new_content_suggestions,
                                    targetSection: args.target_section,
                                    context: args.task_description
                                };
                                
                                yield { type: 'generative_suggestion', suggestion: suggestionPayload };
                                responseGenerated = true;

                            } else if (functionName === 'generateAnalysisDocument') {
                                responseGenerated = true;
                                for await (const docChunk of geminiService.generateAnalysisDocument(history, templates.analysis, model)) {
                                    yield docChunk;
                                }
                                yield { type: 'chat_stream_chunk', chunk: "İş analizi dokümanını oluşturdum. Çalışma alanından inceleyebilirsiniz." };

                            } else if (functionName === 'generateTestScenarios') {
                                responseGenerated = true;
                                yield { type: 'status_update', message: 'Test senaryoları hazırlanıyor...' };
                                for await (const docChunk of geminiService.generateTestScenarios(generatedDocs.analysisDoc, templates.test, model)) {
                                   yield docChunk;
                                }
                                yield { type: 'chat_stream_chunk', chunk: "Test senaryolarını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                            } else if (functionName === 'generateTraceabilityMatrix') {
                                responseGenerated = true;
                                yield { type: 'status_update', message: 'İzlenebilirlik matrisi oluşturuluyor...' };
                                const testScenariosContent = typeof generatedDocs.testScenarios === 'object' ? generatedDocs.testScenarios.content : generatedDocs.testScenarios;
                                for await (const docChunk of geminiService.generateTraceabilityMatrix(generatedDocs.analysisDoc, testScenariosContent, templates.traceability, model)) {
                                   yield docChunk;
                                }
                                yield { type: 'chat_stream_chunk', chunk: "İzlenebilirlik matrisini oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                            } else if (functionName === 'generateVisualization') {
                                responseGenerated = true;
                                yield { type: 'status_update', message: 'Süreç akışı görselleştiriliyor...' };
                                const { code: vizCode, tokens } = await geminiService.generateDiagram(generatedDocs.analysisDoc, 'mermaid', templates.visualization, model);
                                yield { type: 'usage_update', tokens };
                                yield { type: 'visualization_update', content: vizCode };
                                yield { type: 'chat_stream_chunk', chunk: "Süreç akış diyagramını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                            }
                        }
                    }
                }

                if (hasFunctionCall) {
                    if (totalTokens > 0) { yield { type: 'usage_update', tokens: totalTokens }; }
                    break;
                }

                if (chunk.text) {
                    yield { type: 'chat_stream_chunk', chunk: chunk.text };
                    responseGenerated = true;
                }
            }
            
            if (totalTokens > 0 && !hasFunctionCall) {
                yield { type: 'usage_update', tokens: totalTokens };
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
            yield { type: 'error', message: errorMessage };
            handleGeminiError(error);
        } finally {
            if (responseGenerated) {
                try {
                    const { report, tokens } = await geminiService.checkAnalysisMaturity(history, generatedDocs, 'gemini-2.5-flash-lite'); 
                    yield { type: 'usage_update', tokens };
                    yield { type: 'maturity_update', report };
                } catch (maturityError) {
                    console.warn("Arka plan olgunluk kontrolü başarısız oldu:", maturityError);
                }
            }
        }
    },
    
    clarifyAndConfirmExpertMode: async (history: Message[], model: GeminiModel): Promise<{ needsClarification: boolean; questions?: string; confirmationRequest?: string; checklist?: ExpertStep[], tokens: number }> => {
        // ... (logic remains the same, just need to handle token return)
        const schema = {
            type: Type.OBJECT,
            properties: {
                needsClarification: { type: Type.BOOLEAN },
                questions: { type: Type.STRING },
                isReadyForConfirmation: { type: Type.BOOLEAN }
            },
            required: ['needsClarification', 'questions', 'isReadyForConfirmation']
        };

        const prompt = promptService.getPrompt('expertModeClarificationCheck') + `\n\nSohbet Geçmişi:\n${formatHistory(history)}`;
        const config = { responseMimeType: "application/json", responseSchema: schema };

        const { text: jsonString, tokens } = await generateContent(prompt, model, config);
        const result = JSON.parse(jsonString);
        
        const checklist: ExpertStep[] = [
            { id: 'analysis', name: 'İş Analizi Dokümanı Oluşturma', status: 'pending' },
            { id: 'viz', name: 'Süreç Akışını Görselleştirme', status: 'pending' },
            { id: 'test', name: 'Test Senaryoları Oluşturma', status: 'pending' },
            { id: 'traceability', name: 'İzlenebilirlik Matrisi Oluşturma', status: 'pending' },
        ];
        
        if (result.needsClarification) {
            return { needsClarification: true, questions: result.questions, tokens };
        } else {
             return {
                needsClarification: false,
                confirmationRequest: "Analiz için yeterli bilgiye sahibim. Aşağıdaki adımları otomatik olarak gerçekleştireceğim. Onaylıyor musunuz?",
                checklist: checklist,
                tokens
            };
        }
    },

    executeExpertRun: async function* (history: Message[], templates: { analysis: string; test: string; traceability: string; visualization: string; }, model: GeminiModel): AsyncGenerator<StreamChunk> {
        let analysisDocContent = '';
        for await (const chunk of geminiService.generateAnalysisDocument(history, templates.analysis, model)) {
            if (chunk.type === 'doc_stream_chunk' && chunk.docKey === 'analysisDoc') {
                analysisDocContent += chunk.chunk;
            }
            yield chunk;
        }

        if (analysisDocContent) {
            const { code: vizCode, tokens: vizTokens } = await geminiService.generateDiagram(analysisDocContent, 'mermaid', templates.visualization, model);
            yield { type: 'usage_update', tokens: vizTokens };
            yield { type: 'visualization_update', content: vizCode };
            
            let testScenariosContent = '';
            for await (const chunk of geminiService.generateTestScenarios(analysisDocContent, templates.test, model)) {
                if (chunk.type === 'doc_stream_chunk' && chunk.docKey === 'testScenarios') {
                    testScenariosContent += chunk.chunk;
                }
                yield chunk;
            }

            if (testScenariosContent) {
                for await (const chunk of geminiService.generateTraceabilityMatrix(analysisDocContent, testScenariosContent, templates.traceability, model)) {
                    yield chunk;
                }
            }
        }
    },


    continueConversation: async (history: Message[], model: GeminiModel): Promise<{ text: string, tokens: number }> => {
        const systemInstruction = promptService.getPrompt('continueConversation');
        const geminiHistory = convertMessagesToGeminiFormat(history);
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model, contents: geminiHistory, config: { systemInstruction }
        });
        return {
            text: response.text,
            tokens: response.usageMetadata?.totalTokenCount || 0
        };
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

    generateAnalysisDocument: async function* (history: Message[], templatePrompt: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<StreamChunk> {
        const prompt = `${templatePrompt}\n\n**TALİMAT:**\nDokümanı yalnızca ve yalnızca aşağıda sağlanan konuşma geçmişine dayanarak oluştur.\n\n**Konuşma Geçmişi:**\n${formatHistory(history)}`;
        const stream = generateContentStream(prompt, model, modelConfig);
        let totalTokens = 0;
        for await (const chunk of stream) {
            if (chunk.text) {
                yield { type: 'doc_stream_chunk', docKey: 'analysisDoc', chunk: chunk.text };
            }
            if (chunk.usageMetadata?.totalTokenCount) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
            }
        }
        if (totalTokens > 0) {
            yield { type: 'usage_update', tokens: totalTokens };
        }
    },

    generateTestScenarios: async function* (analysisDocument: string, templatePrompt: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<StreamChunk> {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini")) {
            throw new Error("Lütfen önce geçerli bir analiz dokümanı oluşturun.");
        }
        const prompt = `${templatePrompt}\n\n**TALİMAT:**\nTest senaryolarını yalnızca aşağıda sağlanan İş Analizi Dokümanına dayanarak oluştur.\n\n**İş Analizi Dokümanı:**\n'${analysisDocument}'`;
        const stream = generateContentStream(prompt, model, modelConfig);
        let totalTokens = 0;
        for await (const chunk of stream) {
            if (chunk.text) {
                yield { type: 'doc_stream_chunk', docKey: 'testScenarios', chunk: chunk.text };
            }
            if (chunk.usageMetadata?.totalTokenCount) {
                totalTokens = chunk.usageMetadata.totalTokenCount;
            }
        }
        if (totalTokens > 0) {
            yield { type: 'usage_update', tokens: totalTokens };
        }
    },
    
    generateTraceabilityMatrix: async function* (analysisDocument: string, testScenarios: string, templatePrompt: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<StreamChunk> {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini") || !testScenarios) {
            throw new Error("Lütfen önce geçerli bir analiz dokümanı ve test senaryoları oluşturun.");
        }
        const prompt = `${templatePrompt}\n\n**İş Analizi Dokümanı:**\n'${analysisDocument}'\n\n**Test Senaryoları Dokümanı:**\n'${testScenarios}'`;
        const stream = generateContentStream(prompt, model, modelConfig);
        let totalTokens = 0;
        for await (const chunk of stream) {
            if (chunk.text) {
                yield { type: 'doc_stream_chunk', docKey: 'traceabilityMatrix', chunk: chunk.text };
            }
            if (chunk.usageMetadata?.totalTokenCount) {
               totalTokens = chunk.usageMetadata.totalTokenCount;
            }
        }
        if (totalTokens > 0) {
             yield { type: 'usage_update', tokens: totalTokens };
        }
    },

    generateConversationTitle: async (firstMessage: string): Promise<{ title: string, tokens: number }> => {
        const basePrompt = promptService.getPrompt('generateConversationTitle');
        const prompt = `${basePrompt}: "${firstMessage}"`;
        const { text: title, tokens } = await generateContent(prompt, 'gemini-2.5-flash-lite', { maxOutputTokens: 15 });
        return { title: title.replace(/["*]/g, '').trim(), tokens };
    },

    generateDiagram: async (analysisDocument: string, diagramType: 'mermaid' | 'bpmn', templatePrompt: string, model: GeminiModel, modelConfig?: object): Promise<{ code: string, tokens: number }> => {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini")) {
           throw new Error("Lütfen önce geçerli bir analiz dokümanı oluşturun.");
       }
       
       const prompt = `
           ${templatePrompt}
           ---
           **İş Analizi Dokümanı:**
           \`\`\`
           ${analysisDocument}
           \`\`\`
       `;
       const { text: result, tokens } = await generateContent(prompt, model, modelConfig);
       let code = result.trim();
       if (diagramType === 'mermaid') {
           const mermaidMatch = result.match(/```mermaid\n([\s\S]*?)\n```/);
           code = mermaidMatch ? mermaidMatch[1].trim() : code;
       } else { // BPMN
           const xmlMatch = result.match(/```xml\n([\s\S]*?)\n```/);
           code = xmlMatch ? xmlMatch[1].trim() : code;
       }
       return { code, tokens };
   },

    modifyDiagram: async (currentCode: string, userPrompt: string, model: GeminiModel, diagramType: 'mermaid' | 'bpmn', modelConfig?: object): Promise<{ code: string, tokens: number }> => {
       const promptId = diagramType === 'bpmn' ? 'modifyBPMN' : 'modifyVisualization';
       const basePrompt = promptService.getPrompt(promptId);
       
       const prompt = `
           ${basePrompt}
           ---
           **Mevcut ${diagramType.toUpperCase()} Kodu:**
           \`\`\`${diagramType === 'bpmn' ? 'xml' : 'mermaid'}
           ${currentCode}
           \`\`\`
           ---
           **Kullanıcı Talimatı:**
           "${userPrompt}"
       `;
       
       const { text: result, tokens } = await generateContent(prompt, model, modelConfig);
       let code = result.trim();
       if (diagramType === 'mermaid') {
           const mermaidMatch = result.match(/```mermaid\n([\s\S]*?)\n```/);
           code = mermaidMatch ? mermaidMatch[1].trim() : code;
       } else { // BPMN
           const xmlMatch = result.match(/```xml\n([\s\S]*?)\n```/);
           code = xmlMatch ? xmlMatch[1].trim() : code;
       }
       return { code, tokens };
    },
    
    generateBacklogSuggestions: async (analysisDoc: string, testScenarios: string, traceabilityMatrix: string, model: GeminiModel): Promise<{ suggestions: BacklogSuggestion[], tokens: number }> => {
        const backlogItemProperties = {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['epic', 'story', 'test_case'] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
        };
        
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    ...backlogItemProperties,
                    children: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                ...backlogItemProperties,
                                // For grandchildren, define children as a generic array to stop schema recursion
                                // while still satisfying the API's requirement for defined properties.
                                children: { type: Type.ARRAY }
                            },
                            required: ['id', 'type', 'title', 'description', 'priority', 'children']
                        }
                    }
                },
                required: ['id', 'type', 'title', 'description', 'priority', 'children']
            }
        };

        const basePrompt = promptService.getPrompt('generateBacklogFromArtifacts');
        const prompt = `${basePrompt}\n\n**İş Analizi Dokümanı:**\n${analysisDoc}\n\n**Test Senaryoları:**\n${testScenarios}\n\n**İzlenebilirlik Matrisi:**\n${traceabilityMatrix}`;
        
        const config = { responseMimeType: "application/json", responseSchema: schema };

        const { text: jsonString, tokens } = await generateContent(prompt, model, config);
        try {
            const cleanedJson = jsonString.replace(/^```json\s*|```\s*$/g, '');
            const results = JSON.parse(cleanedJson) as BacklogSuggestion[];
            return { suggestions: results, tokens };
        } catch (e) {
            console.error("Failed to parse backlog suggestions JSON:", e, "Received string:", jsonString);
            throw new Error("Backlog önerileri ayrıştırılamadı.");
        }
    },

    summarizeDocumentChange: async (oldDoc: string, newDoc: string, model: GeminiModel = 'gemini-2.5-flash-lite'): Promise<{ summary: string, tokens: number }> => {
        if (oldDoc === newDoc) {
            return { summary: "Değişiklik yapılmadı.", tokens: 0 };
        }
        const basePrompt = promptService.getPrompt('summarizeChange');
        const prompt = `${basePrompt}\n\n**ESKİ VERSİYON:**\n---\n${oldDoc}\n---\n\n**YENİ VERSİYON:**\n---\n${newDoc}\n---`;
        
        try {
            const { text, tokens } = await generateContent(prompt, model);
            return { summary: text.trim() || "Manuel Düzenleme", tokens };
        } catch (error) {
            console.error("Değişiklik özeti oluşturulurken hata:", error);
            return { summary: "Manuel Düzenleme", tokens: 0 };
        }
    },

    analyzeDocumentChange: async (oldDoc: string, newDoc: string, model: GeminiModel = 'gemini-2.5-flash'): Promise<{ impact: DocumentImpactAnalysis, tokens: number }> => {
        const schema = {
            type: Type.OBJECT,
            properties: {
                changeType: { type: Type.STRING, enum: ['minor', 'major'] },
                summary: { type: Type.STRING },
                isVisualizationImpacted: { type: Type.BOOLEAN },
                isTestScenariosImpacted: { type: Type.BOOLEAN },
                isTraceabilityImpacted: { type: Type.BOOLEAN },
                isBacklogImpacted: { type: Type.BOOLEAN },
            },
            required: ['changeType', 'summary', 'isVisualizationImpacted', 'isTestScenariosImpacted', 'isTraceabilityImpacted', 'isBacklogImpacted']
        };

        const prompt = `
            **GÖREV:** Bir iş analizi dokümanının iki versiyonu arasındaki farkları analiz et ve bu değişikliklerin diğer proje dokümanları (görselleştirme, test senaryoları, izlenebilirlik matrisi, backlog) üzerindeki potansiyel etkisini değerlendir.

            **ANALİZ KRİTERLERİ:**
            - **changeType:** Değişiklik sadece metinsel düzeltmeler içeriyorsa 'minor', iş mantığını, gereksinimleri veya kapsamı etkiliyorsa 'major' olarak belirle.
            - **summary:** Değişikliğin ne olduğunu 1-2 cümleyle özetle.
            - **isVisualizationImpacted:** Değişiklik, süreç akışını (yeni adımlar, kararlar, roller) etkiliyorsa \`true\`.
            - **isTestScenariosImpacted:** Değişiklik, fonksiyonel gereksinimleri (FR) ekliyor, siliyor veya değiştiriyorsa \`true\`.
            - **isTraceabilityImpacted:** Fonksiyonel gereksinimler veya test senaryoları etkilendiyse \`true\`.
            - **isBacklogImpacted:** Kapsamda, hedeflerde veya ana gereksinimlerde büyük bir değişiklik varsa \`true\`.
            
            ---
            **ESKİ DOKÜMAN:**
            ${oldDoc}
            ---
            **YENİ DOKÜMAN:**
            ${newDoc}
            ---
            
            **ÇIKTI KURALLARI:**
            - Cevabını SADECE ve SADECE sağlanan JSON şemasına uygun olarak ver.
        `;

        const config = { responseMimeType: "application/json", responseSchema: schema };
        const { text: jsonString, tokens } = await generateContent(prompt, model, config);
        try {
            return { impact: JSON.parse(jsonString) as DocumentImpactAnalysis, tokens };
        } catch (e) {
            console.error("Failed to parse impact analysis JSON:", e, "Received string:", jsonString);
            throw new Error("Etki analizi raporu ayrıştırılamadı.");
        }
    },

    analyzeFeedback: async (feedbackData: FeedbackItem[], model: GeminiModel = 'gemini-2.5-flash'): Promise<{ analysis: string, tokens: number }> => {
        if (feedbackData.length === 0) {
            return { analysis: "Analiz edilecek geri bildirim bulunmuyor.", tokens: 0 };
        }
        
        const formattedFeedback = feedbackData
            .filter(item => item.message.feedback?.comment) // Only analyze items with comments
            .map(item => {
                const rating = item.message.feedback?.rating === 'up' ? 'Beğenildi' : 'Beğenilmedi';
                const comment = item.message.feedback?.comment;
                const messageContent = item.message.content.substring(0, 150) + '...'; // Truncate for brevity
                return `
                    ---
                    Sohbet Başlığı: ${item.conversationTitle}
                    Değerlendirme: ${rating}
                    Kullanıcı Yorumu: "${comment}"
                    İlgili Mesaj (kısaltılmış): "${messageContent}"
                `;
            }).join('\n');
        
        if (!formattedFeedback.trim()) {
            return { analysis: "Analiz edilecek yorum içeren geri bildirim bulunmuyor.", tokens: 0 };
        }

        const basePrompt = promptService.getPrompt('analyzeFeedback');
        const prompt = `${basePrompt}\n\n**Kullanıcı Geri Bildirim Verisi:**\n${formattedFeedback}`;
        
        const { text, tokens } = await generateContent(prompt, model);
        return { analysis: text, tokens };
    },

    lintDocument: async (documentContent: string, model: GeminiModel = 'gemini-2.5-flash'): Promise<{ issues: LintingIssue[], tokens: number }> => {
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['BROKEN_SEQUENCE'] },
                    section: { type: Type.STRING },
                    details: { type: Type.STRING },
                },
                required: ['type', 'section', 'details']
            }
        };

        const basePrompt = promptService.getPrompt('lintDocument');
        const prompt = `${basePrompt}\n\n**DOKÜMAN İÇERİĞİ:**\n${documentContent}`;
        
        const config = { responseMimeType: "application/json", responseSchema: schema };
        const { text: jsonString, tokens } = await generateContent(prompt, model, config);
        try {
            if (!jsonString.trim() || jsonString.trim() === '[]') return { issues: [], tokens };
            return { issues: JSON.parse(jsonString) as LintingIssue[], tokens };
        } catch (e) {
            console.error("Failed to parse linting issues JSON:", e, "Received string:", jsonString);
            return { issues: [], tokens }; // Return empty on parse error
        }
    },

    fixDocumentLinterIssues: async (documentContent: string, issue: LintingIssue, model: GeminiModel = 'gemini-2.5-flash'): Promise<{ fixedContent: string, tokens: number }> => {
        const instruction = `Dokümanda şu hatayı düzelt: "${issue.details}" (Bölüm: ${issue.section})`;
        const basePrompt = promptService.getPrompt('fixLinterIssues').replace('{instruction}', instruction);
        const prompt = `${basePrompt}\n\n**DOKÜMAN İÇERİĞİ:**\n${documentContent}`;
        
        const { text: fixedContent, tokens } = await generateContent(prompt, model);
        return { fixedContent, tokens };
    },

    suggestNextFeature: async (analysisDocument: string, history: Message[], model: GeminiModel, modelConfig?: object): Promise<{ suggestions: string[], tokens: number }> => {
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
            },
        };

        const basePrompt = promptService.getPrompt('suggestNextFeature');
        const prompt = `${basePrompt}\n\n**Mevcut Analiz Dokümanı:**\n${analysisDocument}\n\n**Sohbet Geçmişi:**\n${formatHistory(history)}`;
        const config = { responseMimeType: "application/json", responseSchema: schema, ...modelConfig };

        const { text: jsonString, tokens } = await generateContent(prompt, model, config);
        try {
            const result = JSON.parse(jsonString);
            const suggestions = Array.isArray(result) ? result : [String(result)];
            return { suggestions, tokens };
        } catch (e) {
            console.error("Failed to parse feature suggestions JSON:", e, "Received string:", jsonString);
            throw new Error("Özellik önerileri ayrıştırılamadı.");
        }
    },
};

