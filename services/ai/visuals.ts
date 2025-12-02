
import { GoogleGenAI } from "@google/genai";
import type { GeminiModel } from '../../types';
import { getApiKey, handleGeminiError, generateContent } from './core';
import { promptService } from '../promptService';

export const editImage = async (base64Data: string, mimeType: string, prompt: string): Promise<{ base64Image: string, tokens: number }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: mimeType } },
              { text: prompt },
            ],
          },
        });
        
        // FIX: Add safety checks for response structure including optional chaining for candidates[0]
        if (response.candidates && response.candidates.length > 0 && response.candidates[0]?.content && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                return { base64Image: part.inlineData.data, tokens: response.usageMetadata?.totalTokenCount || 0 };
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
    const { text, tokens } = await generateContent(prompt, 'gemini-2.5-pro');
    const newXml = text.replace(/```(xml)?\s*|\s*```/g, '').trim();
    return { newXml, tokens };
};
