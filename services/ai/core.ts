
import OpenAI from "openai";
import type { GeminiModel } from '../../types';
import { supabase } from '../supabaseClient';

let cachedApiKey: string | null = null;

export const getApiKey = async (): Promise<string> => {
    if (cachedApiKey) return cachedApiKey;

    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'OPENAI_API_KEY')
        .maybeSingle();

    if (error) {
        console.error('Supabase settings error:', error);
        throw new Error("OpenAI API Anahtarı alınamadı.");
    }

    const apiKey = data?.value?.trim();
    if (!apiKey) {
        throw new Error("OpenAI API Anahtarı ayarlanmamış. Lütfen Developer Panel'den API anahtarınızı girin.");
    }

    cachedApiKey = apiKey;
    return apiKey;
};

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
    console.error("OpenAI API Hatası:", error);
    const message = (error?.message || String(error)).toLowerCase();
    if (message.includes('429') || message.includes('quota') || message.includes('rate limit')) throw new Error("API Kota Limiti Aşıldı.");
    if (message.includes('api key') || message.includes('authentication')) throw new Error("Geçersiz API Anahtarı.");
    if (message.includes('internal error') || message.includes('server error')) throw new Error("OpenAI API'sinde geçici bir iç hata oluştu.");
    if (message.includes('network error')) throw new Error("Ağ bağlantı hatası.");
    throw new Error(`Beklenmedik bir hata oluştu: ${error?.message || error}`);
}

export const generateContent = async (prompt: string, model: GeminiModel, modelConfig?: any): Promise<{ text: string, tokens: number }> => {
    try {
        const apiKey = await getApiKey();
        const openai = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true
        });

        const openaiModel = getOpenAIModel(model);
        const temperature = modelConfig?.temperature ?? 0.7;
        const maxTokens = modelConfig?.maxOutputTokens ?? 8000;

        const response = await openai.chat.completions.create({
            model: openaiModel,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            max_tokens: maxTokens,
        });

        const text = response.choices[0]?.message?.content || '';
        const tokens = response.usage?.total_tokens || 0;
        return { text, tokens };
    } catch (error) {
        handleGeminiError(error);
    }
};

export const generateContentStream = async function* (prompt: string, model: GeminiModel, modelConfig?: any): AsyncGenerator<any> {
    try {
        const apiKey = await getApiKey();
        const openai = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true
        });

        const openaiModel = getOpenAIModel(model);
        const temperature = modelConfig?.temperature ?? 0.7;
        const maxTokens = modelConfig?.maxOutputTokens ?? 8000;

        const stream = await openai.chat.completions.create({
            model: openaiModel,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            max_tokens: maxTokens,
            stream: true,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
                yield {
                    text: delta,
                    usageMetadata: {
                        totalTokenCount: 0
                    }
                };
            }
        }
    } catch (error) {
        handleGeminiError(error);
    }
};
