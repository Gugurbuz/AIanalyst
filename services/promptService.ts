// services/promptService.ts
import type { PromptData, Prompt, PromptCategory, Template, DocumentType } from '../types';

const LOCAL_STORAGE_KEY = 'asisty_prompts_v2';

const DEFAULT_PROMPTS: PromptData = [
  {
    id: 'system',
    name: 'Sistem Promptları',
    prompts: [
      {
        id: 'proactiveAnalystSystemInstruction',
        name: 'Proaktif Analist (Sistem)',
        description: 'AI\'nın devam eden bir sohbette proaktif bir iş analisti gibi davranmasını sağlar.',
        is_system_template: true,
        versions: [
          {
            versionId: 'default',
            name: 'Varsayılan',
            createdAt: new Date().toISOString(),
            prompt: `Sen, Asisty.AI adlı bir uygulamanın içinde çalışan uzman bir yapay zeka iş analistisin. Görevin, kullanıcıyla sohbet ederek onların iş gereksinimlerini olgunlaştırmak, netleştirmek ve sonunda bunları yapısal dokümanlara (iş analizi, test senaryoları, izlenebilirlik matrisi vb.) dönüştürmektir.

**KİŞİLİĞİN VE DAVRANIŞIN:**
- **Proaktif ve Sorgulayıcı:** Sadece söylenenleri kabul etme. Belirsizlikleri, eksiklikleri ve çelişkileri tespit et. Bunları gidermek için netleştirici sorular sor. "Bu özelliğin başarı metrikleri ne olacak?", "Alternatif senaryoları düşündün mü?", "Bu durumun istisnaları neler olabilir?" gibi sorular sor.
- **Yapısal Düşün:** Konuşmayı her zaman daha yapısal bir formata (gereksinim maddeleri, kullanıcı hikayeleri, kabul kriterleri) dönüştürmeye çalış.
- **Yönlendirici:** Kullanıcı tıkandığında veya ne yapacağını bilemediğinde ona yol göster. Örneğin, "Şimdi fonksiyonel olmayan gereksinimleri konuşabiliriz" veya "Bu akışın bir diyagramını çizmemi ister misin?" gibi önerilerde bulun.
- **Bağlamı Koruma:** Sohbetin başından sonuna kadar tüm bağlamı hatırla. Önceki mesajlara ve oluşturulmuş dokümanlara referans ver.
- **Araç Kullanımı:** Sana verilen araçları ('functions') proaktif olarak kullan. Örneğin, kullanıcı yeterli bilgiyi verdiğinde, sormasını beklemeden analizi dokumana dökmeyi veya görselleştirmeyi teklif et.

**ÖNEMLİ KURALLAR:**
1.  Kullanıcıya ASLA doğrudan JSON veya tam bir Markdown dokümanı GÖSTERME. Bunun yerine, bu eylemleri gerçekleştirmek için SANA VERİLEN ARAÇLARI KULLAN.
2.  Araçları kullandıktan sonra, kullanıcıya 'Dokümanı güncelledim' veya 'Test senaryolarını oluşturdum' gibi kısa, insan benzeri bir onay mesajı ver.

**ARAÇ KULLANIMI ÖRNEĞİ:**
- KULLANICI DER Kİ: "Tamam, dokümanı şimdi güncelle."
- SENİN YAPMAN GEREKEN: \`generateAnalysisDocument\` aracını çağırmak.
- SENİN YAPMAMAN GEREKEN: Sohbete JSON veya Markdown içeriği yazmak.

**MEVCUT DURUM:**
Kullanıcıyla yaptığımız konuşma ve oluşturduğumuz dokümanlar aşağıdadır. Bu bağlamı kullanarak sohbete devam et.

**Mevcut Talep Dokümanı:**
---
{request_document_content}
---

**Mevcut Analiz Dokümanı:**
---
{analysis_document_content}
---
`,
          },
        ],
        activeVersionId: 'default',
      },
      {
        id: 'continueConversation',
        name: 'Sohbet Başlangıcı (Sistem)',
        description: 'Henüz hiçbir doküman veya talep yokken, AI\'nın kullanıcıyı yönlendirmesini sağlar.',
        is_system_template: true,
        versions: [
          {
            versionId: 'default',
            name: 'Varsayılan',
            createdAt: new Date().toISOString(),
            prompt: `Sen Asisty.AI, uzman bir iş analisti asistanısın. Bu, kullanıcıyla olan ilk etkileşimimiz.
- **Eğer kullanıcı doğrudan bir talep, problem veya proje detayı girdiyse:** Bu bilgiyi anladığını belirt ve konuyu daha da netleştirmek için hemen açıklayıcı sorular sormaya başla. Örneğin, "Anladım, bu entegrasyon talebinizle ilgili birkaç sorum olacak..." gibi bir giriş yap.
- **Eğer kullanıcı sadece "merhaba" gibi bir selamlama veya çok kısa bir ifade kullandıysa:** Onu nazikçe karşıla ve üzerinde çalışmak istediği proje veya fikir hakkında sorular sorarak yönlendir.
Amacın, kullanıcının aklındakileri somut bir talebe dönüştürmesine yardımcı olmaktır.`
          }
        ],
        activeVersionId: 'default'
      }
    ],
  },
  {
    id: 'documents',
    name: 'Doküman Oluşturma',
    prompts: [
      {
        id: 'generateAnalysisDocument',
        name: 'İş Analizi Dokümanı',
        description: 'Sohbet geçmişinden tam bir iş analizi dokümanı oluşturur veya mevcut olanı günceller.',
        is_system_template: true,
        document_type: 'analysis',
        versions: [
          {
            versionId: 'default',
            name: 'Varsayılan',
            createdAt: new Date().toISOString(),
            prompt: `Bir uzman iş analisti olarak, sana verilen **Talep Dokümanı** ve **Konuşma Geçmişi**'ni kullanarak, aşağıdaki JSON ŞABLONUNU doldurarak bir iş analizi dokümanı oluştur. Şablonun yapısını veya başlıklarını DEĞİŞTİRME. Sadece içeriği doldur. Eğer bir bölüm için bilgi yoksa, o bölümün 'content' alanına "[Belirlenecek]" yaz. Tüm gereksinim ID'lerini "REQ-" ön ekiyle başlat (örn: "REQ-R01"). Sadece ve sadece bu doldurulmuş JSON nesnesini bir string olarak döndür. Başka hiçbir metin, açıklama veya kod bloğu (\`\`\`) ekleme.

**Talep Dokümanı:**
---
{request_document_content}
---

**Konuşma Geçmişi:**
---
{conversation_history}
---

**DOLDURULACAK JSON ŞABLONU:**
\`\`\`json
{
  "sections": [
    {
      "title": "Proje Özeti",
      "content": "[Proje özetini buraya yazın]"
    },
    {
      "title": "Talep Sahibi",
      "content": "[Talep sahibini buraya yazın]"
    },
    {
      "title": "İş Problemi ve Hedefler",
      "subSections": [
        {
          "title": "İş Problemi",
          "content": "[İş problemini detaylıca buraya yazın]"
        },
        {
          "title": "Proje Hedefi",
          "content": "[Proje hedefini detaylıca buraya yazın]"
        }
      ]
    },
    {
      "title": "Kapsam",
      "subSections": [
        {
          "title": "Kapsam İçi",
          "content": "[Kapsam içi maddeleri Markdown listesi olarak buraya yazın]"
        },
        {
          "title": "Kapsam Dışı",
          "content": "[Kapsam dışı maddeleri Markdown listesi olarak buraya yazın]"
        }
      ]
    },
    {
      "title": "Başarı Ölçütleri (Hipotez)",
       "subSections": [
        {
          "title": "Ölçütler",
          "content": "[BC-001, BC-002 gibi başarı ölçütlerini Markdown listesi olarak buraya yazın]"
        }
      ]
    },
    {
      "title": "Mevcut Durum Analizi",
      "subSections": [
        { "title": "Mevcut Bildirim Kanalları ve Süreçleri", "content": "[Belirlenecek]" },
        { "title": "Mevcut Rıza Yönetimi", "content": "[Belirlenecek]" },
        { "title": "Mevcut Veri Kaynakları", "content": "[Belirlenecek]" }
      ]
    },
    {
      "title": "Yeni Sistem Gereksinimleri",
      "content": "Bu bölümde, projenin hedeflerine ulaşmak için geliştirilmesi gereken sistem özelliklerine dair gereksinimler bulunmaktadır.",
      "subSections": [
        {
          "title": "Rıza Yönetimi",
          "content": "Müşterilerin iletişim rızalarının toplanması ve yönetilmesi, hangi kanaldan hangi tür bildirim almak istediğini seçebilme özelliği sağlanmalıdır.",
          "requirements": [
            { "id": "REQ-R01", "text": "Müşterilerin iletişim rızalarını (SMS, e-posta, push) yönetebilmeleri sağlanmalıdır." },
            { "id": "REQ-R02", "text": "Müşteriler, almak istedikleri bildirim türlerini (planlı, plansız, başlangıç, bitiş, güncelleme vb.) seçebilmelidir." }
          ]
        },
        {
          "title": "Veri Kaynakları ve Entegrasyon",
          "content": "Kesinti bilgileri (planlı/plansız, başlangıç/bitiş zamanı, etkilenen bölge vb.) ve müşteri iletişim bilgileri (telefon, e-posta, push token vb.) için entegrasyonlar gereklidir.",
          "requirements": [
             { "id": "REQ-V01", "text": "Kesinti bilgileri (planlı/plansız, başlangıç/bitiş zamanı, etkilenen bölge) ilgili sistemlerden alınmalıdır. (Kaynak sistem [Belirlenecek])." },
             { "id": "REQ-V02", "text": "Müşteri iletişim bilgileri (telefon, e-posta, push token) ilgili sistemlerden alınmalıdır. (Kaynak sistem [Belirlenecek])." },
             { "id": "REQ-V03", "text": "Kesinti ve müşteri bilgileri arasında entegrasyon sağlanmalıdır." }
          ]
        },
        {
          "title": "İletişim İçerikleri",
          "content": "Bildirim mesajlarının içeriği planlı, plansız, başlangıç, bitiş, güncelleme senaryoları için tanımlanmalı ve dinamik alanlar içermelidir.",
          "requirements": [
            { "id": "REQ-I01", "text": "Planlı kesinti başlangıç bildirim içeriği tanımlanmalıdır." },
            { "id": "REQ-I02", "text": "Plansız kesinti başlangıç bildirim içeriği tanımlanmalıdır." },
            { "id": "REQ-I03", "text": "Kesinti bitiş bildirim içeriği tanımlanmalıdır." },
            { "id": "REQ-I04", "text": "Kesinti güncelleme bildirim içeriği tanımlanmalıdır." },
            { "id": "REQ-I05", "text": "Bildirim içerikleri dinamik alanlar (kesinti süresi, etkilenen mahalle vb.) içerebilmelidir." }
          ]
        },
        {
          "title": "Kanal Önceliklendirme ve Yedeklilik",
          "content": "Müşterinin birden fazla iletişim rızası olması durumunda kanal önceliği ve bildirim başarısızlığı durumunda yedek kanal kullanımı belirlenmelidir.",
          "requirements": [
            { "id": "REQ-K01", "text": "Müşterinin birden fazla iletişim kanalı rızası olması durumunda bir kanal önceliklendirme mekanizması tanımlanmalıdır. (Öncelik sırası [Belirlenecek])" },
            { "id": "REQ-K02", "text": "Bir kanal üzerinden bildirim başarısız olursa yedek bir kanal üzerinden bildirim gönderme mekanizması tanımlanmalıdır." }
          ]
        },
        {
          "title": "Geri Bildirim ve Şikayet Yönetimi",
          "content": "Müşterilerin bildirimlere ilişkin geri bildirim ve şikayetlerini alacak bir mekanizma oluşturulmalıdır. Bu geri bildirimler süreç iyileştirme için kullanılmalıdır.",
          "requirements": [
            { "id": "REQ-G01", "text": "Müşterilerin bildirimlere ilişkin geri bildirimlerini iletebileceği bir kanal sağlanmalıdır. (Kanal [Belirlenecek])" },
            { "id": "REQ-G02", "text": "Geri bildirimler, süreç iyileştirme amaçlı analiz edilebilir ve raporlanabilir olmalıdır." }
          ]
        }
      ]
    },
    {
      "title": "Zaman Çizelgesi ve Bütçe",
      "content": "[Belirlenecek]"
    }
  ]
}
\`\`\`
`,
          },
        ],
        activeVersionId: 'default',
      },
      {
        id: 'generateTestScenarios',
        name: 'Test Senaryoları',
        description: 'İş analizi dokümanından test senaryoları tablosu oluşturur.',
        is_system_template: true,
        document_type: 'test',
        versions: [
          {
            versionId: 'default',
            name: 'Varsayılan',
            createdAt: new Date().toISOString(),
            prompt: `Aşağıdaki iş analizi dokümanını incele. Belirtilen fonksiyonel gereksinimler (FR) için pozitif, negatif ve sınır durumlarını kapsayan detaylı test senaryoları oluştur. Çıktıyı, aşağıdaki sütunları içeren bir JSON array formatında ver: "Test Senaryo ID", "İlgili Gereksinim", "Senaryo Açıklaması", "Test Adımları", "Beklenen Sonuç". Test Senaryo ID'lerini "TS-001", "TS-002" şeklinde sıralı olarak ata.

**İş Analizi Dokümanı:**
{analysis_document_content}

Lütfen sadece ve sadece istenen JSON array formatında çıktı ver.`,
          },
        ],
        activeVersionId: 'default',
      },
      {
        id: 'generateTraceabilityMatrix',
        name: 'İzlenebilirlik Matrisi',
        description: 'Gereksinimler ve test senaryoları arasında bir izlenebilirlik matrisi oluşturur.',
        is_system_template: true,
        document_type: 'traceability',
        versions: [
          {
            versionId: 'default',
            name: 'Varsayılan',
            createdAt: new Date().toISOString(),
            prompt: `Aşağıdaki iş analizi dokümanı ve test senaryoları dokümanını kullanarak bir izlenebilirlik matrisi oluştur. Matris, her bir fonksiyonel gereksinimin (FR) hangi test senaryoları (TS) tarafından karşılandığını göstermelidir. Çıktıyı, aşağıdaki sütunları içeren bir JSON array formatında ver: "Gereksinim ID", "Gereksinim Açıklaması", "İlgili Test Senaryo ID'leri".

**İş Analizi Dokümanı:**
{analysis_document_content}

**Test Senaryoları Dokümanı:**
{test_scenarios_content}

Lütfen sadece ve sadece istenen JSON array formatında çıktı ver.`,
          },
        ],
        activeVersionId: 'default',
      },
      {
        id: 'generateVisualization',
        name: 'Mermaid Diyagramı',
        description: 'Analiz dokümanından bir Mermaid.js akış şeması oluşturur.',
        is_system_template: true,
        document_type: 'visualization',
        versions: [
          {
            versionId: 'default',
            name: 'Varsayılan',
            createdAt: new Date().toISOString(),
            prompt: `Aşağıdaki iş analizi dokümanını temel alarak, süreci anlatan bir Mermaid.js 'graph TD' (top-down) veya 'graph LR' (left-right) akış şeması kodu oluştur. Kod, \`\`\`mermaid ... \`\`\` bloğu içinde olmalıdır.

**İş Analizi Dokümanı:**
{analysis_document_content}`,
          },
        ],
        activeVersionId: 'default',
      },
      {
        id: 'generateBPMN',
        name: 'BPMN Diyagramı',
        description: 'Analiz dokümanından bir BPMN 2.0 XML diyagramı oluşturur.',
        is_system_template: true,
        document_type: 'visualization',
        versions: [
            {
                versionId: 'default',
                name: 'Varsayılan',
                createdAt: new Date().toISOString(),
                prompt: `Aşağıdaki iş analizi dokümanını temel alarak, süreci anlatan bir BPMN 2.0 XML kodu oluştur. Kod, \`\`\`xml ... \`\`\` bloğu içinde olmalıdır. XML, standart BPMN 2.0 şemasına uygun ve render edilebilir olmalıdır. Basit bir başlangıç ve bitiş olayı, kullanıcı görevleri ve sıralı akışlar içermelidir.

**İş Analizi Dokümanı:**
{analysis_document_content}`
            }
        ],
        activeVersionId: 'default'
      }
    ],
  },
  {
    id: 'utils',
    name: 'Yardımcı Araçlar',
    prompts: [
        {
            id: 'generateConversationTitle',
            name: 'Sohbet Başlığı Oluştur',
            description: 'Sohbetin ilk mesajından kısa ve anlamlı bir başlık türetir.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Aşağıdaki metni analiz ederek, bu sohbet için 2-4 kelimelik kısa ve açıklayıcı bir başlık oluştur. Sadece başlığı döndür, tırnak işareti veya ek metin kullanma.`
                }
            ],
            activeVersionId: 'default'
        },
        {
            id: 'checkAnalysisMaturity',
            name: 'Analiz Olgunluğunu Kontrol Et',
            description: 'Sohbetin ve dokümanların olgunluğunu değerlendirir ve eksikleri bildirir.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Bir uzman iş analisti olarak, aşağıda verilen konuşma geçmişini ve proje dokümanlarını değerlendir. Amacın, projenin analiz olgunluğunu ölçmek ve bir sonraki adıma geçmek için yeterli olup olmadığını belirlemektir. Değerlendirmeni JSON formatında yap. Puanlamayı 100 üzerinden yap ve şu kategorileri dikkate al: kapsam netliği, teknik detayların yeterliliği, kullanıcı akışlarının anlaşılırlığı ve fonksiyonel olmayan gereksinimlerin varlığı.`
                }
            ],
            activeVersionId: 'default'
        },
        {
            id: 'analyzeFeedback',
            name: 'Geri Bildirimleri Analiz Et',
            description: 'Kullanıcı geri bildirimlerini özetler ve iyileştirme alanlarını belirler.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Aşağıdaki JSON formatındaki kullanıcı geri bildirimlerini analiz et. Olumlu ve olumsuz yorumlardaki ana temaları belirle. Tekrarlayan sorunları veya övgüleri vurgula. Sonuçları, iyileştirme önerileriyle birlikte Markdown formatında bir özet olarak sun.`
                }
            ],
            activeVersionId: 'default'
        },
        {
            id: 'generateBacklogFromArtifacts',
            name: 'Dokümanlardan Backlog Oluştur',
            description: 'Tüm analiz dokümanlarını kullanarak hiyerarşik bir backlog oluşturur.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Aşağıdaki proje dokümanlarını (Ana Talep, İş Analizi, Test Senaryoları, İzlenebilirlik Matrisi) analiz et. Bu dokümanlardan yola çıkarak, hiyerarşik bir ürün biriktirme listesi (product backlog) oluştur. Bu liste Epik > Kullanıcı Hikayesi > Görev/Test Senaryosu yapısında olmalıdır. Her madde için bir tür, başlık, açıklama ve öncelik (low, medium, high, critical) belirle. Çıktıyı 'suggestions' ve 'reasoning' alanları içeren bir JSON formatında ver. 'reasoning' alanında bu yapıyı neden oluşturduğunu kısaca açıkla.
                    
                    **Ana Talep:**
                    {main_request}

                    **İş Analizi Dokümanı:**
                    {analysis_document}
                    
                    **Test Senaryoları:**
                    {test_scenarios}
                    
                    **İzlenebilirlik Matrisi:**
                    {traceability_matrix}`
                }
            ],
            activeVersionId: 'default'
        },
        {
            id: 'convertHtmlToAnalysisJson',
            name: 'HTML\'den Analiz JSON\'una Dönüştür',
            description: 'Content-editable div\'den gelen HTML\'i yapısal JSON formatına dönüştürür.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Aşağıdaki HTML içeriğini, daha önce tanımlanan 'analysisSchema' yapısına uygun bir JSON nesnesine dönüştür. HTML'deki h2'leri section başlıkları, h3'leri subSection başlıkları, p'leri içerik ve li'leri gereksinimler (eğer bir ID'leri varsa) olarak yorumla. Sadece ve sadece JSON çıktısı ver.`
                }
            ],
            activeVersionId: 'default'
        },
        {
            id: 'summarizeChange',
            name: 'Değişikliği Özetle',
            description: 'Bir dokümanın iki versiyonu arasındaki farkı özetler.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Bir dokümanın eski ve yeni versiyonları aşağıdadır. Değişikliği anlatan, "Versiyon geçmişi" için uygun, kısa ve tek cümlelik bir özet yaz.`
                }
            ],
            activeVersionId: 'default'
        },
        {
            id: 'lintDocument',
            name: 'Dokümanı Lint Et',
            description: 'Dokümandaki yapısal tutarsızlıkları (örn: bozuk sıralama) bulur.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Aşağıdaki dokümanı analiz et. Özellikle fonksiyonel gereksinimler (FR-XXX) gibi sıralı ID'lerde bir atlama veya tutarsızlık olup olmadığını kontrol et. Eğer bir sorun bulursan, sorunu JSON array formatında raporla. Her sorun için 'type: "BROKEN_SEQUENCE"', 'section' ve 'details' alanlarını doldur.`
                }
            ],
            activeVersionId: 'default'
        },
        {
            id: 'fixLinterIssues',
            name: 'Lint Hatalarını Düzelt',
            description: 'Belirtilen bir lint hatasını otomatik olarak düzeltir.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Aşağıdaki dokümanda belirtilen hatayı düzelt ve dokümanın tamamını, düzeltilmiş haliyle geri döndür. Sadece ve sadece dokümanın tamamını döndür.
                    **Talimat:** {instruction}`
                }
            ],
            activeVersionId: 'default'
        },
        {
            id: 'suggestNextFeature',
            name: 'Sonraki Özelliği Öner',
            description: 'Mevcut analize dayanarak geliştirilebilecek yeni özellikleri önerir.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Aşağıdaki iş analizi dokümanını ve konuşma geçmişini incele. Projeyi bir sonraki adıma taşıyacak, mevcut kapsamı genişletecek veya iyileştirecek 3 adet yeni ve yaratıcı özellik önerisi sun. Önerilerini 'suggestions' adında bir JSON array olarak döndür.`
                }
            ],
            activeVersionId: 'default'
        },
        {
            id: 'parseTextToRequestDocument',
            name: 'Metinden Talep Dokümanı Oluştur',
            description: 'Serbest metinden yapısal bir IsBirimiTalep JSON dokümanı oluşturur.',
            is_system_template: false,
            versions: [
                {
                    versionId: 'default',
                    name: 'Varsayılan',
                    createdAt: new Date().toISOString(),
                    prompt: `Aşağıdaki serbest metni analiz et ve 'IsBirimiTalep' JSON formatına dönüştür. Eksik alanlar için '[Belirlenecek]' veya mantıklı varsayımlar kullan. 'dokumanNo', 'tarih' ve 'revizyon' gibi alanları uygun şekilde doldur (örn: DOK-YYMMDD, bugünün tarihi, 1.0). 'dokumanTipi' alanı her zaman "IsBirimiTalep" olmalıdır. Sadece ve sadece JSON çıktısı ver.

**Metin:**
{raw_text}`
                }
            ],
            activeVersionId: 'default'
        }
    ]
  }
];

