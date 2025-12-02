
import type { FeedbackItem, Message } from '../../types';
import { generateContent } from './core';
import { promptService } from '../promptService';

export const analyzeFeedback = async (feedbackData: FeedbackItem[]): Promise<{ analysis: string, tokens: number }> => {
    const formattedFeedback = feedbackData.map(item =>
        `Sohbet: "${item.conversationTitle}"\nDeğerlendirme: ${item.message.feedback?.rating}\nYorum: ${item.message.feedback?.comment}\n---\n`
    ).join('\n');
    const prompt = `Aşağıdaki kullanıcı geri bildirimlerini analiz et. Ana temaları, sık karşılaşılan sorunları ve olumlu yönleri özetleyerek bir rapor hazırla. Önerilerde bulun.\n\n${formattedFeedback}`;
    const { text, tokens } = await generateContent(prompt, 'gemini-2.5-flash');
    return { analysis: text, tokens };
};

export const suggestNextFeature = async (analysisDoc: string, history: Message[]): Promise<{ suggestions: string[], tokens: number }> => {
    const conversationHistory = history.map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = promptService.getPrompt('suggestNextFeature')
        .replace('{analysis_document}', analysisDoc)
        .replace('{conversation_history}', conversationHistory);
    const { text, tokens } = await generateContent(prompt, 'gemini-2.5-flash', { config: { responseMimeType: "application/json" } });
    try {
        const parsed = JSON.parse(text);
        return { suggestions: parsed.suggestions || [], tokens };
    } catch (e) {
        return { suggestions: [], tokens };
    }
};

export const generateConversationTitle = async (text: string): Promise<{ title: string, tokens: number }> => {
    const prompt = promptService.getPrompt('generateConversationTitle') + `\n\nMETİN:\n---\n${text}\n---`;
    const { text: title, tokens } = await generateContent(prompt, 'gemini-2.5-flash-lite');
    return { title: title.replace(/["']/g, '').trim(), tokens };
};
