// services/promptService.ts

import type { PromptData, Prompt, PromptVersion } from '../types';
import { ANALYSIS_TEMPLATES, TEST_SCENARIO_TEMPLATES } from '../templates';

const PROMPT_STORAGE_KEY = 'ai_business_analyst_prompts';

const createDefaultVersion = (prompt: string) => ({
    versionId: 'default',
    name: 'Orijinal',
    prompt: prompt.trim(),
    createdAt: new Date().toISOString(),
});

const defaultPrompts: PromptData = [
    {
        id: 'conversation',
        name: 'Konuşma ve Yönlendirme',
        prompts: [
            {
                id: 'continueConversation',
                name: 'Sohbeti Sürdürme',
                description: 'Kullanıcının mesajına yanıt verir ve analizi ilerletir.',
                versions: [createDefaultVersion(`
                    Sen uzman bir iş analisti yapay zekasısın. 
                    Görevin, kullanıcının iş talebini konuşma yoluyla anlamak, netleştirmek ve olgunlaştırmaktır.
                    Kullanıcının son mesajına ve tüm konuşma geçmişine dayanarak uygun bir yanıt ver.
                    - Eğer talep belirsizse, netleştirici sorular sor.
                    - Eğer talep yeterince açıksa, bunu belirt ve bir analiz dokümanı veya test senaryosu oluşturabileceğini söyle.
                    - Kullanıcının sorularını yanıtla ve sürece rehberlik et.
                    Cevabını samimi ve profesyonel bir asistan gibi ifade et.
                `)],
                activeVersionId: 'default',
            },
            {
                id: 'generateConversationTitle',
                name: 'Sohbet Başlığı Oluşturma',
                description: 'İlk kullanıcı mesajından kısa bir sohbet başlığı üretir.',
                versions: [createDefaultVersion('Kullanıcının şu ilk mesajına dayanarak 5 kelimeyi geçmeyen kısa, öz ve açıklayıcı bir sohbet başlığı oluştur')],
                activeVersionId: 'default',
            },
        ],
    },
    {
        id: 'analysis',
        name: 'Analiz ve Dokümantasyon',
        prompts: [
            {
                id: 'checkAnalysisMaturity',
                name: 'Olgunluk Kontrolü',
                description: 'Konuşmanın doküman oluşturmak için yeterli olup olmadığını değerlendirir.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Sen, bir iş analizi sürecini denetleyen son derece yetenekli bir Kıdemli İş Analistisin. Sağlanan konuşma geçmişini dikkatlice inceleyerek, analizin olgunluğunu değerlendir. Amacın, analizin bir sonraki aşamaya (dokümantasyon) geçmeye hazır olup olmadığını belirlemek ve değilse, en kritik eksiklikleri yapısal bir şekilde ortaya koymaktır.
                    **DEĞERLENDİRME KRİTERLERİ:**
                    1.  **Ana Amaç ve İş Değeri:** Projenin temel hedefi net mi?
                    2.  **Kapsam:** Kapsam dahilindeki ve dışındaki maddeler yeterince tanımlanmış mı?
                    3.  **Kullanıcılar ve Roller:** Hedef kullanıcı kitlesi ve ihtiyaçları belli mi?
                    4.  **Fonksiyonel Gereksinimler:** Sistemin ne yapması gerektiği açıkça belirtilmiş mi?
                    **ÇIKTI KURALLARI:**
                    - Cevabını **SADECE** ve **SADECE** sağlanan JSON şemasına uygun olarak ver.
                `)],
                activeVersionId: 'default',
            },
            ...ANALYSIS_TEMPLATES.map(template => ({
                id: template.id,
                name: `Analiz Şablonu: ${template.name}`,
                description: 'Belirli bir formata göre analiz dokümanı oluşturur.',
                versions: [createDefaultVersion(template.prompt)],
                activeVersionId: 'default' as string,
            }))
        ]
    },
    {
        id: 'testing',
        name: 'Test Senaryoları',
        prompts: TEST_SCENARIO_TEMPLATES.map(template => ({
            id: template.id,
            name: `Test Şablonu: ${template.name}`,
            description: 'Belirli bir formata göre test senaryoları oluşturur.',
            versions: [createDefaultVersion(template.prompt)],
            activeVersionId: 'default' as string,
        }))
    },
    {
        id: 'visualization',
        name: 'Görselleştirme',
        prompts: [
            {
                id: 'generateVisualization',
                name: 'Diyagram Oluşturma',
                description: 'Analiz dokümanından Mermaid.js diyagramı üretir.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Deneyimli bir sistem mimarı olarak, sana sağlanan iş analizi dokümanını dikkatlice incele. Dokümanda açıklanan ana iş akışını, kullanıcı adımlarını, sistem etkileşimlerini veya süreçleri temel alarak bir **Mermaid.js diyagramı** oluştur.
                `)],
                activeVersionId: 'default',
            }
        ]
    },
    {
        id: 'projectManagement',
        name: 'Proje Yönetimi',
        prompts: [
            {
                id: 'generateTasksFromAnalysis',
                name: 'Analizden Görev Oluşturma',
                description: 'Bir analiz dokümanından Jira benzeri görevler listesi üretir.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Sen, bir çevik (agile) geliştirme takımında çalışan deneyimli bir Proje Yöneticisi/Scrum Master'sın. Sana sunulan İş Analizi Dokümanını dikkatlice incele ve bu dokümandaki, özellikle "Fonksiyonel Gereksinimler" bölümündeki maddeleri, geliştirme ekibi için eyleme dönüştürülebilir görevlere ayır.

                    **TALİMATLAR:**
                    1.  Her bir fonksiyonel gereksinimi (FR) veya mantıksal bir alt görevini ayrı bir görev olarak ele al.
                    2.  Her görev için kısa, net ve eylem odaklı bir **başlık** oluştur.
                    3.  Her görev için, ilgili gereksinimi açıklayan ve görevin amacını belirten bir **açıklama** yaz.
                    4.  Her görevin önemine göre bir **öncelik seviyesi** ata. Kullanabileceğin seviyeler: 'low', 'medium', 'high', 'critical'.
                    5.  Çıktıyı **SADECE** ve **SADECE** belirtilen JSON şemasına uygun bir dizi (array) olarak döndür.

                    **ÖRNEK:**
                    Eğer gereksinim "FR-001: Bir Kullanıcı olarak, sisteme e-posta ve şifremle giriş yapabilmeliyim" ise, bu şu görevlere bölünebilir:
                    - Başlık: "Kullanıcı Giriş Arayüzünü Oluştur", Açıklama: "E-posta ve şifre alanları ile 'Giriş Yap' butonunu içeren bir UI tasarla.", Öncelik: "high"
                    - Başlık: "Giriş Doğrulama API Uç Noktası Geliştir", Açıklama: "Kullanıcı kimlik bilgilerini doğrulayan bir backend servisi oluştur.", Öncelik: "critical"
                `)],
                activeVersionId: 'default',
            }
        ]
    },
    // FIX: Add a new prompt category and prompt for analyzing feedback.
    {
        id: 'feedback',
        name: 'Geri Bildirim Analizi',
        prompts: [
            {
                id: 'analyzeFeedback',
                name: 'Geri Bildirimleri Analiz Et',
                description: 'Kullanıcı geri bildirimlerini özetler ve iyileştirme alanlarını belirler.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Sen, bir ürün yöneticisi rolünde hareket eden bir yapay zekasın. Sana sunulan, kullanıcıların verdiği "beğendim" (up) ve "beğenmedim" (down) oyları ile birlikte yazdıkları yorumları analiz et. Amacın, bu geri bildirimlerden anlamlı içgörüler çıkarmak ve ürünün geliştirilmesi için önerilerde bulunmaktır.

                    **FORMATLAMA KURALLARI:**
                    - Çıktı, Markdown formatında olmalıdır.
                    - Ana başlıklar için '##', alt başlıklar için '###' kullan.
                    - Listeler için madde imleri kullan.

                    **ANALİZ YAPISI:**
                    Analizin aşağıdaki bölümleri içermelidir:

                    ## Genel Bakış
                    - Geri bildirimlerin genel bir özetini yap. Kullanıcıların genel hissiyatı nedir? (Örn: "Kullanıcılar genellikle X özelliğinden memnunken, Y konusunda zorluklar yaşıyor.")

                    ## Öne Çıkan Olumlu Yönler
                    - Kullanıcıların en çok beğendiği ve olumlu yorum yaptığı konuları madde madde listele. Hangi özellikler veya davranışlar takdir ediliyor?

                    ## İyileştirme Alanları
                    - Kullanıcıların en çok şikayet ettiği, "beğenmedim" oyu verdiği veya sorun yaşadığı konuları madde madde listele.
                    - Her bir ana iyileştirme alanı için aşağıdaki formatı kullan:
                    > **İyileştirme Alanı:** [Konu Başlığı]
                    > - [Öneri 1]
                    > - [Öneri 2]

                    ## Acil Aksiyon Önerileri
                    - Analizine dayanarak, en yüksek önceliğe sahip olduğunu düşündüğün 2-3 somut eylem önerisi sun.
                `)],
                activeVersionId: 'default',
            }
        ]
    },
];


