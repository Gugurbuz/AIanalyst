import type { GeminiModel } from '../../types';
import { handleGeminiError, generateContent } from './core';
import { promptService } from '../promptService';

const SUPABASE_URL = 'https://mjrshqlpomrezudlpmoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcnNocWxwb21yZXp1ZGxwbW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzY1MDcsImV4cCI6MjA3NzM1MjUwN30.CY46g7Qnua63CrsWteAAFvMHeU75hwfZzeLfjOKCKNI';

export const editImage = async (base64Data: string, mimeType: string, prompt: string): Promise<{ base64Image: string, tokens: number }> => {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                model: 'gemini-2.5-flash-preview-05-20',
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType: mimeType } },
                        { text: prompt },
                    ],
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0 && data.candidates[0]?.content && data.candidates[0]?.content?.parts) {
            for (const part of data.candidates[0].content.parts) {
                if (part.inlineData) {
                    return { base64Image: part.inlineData.data, tokens: data.usageMetadata?.totalTokenCount || 0 };
                }
            }
        }

        throw new Error("AI did not return an image. Check prompt safety or input format.");
    } catch (error) {
        handleGeminiError(error);
    }
};

export const generateDiagram = async (analysisDoc: string, template: string, model: GeminiModel): Promise<{ code: string, tokens: number }> => {
    const prompt = template.replace('{analysis_document_content}', analysisDoc);
    const { text, tokens } = await generateContent(prompt, model);
    const code = text.replace(/```(xml)?\s*|\s*```/g, '').trim();
    return { code, tokens };
};

export const updateBpmnDiagram = async (currentXml: string, userPrompt: string): Promise<{ newXml: string, tokens: number }> => {
    const prompt = promptService.getPrompt('updateBpmnDiagram')
        .replace('{user_prompt}', userPrompt)
        .replace('{current_xml}', currentXml);
    const { text, tokens } = await generateContent(prompt, 'gemini-2.0-pro');
    const newXml = text.replace(/```(xml)?\s*|\s*```/g, '').trim();
    return { newXml, tokens };
};
