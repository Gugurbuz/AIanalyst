import { geminiService } from './geminiService';
import { openaiService } from './openaiService';
import { promptService } from './promptService';
import type {
    Message,
    GeneratedDocs,
    StreamChunk,
    AIProvider,
    AIModel,
    GeminiModel,
    OpenAIModel
} from '../types';

const isGeminiModel = (model: AIModel): model is GeminiModel => {
    return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'].includes(model);
};

const isOpenAIModel = (model: AIModel): model is OpenAIModel => {
    return ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'].includes(model);
};

export const aiService = {
    handleUserMessageStream: async function* (
        history: Message[],
        generatedDocs: GeneratedDocs,
        templates: { analysis: string; test: string; traceability: string; visualization: string },
        provider: AIProvider,
        model: AIModel
    ): AsyncGenerator<StreamChunk> {
        if (provider === 'openai' && isOpenAIModel(model)) {
            const hasRequestDoc = !!generatedDocs.requestDoc?.trim();
            const hasRealAnalysisDoc = !!generatedDocs.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");
            const isStartingConversation = !hasRequestDoc && !hasRealAnalysisDoc && history.filter(m => m.role !== 'system').length <= 1;

            const systemInstruction = isStartingConversation
                ? promptService.getPrompt('continueConversation')
                : promptService.getPrompt('proactiveAnalystSystemInstruction')
                    .replace('{analysis_document_content}', generatedDocs.analysisDoc || "...")
                    .replace('{request_document_content}', generatedDocs.requestDoc || "...");

            yield* openaiService.generateContentStream(history, systemInstruction, model);
        } else if (provider === 'gemini' && isGeminiModel(model)) {
            yield* geminiService.handleUserMessageStream(history, generatedDocs, templates, model);
        } else {
            yield { type: 'error', message: 'Geçersiz model veya provider seçimi' };
        }
    },

    generateContent: async (
        prompt: string,
        provider: AIProvider,
        model: AIModel
    ): Promise<{ text: string, tokens: number }> => {
        if (provider === 'openai' && isOpenAIModel(model)) {
            return await openaiService.generateContent(prompt, model);
        } else if (provider === 'gemini' && isGeminiModel(model)) {
            const geminiModule = await import('./geminiService');
            return { text: '', tokens: 0 };
        } else {
            throw new Error('Geçersiz model veya provider seçimi');
        }
    }
};
