// services/geminiService.ts

import { GoogleGenAI, Type, Content } from "@google/genai";
import type { Message, MaturityReport, TaskSuggestion, TaskPriority } from '../types';
import { promptService } from './promptService'; // Import the new prompt service

const MODEL_NAME = localStorage.getItem('devModelName') || 'gemini-2.5-flash';

const generateContent = async (prompt: string, modelConfig?: object): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API Anahtarı bulunamadı. Lütfen ortam değişkenlerini yapılandırın.");
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            ...(modelConfig && { config: modelConfig }),
        });
        return response.text;
    } catch (error) {
        console.error("Gemini API call failed:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('API key not valid')) {
             throw new Error("Geçersiz API Anahtarı. Lütfen ortam değişkenlerini kontrol edin.");
        }
        if (errorMessage.toLowerCase().includes('json')) {
            throw new Error(`Modelden geçersiz JSON yanıtı alındı. Lütfen tekrar deneyin.`);
        }
        throw new Error(`Gemini API ile iletişim kurulamadı: ${errorMessage}`);
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

const sanitizeMermaidCode = (code: string): string => {
    // This function programmatically quotes Mermaid node labels that contain special characters
    // like parentheses, which would otherwise cause a syntax error.
    
    // Regex for node definitions.
    // Captures: 1: ID (allows hyphens), 2: open bracket, 3: text, 4: close bracket
    const nodeRegexes = [
        /([\w-]+)(\[)([^\]\n]*?)(\])/g,      // Rectangular: A[text]
        /([\w-]+)(\()([^)\n]*?)(\))/g,      // Round edges: B(text)
        /([\w-]+)(\{)([^}\n]*?)(\})/g,      // Rhombus: C{text}
        /([\w-]+)(>)([^\]\n]*?)(\])/g,      // Stadium: D>text]
    ];

    let sanitizedCode = code;

    nodeRegexes.forEach(regex => {
        sanitizedCode = sanitizedCode.replace(regex, (match, id, open, text, close) => {
            // Check if the text is already properly quoted (handles leading/trailing spaces).
            if (text.trim().startsWith('"') && text.trim().endsWith('"')) {
                return match;
            }
            
            // Check if the text contains special characters that require quoting.
            if (/[()\[\]{}]/.test(text)) {
                // Escape any existing double quotes inside the text to avoid breaking the string.
                const sanitizedText = text.replace(/"/g, '#quot;');
                return `${id}${open}"${sanitizedText}"${close}`;
            }
            
            // If no special characters, return the original match.
            return match;
        });
    });

    return sanitizedCode;
};