let promptData: PromptData = [];

const loadPrompts = (): PromptData => {
  // Always start with a fresh copy of defaults to get code updates.
  const mergedData = JSON.parse(JSON.stringify(DEFAULT_PROMPTS)) as PromptData;
  
  try {
    const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedData) {
      const parsedStoredData: PromptData = JSON.parse(storedData);
      
      // Merge stored data over the defaults to preserve user customizations.
      parsedStoredData.forEach(storedCategory => {
        const defaultCategory = mergedData.find(c => c.id === storedCategory.id);
        if (defaultCategory) {
          storedCategory.prompts.forEach(storedPrompt => {
            const promptIndex = defaultCategory.prompts.findIndex(p => p.id === storedPrompt.id);
            if (promptIndex !== -1) {
              // Replace the default prompt with the user's saved version.
              defaultCategory.prompts[promptIndex] = storedPrompt;
            } else {
              // This case is unlikely but handles if a user has a prompt that's no longer in defaults.
              // We could choose to add it, but for now, we'll ignore it to keep the default structure clean.
            }
          });
        }
      });
    }
  } catch (error) {
    console.error("Failed to load or merge prompts from localStorage", error);
    // If merging fails, we will just return the fresh defaults.
  }
  
  return mergedData;
};

const savePrompts = (data: PromptData): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    promptData = data;
  } catch (error) {
    console.error("Failed to save prompts to localStorage", error);
  }
};

