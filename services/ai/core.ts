import type { GeminiModel } from '../../types';

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

export function handleGeminiError(error: any): never {
    console.error("OpenAI API Hatasi:", error);
    const message = (error?.message || String(error)).toLowerCase();
    if (message.includes('429') || message.includes('quota') || message.includes('rate limit')) throw new Error("API Kota Limiti Asildi.");
    if (message.includes('api key') || message.includes('authentication')) throw new Error("Gecersiz API Anahtari.");
    if (message.includes('internal error') || message.includes('server error')) throw new Error("OpenAI API'sinde gecici bir ic hata olustu.");
    if (message.includes('network error')) throw new Error("Ag baglanti hatasi.");
    throw new Error(`Beklenmedik bir hata olustu: ${error?.message || error}`);
}

export const generateContent = async (prompt: string, model: GeminiModel, modelConfig?: any): Promise<{ text: string, tokens: number }> => {
    try {
        const openaiModel = getOpenAIModel(model);
        const temperature = modelConfig?.temperature ?? 0.7;
        const maxTokens = modelConfig?.maxOutputTokens ?? 8000;

        const response = await fetch(`${SUPABASE_URL}/functions/v1/openai-proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                model: openaiModel,
                messages: [{ role: 'user', content: prompt }],
                temperature,
                max_tokens: maxTokens,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        const tokens = data.usage?.total_tokens || 0;
        return { text, tokens };
    } catch (error) {
        handleGeminiError(error);
    }
};

export const generateContentStream = async function* (prompt: string, model: GeminiModel, modelConfig?: any): AsyncGenerator<any> {
    try {
        const openaiModel = getOpenAIModel(model);
        const temperature = modelConfig?.temperature ?? 0.7;
        const maxTokens = modelConfig?.maxOutputTokens ?? 8000;

        const response = await fetch(`${SUPABASE_URL}/functions/v1/openai-proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                model: openaiModel,
                messages: [{ role: 'user', content: prompt }],
                temperature,
                max_tokens: maxTokens,
                stream: true,
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

        const decoder = new TextDecoder();
        let buffer = '';

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
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta?.content;
                        if (delta) {
                            yield {
                                text: delta,
                                usageMetadata: {
                                    totalTokenCount: 0
                                }
                            };
                        }
                    } catch {}
                }
            }
        }
    } catch (error) {
        handleGeminiError(error);
    }
};
