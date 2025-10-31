// services/geminiService.ts

import { GoogleGenAI, Type, Content, FunctionDeclaration } from "@google/genai";
import type { Message, MaturityReport, TaskSuggestion, GeminiModel, FeedbackItem, GeneratedDocs } from '../types';
import { promptService } from './promptService'; // Import the new prompt service

/**
 * Parses Gemini API errors and throws a user-friendly error message.
 * @param error The original error caught from the API call.
 */
function handleGeminiError(error: any): never {
    console.error("Gemini API Hatası:", error);
    const errorMessage = error?.message || String(error);

    // 1. Check for the most specific error: Quota/Rate limit
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        throw new Error("API Kota Limiti Aşıldı: Mevcut kotanızı aştınız. Lütfen planınızı ve fatura detaylarınızı kontrol edin veya bir süre sonra tekrar deneyin. Daha fazla bilgi için: https://ai.google.dev/gemini-api/docs/rate-limits");
    }

    // 2. Check for other specific known errors
    if (errorMessage.includes('API key not valid')) {
        throw new Error("Geçersiz API Anahtarı. Lütfen Geliştirici Panelindeki ayarları kontrol edin veya ortam değişkenlerini yapılandırın.");
    }
    
    // 3. Generic fallback
    throw new Error(`Gemini API ile iletişim kurulamadı: ${errorMessage}`);
}


const generateContent = async (prompt: string, model: GeminiModel, modelConfig?: object): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("Gemini API Anahtarı ayarlanmamış. Uygulamanın düzgün çalışabilmesi için `API_KEY` ortam değişkeninin ayarlanması gerekiyor.");
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            ...(modelConfig && { config: modelConfig }),
        });
        return response.text;
    } catch (error) {
        handleGeminiError(error);
    }
};

const formatHistory = (history: Message[]): string => {
    return history.map(m => `${m.role === 'user' ? 'Kullanıcı' : m.role === 'assistant' ? 'Asistan' : 'Sistem'}: ${m.content}`).join('\n');
}

const convertMessagesToGeminiFormat = (history: Message[]): Content[] => {
    const relevantMessages = history.filter(msg => msg.role === 'user' || msg.role === 'assistant');

    if (relevantMessages.length === 0) {
        return [];
    }
    
    const processedMessages: Message[] = [];
    let currentMessage = { ...relevantMessages[0] }; 

    for (let i = 1; i < relevantMessages.length; i++) {
        const message = relevantMessages[i];
        if (message.role === currentMessage.role) {
            currentMessage.content += "\n\n" + message.content;
        } else {
            processedMessages.push(currentMessage);
            currentMessage = { ...message };
        }
    }
    processedMessages.push(currentMessage);

    return processedMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));
};

const tools: FunctionDeclaration[] = [
    {
        name: 'generateAnalysisDocument',
        description: 'Mevcut konuşma geçmişine dayanarak iş analizi dokümanını oluşturur veya günceller.',
        parameters: { type: Type.OBJECT, properties: {} } // No parameters needed, uses conversation context
    },
    {
        name: 'generateTestScenarios',
        description: 'Mevcut iş analizi dokümanına dayanarak test senaryoları oluşturur veya günceller.',
        parameters: { type: Type.OBJECT, properties: {} } // No parameters needed
    },
    {
        name: 'generateVisualization',
        description: 'Mevcut iş analizi dokümanına dayanarak süreç akışını açıklayan bir metin oluşturur veya günceller.',
        parameters: { type: Type.OBJECT, properties: {} } // No parameters needed
    }
];

