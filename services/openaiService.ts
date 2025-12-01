import OpenAI from 'openai';
import type { OpenAIModel, Message, ThoughtProcess, StreamChunk } from '../types';

const getOpenAIClient = () => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API anahtarı bulunamadı. Lütfen .env dosyasında VITE_OPENAI_API_KEY değişkenini ayarlayın.');
    }
    return new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true
    });
};

const convertMessagesToOpenAIFormat = (history: Message[]) => {
    return history
        .filter(msg => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string' && msg.content.trim() !== '')
        .map(msg => ({
            role: msg.role,
            content: msg.content
        }));
};

export const openaiService = {
    generateContentStream: async function* (
        messages: Message[],
        systemPrompt: string,
        model: OpenAIModel = 'gpt-4-turbo'
    ): AsyncGenerator<StreamChunk> {
        try {
            const client = getOpenAIClient();
            const openaiMessages = convertMessagesToOpenAIFormat(messages);

            const stream = await client.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...openaiMessages
                ],
                stream: true,
            });

            let buffer = '';
            let thoughtYielded = false;
            let totalTokens = 0;

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content;

                if (delta) {
                    buffer += delta;

                    if (!thoughtYielded) {
                        const startMarker = '```thinking';
                        const endMarker = '```';
                        const startIdx = buffer.indexOf(startMarker);

                        if (startIdx !== -1) {
                            const searchStart = startIdx + startMarker.length;
                            const endIdx = buffer.indexOf(endMarker, searchStart);

                            if (endIdx !== -1) {
                                const jsonStr = buffer.substring(searchStart, endIdx).trim();
                                try {
                                    const thoughtPayload: ThoughtProcess = JSON.parse(jsonStr);
                                    yield { type: 'thought_chunk', payload: thoughtPayload };
                                    thoughtYielded = true;
                                    const remainingText = buffer.substring(endIdx + endMarker.length);
                                    if (remainingText.trim()) {
                                        yield { type: 'text_chunk', text: remainingText };
                                    }
                                    buffer = '';
                                } catch (e) {
                                    console.log("Failed to parse thought JSON (incomplete):", e);
                                }
                            }
                        }
                    } else {
                        yield { type: 'text_chunk', text: buffer };
                        buffer = '';
                    }
                }

                if (chunk.usage) {
                    totalTokens = chunk.usage.total_tokens;
                }
            }

            if (buffer) {
                if (!thoughtYielded) {
                    const startMarker = '```thinking';
                    const endMarker = '```';
                    const startIdx = buffer.indexOf(startMarker);

                    if (startIdx !== -1) {
                        const searchStart = startIdx + startMarker.length;
                        const endIdx = buffer.indexOf(endMarker, searchStart);

                        if (endIdx !== -1) {
                            const jsonStr = buffer.substring(searchStart, endIdx).trim();
                            try {
                                const thoughtPayload: ThoughtProcess = JSON.parse(jsonStr);
                                yield { type: 'thought_chunk', payload: thoughtPayload };
                                const remainingText = buffer.substring(endIdx + endMarker.length).trim();
                                if (remainingText) {
                                    yield { type: 'text_chunk', text: remainingText };
                                }
                            } catch(e) {
                                yield { type: 'text_chunk', text: buffer };
                            }
                        } else {
                            yield { type: 'text_chunk', text: buffer };
                        }
                    } else {
                        yield { type: 'text_chunk', text: buffer };
                    }
                } else {
                    yield { type: 'text_chunk', text: buffer };
                }
            }

            if (totalTokens > 0) {
                yield { type: 'usage_update', tokens: totalTokens };
            }

        } catch (error: any) {
            console.error('OpenAI API Error:', error);
            const message = error?.message || 'OpenAI API ile iletişimde hata oluştu';
            yield { type: 'error', message };
        }
    },

    generateContent: async (
        prompt: string,
        model: OpenAIModel = 'gpt-4-turbo'
    ): Promise<{ text: string, tokens: number }> => {
        try {
            const client = getOpenAIClient();

            const response = await client.chat.completions.create({
                model: model,
                messages: [
                    { role: 'user', content: prompt }
                ],
            });

            const text = response.choices[0]?.message?.content || '';
            const tokens = response.usage?.total_tokens || 0;

            return { text, tokens };
        } catch (error: any) {
            console.error('OpenAI API Error:', error);
            throw new Error(error?.message || 'OpenAI API ile iletişimde hata oluştu');
        }
    }
};
