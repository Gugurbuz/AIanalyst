// services/geminiService.ts

import { GoogleGenAI, Type, Content, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import type { Message, MaturityReport, BacklogSuggestion, GeminiModel, FeedbackItem, GeneratedDocs, ExpertStep, GenerativeSuggestion, LintingIssue } from '../types';
import { promptService } from './promptService'; // Import the new prompt service
import { v4 as uuidvv4 } from 'uuid';

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

export const geminiService = {
    processAnalystMessageStream: async function* (history: Message[], generatedDocs: GeneratedDocs, templates: { analysis: string; test: string }, model: GeminiModel): AsyncGenerator<StreamChunk> {
        let responseGenerated = false;
        try {
            const apiKey = getApiKey();
            const ai = new GoogleGenAI({ apiKey });

            const analysisDocContent = generatedDocs.analysisDoc || "Henüz bir doküman oluşturulmadı.";
            // Heuristic to determine if it's the start of a conversation.
            // If there's only one message (the user's first), it's a new conversation.
            const isNewConversation = history.filter(m => m.role === 'user' || m.role === 'assistant').length <= 1;

            // If it's a new conversation, always use the initial prompt to ask clarifying questions.
            // Otherwise, use the proactive prompt that knows about the document context.
            const systemInstruction = isNewConversation
                ? promptService.getPrompt('continueConversation')
                : promptService.getPrompt('proactiveAnalystSystemInstruction').replace('{analysis_document_content}', analysisDocContent);
            
            const geminiHistory = convertMessagesToGeminiFormat(history);

            const response = await ai.models.generateContent({
                model: model,
                contents: geminiHistory,
                config: {
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: tools }]
                }
            });

            if (response.usageMetadata?.totalTokenCount) {
                yield { type: 'usage_update', tokens: response.usageMetadata.totalTokenCount };
            }
            
            const functionCalls = response.functionCalls;
            
            if (functionCalls && functionCalls.length > 0) {
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
                            properties: {
                                new_content_suggestions: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                },
                            },
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
                        // ... (rest of the logic is the same, just need to handle streams now)
                        for await (const chunk of geminiService.generateAnalysisDocument(history, templates.analysis, model)) {
                            yield chunk;
                        }
                        yield { type: 'chat_response', content: "İş analizi dokümanını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        responseGenerated = true;

                    } else if (functionName === 'generateTestScenarios') {
                        yield { type: 'status_update', message: 'Test senaryoları hazırlanıyor...' };
                        for await (const chunk of geminiService.generateTestScenarios(generatedDocs.analysisDoc, templates.test, model)) {
                           yield chunk;
                        }
                        yield { type: 'chat_response', content: "Test senaryolarını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        responseGenerated = true;
                    } else if (functionName === 'generateTraceabilityMatrix') {
                        yield { type: 'status_update', message: 'İzlenebilirlik matrisi oluşturuluyor...' };
                        for await (const chunk of geminiService.generateTraceabilityMatrix(generatedDocs.analysisDoc, generatedDocs.testScenarios, model)) {
                           yield chunk;
                        }
                        yield { type: 'chat_response', content: "İzlenebilirlik matrisini oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        responseGenerated = true;
                    } else if (functionName === 'generateVisualization') {
                        yield { type: 'status_update', message: 'Süreç akışı görselleştiriliyor...' };
                        const { code: vizCode, tokens } = await geminiService.generateDiagram(generatedDocs.analysisDoc, 'mermaid', model);
                        yield { type: 'usage_update', tokens };
                        yield { type: 'visualization_update', content: vizCode };
                        yield { type: 'chat_response', content: "Süreç akış diyagramını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        responseGenerated = true;
                    }
                }
            } else {
                 // No function calls, handle text response
                const textResponse = response.text;
                if (textResponse) {
                    yield { type: 'chat_response', content: textResponse };
                    responseGenerated = true;
                } else {
                    // Fallback if model returns neither text nor function call
                    yield { type: 'chat_response', content: "Ne demek istediğinizi anlayamadım, farklı bir şekilde ifade edebilir misiniz?" };
                    responseGenerated = true;
                }
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
            yield { type: 'error', message: errorMessage };
            handleGeminiError(error);
        } finally {
            if (responseGenerated) {
                // After any successful response, run a background maturity check.
                try {
                    // Use a 'lite' model for speed and cost-effectiveness
                    const { report, tokens } = await geminiService.checkAnalysisMaturity(history, 'gemini-2.5-flash-lite'); 
                    yield { type: 'usage_update', tokens };
                    yield { type: 'maturity_update', report };
                } catch (maturityError) {
                    console.warn("Arka plan olgunluk kontrolü başarısız oldu:", maturityError);
                    // Do not yield an error to the user, as this is a background task.
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

    executeExpertRun: async function* (history: Message[], templates: { analysis: string; test: string }, model: GeminiModel): AsyncGenerator<StreamChunk> {
        let analysisDocContent = '';
        for await (const chunk of geminiService.generateAnalysisDocument(history, templates.analysis, model)) {
            if (chunk.type === 'doc_stream_chunk' && chunk.docKey === 'analysisDoc') {
                analysisDocContent += chunk.chunk;
            }
            yield chunk;
        }

        if (analysisDocContent) {
            const { code: vizCode, tokens: vizTokens } = await geminiService.generateDiagram(analysisDocContent, 'mermaid', model);
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
                for await (const chunk of geminiService.generateTraceabilityMatrix(analysisDocContent, testScenariosContent, model)) {
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
    
    checkAnalysisMaturity: async (history: Message[], model: GeminiModel, modelConfig?: object): Promise<{ report: MaturityReport, tokens: number }> => {
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
        const prompt = `${basePrompt}\n\nKonuşma Geçmişi:\n${formatHistory(history)}`;
        
        const config = { responseMimeType: "application/json", responseSchema: schema, ...modelConfig };

        const { text: jsonString, tokens } = await generateContent(prompt, model, config);
        try {
            return { report: JSON.parse(jsonString) as MaturityReport, tokens };
        } catch (e) {
            console.error("Failed to parse maturity report JSON:", e, "Received string:", jsonString);
            throw new Error("Analiz olgunluk raporu ayrıştırılamadı.");
        }
    },

    generateAnalysisDocument: async function* (history: Message[], templateId: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<StreamChunk> {
        const templatePrompt = promptService.getPrompt(templateId);
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

    generateTestScenarios: async function* (analysisDocument: string, templateId: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<StreamChunk> {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini")) {
            throw new Error("Lütfen önce geçerli bir analiz dokümanı oluşturun.");
        }
        const templatePrompt = promptService.getPrompt(templateId);
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
    
    generateTraceabilityMatrix: async function* (analysisDocument: string, testScenarios: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<StreamChunk> {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini") || !testScenarios) {
            throw new Error("Lütfen önce geçerli bir analiz dokümanı ve test senaryoları oluşturun.");
        }
        const templatePrompt = promptService.getPrompt('generateTraceabilityMatrix');
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
        const { text: title, tokens } = await generateContent(prompt, 'gemini-2.5-flash-lite');
        return { title: title.replace(/["*]/g, '').trim(), tokens };
    },

    generateDiagram: async (analysisDocument: string, diagramType: 'mermaid' | 'bpmn', model: GeminiModel, modelConfig?: object): Promise<{ code: string, tokens: number }> => {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini")) {
           throw new Error("Lütfen önce geçerli bir analiz dokümanı oluşturun.");
       }
       
       const promptId = diagramType === 'bpmn' ? 'generateBPMN' : 'generateVisualization';
       const basePrompt = promptService.getPrompt(promptId);
       
       const prompt = `
           ${basePrompt}
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
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['epic', 'story', 'test_case'] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
                    children: { type: Type.ARRAY, items: { type: Type.OBJECT } } // Recursive definition
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

    summarizeDocumentChange: async (oldDoc: string, newDoc: string, model: GeminiModel = 'gemini-2.5-flash'): Promise<{ summary: string, tokens: number }> => {
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