export const geminiService = {
    continueConversation: async (history: Message[], model: GeminiModel): Promise<string> => {
        if (!process.env.API_KEY) {
            throw new Error("Gemini API Anahtarı ayarlanmamış. Uygulamanın düzgün çalışabilmesi için `API_KEY` ortam değişkeninin ayarlanması gerekiyor.");
        }
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const systemInstruction = promptService.getPrompt('continueConversation');
            const geminiHistory = convertMessagesToGeminiFormat(history);

            const response = await ai.models.generateContent({
                model: model,
                contents: geminiHistory,
                config: {
                    systemInstruction: systemInstruction,
                }
            });
            return response.text;
        } catch (error) {
            handleGeminiError(error);
        }
    },
    
    checkAnalysisMaturity: async (history: Message[], model: GeminiModel, modelConfig?: object): Promise<MaturityReport> => {
        const schema = {
            type: Type.OBJECT,
            properties: {
                isSufficient: { type: Type.BOOLEAN },
                summary: { type: Type.STRING },
                missingTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['isSufficient', 'summary', 'missingTopics', 'suggestedQuestions']
        };
        
        const basePrompt = promptService.getPrompt('checkAnalysisMaturity');
        const prompt = `${basePrompt}\n\nKonuşma Geçmişi:\n${formatHistory(history)}`;
        
        const config = { responseMimeType: "application/json", responseSchema: schema, ...modelConfig };

        const jsonString = await generateContent(prompt, model, config);
        try {
            return JSON.parse(jsonString) as MaturityReport;
        } catch (e) {
            console.error("Failed to parse maturity report JSON:", e, "Received string:", jsonString);
            throw new Error("Analiz olgunluk raporu ayrıştırılamadı.");
        }
    },

    generateAnalysisDocument: async (history: Message[], templateId: string, model: GeminiModel, modelConfig?: object): Promise<string> => {
        const templatePrompt = promptService.getPrompt(templateId);
        const prompt = `${templatePrompt}\n\n**TALİMAT:**\nDokümanı yalnızca ve yalnızca aşağıda sağlanan konuşma geçmişine dayanarak oluştur.\n\n**Konuşma Geçmişi:**\n${formatHistory(history)}`;
        return generateContent(prompt, model, modelConfig);
    },

    generateTestScenarios: async (analysisDocument: string, templateId: string, model: GeminiModel, modelConfig?: object): Promise<string> => {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini")) {
            throw new Error("Lütfen önce geçerli bir analiz dokümanı oluşturun.");
        }
        const templatePrompt = promptService.getPrompt(templateId);
        const prompt = `${templatePrompt}\n\n**TALİMAT:**\nTest senaryolarını yalnızca aşağıda sağlanan İş Analizi Dokümanına dayanarak oluştur.\n\n**İş Analizi Dokümanı:**\n'${analysisDocument}'`;
        return generateContent(prompt, model, modelConfig);
    },
    
    generateTraceabilityMatrix: async (analysisDocument: string, testScenarios: string, model: GeminiModel, modelConfig?: object): Promise<string> => {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini") || !testScenarios) {
            throw new Error("Lütfen önce geçerli bir analiz dokümanı ve test senaryoları oluşturun.");
        }
        const templatePrompt = promptService.getPrompt('generateTraceabilityMatrix');
        const prompt = `${templatePrompt}\n\n**İş Analizi Dokümanı:**\n'${analysisDocument}'\n\n**Test Senaryoları Dokümanı:**\n'${testScenarios}'`;
        return generateContent(prompt, model, modelConfig);
    },

    generateConversationTitle: async (firstMessage: string): Promise<string> => {
        const basePrompt = promptService.getPrompt('generateConversationTitle');
        const prompt = `${basePrompt}: "${firstMessage}"`;
        const title = await generateContent(prompt, 'gemini-2.5-flash-lite');
        return title.replace(/["*]/g, '').trim();
    },

    generateDiagram: async (analysisDocument: string, diagramType: 'mermaid' | 'bpmn', model: GeminiModel, modelConfig?: object): Promise<string> => {
        if (!analysisDocument || analysisDocument.includes("Bu bölüme projenin temel hedefini")) {
           throw new Error("Lütfen önce geçerli bir analiz dokümanı oluşturun.");
       }
       
       const promptId = diagramType === 'bpmn' ? 'generateBPMN' : 'generateVisualization';
       const basePrompt = promptService.getPrompt(promptId);
       
       const prompt = `
           ${basePrompt}
           ---
           **İş Analizi Dokümanı:**
           \`\`\`
           ${analysisDocument}
           \`\`\`
       `;
       const result = await generateContent(prompt, model, modelConfig);
       
       if (diagramType === 'mermaid') {
           const mermaidMatch = result.match(/```mermaid\n([\s\S]*?)\n```/);
           return mermaidMatch ? mermaidMatch[1].trim() : result.trim();
       } else { // BPMN
           const xmlMatch = result.match(/```xml\n([\s\S]*?)\n```/);
           return xmlMatch ? xmlMatch[1].trim() : result.trim();
       }
   },

   modifyDiagram: async (currentCode: string, userPrompt: string, model: GeminiModel, diagramType: 'mermaid' | 'bpmn', modelConfig?: object): Promise<string> => {
    const promptId = diagramType === 'bpmn' ? 'modifyBPMN' : 'modifyVisualization';
    const systemPrompt = promptService.getPrompt(promptId);
    
    const codeBlockType = diagramType === 'bpmn' ? 'xml' : 'mermaid';
    const fullPrompt = `
        **Mevcut ${diagramType.toUpperCase()} Kodu:**
        \`\`\`${codeBlockType}
        ${currentCode}
        \`\`\`

        ---
        **Kullanıcı Talimatı:**
        "${userPrompt}"
    `;

    if (!process.env.API_KEY) {
        throw new Error("Gemini API Anahtarı ayarlanmamış. Uygulamanın düzgün çalışabilmesi için `API_KEY` ortam değişkeninin ayarlanması gerekiyor.");
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model,
            contents: fullPrompt,
            config: {
                systemInstruction: systemPrompt,
                ...modelConfig,
            }
        });
        const result = response.text;

        const codeMatch = result.match(new RegExp("```" + codeBlockType + "\\n([\\s\\S]*?)\\n```"));
        return codeMatch ? codeMatch[1].trim() : result.trim();
    } catch (error) {
        handleGeminiError(error);
    }
},


    rephraseText: async (textToRephrase: string): Promise<string> => {
        const prompt = promptService.getPrompt('rephraseText');
        const fullPrompt = `${prompt}\n\n**Yeniden Yazılacak Metin:**\n"${textToRephrase}"`;
        const rephrased = await generateContent(fullPrompt, 'gemini-2.5-flash-lite');
        return rephrased.replace(/["*]/g, '').trim();
    },

    modifySelectedText: async (originalText: string, userPrompt: string): Promise<string> => {
        const systemPrompt = promptService.getPrompt('modifySelectedText');
        const fullPrompt = `**Orijinal Metin:**\n\`\`\`\n${originalText}\n\`\`\`\n\n**Talimat:**\n${userPrompt}`;
        
        if (!process.env.API_KEY) {
            throw new Error("Gemini API Anahtarı ayarlanmamış. Uygulamanın düzgün çalışabilmesi için `API_KEY` ortam değişkeninin ayarlanması gerekiyor.");
        }
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    systemInstruction: systemPrompt,
                }
            });
            return response.text.trim();
        } catch (error) {
            handleGeminiError(error);
        }
    },


    analyzeFeedback: async (feedbackItems: FeedbackItem[]): Promise<string> => {
        const basePrompt = promptService.getPrompt('analyzeFeedback');
        const formattedFeedback = feedbackItems
            .map(item => {
                const feedback = item.message.feedback;
                if (!feedback || !feedback.rating) return null;
                const ratingText = feedback.rating === 'up' ? 'Beğenildi' : 'Beğenilmedi';
                const commentText = feedback.comment ? `Yorum: "${feedback.comment}"` : 'Yorum yok.';
                return `- Oylama: ${ratingText}, ${commentText}`;
            })
            .filter(Boolean)
            .join('\n');

        if (!formattedFeedback) {
            return "Analiz edilecek geri bildirim bulunmuyor.";
        }

        const prompt = `${basePrompt}\n\n**Analiz Edilecek Geri Bildirimler:**\n${formattedFeedback}`;
        return generateContent(prompt, 'gemini-2.5-flash');
    },

    generateTasksFromAnalysis: async (analysisDocument: string, model: GeminiModel, modelConfig?: object): Promise<TaskSuggestion[]> => {
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: 'Görevin kısa, eyleme yönelik başlığı.' },
                    description: { type: Type.STRING, description: 'Görevin detaylı açıklaması, genellikle ilgili fonksiyonel gereksinimi içerir.' },
                    priority: { type: Type.STRING, description: "Görevin öncelik seviyesi ('low', 'medium', 'high', 'critical')." }
                },
                required: ['title', 'description', 'priority']
            }
        };

        const basePrompt = promptService.getPrompt('generateTasksFromAnalysis');
        const prompt = `${basePrompt}\n\n**İş Analizi Dokümanı:**\n${analysisDocument}`;

        const config = { responseMimeType: "application/json", responseSchema: schema, ...modelConfig };

        const jsonString = await generateContent(prompt, model, config);
        try {
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed)) {
                return parsed as TaskSuggestion[];
            }
            if (typeof parsed === 'object' && parsed !== null) {
                const key = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
                if (key) {
                    return parsed[key] as TaskSuggestion[];
                }
            }
            throw new Error("JSON yanıtı beklenen formatta bir dizi içermiyor.");
        } catch (e) {
            console.error("Failed to parse task suggestions JSON:", e, "Received string:", jsonString);
            throw new Error("Görev önerileri ayrıştırılamadı.");
        }
    },

    suggestNextFeature: async (analysisDoc: string, history: Message[], model: GeminiModel, modelConfig?: object): Promise<string> => {
        const basePrompt = promptService.getPrompt('suggestNextFeature');
        const prompt = `
            ${basePrompt}

            ---
            **Mevcut İş Analizi Dokümanı:**
            \`\`\`
            ${analysisDoc}
            \`\`\`
            ---
            **Konuşma Geçmişi:**
            ${formatHistory(history)}
        `;
        return generateContent(prompt, model, modelConfig);
    },
    
    processAnalystMessage: async (
        history: Message[],
        currentDocs: GeneratedDocs,
        templates: { analysis: string; test: string },
        model: GeminiModel,
        modelConfig?: object
    ): Promise<{ type: 'chat'; content: string } | { type: 'doc_update'; docKey: 'analysisDoc' | 'testScenarios' | 'visualization'; content: string; confirmation: string }> => {
        if (!process.env.API_KEY) {
            throw new Error("Gemini API Anahtarı ayarlanmamış. Uygulamanın düzgün çalışabilmesi için `API_KEY` ortam değişkeninin ayarlanması gerekiyor.");
        }
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const systemInstruction = promptService.getPrompt('continueConversation');
            const geminiHistory = convertMessagesToGeminiFormat(history);

            const response = await ai.models.generateContent({
                model,
                contents: geminiHistory,
                config: {
                    systemInstruction: `${systemInstruction}. Kullanıcının amacı bir doküman oluşturmak veya güncellemek ise, uygun aracı çağır. Aksi takdirde, normal şekilde sohbet et.`,
                    tools: [{ functionDeclarations: tools }],
                    ...modelConfig,
                }
            });
            
            if (response.functionCalls && response.functionCalls.length > 0) {
                const call = response.functionCalls[0];
                let newContent = '';
                let docKey: 'analysisDoc' | 'testScenarios' | 'visualization' | null = null;
                let confirmation = '';

                switch (call.name) {
                    case 'generateAnalysisDocument':
                        docKey = 'analysisDoc';
                        newContent = await geminiService.generateAnalysisDocument(history, templates.analysis, model, modelConfig);
                        confirmation = "Elbette, analiz dokümanını konuşmamıza göre güncelledim.";
                        break;
                    case 'generateTestScenarios':
                        docKey = 'testScenarios';
                        newContent = await geminiService.generateTestScenarios(currentDocs.analysisDoc, templates.test, model, modelConfig);
                        confirmation = "Harika, test senaryolarını oluşturdum. 'Test Senaryoları' sekmesinden inceleyebilirsiniz.";
                        break;
                    case 'generateVisualization':
                        docKey = 'visualization';
                        const diagramType = currentDocs.visualizationType || 'mermaid';
                        newContent = await geminiService.generateDiagram(currentDocs.analysisDoc, diagramType, model, modelConfig);
                        confirmation = `İsteğiniz üzerine, süreç akışını '${diagramType === 'bpmn' ? 'BPMN' : 'Mermaid'}' formatında 'Görselleştirme' sekmesinde güncelledim.`;
                        break;
                    default:
                        // If an unknown tool is called, just provide a default chat response.
                        return { type: 'chat', content: "İstediğiniz işlemi anladım ancak şu an gerçekleştiremiyorum. Başka nasıl yardımcı olabilirim?" };
                }

                if (docKey) {
                    return { type: 'doc_update', docKey, content: newContent, confirmation };
                }
            }
            
            // If no function call, it's a regular chat message
            return { type: 'chat', content: response.text };

        } catch (error) {
            handleGeminiError(error);
        }
    },
};