// services/geminiService.ts

import { GoogleGenAI, Type } from "@google/genai";
import type { Message, MaturityReport } from '../types';

export interface GeminiConfig {
    apiKey: string;
    modelName: string;
}

const generateContent = async (prompt: string, config: GeminiConfig, modelConfig?: object): Promise<string> => {
    if (!config.apiKey) {
        throw new Error("API Anahtarı sağlanmadı.");
    }
    try {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const response = await ai.models.generateContent({
            model: config.modelName,
            contents: prompt,
            ...(modelConfig && { config: modelConfig }),
        });
        return response.text;
    } catch (error) {
        console.error("Gemini API call failed:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('API key not valid')) {
             throw new Error("Geçersiz API Anahtarı. Lütfen Geliştirici Panelinden kontrol edin.");
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

export const geminiService = {
    continueConversation: async (history: Message[], config: GeminiConfig): Promise<string> => {
        const prompt = `
            Sen uzman bir iş analisti yapay zekasısın. 
            Görevin, kullanıcının iş talebini konuşma yoluyla anlamak, netleştirmek ve olgunlaştırmaktır.
            Kullanıcının son mesajına ve tüm konuşma geçmişine dayanarak uygun bir yanıt ver.
            - Eğer talep belirsizse, netleştirici sorular sor.
            - Eğer talep yeterince açıksa, bunu belirt ve bir analiz dokümanı veya test senaryosu oluşturabileceğini söyle.
            - Kullanıcının sorularını yanıtla ve sürece rehberlik et.
            Cevabını samimi ve profesyonel bir asistan gibi ifade et.
            
            Konuşma Geçmişi:
            ${formatHistory(history)}
        `;
        return generateContent(prompt, config);
    },
    
    checkAnalysisMaturity: async (history: Message[], config: GeminiConfig): Promise<MaturityReport> => {
        const schema = {
            type: Type.OBJECT,
            properties: {
                isSufficient: { type: Type.BOOLEAN, description: 'Analiz dokümanı oluşturmak için bilgilerin yeterli olup olmadığı.' },
                summary: { type: Type.STRING, description: 'Analizin mevcut durumunun kısa bir özeti.' },
                missingTopics: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Konuşmada eksik olan veya daha fazla detaylandırılması gereken ana başlıkların listesi.'
                },
                suggestedQuestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Eksik konuları netleştirmek için kullanıcıya sorulabilecek 1-3 adet bağlamsal ve akıllı soru.'
                }
            },
            required: ['isSufficient', 'summary', 'missingTopics', 'suggestedQuestions']
        };

        const prompt = `
            **GÖREV:** Sen, bir iş analizi sürecini denetleyen son derece yetenekli bir Kıdemli İş Analistisin. Sağlanan konuşma geçmişini dikkatlice inceleyerek, analizin olgunluğunu değerlendir. Amacın, analizin bir sonraki aşamaya (dokümantasyon) geçmeye hazır olup olmadığını belirlemek ve değilse, en kritik eksiklikleri yapısal bir şekilde ortaya koymaktır.

            **DEĞERLENDİRME KRİTERLERİ:**
            Konuşmayı aşağıdaki anahtar iş analizi alanları açısından değerlendir:
            1.  **Ana Amaç ve İş Değeri:** Projenin temel hedefi net mi?
            2.  **Kapsam:** Kapsam dahilindeki ve dışındaki maddeler yeterince tanımlanmış mı?
            3.  **Kullanıcılar ve Roller:** Hedef kullanıcı kitlesi ve ihtiyaçları belli mi?
            4.  **Fonksiyonel Gereksinimler:** Sistemin ne yapması gerektiği açıkça belirtilmiş mi?
            5.  **Fonksiyonel Olmayan Gereksinimler:** Performans, güvenlik, kullanılabilirlik gibi konulara değinilmiş mi?
            6.  **Veri ve Entegrasyonlar:** Gerekli veri modelleri veya dış sistem entegrasyonları hakkında bilgi var mı?
            7.  **Kısıtlar ve Bağımlılıklar:** Projeyi etkileyebilecek teknik veya iş kısıtları biliniyor mu?
            8.  **Başarı Metrikleri:** Projenin başarısının nasıl ölçüleceği tanımlanmış mı?

            **ÇIKTI KURALLARI:**
            - Cevabını **SADECE** ve **SADECE** sağlanan JSON şemasına uygun olarak ver.
            - **summary:** Mevcut durumu (örn: "Başlangıç aşamasında", "Detaylandırılıyor", "Neredeyse hazır") ve en büyük eksikliği vurgulayan 1-2 cümlelik bir özet yaz.
            - **isSufficient:** Eğer yukarıdaki kriterlerin çoğu (özellikle ilk 4'ü) yeterince detaylıysa \`true\`, aksi halde \`false\` döndür.
            - **missingTopics:** Yukarıdaki kriterlerden hangilerinin eksik veya zayıf olduğunu listele.
            - **suggestedQuestions:** Eksik konuları aydınlatmak için, daha önce sorulmamış, spesifik ve bağlamsal 1 ila 3 soru oluştur. Genel sorulardan kaçın.

            **Konuşma Geçmişi:**
            ${formatHistory(history)}
        `;
        
        const modelConfig = {
            responseMimeType: "application/json",
            responseSchema: schema,
        };

        const jsonString = await generateContent(prompt, config, modelConfig);
        try {
            return JSON.parse(jsonString) as MaturityReport;
        } catch (e) {
            console.error("Failed to parse maturity report JSON:", e, "Received string:", jsonString);
            throw new Error("Analiz olgunluk raporu ayrıştırılamadı.");
        }
    },

    generateAnalysisDocument: async (history: Message[], templatePrompt: string, config: GeminiConfig): Promise<string> => {
        const prompt = `
            ${templatePrompt}

            **EK VE EN ÖNEMLİ TALİMAT: İYİLEŞTİRME ODAKLI YAKLAŞIM**
            Yukarıdaki "GÖREV" ve "DOKÜMAN YAPISI"nı takip ederken, konuşma geçmişindeki eksik, belirsiz veya varsayımsal bilgileri tespit et. Bu zayıf noktaları görmezden gelme. Bunun yerine:
            1.  Eldeki bilgilerle ilgili bölümü yine de yaz. Eğer bir varsayımda bulunuyorsan, bunu açıkça belirt (örn: "Varsayım: ...").
            2.  İlgili bölümün hemen sonuna, o konuyu netleştirmek için kullanıcıya yöneltilmesi gereken 1-2 kritik soruyu içeren özel bir "İyileştirme Alanı" bloğu ekle.
            3.  Bu bloğu aşağıdaki Markdown formatında biçimlendir:

            > **İyileştirme Alanı:**
            > *Bu bölümdeki bilgiler varsayımlara dayanmaktadır veya eksiktir. Analizi güçlendirmek için lütfen aşağıdaki soruları yanıtlayın:*
            > - **Soru 1:** ...?
            > - **Soru 2:** ...?

            - Eğer bir bölümle ilgili konuşmada HİÇBİR bilgi yoksa, o bölümün başlığını yaz ve altına "Bu konuyla ilgili yeterli bilgi bulunmamaktadır." notunu ekle, ardından bir "İyileştirme Alanı" bloğu ile ilgili soruları sor.
            - Tüm dokümanı tek bir akıcı metin olarak sun.

            **TALİMAT:**
            Dokümanı yalnızca ve yalnızca aşağıda sağlanan konuşma geçmişine dayanarak oluştur.

            **Konuşma Geçmişi:**
            ${formatHistory(history)}
        `;
        return generateContent(prompt, config);
    },

    generateTestScenarios: async (analysisDocument: string, templatePrompt: string, config: GeminiConfig): Promise<string> => {
        const prompt = `
            ${templatePrompt}
            
            **TALİMAT:**
            Test senaryolarını yalnızca aşağıda sağlanan İş Analizi Dokümanına dayanarak oluştur.

            **İş Analizi Dokümanı:**
            '${analysisDocument}'
        `;
        return generateContent(prompt, config);
    },

    generateConversationTitle: async (firstMessage: string, config: GeminiConfig): Promise<string> => {
        const prompt = `Kullanıcının şu ilk mesajına dayanarak 5 kelimeyi geçmeyen kısa, öz ve açıklayıcı bir sohbet başlığı oluştur: "${firstMessage}"`;
        const title = await generateContent(prompt, config);
        // Remove quotes and asterisks that the model might add
        return title.replace(/["*]/g, '').trim();
    },

    generateVisualization: async (history: Message[], config: GeminiConfig): Promise<string> => {
        const prompt = `
            **GÖREV:** Deneyimli bir sistem mimarı olarak, sağlanan konuşma geçmişini analiz et ve ana iş akışını, süreçler arasındaki etkileşimi veya kavramsal hiyerarşiyi en iyi şekilde özetleyen bir **Mermaid.js diyagramı** oluştur.

            **DİYAGRAM TÜRÜ SEÇİMİ:**
            - Konuşma bir süreç veya iş akışı tanımlıyorsa, **akış şeması (flowchart)** kullan (\`graph TD\`).
            - Konuşma, sistemler veya kullanıcılar arasında zaman sıralı bir etkileşim içeriyorsa, **sekans diyagramı (sequenceDiagram)** kullan.
            - Konuşma, merkezi bir konsept etrafındaki fikirleri veya özellikleri araştırıyorsa, **zihin haritası (mindmap)** kullan.
            - Konuşmanın içeriğine göre en uygun diyagram türünü kendin seç.

            **KRİTİK KURALLAR:**
            1.  Çıktın **SADECE** ve **SADECE** seçtiğin diyagram türü için geçerli Mermaid.js sözdizimi içermelidir.
            2.  Sözdizimini \`\`\`mermaid ... \`\`\` kod bloğu içine ALMA. Sadece ham sözdizimini döndür.
            3.  Diyagramı mümkün olduğunca okunabilir ve anlaşılır yap. Karmaşık adımları basitleştir.
            4.  Eğer konuşma çok kısaysa veya anlamlı bir diyagram çıkarılamıyorsa, temel amacı gösteren basit bir diyagram oluştur (genellikle bir akış şeması en güvenli seçenektir).

            **ÖRNEK ÇIKTI (Akış Şeması):**
            graph TD
                A[Kullanıcı Giriş Yapar] --> B{Giriş Başarılı mı?};
                B -->|Evet| C[Ana Sayfayı Görüntüler];
                B -->|Hayır| D[Hata Mesajı Gösterilir];
                C --> E[Rapor Oluşturma Sayfasına Gider];

            **Konuşma Geçmişi:**
            ${formatHistory(history)}
        `;
         return generateContent(prompt, config);
    }
};