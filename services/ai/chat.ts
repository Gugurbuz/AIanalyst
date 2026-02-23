
import OpenAI from "openai";
import type { Message, GeminiModel, StreamChunk, GeneratedDocs, ThoughtProcess } from '../../types';
import { promptService } from '../promptService';
import { getApiKey, handleGeminiError } from './core';
import { ThoughtProcessSchema } from '../schemas';

const modelMapping: Record<GeminiModel, string> = {
    'gemini-2.0-flash': 'gpt-4o-mini',
    'gemini-2.5-flash': 'gpt-4o-mini',
    'gemini-2.0-pro': 'gpt-4o',
    'gemini-exp-1206': 'gpt-4o',
};

const getOpenAIModel = (geminiModel: GeminiModel): string => {
    return modelMapping[geminiModel] || 'gpt-4o-mini';
};

export const tools = [
    {
        type: 'function',
        function: {
            name: 'generateAnalysisDocument',
            description: 'Kullanıcı bir dokümanı "güncelle", "oluştur", "yeniden yaz" veya "yeniden oluştur" gibi bir komut verdiğinde BU ARACI KULLAN. Araç, mevcut konuşma geçmişini ve talebi kullanarak tam bir iş analizi dokümanı JSON nesnesi üretir.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'saveRequestDocument',
            description: 'Kullanıcının ilk talebi netleştiğinde, bu talebi özetlemek ve "Talep Dokümanı" olarak OTOMATİK OLARAK KAYDETMEK için kullanılır. Kullanıcıdan onay isteme, doğrudan bu aracı çağır. Bu araç, sadece sohbetin başında, ilk talep oluşturulurken kullanılmalıdır.',
            parameters: {
                type: 'object',
                properties: {
                    request_summary: { type: 'string', description: 'Kullanıcının ilk talebinin kısa ve net bir özeti.' }
                },
                required: ['request_summary'],
            },
        }
    },
    {
        type: 'function',
        function: {
            name: 'generateTestScenarios',
            description: 'Kullanıcı test senaryoları oluşturulmasını istediğinde veya analiz dokümanı yeterince olgunlaştığında bu aracı kullan. Mevcut analiz dokümanından test senaryoları oluşturur.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'generateTraceabilityMatrix',
            description: 'Kullanıcı gereksinimler ve testler arasında bir izlenebilirlik matrisi istediğinde veya hem analiz hem de test dokümanları mevcut olduğunda bu aracı kullan.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'generateVisualization',
            description: 'Kullanıcı süreç akışını görselleştirmek istediğinde veya bir süreci "çiz", "görselleştir" veya "diyagramını yap" dediğinde bu aracı kullan.',
            parameters: { type: 'object', properties: {} },
        }
    }
];

export const convertMessagesToOpenAIFormat = (history: Message[]): any[] => {
    const relevantMessages = history.filter(msg =>
        msg &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        ((typeof msg.content === 'string' && msg.content.trim() !== '') || (msg as any).imageUrl)
    );

    if (relevantMessages.length === 0) return [];

    return relevantMessages.map(msg => {
        const content: any[] = [];

        if (msg.content && typeof msg.content === 'string' && !msg.content.startsWith('data:image/')) {
            content.push({ type: 'text', text: msg.content });
        }

        if ((msg as any).base64Image) {
            content.push({
                type: 'image_url',
                image_url: {
                    url: `data:${(msg as any).imageMimeType || 'image/jpeg'};base64,${(msg as any).base64Image}`
                }
            });
        }

        return {
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: content.length === 1 && content[0].type === 'text' ? content[0].text : content
        };
    });
};

export async function* parseStreamingResponse(stream: any): AsyncGenerator<StreamChunk> {
    let buffer = '';
    let thoughtYielded = false;
    let totalTokens = 0;

    for await (const chunk of stream) {
        if (chunk.choices?.[0]?.finish_reason) {
            if (totalTokens > 0) {
                yield { type: 'usage_update', tokens: totalTokens };
            }
        }

        const toolCalls = chunk.choices?.[0]?.delta?.tool_calls;
        if (toolCalls) {
            for (const tc of toolCalls) {
                if (tc.function?.name) {
                    const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
                    yield { type: 'function_call', name: tc.function.name, args };
                }
            }
        }

        const delta = chunk.choices?.[0]?.delta?.content;
        if (!delta) continue;

        buffer += delta;

        if (!thoughtYielded) {
            const startTag = '<dusunce>';
            const endTag = '</dusunce>';
            const startIdx = buffer.indexOf(startTag);
            const endIdx = buffer.indexOf(endTag);

            if (startIdx !== -1 && endIdx !== -1) {
                const jsonStr = buffer.substring(startIdx + startTag.length, endIdx);
                try {
                    const parsedJson = JSON.parse(jsonStr);
                    const validation = ThoughtProcessSchema.safeParse(parsedJson);

                    if (validation.success) {
                        yield { type: 'thought_chunk', payload: validation.data };
                    } else {
                        console.warn("Thought process validation failed:", validation.error);
                        yield { type: 'thought_chunk', payload: parsedJson as ThoughtProcess };
                    }

                    thoughtYielded = true;
                    const remainingText = buffer.substring(endIdx + endTag.length);
                    if (remainingText) {
                        yield { type: 'text_chunk', text: remainingText };
                    }
                    buffer = '';
                } catch (e) {
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
        const openai = new OpenAI({
            apiKey: getApiKey(),
            dangerouslyAllowBrowser: true
        });

        const hasRequestDoc = !!generatedDocs.requestDoc?.content?.trim();
        const hasRealAnalysisDoc = !!generatedDocs.analysisDoc?.content && !generatedDocs.analysisDoc.content.includes("Bu bölüme projenin temel hedefini");
        const isStartingConversation = !hasRequestDoc && !hasRealAnalysisDoc && history.filter(m => m && m.role !== 'system').length <= 1;

        const systemInstruction = isStartingConversation
            ? promptService.getPrompt('continueConversation')
            : promptService.getPrompt('proactiveAnalystSystemInstruction')
                .replace('{analysis_document_content}', generatedDocs.analysisDoc?.content || "...")
                .replace('{request_document_content}', generatedDocs.requestDoc?.content || "...");

        const messages = convertMessagesToOpenAIFormat(history);
        const openaiModel = getOpenAIModel(model);

        const responseStream = await openai.chat.completions.create({
            model: openaiModel,
            messages: [
                { role: 'system', content: systemInstruction },
                ...messages
            ],
            tools: isSearchEnabled ? undefined : tools as any,
            stream: true,
            temperature: 0.7,
        });

        yield* parseStreamingResponse(responseStream);
    } catch (error) {
        handleGeminiError(error);
    }
};
