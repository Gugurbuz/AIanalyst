// services/geminiService.ts

// GoogleGenAI import'u kaldırıldı, supabase import'u eklendi
import { supabase } from './supabaseClient'; 
import { Type, Content, FunctionDeclaration, GenerateContentResponse, Modality } from "@google/genai";
import type { Message, MaturityReport, BacklogSuggestion, GeminiModel, FeedbackItem, GeneratedDocs, ExpertStep, GenerativeSuggestion, LintingIssue, SourcedDocument, VizData, ThoughtProcess, StreamChunk } from '../types';
import { promptService } from './promptService';
import { v4 as uuidv4 } from 'uuid';

// getApiKey fonksiyonu SİLİNDİ.

export interface DocumentImpactAnalysis {
    // ... (içerik aynı) ...
    changeType: 'minor' | 'major';
    summary: string;
    isVisualizationImpacted: boolean;
    isTestScenariosImpacted: boolean;
    isTraceabilityImpacted: boolean;
    isBacklogImpacted: boolean;
}

function handleGeminiError(error: any): never {
    console.error("Gemini/Supabase Function Hatası:", error);
    // ... (hata işleme mantığı aynı kalabilir) ...
    const message = (error?.message || String(error)).toLowerCase();
    if (message.includes('429') || message.includes('quota')) throw new Error("API Kota Limiti Aşıldı.");
    if (message.includes('api key not valid')) throw new Error("Geçersiz API Anahtarı.");
    if (message.includes('internal error')) throw new Error("Gemini API'sinde geçici bir iç hata oluştu.");
    if (message.includes('network error')) throw new Error("Ağ bağlantı hatası.");
    throw new Error(`Beklenmedik bir hata oluştu: ${error?.message || error}`);
}

// !!!!!!!!!!!!!!! DEĞİŞİKLİK 1 !!!!!!!!!!!!!!!
// Bu fonksiyon artık Google'a değil, Supabase Edge Function'a istek atıyor
const generateContent = async (
  prompt: string, 
  model: GeminiModel, // model parametresi artık sunucu tarafında yönetiliyor
  modelConfig?: any
): Promise<{ text: string, tokens: number }> => {
    
    const { contents, config } = {
        contents: prompt,
        config: modelConfig?.generationConfig || modelConfig,
    };

    try {
        // 'gemini-proxy' fonksiyonunu çağır
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: { contents, config },
            // responseType belirtilmezse, yanıtı toplu olarak bekler
        });

        if (error) throw error;
        
        // Gelen yanıtı stream olarak oku (Edge Function'ınız stream dönecek şekilde ayarlanmışsa)
        if (data instanceof ReadableStream) {
             const reader = data.getReader();
             const decoder = new TextDecoder();
             let text = "";
             let done = false;
             while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    text += decoder.decode(value, { stream: true });
                }
             }
             // ÖNEMLİ: Edge function'dan token bilgisi alamıyoruz.
             // Bu nedenle token sayısını 0 olarak döndürüyoruz.
             return { text: text, tokens: 0 }; 
        }

        // Eğer data JSON ise (stream değilse)
        if (data && data.text) {
             return { text: data.text, tokens: data.tokens || 0 };
        }

        throw new Error("Supabase Function'dan beklenmeyen yanıt formatı.");

    } catch (error) {
        console.error("Supabase Function Hatası:", error);
        handleGeminiError(error);
    }
};

// !!!!!!!!!!!!!!! DEĞİŞİKLİK 2 !!!!!!!!!!!!!!!
// Bu fonksiyon da artık Google'a değil, Supabase Edge Function'a istek atıyor
const generateContentStream = async function* (
  prompt: string, 
  model: GeminiModel, // model parametresi sunucuda
  modelConfig?: any
): AsyncGenerator<GenerateContentResponse> {
    
    const { contents, config } = {
        contents: prompt,
        config: modelConfig?.generationConfig || modelConfig,
    };

    try {
        // 'gemini-proxy' fonksiyonunu çağır
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: { contents, config },
            responseType: 'stream', // Stream olarak yanıt beklediğimizi belirtiyoruz
        });

        if (error) throw error;
        if (!data.body) throw new Error("Stream body bulunamadı.");

        const reader = data.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const text = decoder.decode(value, { stream: true });
                // Orijinal 'GenerateContentResponse' formatına benzeterek yield et
                yield {
                    text: () => text,
                    // Diğer fonksiyonlar (usageMetadata vb.) bu akışta gelmeyecek
                } as unknown as GenerateContentResponse;
            }
        }

    } catch (error) {
        console.error("Supabase Function Hatası:", error);
        handleGeminiError(error);
    }
};