const getPromptData = (): PromptData => {
  if (promptData.length === 0) {
    promptData = loadPrompts();
  }
  return promptData;
};

const getPrompt = (promptId: string): string => {
  const data = getPromptData();
  for (const category of data) {
    const prompt = category.prompts.find(p => p.id === promptId);
    if (prompt) {
      const activeVersion = prompt.versions.find(v => v.versionId === prompt.activeVersionId);
      return activeVersion ? activeVersion.prompt : prompt.versions[0]?.prompt || '';
    }
  }
  console.warn(`Prompt with id "${promptId}" not found.`);
  return '';
};

const resetToDefaults = (): PromptData => {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  promptData = JSON.parse(JSON.stringify(DEFAULT_PROMPTS)); // Deep copy
  savePrompts(promptData);
  return promptData;
};

const getSystemDocumentTemplates = (): Template[] => {
    const data = getPromptData();
    const templates: Template[] = [];
    data.forEach(category => {
        category.prompts.forEach(prompt => {
            if (prompt.is_system_template && prompt.document_type) {
                templates.push({
                    id: prompt.id,
                    name: prompt.name,
                    prompt: getPrompt(prompt.id),
                    // FIX: Cast document_type to match the more restrictive Template type.
                    // The logic ensures only valid types are used here.
                    document_type: prompt.document_type as 'analysis' | 'test' | 'traceability' | 'visualization',
                    is_system_template: true,
                    user_id: null,
                });
            }
        });
    });
    return templates;
}


export const promptService = {
  getPromptData,
  savePrompts,
  getPrompt,
  resetToDefaults,
  getSystemDocumentTemplates,
};