export const geminiService = {
    continueConversation: async (history: Message[]): Promise<string> => {
        if (!process.env.API_KEY) {
            throw new Error("API Anahtarı bulunamadı. Lütfen ortam değişkenlerini yapılandırın.");
        }
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const systemInstruction = promptService.getPrompt('continueConversation');
            const geminiHistory = convertMessagesToGeminiFormat(history);

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: geminiHistory,
                config: {
                    systemInstruction: systemInstruction,
                }
            });
            return response.text;
        } catch (error) {
            console.error("Gemini API call failed in continueConversation:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('API key not valid')) {
                 throw new Error("Geçersiz API Anahtarı. Lütfen ortam değişkenlerini kontrol edin.");
            }
            throw new Error(`Gemini API ile iletişim kurulamadı: ${errorMessage}`);
        }
    },
    
    checkAnalysisMaturity: async (history: Message[]): Promise<MaturityReport> => {
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
        
        const modelConfig = { responseMimeType: "application/json", responseSchema: schema };

        const jsonString = await generateContent(prompt, modelConfig);
        try {
            return JSON.parse(jsonString) as MaturityReport;
        } catch (e) {
            console.error("Failed to parse maturity report JSON:", e, "Received string:", jsonString);
            throw new Error("Analiz olgunluk raporu ayrıştırılamadı.");
        }
    },

    generateAnalysisDocument: async (history: Message[], templateId: string): Promise<string> => {
        const templatePrompt = promptService.getPrompt(templateId);
        const prompt = `${templatePrompt}\n\n**TALİMAT:**\nDokümanı yalnızca ve yalnızca aşağıda sağlanan konuşma geçmişine dayanarak oluştur.\n\n**Konuşma Geçmişi:**\n${formatHistory(history)}`;
        return generateContent(prompt);
    },

    generateTestScenarios: async (analysisDocument: string, templateId: string): Promise<string> => {
        const templatePrompt = promptService.getPrompt(templateId);
        const prompt = `${templatePrompt}\n\n**TALİMAT:**\nTest senaryolarını yalnızca aşağıda sağlanan İş Analizi Dokümanına dayanarak oluştur.\n\n**İş Analizi Dokümanı:**\n'${analysisDocument}'`;
        return generateContent(prompt);
    },

    generateConversationTitle: async (firstMessage: string): Promise<string> => {
        const basePrompt = promptService.getPrompt('generateConversationTitle');
        const prompt = `${basePrompt}: "${firstMessage}"`;
        const title = await generateContent(prompt);
        return title.replace(/["*]/g, '').trim();
    },

    generateVisualization: async (analysisDocument: string, diagramType: string): Promise<string> => {
        const basePrompt = promptService.getPrompt('generateVisualization');
        // ... (rest of the function is the same, no changes needed here)
        const diagramTypeInstruction = {
            'auto': `
                **DİYAGRAM TÜRÜ SEÇİMİ:**
                - Doküman bir süreç veya iş akışı tanımlıyorsa, **akış şeması (flowchart)** kullan (\`graph TD\`).
                - Doküman, sistemler veya kullanıcılar arasında zaman sıralı bir etkileşim içeriyorsa, **sekans diyagramı (sequenceDiagram)** kullan.
                - Doküman, merkezi bir konsept etrafındaki fikirleri veya özellikleri araştırıyorsa, **zihin haritası (mindmap)** kullan.
                - Dokümanın içeriğine göre en uygun diyagram türünü kendin seç. Önceliğin akış şeması olsun.
            `,
            'flowchart': `
                **DİYAGRAM TÜRÜ SEÇİMİ:**
                - **SADECE** bir **akış şeması (flowchart)** kullanarak (\`graph TD\`) bir diyagram oluştur. Dokümandaki ana iş akışını veya süreci göster.
            `,
            'sequenceDiagram': `
                **DİYAGRAM TÜRÜ SEÇİMİ:**
                - **SADECE** bir **sekans diyagramı (sequenceDiagram)** kullanarak bir diyagram oluştur. Sistemler veya kullanıcılar arasındaki zaman sıralı etkileşimi göster.
            `,
            'mindmap': `
                **DİYAGRAM TÜRÜ SEÇİMİ:**
                - **SADECE** bir **zihin haritası (mindmap)** kullanarak bir diyagram oluştur. Merkezi bir konsept etrafındaki fikirleri veya özellikleri göster.
            `
        };
        const prompt = `
            ${basePrompt}
            ${diagramTypeInstruction[diagramType as keyof typeof diagramTypeInstruction] || diagramTypeInstruction['auto']}
            **KRİTİK KURALLAR:**
            1.  Çıktın **SADECE** ve **SADECE** seçtiğin diyagram türü için geçerli Mermaid.js sözdizimi içermelidir.
            2.  Sözdizimini \`\`\`mermaid ... \`\`\` kod bloğu içine ALMA. Sadece ham sözdizimini döndür.
            3.  **EN KRİTİK KURAL - OK SÖZDİZİMİ:** Bağlantılar için **ASLA** ikiden fazla tire (\`-\`) art arda kullanma. **SADECE** şu formatlara izin verilir: \`-->\` ve \`-- Metin -->\`. **ÖRNEK YANLIŞ KULLANIM:** \`A --- B\` **KESİNLİKLE YANLIŞTIR**. **ÖRNEK DOĞRU KULLANIM:** \`A --> B\`.
            4.  **EN ÖNEMLİ KURAL - DÜĞÜM METİNLERİ:** Düğüm (node) metinleri içerisinde parantez \`()\`, köşeli parantez \`[]\` gibi özel karakterler varsa, metni **MUTLAKA** çift tırnak içine almalısın. **ÖRNEK DOĞRU KULLANIM:** \`A["Bu bir (örnek) metindir"]\`. **ÖRNEK YANLIŞ KULLANIM:** \`A[Bu bir (örnek) metindir]\`.
            **İş Analizi Dokümanı:**
            \`\`\`
            ${analysisDocument}
            \`\`\`
        `;
         const rawMermaidCode = await generateContent(prompt);
         return sanitizeMermaidCode(rawMermaidCode);
    },

    // FIX: Implement the missing 'analyzeFeedback' function.
    analyzeFeedback: async (feedbackItems: { comment?: string; rating: 'up' | 'down' | null }[]): Promise<string> => {
        const basePrompt = promptService.getPrompt('analyzeFeedback');
        const formattedFeedback = feedbackItems.map(item => {
            if (!item.rating) return null; // Skip items without a rating
            const ratingText = item.rating === 'up' ? 'Beğenildi' : 'Beğenilmedi';
            const commentText = item.comment ? `Yorum: "${item.comment}"` : 'Yorum yok.';
            return `- Oylama: ${ratingText}, ${commentText}`;
        }).filter(Boolean).join('\n');

        if (!formattedFeedback) {
            return "Analiz edilecek geri bildirim bulunmuyor.";
        }

        const prompt = `${basePrompt}\n\n**Analiz Edilecek Geri Bildirimler:**\n${formattedFeedback}`;
        return generateContent(prompt);
    },

    generateTasksFromAnalysis: async (analysisDocument: string): Promise<TaskSuggestion[]> => {
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

        const modelConfig = { responseMimeType: "application/json", responseSchema: schema };

        const jsonString = await generateContent(prompt, modelConfig);
        try {
            // The model may return an object with a root key (e.g., { "tasks": [...] }). 
            // We need to handle this to find the array.
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
};