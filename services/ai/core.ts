
import { GoogleGenAI } from "@google/genai";
import type { GeminiModel } from '../../types';

export const getApiKey = (): string => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("Gemini API Anahtarı ayarlanmamış.");
    return apiKey;
};

export function handleGeminiError(error: any): never {
    console.error("Gemini API Hatası:", error);
    const message = (error?.message || String(error)).toLowerCase();
    if (message.includes('429') || message.includes('quota')) throw new Error("API Kota Limiti Aşıldı.");
    if (message.includes('api key not valid')) throw new Error("Geçersiz API Anahtarı.");
    if (message.includes('internal error')) throw new Error("Gemini API'sinde geçici bir iç hata oluştu.");
    if (message.includes('network error')) throw new Error("Ağ bağlantı hatası.");
    throw new Error(`Beklenmedik bir hata oluştu: ${error?.message || error}`);
}

export const generateContent = async (prompt: string, model: GeminiModel, modelConfig?: any): Promise<{ text: string, tokens: number }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const config = modelConfig?.generationConfig || modelConfig;
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config,
        });
        const text = response.text;
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        return { text: text || '', tokens };
    } catch (error) {
        handleGeminiError(error);
    }
};

export const generateContentStream = async function* (prompt: string, model: GeminiModel, modelConfig?: any): AsyncGenerator<any> {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const config = modelConfig?.generationConfig || modelConfig;
        const responseStream = await ai.models.generateContentStream({
            model,
            contents: prompt,
            config,
        });
        for await (const chunk of responseStream) yield chunk;
    } catch (error) {
        handleGeminiError(error);
    }
};
