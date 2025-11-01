// services/geminiService.ts

import { GoogleGenAI, Type, Content, FunctionDeclaration } from "@google/genai";
import type { Message, MaturityReport, BacklogSuggestion, GeminiModel, FeedbackItem, GeneratedDocs, ExpertStep, GenerativeSuggestion } from '../types';
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


const generateContent = async (prompt: string, model: GeminiModel, modelConfig?: object): Promise<string> => {
    try {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            ...(modelConfig && { config: modelConfig }),
        });
        
        // Manually extract text from parts to avoid SDK warning about non-text parts.
        if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                return candidate.content.parts
                    .map(part => part.text)
                    .filter(Boolean) // Filter out undefined/null/empty strings from non-text parts
                    .join('');
            }
        }
        return ''; // Return empty string if no text is found
    } catch (error) {
        handleGeminiError(error);
    }
};

const generateContentStream = async function* (prompt: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<string> {
    try {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const responseStream = await ai.models.generateContentStream({
            model: model,
            contents: prompt,
            ...(modelConfig && { config: modelConfig }),
        });

        for await (const chunk of responseStream) {
            // Manually extract text from parts to avoid SDK warning about non-text parts.
            let textChunk = '';
            if (chunk.candidates && chunk.candidates.length > 0) {
                const candidate = chunk.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    textChunk = candidate.content.parts
                        .map(part => part.text)
                        .filter(Boolean)
                        .join('');
                }
            }
            if (textChunk) {
                yield textChunk;
            }
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
            const isDocJustSample = analysisDocContent.includes("Bu bölüme projenin temel hedefini");

            // If the document is just the initial sample, use a simpler conversational prompt.
            // Otherwise, use the proactive prompt that knows about the document context.
            const systemInstruction = isDocJustSample
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

                        const jsonString = await generateContent(suggestionPrompt, 'gemini-2.5-pro', config);
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
                        const args = fc.args as { force?: boolean; incrementalUpdate?: boolean };
                        const isIncremental = args?.incrementalUpdate === true;
                        const isForced = args?.force === true;
                        let maturityReport: MaturityReport | null = null;
                        
                        // The maturity check should only run if it's NOT an incremental update and NOT forced.
                        if (!isIncremental && !isForced) {
                            yield { type: 'status_update', message: 'Analiz olgunluğu kontrol ediliyor...' };
                            const report = await geminiService.checkAnalysisMaturity(history, model);
                            if (!report.isSufficient) {
                                yield { type: 'chat_response', content: `Analiz dokümanı oluşturmak için konuşma henüz yeterli olgunlukta değil. Öneri: "${report.suggestedQuestions[0]}"` };
                                continue; // Stop this function call
                            }
                            maturityReport = report; // Store the report to pass along with the stream
                        }

                        // If we passed the check, or skipped it, we generate the document.
                        const statusMessage = isIncremental 
                            ? 'İş analizi dokümanı güncelleniyor...'
                            : 'İş analizi dokümanı oluşturuluyor...';
                        yield { type: 'status_update', message: statusMessage };

                        const docStream = geminiService.generateAnalysisDocument(history, templates.analysis, model);
                        for await (const chunk of docStream) {
                            yield { type: 'doc_stream_chunk', docKey: 'analysisDoc', chunk, updatedReport: maturityReport };
                        }

                        const completionMessage = isIncremental
                            ? "İş analizi dokümanını güncelledim. Çalışma alanından inceleyebilirsiniz."
                            : "İş analizi dokümanını oluşturdum. Çalışma alanından inceleyebilirsiniz.";
                        yield { type: 'chat_response', content: completionMessage };
                        responseGenerated = true;
                    } else if (functionName === 'generateTestScenarios') {
                        yield { type: 'status_update', message: 'Test senaryoları hazırlanıyor...' };
                        const docStream = geminiService.generateTestScenarios(generatedDocs.analysisDoc, templates.test, model);
                        for await (const chunk of docStream) {
                            yield { type: 'doc_stream_chunk', docKey: 'testScenarios', chunk };
                        }
                        yield { type: 'chat_response', content: "Test senaryolarını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        responseGenerated = true;
                    } else if (functionName === 'generateTraceabilityMatrix') {
                        yield { type: 'status_update', message: 'İzlenebilirlik matrisi oluşturuluyor...' };
                        const docStream = geminiService.generateTraceabilityMatrix(generatedDocs.analysisDoc, generatedDocs.testScenarios, model);
                         for await (const chunk of docStream) {
                            yield { type: 'doc_stream_chunk', docKey: 'traceabilityMatrix', chunk };
                        }
                        yield { type: 'chat_response', content: "İzlenebilirlik matrisini oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        responseGenerated = true;
                    } else if (functionName === 'generateVisualization') {
                        yield { type: 'status_update', message: 'Süreç akışı görselleştiriliyor...' };
                        const vizCode = await geminiService.generateDiagram(generatedDocs.analysisDoc, 'mermaid', model);
                        yield { type: 'visualization_update', content: vizCode };
                        yield { type: 'chat_response', content: "Süreç akış diyagramını oluşturdum. Çalışma alanından inceleyebilirsiniz." };
                        responseGenerated = true;
                    }
                }
            } else {
                 // No function calls, handle text response
                let textResponse = '';
                if (response.candidates && response.candidates.length > 0) {
                    const candidate = response.candidates[0];
                    if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                        textResponse = candidate.content.parts
                            .map(part => part.text)
                            .filter(Boolean)
                            .join('');
                    }
                }

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
                    const report = await geminiService.checkAnalysisMaturity(history, 'gemini-2.5-flash-lite'); 
                    yield { type: 'maturity_update', report };
                } catch (maturityError) {
                    console.warn("Arka plan olgunluk kontrolü başarısız oldu:", maturityError);
                    // Do not yield an error to the user, as this is a background task.
                }
            }
        }
    },
    
    clarifyAndConfirmExpertMode: async (history: Message[], model: GeminiModel): Promise<{ needsClarification: boolean; questions?: string; confirmationRequest?: string; checklist?: ExpertStep[] }> => {
        const lastUserMessage = history.length > 0 ? history[history.length - 1].content.trim().toLowerCase() : '';
        const forceProceedKeywords = [
            'başla',
            'devam et',
            'bu şekilde devam',
            'ek bilgi yok',
            'bilmiyorum'
        ];

        // Check if the user's message CONTAINS any of the keywords indicating they want to proceed.
        // This is more flexible than an exact match.
        if (forceProceedKeywords.some(keyword => lastUserMessage.includes(keyword))) {
            const checklist: ExpertStep[] = [
                { id: 'analysis', name: 'İş Analizi Dokümanı Oluşturma', status: 'pending' },
                { id: 'viz', name: 'Süreç Akışını Görselleştirme', status: 'pending' },
                { id: 'test', name: 'Test Senaryoları Oluşturma', status: 'pending' },
                { id: 'traceability', name: 'İzlenebilirlik Matrisi Oluşturma', status: 'pending' },
            ];
            return {
                needsClarification: false,
                confirmationRequest: "Anladım, mevcut bilgilerle devam ediyorum. Aşağıdaki adımları otomatik olarak gerçekleştireceğim. Onaylıyor musunuz?",
                checklist: checklist
            };
        }
        
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

        const jsonString = await generateContent(prompt, model, config);
        const result = JSON.parse(jsonString);

        if (result.needsClarification) {
            return { needsClarification: true, questions: result.questions };
        } else {
            const checklist: ExpertStep[] = [
                { id: 'analysis', name: 'İş Analizi Dokümanı Oluşturma', status: 'pending' },
                { id: 'viz', name: 'Süreç Akışını Görselleştirme', status: 'pending' },
                { id: 'test', name: 'Test Senaryoları Oluşturma', status: 'pending' },
                { id: 'traceability', name: 'İzlenebilirlik Matrisi Oluşturma', status: 'pending' },
            ];
            return {
                needsClarification: false,
                confirmationRequest: "Analiz için yeterli bilgiye sahibim. Aşağıdaki adımları otomatik olarak gerçekleştireceğim. Onaylıyor musunuz?",
                checklist: checklist
            };
        }
    },

    executeExpertRun: async function* (history: Message[], templates: { analysis: string; test: string }, model: GeminiModel): AsyncGenerator<StreamChunk> {
        let fullAnalysisDoc = '';
        let fullTestScenarios = '';

        const checklist: ExpertStep[] = [
            { id: 'analysis', name: 'İş Analizi Dokümanı Oluşturma', status: 'pending' },
            { id: 'viz', name: 'Süreç Akışını Görselleştirme', status: 'pending' },
            { id: 'test', name: 'Test Senaryoları Oluşturma', status: 'pending' },
            { id: 'traceability', name: 'İzlenebilirlik Matrisi Oluşturma', status: 'pending' },
        ];
        
        yield { type: 'expert_run_update', checklist: [...checklist], isComplete: false };

        const updateStep = (id: ExpertStep['id'], status: ExpertStep['status'], details?: string): void => {
            const step = checklist.find(s => s.id === id);
            if (step) {
                step.status = status;
                if (details) step.details = details;
            }
        };

        try {
            // Step 1: Analysis Document
            updateStep('analysis', 'in_progress');
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: false };
            for await (const chunk of geminiService.generateAnalysisDocument(history, templates.analysis, model)) {
                fullAnalysisDoc += chunk;
                yield { type: 'doc_stream_chunk', docKey: 'analysisDoc', chunk };
            }
            updateStep('analysis', 'completed');
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: false };

            // Step 2: Visualization
            updateStep('viz', 'in_progress');
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: false };
            const vizCode = await geminiService.generateDiagram(fullAnalysisDoc, 'mermaid', model);
            yield { type: 'visualization_update', content: vizCode };
            updateStep('viz', 'completed');
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: false };
            
            // Step 3: Test Scenarios
            updateStep('test', 'in_progress');
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: false };
            for await (const chunk of geminiService.generateTestScenarios(fullAnalysisDoc, templates.test, model)) {
                fullTestScenarios += chunk;
                yield { type: 'doc_stream_chunk', docKey: 'testScenarios', chunk };
            }
            updateStep('test', 'completed');
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: false };

            // Step 4: Traceability Matrix
            updateStep('traceability', 'in_progress');
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: false };
            for await (const chunk of geminiService.generateTraceabilityMatrix(fullAnalysisDoc, fullTestScenarios, model)) {
                 yield { type: 'doc_stream_chunk', docKey: 'traceabilityMatrix', chunk };
            }
            updateStep('traceability', 'completed');
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: true, finalMessage: "Tüm adımlar başarıyla tamamlandı. Oluşturulan dokümanları çalışma alanından inceleyebilirsiniz." };

        } catch (error) {
            const lastActiveStep = checklist.find(s => s.status === 'in_progress');
            if (lastActiveStep) {
                updateStep(lastActiveStep.id, 'error', error instanceof Error ? error.message : "Bilinmeyen hata");
            }
            yield { type: 'expert_run_update', checklist: [...checklist], isComplete: true, finalMessage: "Bir hata nedeniyle süreç durduruldu." };
            handleGeminiError(error);
        }
    },


    continueConversation: async (history: Message[], model: GeminiModel): Promise<string> => {
        try {
            const apiKey = getApiKey();
            const ai = new GoogleGenAI({ apiKey });
            const systemInstruction = promptService.getPrompt('continueConversation');
            const geminiHistory = convertMessagesToGeminiFormat(history);

            const response = await ai.models.generateContent({
                model: model,
                contents: geminiHistory,
                config: {
                    systemInstruction: systemInstruction,
                }
            });
            // Manually extract text from parts to avoid SDK warning about non-text parts.
            if (response.candidates && response.candidates.length > 0) {
                const candidate = response.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    return candidate.content.parts
                        .map(part => part.text)
                        .filter(Boolean) 
                        .join('');
                }
            }
            return '';
        } catch (error) {
            handleGeminiError(error);
        }
    },
    
    checkAnalysisMaturity: async (history: Message[], model: GeminiModel, modelConfig?: object): Promise<MaturityReport> => {
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

        const jsonString = await generateContent(prompt, model, config);
        try {
            return JSON.parse(jsonString) as MaturityReport;
        } catch (e) {
            console.error("Failed to parse maturity report JSON:", e, "Received string:", jsonString);
            throw new Error("Analiz olgunluk raporu ayrıştırılamadı.");
        }
    },

    generateAnalysisDocument: async function* (history: Message[], templateId: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<string> {
        const templatePrompt = promptService.getPrompt(templateId);
        const prompt = `${templatePrompt}\n\n**TALİMAT:**\nDokümanı yalnızca ve yalnızca aşağıda sağlanan konuşma geçmişine dayanarak oluştur.\n\n**Konuşma Geçmişi:**\n${formatHistory(history)}`;
        yield* generateContentStream(prompt, model, modelConfig);
    },

    generateTestScenarios: async function* (analysisDocument: string, templateId: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<string> {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini")) {
            throw new Error("Lütfen önce geçerli bir analiz dokümanı oluşturun.");
        }
        const templatePrompt = promptService.getPrompt(templateId);
        const prompt = `${templatePrompt}\n\n**TALİMAT:**\nTest senaryolarını yalnızca aşağıda sağlanan İş Analizi Dokümanına dayanarak oluştur.\n\n**İş Analizi Dokümanı:**\n'${analysisDocument}'`;
        yield* generateContentStream(prompt, model, modelConfig);
    },
    
    generateTraceabilityMatrix: async function* (analysisDocument: string, testScenarios: string, model: GeminiModel, modelConfig?: object): AsyncGenerator<string> {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini") || !testScenarios) {
            throw new Error("Lütfen önce geçerli bir analiz dokümanı ve test senaryoları oluşturun.");
        }
        const templatePrompt = promptService.getPrompt('generateTraceabilityMatrix');
        const prompt = `${templatePrompt}\n\n**İş Analizi Dokümanı:**\n'${analysisDocument}'\n\n**Test Senaryoları Dokümanı:**\n'${testScenarios}'`;
        yield* generateContentStream(prompt, model, modelConfig);
    },

    generateConversationTitle: async (firstMessage: string): Promise<string> => {
        const basePrompt = promptService.getPrompt('generateConversationTitle');
        const prompt = `${basePrompt}: "${firstMessage}"`;
        const title = await generateContent(prompt, 'gemini-2.5-flash-lite');
        return title.replace(/["*]/g, '').trim();
    },

    generateDiagram: async (analysisDocument: string, diagramType: 'mermaid' | 'bpmn', model: GeminiModel, modelConfig?: object): Promise<string> => {
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
       const result = await generateContent(prompt, model, modelConfig);
       
       if (diagramType === 'mermaid') {
           const mermaidMatch = result.match(/```mermaid\n([\s\S]*?)\n```/);
           return mermaidMatch ? mermaidMatch[1].trim() : result.trim();
       } else { // BPMN
           const xmlMatch = result.match(/```xml\n([\s\S]*?)\n```/);
           return xmlMatch ? xmlMatch[1].trim() : result.trim();
       }
   },

    modifyDiagram: async (currentCode: string, userPrompt: string, model: GeminiModel, diagramType: 'mermaid' | 'bpmn', modelConfig?: object): Promise<string> => {
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
       
       const result = await generateContent(prompt, model, modelConfig);
       
       if (diagramType === 'mermaid') {
           const mermaidMatch = result.match(/```mermaid\n([\s\S]*?)\n```/);
           return mermaidMatch ? mermaidMatch[1].trim() : result.trim();
       } else { // BPMN
           const xmlMatch = result.match(/```xml\n([\s\S]*?)\n```/);
           return xmlMatch ? xmlMatch[1].trim() : result.trim();
       }
    },
    
    generateBacklogSuggestions: async (analysisDoc: string, testScenarios: string, traceabilityMatrix: string, model: GeminiModel): Promise<BacklogSuggestion[]> => {
        
        // Define base properties to reuse them and keep the schema DRY.
        const baseSuggestionProperties = {
            id: { type: Type.STRING, description: "Benzersiz bir UUIDv4." },
            type: { type: Type.STRING, enum: ['epic', 'story', 'test_case'] },
            title: { type: Type.STRING, description: "Görevin kısa başlığı." },
            description: { type: Type.STRING, description: "Görevin detaylı açıklaması." },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
        };

        const suggestionSchema = {
            type: Type.OBJECT,
            description: "En üst seviye backlog maddesi, genellikle bir Epic.",
            properties: {
                ...baseSuggestionProperties,
                children: { 
                    type: Type.ARRAY, 
                    items: {
                        // Level 1 children (e.g., stories under an epic)
                        type: Type.OBJECT,
                        description: "Bir epic'e ait olan story veya test case.",
                        properties: {
                            ...baseSuggestionProperties,
                            children: { 
                                type: Type.ARRAY, 
                                items: { 
                                    // Level 2 children (e.g., test cases under a story)
                                    // These should not have children of their own, so we stop recursion here.
                                    type: Type.OBJECT,
                                    description: "Bir story'ye ait olan test case.",
                                    properties: {
                                        ...baseSuggestionProperties,
                                        // No 'children' property here to terminate the nesting.
                                    },
                                    required: ['id', 'type', 'title', 'description', 'priority']
                                } 
                            }
                        },
                        required: ['id', 'type', 'title', 'description', 'priority', 'children']
                    } 
                }
            },
            required: ['id', 'type', 'title', 'description', 'priority', 'children']
        };

        const schema = {
            type: Type.ARRAY,
            items: suggestionSchema
        };

        const basePrompt = promptService.getPrompt('generateBacklogFromArtifacts');
        const prompt = `${basePrompt}\n\n**İş Analizi Dokümanı:**\n${analysisDoc}\n\n**Test Senaryoları:**\n${testScenarios}\n\n**İzlenebilirlik Matrisi:**\n${traceabilityMatrix}`;
        
        const config = { responseMimeType: "application/json", responseSchema: schema };

        const jsonString = await generateContent(prompt, model, config);
        try {
            // Gemini might return a string with ```json ... ```, so we clean it.
            const cleanedJson = jsonString.replace(/^```json\s*|```\s*$/g, '');
            const results = JSON.parse(cleanedJson) as any[];

            // Add UUIDs if missing, as the model might not generate them reliably.
            const addIds = (items: any[]): BacklogSuggestion[] => {
                return items.map(item => ({
                    ...item,
                    // FIX: Correct typo from uuidv4 to uuidvv4
                    id: item.id || uuidvv4(),
                    children: item.children ? addIds(item.children) : []
                }));
            }

            return addIds(results);
            
        } catch (e) {
            console.error("Failed to parse backlog suggestions JSON:", e, "Received string:", jsonString);
            throw new Error("Backlog önerileri ayrıştırılamadı.");
        }
    },

    suggestNextFeature: async (analysisDocument: string, history: Message[], model: GeminiModel, modelConfig?: object): Promise<string[]> => {
        const schema = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };

        const basePrompt = promptService.getPrompt('suggestNextFeature');
        const prompt = `${basePrompt}\n\n**Mevcut Analiz Dokümanı:**\n${analysisDocument}\n\n**Sohbet Geçmişi:**\n${formatHistory(history)}`;

        const config = { responseMimeType: "application/json", responseSchema: schema, ...modelConfig };

        const jsonString = await generateContent(prompt, model, config);
        try {
            const result = JSON.parse(jsonString);
            return Array.isArray(result) ? result : [String(result)];
        } catch (e) {
            console.error("Failed to parse feature suggestions JSON:", e, "Received string:", jsonString);
            throw new Error("Özellik önerileri ayrıştırılamadı.");
        }
    },

    analyzeFeedback: async (feedbackData: FeedbackItem[], model: GeminiModel = 'gemini-2.5-flash'): Promise<string> => {
        const basePrompt = promptService.getPrompt('analyzeFeedback');
        
        const formattedFeedback = feedbackData
            .filter(item => item.message.feedback && (item.message.feedback.comment || item.message.feedback.rating))
            .map(item => {
                const fb = item.message.feedback!;
                const rating = fb.rating === 'up' ? 'Beğenildi' : 'Beğenilmedi';
                const comment = fb.comment ? `Yorum: "${fb.comment}"` : "Yorum yok.";
                return `- Konu: "${item.conversationTitle}"\n  - Değerlendirme: ${rating}\n  - ${comment}`;
            }).join('\n');

        if (!formattedFeedback.trim()) {
            return "## Geri Bildirim Analizi\n\nAnaliz edilecek yeterli geri bildirim bulunamadı.";
        }
            
        const prompt = `${basePrompt}\n\n**Kullanıcı Geri Bildirimleri:**\n${formattedFeedback}`;
        
        return await generateContent(prompt, model);
    },

    // --- NEW: AI-powered Impact Analysis ---
    analyzeDocumentChange: async (oldDoc: string, newDoc: string, model: GeminiModel): Promise<DocumentImpactAnalysis> => {
        // If there's no old doc, it's a new creation, so everything is impacted.
        if (!oldDoc.trim()) {
            return {
                changeType: 'major',
                summary: 'Doküman ilk kez oluşturuldu.',
                isVisualizationImpacted: true,
                isTestScenariosImpacted: true,
                isTraceabilityImpacted: true,
                isBacklogImpacted: true,
            };
        }
        
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
            **GÖREV:** İki iş analizi dokümanı versiyonu arasındaki değişikliğin etkisini analiz et.
            
            **ANALİZ KRİTERLERİ:**
            - **changeType:** Değişiklik sadece yazım hatası, yeniden ifade etme gibi küçük metinsel düzeltmeler içeriyorsa 'minor'; yeni bir fonksiyonel gereksinim eklenmesi/çıkarılması, kapsamın değişmesi, iş kurallarının güncellenmesi gibi yapısal bir değişiklikse 'major' olarak belirle.
            - **isVisualizationImpacted:** Değişiklik, kullanıcı akışını, adımları veya sistem etkileşimlerini etkiliyorsa \`true\`.
            - **isTestScenariosImpacted:** Değişiklik, fonksiyonel gereksinimleri (FR) veya kabul kriterlerini etkiliyorsa \`true\`.
            - **isTraceabilityImpacted:** Test senaryoları etkileniyorsa, bu da etkilenir. \`isTestScenariosImpacted\` ile aynı olmalı.
            - **isBacklogImpacted:** Kapsam veya fonksiyonel gereksinimler değiştiyse \`true\`.

            **DOKÜMANLAR:**
            ---
            **ESKİ VERSİYON:**
            ${oldDoc}
            ---
            **YENİ VERSİYON:**
            ${newDoc}
            ---
            
            **ÇIKTI:**
            Analizini SADECE ve SADECE sağlanan JSON şemasına uygun olarak ver.
        `;

        const config = { responseMimeType: "application/json", responseSchema: schema };
        const jsonString = await generateContent(prompt, model, config);
        
        try {
            return JSON.parse(jsonString) as DocumentImpactAnalysis;
        } catch (e) {
            console.error("Failed to parse impact analysis JSON:", e, "Received string:", jsonString);
            // Fallback to a "major change" assumption on parsing failure to be safe
            return {
                changeType: 'major',
                summary: 'Değişiklik analizi sırasında bir ayrıştırma hatası oluştu, büyük bir değişiklik varsayılıyor.',
                isVisualizationImpacted: true,
                isTestScenariosImpacted: true,
                isTraceabilityImpacted: true,
                isBacklogImpacted: true,
            };
        }
    },
};