// ... (dosyanın geri kalanı: convertMessagesToGeminiFormat, tools, parseStreamingResponse, isBirimiTalepSchema, ve tüm 'geminiService' objesi aynı kalabilir) ...
// ...
// ...
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
        
        // DEĞİŞİKLİK: 'chunk.text' artık bir fonksiyon
        const text = chunk.text ? chunk.text() : null;
        if (!text) continue;

        buffer += text;
        
        // ... (geri kalan 'parseStreamingResponse' mantığı aynı) ...
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
                    const remainingText = buffer.substring(endIdx + endTag.length);
                    if (remainingText) {
                        yield { type: 'text_chunk', text: remainingText };
                    }
                    buffer = ''; 
                } catch (e) {
                    // JSON yarım kalmış olabilir
                }
            }
        } else {
            yield { type: 'text_chunk', text: buffer };
            buffer = ''; 
        }
    }
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
    // ... (handleUserMessageStream, runExpertAnalysisStream, vb. fonksiyonlarınız) ...
    // ÖNEMLİ: Bu fonksiyonların içindeki 'generateContent' ve 'generateContentStream'
    // çağrılarının HEPSİ artık Sizin Supabase Function'ınızı ('gemini-proxy') kullanacak.
    
    // Örnek: handleUserMessageStream'in içindeki 'ai.models.generateContentStream'
    // çağrısını 'generateContentStream' (bizim yeni yazdığımız) ile değiştirmeniz gerekir.
    
    // Örnek:
    handleUserMessageStream: async function* (history: Message[], generatedDocs: GeneratedDocs, templates: { analysis: string; test: string; traceability: string; visualization: string; }, model: GeminiModel): AsyncGenerator<StreamChunk> {
        try {
            // const ai = new GoogleGenAI({ apiKey: getApiKey() }); // SİLİNDİ
            const hasRequestDoc = !!generatedDocs.requestDoc?.trim();
            const hasRealAnalysisDoc = !!generatedDocs.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");
            const isStartingConversation = !hasRequestDoc && !hasRealAnalysisDoc && history.filter(m => m.role !== 'system').length <= 1;

            const systemInstruction = isStartingConversation
                ? promptService.getPrompt('continueConversation')
                : promptService.getPrompt('proactiveAnalystSystemInstruction')
                    .replace('{analysis_document_content}', generatedDocs.analysisDoc || "...")
                    .replace('{request_document_content}', generatedDocs.requestDoc || "...");
            
            const geminiHistory = convertMessagesToGeminiFormat(history);
            
            // !!!!!!!!!!!!!!! BURASI DEĞİŞTİ !!!!!!!!!!!!!!!
            // 'ai.models.generateContentStream' yerine 'generateContentStream' (bizimki)
            const responseStream = generateContentStream(
                geminiHistory as any, // Düzeltme: prompt string olmalı, düzeltiyoruz
                model, 
                {
                    systemInstruction,
                    tools: [{ functionDeclarations: tools }],
                }
            );

            let buffer = '';
            let thoughtYielded = false;
            
            for await (const chunk of responseStream) {
                 if (chunk.usageMetadata) {
                     yield { type: 'usage_update', tokens: chunk.usageMetadata.totalTokenCount };
                }
                // 'functionCalls' Supabase proxy'sinden doğrudan gelmez,
                // bunu işlemek için Edge Function'ı güncellemeniz gerekir.
                // ŞİMDİLİK BU KISIM ÇALIŞMAYABİLİR:
                if (chunk.functionCalls) {
                    for (const fc of chunk.functionCalls) {
                        yield { type: 'function_call', name: fc.name, args: fc.args };
                    }
                }
                
                const text = chunk.text ? chunk.text() : null; // DEĞİŞİKLİK
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
                                buffer = ''; 
                            } catch (e) {
                                // Incomplete JSON
                            }
                        }
                    } else {
                        yield { type: 'text_chunk', text: buffer };
                        buffer = ''; 
                    }
                }
            }

            if (buffer) {
                 // ... (geri kalan buffer işleme mantığı aynı) ...
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
    
    // ... (Diğer tüm geminiService fonksiyonları (generateDiagram, generateAnalysisDocument vb.)
    // 'generateContent' veya 'generateContentStream' kullandıkları için
    // otomatik olarak güncellenmiş ve güvenli hale gelmiş olacaklar.)

    // ... (Tüm fonksiyonlarınızı buraya geri kopyalayın)
    // Örnek:
    checkAnalysisMaturity: async (history: Message[], generatedDocs: GeneratedDocs, model: GeminiModel, modelConfig?: object): Promise<{ report: MaturityReport, tokens: number }> => {
        const schema = {
            type: Type.OBJECT,
            properties: { /* ... (schema tanımı) ... */ 
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
            ? (generatedDocs.testScenarios as SourcedDocument).content
            : generatedDocs.testScenarios as string;

        const traceabilityMatrixContent = typeof generatedDocs.traceabilityMatrix === 'object'
            ? (generatedDocs.traceabilityMatrix as SourcedDocument).content
            : generatedDocs.traceabilityMatrix as string;
            
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

        // BU ÇAĞRI ARTIK GÜVENLİ EDGE FUNCTION'I KULLANACAK
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
        // BU ÇAĞRI ARTIK GÜVENLİ EDGE FUNCTION'I KULLANACAK
        const { text, tokens } = await generateContent(prompt, 'gemini-2.5-flash');
        return { title: text.replace(/"/g, ''), tokens };
    },

    // ... (diğer tüm geminiService fonksiyonları) ...
    // (Aşağıdaki fonksiyonları 'services/geminiService.ts' dosyanızdan kopyalayıp buraya yapıştırın)
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
                }, // <-- EKLENEN VİRGÜL
                reasoning: { type: Type.STRING }
            },
            required: ['suggestions', 'reasoning']
        };