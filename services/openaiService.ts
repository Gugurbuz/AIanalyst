import type { OpenAIModel, Message, ThoughtProcess, StreamChunk } from '../types';

const getEdgeFunctionUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error('Supabase URL bulunamadı.');
    }
    return `${supabaseUrl}/functions/v1/openai-proxy`;
};

const getAuthHeaders = () => {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!anonKey) {
        throw new Error('Supabase anon key bulunamadı.');
    }
    return {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
    };
};

const convertMessagesToOpenAIFormat = (history: Message[]) => {
    return history
        .filter(msg => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string' && msg.content.trim() !== '')
        .map(msg => ({
            role: msg.role,
            content: msg.content
        }));
};

const FUNCTION_TOOLS = [
    {
        type: "function",
        function: {
            name: "generateAnalysisDocument",
            description: "Kullanıcı bir dokümanı 'güncelle', 'oluştur', 'yeniden yaz' veya 'yeniden oluştur' gibi bir komut verdiğinde bu aracı kullan.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "saveRequestDocument",
            description: "Kullanıcının ilk talebi netleştiğinde, bu talebi otomatik olarak kaydetmek için kullan.",
            parameters: {
                type: "object",
                properties: {
                    request_summary: { type: "string", description: "Kullanıcının ilk talebinin kısa ve net bir özeti." }
                },
                required: ["request_summary"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generateTestScenarios",
            description: "Test senaryoları oluşturmak için kullan.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "generateTraceabilityMatrix",
            description: "İzlenebilirlik matrisi oluşturmak için kullan.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "generateVisualization",
            description: "Süreç akışını görselleştirmek için kullan.",
            parameters: { type: "object", properties: {} }
        }
    }
];

export const openaiService = {
    generateContentStream: async function* (
        messages: Message[],
        systemPrompt: string,
        model: OpenAIModel = 'gpt-4-turbo'
    ): AsyncGenerator<StreamChunk> {
        try {
            const edgeFunctionUrl = getEdgeFunctionUrl();
            const headers = getAuthHeaders();
            const openaiMessages = convertMessagesToOpenAIFormat(messages);

            const response = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...openaiMessages
                    ],
                    tools: FUNCTION_TOOLS,
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'OpenAI API ile iletişimde hata oluştu');
            }

            if (!response.body) {
                throw new Error('Yanıt gövdesi alınamadı');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let buffer = '';
            let thoughtYielded = false;
            let totalTokens = 0;
            let functionCallBuffer = { name: '', arguments: '' };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n');

                for (const line of lines) {
                    if (!line.trim() || line.trim() === 'data: [DONE]') continue;

                    const jsonStr = line.replace(/^data: /, '').trim();
                    if (!jsonStr) continue;

                    try {
                        const chunk = JSON.parse(jsonStr);
                        const delta = chunk.choices?.[0]?.delta;

                        if (delta?.tool_calls && delta.tool_calls.length > 0) {
                            const toolCall = delta.tool_calls[0];
                            if (toolCall.function) {
                                if (toolCall.function.name) {
                                    functionCallBuffer.name = toolCall.function.name;
                                }
                                if (toolCall.function.arguments) {
                                    functionCallBuffer.arguments += toolCall.function.arguments;
                                }
                            }
                        }

                        const content = delta?.content;
                        if (content) {
                            buffer += content;

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
                    } catch (e) {
                        console.error('JSON parse error:', e);
                    }
                }
            }

            if (functionCallBuffer.name) {
                try {
                    const args = functionCallBuffer.arguments ? JSON.parse(functionCallBuffer.arguments) : {};
                    yield { type: 'function_call', name: functionCallBuffer.name, args };
                } catch (e) {
                    console.error('Failed to parse function arguments:', e);
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

    generateContent: async function(
        prompt: string,
        model: OpenAIModel = 'gpt-4-turbo'
    ): Promise<{ text: string, tokens: number }> {
        try {
            const edgeFunctionUrl = getEdgeFunctionUrl();
            const headers = getAuthHeaders();

            const response = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    stream: false,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'OpenAI API ile iletişimde hata oluştu');
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';
            const tokens = data.usage?.total_tokens || 0;

            return { text, tokens };
        } catch (error: any) {
            console.error('OpenAI API Error:', error);
            throw new Error(error?.message || 'OpenAI API ile iletişimde hata oluştu');
        }
    }
};
