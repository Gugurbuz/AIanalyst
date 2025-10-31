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
            })),
             {
                id: 'generateTraceabilityMatrix',
                name: 'İzlenebilirlik Matrisi Oluşturma',
                description: 'Analiz dokümanındaki fonksiyonel gereksinimleri, test senaryoları dokümanındaki ilgili test durumlarıyla eşleştirir.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Titiz bir Kıdemli Kalite Güvence (QA) Analisti olarak hareket et. Sana sunulan İş Analizi Dokümanı ve Test Senaryoları Dokümanını kullanarak bir İzlenebilirlik Matrisi (Traceability Matrix) oluştur.

                    **FORMATLAMA KURALLARI:**
                    - Çıktı, **yalnızca** aşağıda belirtilen sütunları içeren bir Markdown tablosu olmalıdır. Tablo dışında hiçbir metin (giriş, açıklama, sonuç vb.) ekleme.

                    **İŞLEM ADIMLARI:**
                    1.  İş Analizi Dokümanındaki her bir Fonksiyonel Gereksinimi (örn. "FR-001", "FR-002") ve açıklamasını bul.
                    2.  Test Senaryoları Dokümanındaki her bir test senaryosunu ("Senaryo ID" sütunu, örn. "TC-FR001-01") ve açıklamasını ("Test Durumu Açıklaması" sütunu) bul.
                    3.  Her bir gereksinimi, ilgili test senaryosu/senaryolarıyla eşleştir. Eşleştirmeyi "FR-001" ve "TC-FR001-xx" gibi ID'ler üzerinden yap.
                    4.  Bir gereksinimin birden fazla test senaryosu varsa, her eşleşme için tabloda ayrı bir satır oluştur.

                    **TABLO YAPISI:**

                    | Gereksinim ID | Gereksinim Açıklaması | Test Senaryo ID | Test Durumu Açıklaması |
                    |---------------|-------------------------|-----------------|--------------------------|
                    | FR-001        | [Gereksinimin kısa açıklaması] | TC-FR001-01     | [Test senaryosunun açıklaması] |
                    | FR-001        | [Gereksinimin kısa açıklaması] | TC-FR001-02     | [İkinci test senaryosunun açıklaması] |
                    | FR-002        | [Diğer gereksinimin açıklaması] | TC-FR002-01     | [İlgili testin açıklaması] |
                `)],
                activeVersionId: 'default',
            },
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
                name: 'Süreç Akış Diyagramı Oluşturma (Mermaid)',
                description: 'Analiz dokümanındaki süreçleri Mermaid.js diyagramı olarak görselleştirir.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Profesyonel ve standartlara uygun bir Mermaid.js akış şeması (flowchart) kodu oluştur.

                    **ÇOK ÖNEMLİ - KOD YAPISI VE SIRALAMASI:**
                    Oluşturacağın kod **KESİNLİKLE** aşağıdaki yapıya ve sıralamaya uymalıdır:

                    1.  **Diyagram Yönü (ZORUNLU):** Kod, \`graph TD;\` satırıyla başlamalıdır.
                    2.  **Stil Sınıfı Tanımları (ZORUNLU):** \`graph TD;\` satırından **HEMEN SONRA**, aşağıdaki \`classDef\` bloklarını **DEĞİŞTİRMEDEN** ekle.
                    3.  **Düğümler ve Bağlantılar:** Stil tanımlarından sonra, diyagramın düğümlerini ve bağlantılarını tanımla.

                    **STİL ve FORMATLAMA KURALLARI:**
                    - **YORUM YASAK:** Kod bloğunun içine \`//\` veya \`#\` gibi yorum satırları **KESİNLİKLE EKLEME**. Mermaid'in kendi yorum formatı olan \`%% ... %%\` dışında yorum kullanma.
                    - **STİL UYGULAMA:** Oluşturduğun her düğüme, anlamını en iyi yansıtan stili uygula. Kullanılacak stiller:
                        - **\`system\`**: Otomatik sistem işlemleri.
                        - **\`actor\`**: Son kullanıcı veya insan aktör.
                        - **\`decision\`**: Karar veya koşul bloğu (genellikle \`{}\` şekliyle).
                        - **\`warn\`**: Hata durumu veya uyarı.
                        - **Uygulama Yöntemi:** Düğüm tanımından sonra \`:::\` ve stil adını ekle. Örnek: \`A["Kullanıcı Giriş Yapar"]:::actor\`.
                    - **DÜĞÜM METİNLERİ:**
                        - Tüm düğüm metinleri **KESİNLİKLE** çift tırnak \`""\` içine alınmalıdır.
                        - Çok satırlı metin için **SADECE** \`<br/>\` HTML etiketini kullan.

                    ---
                    **DOĞRU YAPIDA ÖRNEK:**
                    \`\`\`mermaid
                    graph TD;
                        classDef system fill:#e0e7ff,stroke:#a5b4fc,color:#3730a3,stroke-width:2px;
                        classDef actor fill:#fef3c7,stroke:#fcd34d,color:#92400e,stroke-width:2px;
                        classDef decision fill:#dcfce7,stroke:#86efac,color:#166534,stroke-width:2px;
                        classDef warn fill:#fee2e2,stroke:#fca5a5,color:#991b1b,stroke-width:2px;

                        A["Kullanıcı sipariş<br/>sayfasını açar"]:::actor;
                        B["Sipariş Detaylarını Girer"]:::actor;
                        C{"Stok Yeterli mi?"}:::decision;
                        D["Ödeme İşlemini Başlat"]:::system;
                        E["Stok Yetersiz<br/>Uyarısı Göster"]:::warn;
                        
                        A --> B;
                        B --> C;
                        C -- Evet --> D;
                        C -- Hayır --> E;
                    \`\`\`
                    ---

                    **ZORUNLU ÇIKTI FORMATI:**
                    - Çıktı olarak **SADECE** ve **SADECE** \`\`\`mermaid\n...\n\`\`\` kod bloğunu ver. Başka hiçbir giriş, açıklama veya sonuç metni ekleme.
                `)],
                activeVersionId: 'default',
            },
            {
                id: 'modifyVisualization',
                name: 'Süreç Akışını Değiştirme (Mermaid)',
                description: 'Mevcut bir Mermaid.js diyagramını doğal dil talimatlarıyla değiştirir.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Sen uzman bir Mermaid.js editörüsün. Sana bir "Mevcut Mermaid Kodu" ve bu kodu değiştirmek için bir "Kullanıcı Talimatı" verilecek. Görevin, talimatı mevcut koda uygulamak ve **tamamlanmış, yeni Mermaid kodunu** geri döndürmektir.

                    **EN ÖNEMLİ KURALLAR:**
                    Orijinal koddaki ve aşağıdaki tüm formatlama kurallarına **KESİNLİKLE** uymalısın:
                    - **DOĞRU SIRALAMA:** \`graph TD;\` her zaman \`classDef\` tanımlarından **önce** gelmelidir. Bu sıralamayı bozan bir kod üretme.
                    - **STİLLERİ KORU:** Tüm orijinal \`classDef\` stil tanımlarını koru ve yeni düğümlere uygun stilleri uygula (\`system\`, \`actor\`, \`decision\`, \`warn\`).
                    - **YORUM YASAK:** Kod bloğunun içine \`//\` veya \`#\` gibi yorum satırları **KESİNLİKLE EKLEME**.
                    - **YENİ SATIRLAR:** Yeni satırlar için \`\\n\` yerine **SADECE** \`<br/>\` kullan.
                    - **TIRNAK İŞARETLERİ:** Tüm düğüm metinlerini çift tırnak \`""\` içine al.
                    - **STİL SÖZDİZİMİ:** Stil uygulamak için \`:::\` sözdizimini kullan.

                    **ÇIKTI FORMATI:**
                    - Çıktı olarak **SADECE** ve **SADECE** \`\`\`mermaid\n...\n\`\`\` kod bloğunu ver. Başka hiçbir giriş, açıklama veya sonuç metni ekleme.
                `)],
                activeVersionId: 'default',
            },
            {
                id: 'generateBPMN',
                name: 'Süreç Akış Diyagramı Oluşturma (BPMN)',
                description: 'Analiz dokümanındaki süreçleri BPMN 2.0 XML formatında modeller.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Uzman bir BPMN 2.0 modelleyicisi olarak hareket et. Sağlanan İş Analizi Dokümanını temel alarak, standartlara uygun ve geçerli bir BPMN 2.0 XML dosyası oluştur.
                    
                    **KURALLAR:**
                    1.  **Tam ve Geçerli XML:** Ürettiğin XML, bir BPMN modelleme aracında açılabilecek şekilde tam ve geçerli olmalıdır. Bu, \`<bpmn:definitions>\`, \`<bpmn:process>\` ve \`<bpmndi:BPMNDiagram>\` gibi tüm gerekli kök ve yapısal elemanları içermesi gerektiği anlamına gelir.
                    2.  **Elementler:** Süreci modellemek için standart BPMN elemanlarını kullan:
                        - \`<bpmn:startEvent>\`
                        - \`<bpmn:task>\` (Kullanıcı görevleri için \`<bpmn:userTask>\`, sistem görevleri için \`<bpmn:serviceTask>\` kullanabilirsin)
                        - \`<bpmn:exclusiveGateway>\` (Karar noktaları için)
                        - \`<bpmn:endEvent>\`
                        - \`<bpmn:sequenceFlow>\` (Akış okları için)
                    3.  **Diyagram Bilgisi (DI):** Her bir şekil (\`<bpmndi:BPMNShape>\`) ve ok (\`<bpmndi:BPMNEdge>\`) için pozisyon ve boyut bilgilerini içeren \`<bpmndi:BPMNPlane>\` bölümünü **MUTLAKA** oluştur. Bu, diyagramın görsel olarak oluşturulabilmesi için kritiktir. Tahmini koordinatlar (x, y, width, height) kullanabilirsin.
                    4.  **ID'ler:** Tüm elemanlara (process, task, event, gateway, flow, shape, edge) benzersiz ID'ler ata.
                    5.  **Etiketler:** \`name\` attribute'unu kullanarak görevleri, olayları ve geçitleri İş Analizi Dokümanındaki adımlara göre etiketle.
                    
                    **ZORUNLU ÇIKTI FORMATI:**
                    - Çıktı olarak **SADECE** ve **SADECE** \`\`\`xml\n<?xml ...?>\n...\n</bpmn:definitions>\n\`\`\` kod bloğunu ver. XML bloğunun dışına başka hiçbir giriş, açıklama veya sonuç metni ekleme.
                `)],
                activeVersionId: 'default',
            },
            {
                id: 'modifyBPMN',
                name: 'Süreç Akışını Değiştirme (BPMN)',
                description: 'Mevcut bir BPMN 2.0 XML diyagramını doğal dil talimatlarıyla değiştirir.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Sen uzman bir BPMN 2.0 XML editörüsün. Sana bir "Mevcut BPMN Kodu" ve bu kodu değiştirmek için bir "Kullanıcı Talimatı" verilecek. Görevin, talimatı mevcut XML'e uygulamak ve **tamamlanmış, yeni ve geçerli BPMN 2.0 XML kodunu** geri döndürmektir.
                    
                    **EN ÖNEMLİ KURAL:**
                    - **Yapıyı Koru:** Orijinal XML'in yapısını (definitions, process, BPMNDiagram, BPMNPlane) koru.
                    - **Geçerli XML:** Yaptığın değişiklikler sonucunda ortaya çıkan XML'in hala geçerli bir BPMN 2.0 dosyası olduğundan emin ol.
                    - **Diyagram Bilgisini Güncelle (DI):** Yeni bir eleman (task, gateway vb.) eklediğinde, \`<bpmndi:BPMNPlane>\` içine karşılık gelen bir \`<bpmndi:BPMNShape>\` eklemeyi UNUTMA. Yeni bir akış (\`<bpmn:sequenceFlow>\`) eklediğinde, karşılık gelen \`<bpmndi:BPMNEdge>\`'i eklemeyi UNUTMA. Mevcut elemanların koordinatlarını mantıklı bir şekilde ayarla.
                    - **Benzersiz ID'ler:** Eklediğin tüm yeni elemanlara benzersiz ID'ler ata.
                    
                    **ÇIKTI FORMATI:**
                    - Çıktı olarak **SADECE** ve **SADECE** \`\`\`xml\n<?xml ...?>\n...\n</bpmn:definitions>\n\`\`\` kod bloğunu ver. XML bloğunun dışına başka hiçbir giriş, açıklama veya sonuç metni ekleme.
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
            },
            {
                id: 'suggestNextFeature',
                name: 'Sonraki Özelliği Öner',
                description: 'Mevcut analize dayanarak bir sonraki mantıksal özelliği veya iyileştirmeyi önerir.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Deneyimli bir Ürün Yöneticisi olarak hareket et. Sana sunulan İş Analizi Dokümanını ve mevcut konuşma geçmişini analiz et. Bu bilgilere dayanarak, projenin bir sonraki mantıksal adımı olabilecek **tek bir yeni özellik veya iyileştirme önerisi** sun.

                    **KURALLAR:**
                    - Önerin, mevcut projeye değer katacak ve kapsamı mantıklı bir şekilde genişletecek bir fikir olmalıdır.
                    - Önerini, sohbete devam etmeyi teşvik edecek şekilde bir soru olarak formüle et.
                    - Cevabın **SADECE** ve **SADECE** öneri sorusunu içermelidir. Başka hiçbir açıklama, giriş veya sonuç cümlesi ekleme.

                    **ÖRNEK ÇIKTI:**
                    "Mevcut raporlama özellikleri harika. Bir sonraki adım olarak, kullanıcıların bu raporları belirli zaman aralıklarında otomatik olarak e-posta ile alabilmeleri için bir 'Zamanlanmış Raporlar' özelliği eklemeyi değerlendirelim mi?"
                `)],
                activeVersionId: 'default',
            }
        ]
    },
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
    {
        id: 'textManipulation',
        name: 'Metin Düzenleme',
        prompts: [
            {
                id: 'rephraseText',
                name: 'Metni Yeniden İfade Etme',
                description: 'Verilen bir metni daha profesyonel veya farklı bir tonda yeniden yazar.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Sen, metinleri yeniden ifade etme konusunda uzman bir dil modelisin. Sana verilen metnin ana anlamını ve niyetini koruyarak, onu daha profesyonel, akıcı ve açık bir şekilde yeniden yaz.
                    **KURALLAR:**
                    - Sadece ve sadece yeniden yazılmış metni çıktı olarak ver.
                    - Başına veya sonuna ek açıklama, giriş cümlesi ekleme.
                    - Orijinal metindeki anahtar bilgileri ve terminolojiyi koru.
                `)],
                activeVersionId: 'default',
            },
            {
                id: 'modifySelectedText',
                name: 'Seçili Metni Değiştir',
                description: 'Verilen bir metni, yine verilen bir talimata göre değiştirir.',
                versions: [createDefaultVersion(`
                    **GÖREV:** Sen bir metin editörüsün. Sana bir "Orijinal Metin" ve bu metni değiştirmek için bir "Talimat" verilecek. Görevin, talimatı orijinal metne uygulamak ve **SADECE ve SADECE** değiştirilmiş metni geri döndürmektir.
                    **KURALLAR:**
                    - Çıktın, başka hiçbir açıklama, özür veya giriş cümlesi olmadan, yalnızca değiştirilmiş metni içermelidir.
                    - Talimat ne olursa olsun, anlamını yorumla ve en iyi şekilde uygula.
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