class PromptService {
    private prompts: PromptData;

    constructor() {
        this.prompts = this.loadPrompts();
    }

    private loadPrompts(): PromptData {
        try {
            const storedPromptsJson = localStorage.getItem(PROMPT_STORAGE_KEY);
            if (storedPromptsJson) {
                return JSON.parse(storedPromptsJson) as PromptData;
            }
        } catch (error) {
            console.error("Failed to parse stored prompts, falling back to default.", error);
            localStorage.removeItem(PROMPT_STORAGE_KEY);
        }
        return JSON.parse(JSON.stringify(defaultPrompts)); // Deep copy to prevent mutation
    }

    public savePrompts(updatedPrompts: PromptData): void {
        try {
            const json = JSON.stringify(updatedPrompts);
            localStorage.setItem(PROMPT_STORAGE_KEY, json);
            this.prompts = updatedPrompts;
        } catch (error) {
            console.error("Failed to save prompts to localStorage.", error);
        }
    }

    public getPromptData(): PromptData {
        return this.prompts;
    }
    
    public getPrompt(promptId: string): string {
        for (const category of this.prompts) {
            const prompt = category.prompts.find(p => p.id === promptId);
            if (prompt) {
                const activeVersion = prompt.versions.find(v => v.versionId === prompt.activeVersionId);
                return activeVersion ? activeVersion.prompt : (prompt.versions[0]?.prompt || '');
            }
        }
        console.warn(`Prompt with ID "${promptId}" not found. Returning empty string.`);
        return '';
    }
    
    public resetToDefaults(): PromptData {
        localStorage.removeItem(PROMPT_STORAGE_KEY);
        const newDefaults = JSON.parse(JSON.stringify(defaultPrompts));
        this.prompts = newDefaults;
        return newDefaults;
    }
}

export const promptService = new PromptService();