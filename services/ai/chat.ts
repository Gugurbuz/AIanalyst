import type { Message, GeminiModel, StreamChunk, GeneratedDocs, ThoughtProcess } from '../../types';
import { promptService } from '../promptService';
import { handleGeminiError } from './core';
import { ThoughtProcessSchema } from '../schemas';

const SUPABASE_URL = 'https://mjrshqlpomrezudlpmoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcnNocWxwb21yZXp1ZGxwbW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzY1MDcsImV4cCI6MjA3NzM1MjUwN30.CY46g7Qnua63CrsWteAAFvMHeU75hwfZzeLfjOKCKNI';

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
            description: 'Kullanici bir dokumani "guncelle", "olustur", "yeniden yaz" veya "yeniden olustur" gibi bir komut verdiginde BU ARACI KULLAN. Arac, mevcut konusma gecmisini ve talebi kullanarak tam bir is analizi dokumani JSON nesnesi uretir.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'saveRequestDocument',
            description: 'Kullanicinin ilk talebi netlestiginde, bu talebi ozetlemek ve Talep Dokumani olarak OTOMATIK OLARAK KAYDETMEK icin kullanilir. Kullanicidan onay isteme, dogrudan bu araci cagir. Bu arac, sadece sohbetin basinda, ilk talep olusturulurken kullanilmalidir.',
            parameters: {
                type: 'object',
                properties: {
                    request_summary: { type: 'string', description: 'Kullanicinin ilk talebinin kisa ve net bir ozeti.' }
                },
                required: ['request_summary'],
            },
        }
    },
    {
        type: 'function',
        function: {
            name: 'generateTestScenarios',
            description: 'Kullanici test senaryolari olusturulmasini istediginde veya analiz dokumani yeterince olgunlastiginda bu araci kullan. Mevcut analiz dokumani ndan test senaryolari olusturur.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'generateTraceabilityMatrix',
            description: 'Kullanici gereksinimler ve testler arasinda bir izlenebilirlik matrisi istediginde veya hem analiz hem de test dokumanlari mevcut oldugunda bu araci kullan.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'generateVisualization',
            description: 'Kullanici surec akisini gorsellestirmek istediginde veya bir sureci "ciz", "gorsellestir" veya "diyagramini yap" dediginde bu araci kullan.',
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

export async function* parseStreamingResponse(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<StreamChunk> {
    const decoder = new TextDecoder();
    let buffer = '';
    let thoughtYielded = false;
    let textBuffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const chunk = JSON.parse(data);

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

                    textBuffer += delta;

                    if (!thoughtYielded) {
                        const startTag = '<dusunce>';
                        const endTag = '</dusunce>';
                        const startIdx = textBuffer.indexOf(startTag);
                        const endIdx = textBuffer.indexOf(endTag);

                        if (startIdx !== -1 && endIdx !== -1) {
                            const jsonStr = textBuffer.substring(startIdx + startTag.length, endIdx);
                            try {
                                const parsedJson = JSON.parse(jsonStr);
                                const validation = ThoughtProcessSchema.safeParse(parsedJson);

                                if (validation.success) {
                                    yield { type: 'thought_chunk', payload: validation.data };
                                } else {
                                    yield { type: 'thought_chunk', payload: parsedJson as ThoughtProcess };
                                }

                                thoughtYielded = true;
                                const remainingText = textBuffer.substring(endIdx + endTag.length);
                                if (remainingText) {
                                    yield { type: 'text_chunk', text: remainingText };
                                }
                                textBuffer = '';
                            } catch {}
                        }
                    } else {
                        yield { type: 'text_chunk', text: textBuffer };
                        textBuffer = '';
                    }
                } catch {}
            }
        }
    }

    if (textBuffer) {
        yield { type: 'text_chunk', text: textBuffer };
    }
}

export const handleUserMessageStream = async function* (history: Message[], generatedDocs: GeneratedDocs, templates: any, model: GeminiModel, isSearchEnabled?: boolean): AsyncGenerator<StreamChunk> {
    try {
        const hasRequestDoc = !!generatedDocs.requestDoc?.content?.trim();
        const hasRealAnalysisDoc = !!generatedDocs.analysisDoc?.content && !generatedDocs.analysisDoc.content.includes("Bu bolume projenin temel hedefini");
        const isStartingConversation = !hasRequestDoc && !hasRealAnalysisDoc && history.filter(m => m && m.role !== 'system').length <= 1;

        const systemInstruction = isStartingConversation
            ? promptService.getPrompt('continueConversation')
            : promptService.getPrompt('proactiveAnalystSystemInstruction')
                .replace('{analysis_document_content}', generatedDocs.analysisDoc?.content || "...")
                .replace('{request_document_content}', generatedDocs.requestDoc?.content || "...");

        const messages = convertMessagesToOpenAIFormat(history);
        const openaiModel = getOpenAIModel(model);

        const response = await fetch(`${SUPABASE_URL}/functions/v1/openai-proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                model: openaiModel,
                messages: [
                    { role: 'system', content: systemInstruction },
                    ...messages
                ],
                tools: isSearchEnabled ? undefined : tools,
                stream: true,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Stream not available');
        }

        yield* parseStreamingResponse(reader);
    } catch (error) {
        handleGeminiError(error);
    }
};
