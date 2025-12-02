
import { Type, Content, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { GoogleGenAI } from "@google/genai";
import type { Message, GeminiModel, StreamChunk, GeneratedDocs, GroundingChunk, ThoughtProcess } from '../../types';
import { promptService } from '../promptService';
import { getApiKey, handleGeminiError } from './core';
import { ThoughtProcessSchema } from '../schemas';

export const tools: FunctionDeclaration[] = [
    {
        name: 'generateAnalysisDocument',
        description: 'Kullanıcı bir dokümanı "güncelle", "oluştur", "yeniden yaz" veya "yeniden oluştur" gibi bir komut verdiğinde BU ARACI KULLAN. Araç, mevcut konuşma geçmişini ve talebi kullanarak tam bir iş analizi dokümanı JSON nesnesi üretir.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'saveRequestDocument',
        description: 'Kullanıcının ilk talebi netleştiğinde, bu talebi özetlemek ve "Talep Dokümanı" olarak OTOMATİK OLARAK KAYDETMEK için kullanılır. Kullanıcıdan onay isteme, doğrudan bu aracı çağır. Bu araç, sadece sohbetin başında, ilk talep oluşturulurken kullanılmalıdır.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                request_summary: { type: Type.STRING, description: 'Kullanıcının ilk talebinin kısa ve net bir özeti.' }
            },
            required: ['request_summary'],
        },
    },
    {
        name: 'generateTestScenarios',
        description: 'Kullanıcı test senaryoları oluşturulmasını istediğinde veya analiz dokümanı yeterince olgunlaştığında bu aracı kullan. Mevcut analiz dokümanından test senaryoları oluşturur.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'generateTraceabilityMatrix',
        description: 'Kullanıcı gereksinimler ve testler arasında bir izlenebilirlik matrisi istediğinde veya hem analiz hem de test dokümanları mevcut olduğunda bu aracı kullan.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'generateVisualization',
        description: 'Kullanıcı süreç akışını görselleştirmek istediğinde veya bir süreci "çiz", "görselleştir" veya "diyagramını yap" dediğinde bu aracı kullan.',
        parameters: { type: Type.OBJECT, properties: {} },
    }
];

export const convertMessagesToGeminiFormat = (history: Message[]): Content[] => {
    // FIX: Filter out null/undefined messages or empty content before mapping to prevent 'Cannot read properties of null'
    // Ensure 'content' exists and is not null before checking trimmed length if string
    const relevantMessages = history.filter(msg => 
        msg && 
        (msg.role === 'user' || msg.role === 'assistant') && 
        ((typeof msg.content === 'string' && msg.content.trim() !== '') || msg.imageUrl)
    );
    
    if (relevantMessages.length === 0) return [];
    
    return relevantMessages.map(msg => {
        const parts: any[] = [];
        // Safety check for content
        if (msg.content && typeof msg.content === 'string' && !msg.content.startsWith('data:image/')) {
             parts.push({ text: msg.content });
        }
        // Safety check for image properties
        if ((msg as any).base64Image && (msg as any).imageMimeType) {
             parts.push({
                inlineData: {
                    mimeType: (msg as any).imageMimeType,
                    data: (msg as any).base64Image
                }
            });
        }
        return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: parts
        };
    });
};

export async function* parseStreamingResponse(stream: AsyncGenerator<GenerateContentResponse>): AsyncGenerator<StreamChunk> {
    let buffer = '';
    let thoughtYielded = false;

    for await (const chunk of stream) {
        if (chunk.usageMetadata) {
            yield { type: 'usage_update', tokens: chunk.usageMetadata.totalTokenCount };
        }
        if (chunk.functionCalls) {
            for (const fc of chunk.functionCalls) {
                yield { type: 'function_call', name: fc.name, args: fc.args };
            }
        }
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const chunks = chunk.candidates[0].groundingMetadata.groundingChunks;
            if (Array.isArray(chunks)) {
                yield { type: 'grounding_chunk', payload: chunks as GroundingChunk[] };
            }
        }
        if (!chunk.text) continue;

        buffer += chunk.text;
        
        if (!thoughtYielded) {
            const startTag = '<dusunce>';
            const endTag = '</dusunce>';
            const startIdx = buffer.indexOf(startTag);
            const endIdx = buffer.indexOf(endTag);

            if (startIdx !== -1 && endIdx !== -1) {
                const jsonStr = buffer.substring(startIdx + startTag.length, endIdx);
                try {
                    const parsedJson = JSON.parse(jsonStr);
                    // Validate with Zod
                    const validation = ThoughtProcessSchema.safeParse(parsedJson);
                    
                    if (validation.success) {
                        yield { type: 'thought_chunk', payload: validation.data };
                    } else {
                        console.warn("Thought process validation failed:", validation.error);
                        // Fallback: yield what we have if it looks somewhat correct, or skip
                        // Ideally we should handle this error gracefully. 
                        // For now, let's assume if it parses as JSON it's 'okayish' but log warning.
                        yield { type: 'thought_chunk', payload: parsedJson as ThoughtProcess }; 
                    }

                    thoughtYielded = true;
                    const remainingText = buffer.substring(endIdx + endTag.length);
                    if (remainingText) {
                        yield { type: 'text_chunk', text: remainingText };
                    }
                    buffer = '';
                } catch (e) {
                    // JSON might be incomplete
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

export const handleUserMessageStream = async function* (history: Message[], generatedDocs: GeneratedDocs, templates: any, model: GeminiModel, isSearchEnabled?: boolean): AsyncGenerator<StreamChunk> {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const hasRequestDoc = !!generatedDocs.requestDoc?.content?.trim();
        const hasRealAnalysisDoc = !!generatedDocs.analysisDoc?.content && !generatedDocs.analysisDoc.content.includes("Bu bölüme projenin temel hedefini");
        const isStartingConversation = !hasRequestDoc && !hasRealAnalysisDoc && history.filter(m => m && m.role !== 'system').length <= 1;

        const systemInstruction = isStartingConversation
            ? promptService.getPrompt('continueConversation')
            : promptService.getPrompt('proactiveAnalystSystemInstruction')
                // FIX: Use optional chaining and fallback for content to avoid [object Object] or undefined
                .replace('{analysis_document_content}', generatedDocs.analysisDoc?.content || "...")
                .replace('{request_document_content}', generatedDocs.requestDoc?.content || "...");
        
        const geminiHistory = convertMessagesToGeminiFormat(history);
        const lastUserMessage = history[history.length - 1];
        const hasImage = (lastUserMessage as any)?.base64Image;
        let modelToUse = (hasImage || model === 'gemini-2.5-pro') ? 'gemini-3-pro-preview' : (isSearchEnabled ? 'gemini-2.5-flash' : model);
        if (model === 'gemini-2.5-flash-lite') modelToUse = 'gemini-2.5-flash-lite';

        const toolsConfig = isSearchEnabled ? [{googleSearch: {}}] : [{ functionDeclarations: tools }];

        const responseStream = await ai.models.generateContentStream({
            model: modelToUse,
            contents: geminiHistory,
            config: {
                systemInstruction,
                tools: toolsConfig,
            },
        });

        yield* parseStreamingResponse(responseStream);
    } catch (error) {
        handleGeminiError(error);
    }
};
