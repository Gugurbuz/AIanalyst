// templates.ts

// FIX: Import Template type from the central types file.
import type { Template } from './types';

export const SAMPLE_ANALYSIS_DOCUMENT = `## 1. Giriş ve Amaç
- *Bu bölüme projenin temel hedefini, hangi iş ihtiyacını karşıladığını ve tamamlandığında ne gibi bir değer yaratacağını yazın...*

## 2. Kapsam
### 2.1. Kapsam Dahilindeki Maddeler
- Örnek: Kullanıcı girişi ve profil yönetimi
- Örnek: Rapor oluşturma ve indirme

### 2.2. Kapsam Dışındaki Maddeler
- Örnek: Yönetici paneli
- Örnek: Üçüncü parti entegrasyonlar

## 3. Fonksiyonel Gereksinimler
- **FR-001:** Bir **Kullanıcı** olarak, sisteme e-posta ve şifremle **giriş yapabilmeliyim**, böylece **hesabıma güvenli bir şekilde erişebilirim**.
- **FR-002:** Bir **Kullanıcı** olarak, yeni raporlar **oluşturabilmeliyim**, böylece **verileri analiz edebilirim**.

## 4. Fonksiyonel Olmayan Gereksinimler
- **Performans:** Sayfa yüklenme süreleri 3 saniyeyi geçmemelidir.
- **Güvenlik:** Tüm kullanıcı şifreleri veritabanında şifrelenerek (hashed) saklanmalıdır.

*Yukarıdaki şablonu konuşmanızın detaylarına göre düzenleyebilir veya "AI ile Doldur" butonunu kullanarak bu bölümü otomatik olarak doldurabilirsiniz.*
`;


export const ANALYSIS_TEMPLATES: Template[] = [
    {
        id: 'default-analysis',
        name: 'Standart (Detaylı)',
        prompt: `
            **GÖREV:** Dünya standartlarında bir Kıdemli İş Analisti olarak hareket et. Sağlanan konuşma geçmişini temel alarak, bir geliştirme ekibinin incelemesine hazır, kapsamlı ve profesyonel bir İş Analizi Dokümanı oluştur.

            **FORMATLAMA KURALLARI:**
            - Çıktı, Markdown formatında olmalıdır.
            - Ana başlıklar için '##', alt başlıklar için '###' kullan.
            - Listeler için madde imleri veya numaralandırma kullan.
            - Önemli terimleri vurgulamak için **kalın** metin kullan.

            **DOKÜMAN YAPISI:**
            Doküman aşağıdaki bölümleri bu sırayla içermelidir:

            ## 1. Giriş ve Amaç
            - Bu projenin neden yapıldığını, hangi iş problemini çözdüğünü ve hedeflenen iş değerini açıkla.

            ## 2. Kapsam
            ### 2.1. Kapsam Dahilindeki Maddeler
            - Geliştirilecek olan özelliklerin net bir listesini sun.
            ### 2.2. Kapsam Dışındaki Maddeler
            - Bu projenin bir parçası olarak **yapılmayacak** olan ilgili ancak kapsam dışı bırakılan maddeleri belirt.

            ## 3. Fonksiyonel Gereksinimler
            - Tüm fonksiyonel gereksinimleri, her bir gereksinimin kolayca referans verilebilmesi için numaralandırılmış bir liste (FR-001, FR-002, vb.) halinde sun.
            - Gereksinimleri, "Bir [Kullanıcı Tipi] olarak, [bir eylem] yapabilmeliyim, böylece [bir fayda] elde edebilirim." şeklinde kullanıcı hikayesi formatında yazmaya çalış.

            ## 4. Fonksiyonel Olmayan Gereksinimler
            - Aşağıdaki kategorilerde (eğer konuşmada ima ediliyorsa) gereksinimleri listele:
                - **Performans:** Yanıt süreleri, yük kapasitesi vb.
                - **Güvenlik:** Yetkilendirme, veri gizliliği vb.
                - **Kullanılabilirlik:** Kullanıcı dostu arayüz, erişilebilirlik standartları vb.
                - **Ölçeklenebilirlik:** Gelecekteki büyümeyi destekleme kapasitesi.

            ## 5. Varsayımlar ve Kısıtlar
            - **Varsayımlar:** Projenin başarılı olması için doğru kabul edilen ancak henüz kanıtlanmamış tüm faktörleri listele.
            - **Kısıtlar:** Projeyi sınırlayan bilinen teknik, bütçe veya zaman kısıtlamalarını belirt.
            
            ## 6. Bağımlılıklar
            - Konuşmada bahsedilen iç (örn. diğer ekipler, mevcut sistemler, API'ler) veya dış (örn. üçüncü parti servisler, kütüphaneler) bağımlılıkları listele.

            ## 7. Riskler ve Önlemler
            - Konuşma geçmişinden yola çıkarak potansiyel proje risklerini (teknik, operasyonel vb.) ve her bir risk için önerilen önleyici veya azaltıcı stratejileri listele.
        `
    },
    {
        id: 'corporate-standard-analysis',
        name: 'Kurumsal Standart (Word Uyumlu)',
        prompt: `
            **GÖREV:** Sen, kurumsal standartlarda iş analizi dokümanları hazırlayan, son derece deneyimli ve titiz bir Kıdemli İş Analistisin. Sağlanan konuşma geçmişini temel alarak, aşağıdaki yapıya ve formata **KESİNLİKLE** bağlı kalarak kapsamlı bir İş Analizi Dokümanı oluştur.

            **FORMATLAMA KURALLARI:**
            - Çıktı, Markdown formatında olmalıdır.
            - Ana başlıklar için \`## [Numara]. BAŞLIK\` formatını kullan. Örnek: \`## 1. ANALİZ KAPSAMI\`.
            - Alt başlıklar için \`### [Numara].[Alt Numara]. Alt Başlık\` formatını kullan. Örnek: \`### 3.1. Detay İş Kuralları\`.
            - Madde imleri için \`•\` karakterini kullan.
            - İş kuralları için \`BR-1\`, fonksiyonel gereksinimler için \`FR-1\` gibi kodlamalar kullan.
            - GWT (Given-When-Then) formatını kabul kriterlerinde kullanmaya özen göster.
            - Her ana bölüm arasına \`---\` ayıracı koy.

            **DOKÜMAN YAPISI (KESİNLİKLE BU YAPIYI KULLAN):**

            ## 1. ANALİZ KAPSAMI
            •	**Proje Adı:** [Konuşmadan çıkarılan proje adını yaz]
            •	**Amaç:** [Projenin temel amacını 1-2 cümleyle özetle]
            •	**İş Hedefleri:** [Konuşmada belirtilen ölçülebilir hedefleri (KPI, metrik) madde imleriyle listele]
            •	**Kapsam (In-Scope):** [Proje kapsamında yapılacak ana maddeleri listele]
            •	**Kapsam Dışı (Out-of-Scope):** [Proje kapsamında **yapılmayacak** olan ilgili maddeleri listele]
            ---
            ## 2. KISALTMALAR
            •	[Konuşmada geçen veya konuyla ilgili teknik/iş kısaltmalarını ve açıklamalarını listele]
            ---
            ## 3. İŞ GEREKSİNİMLERİ
            [İş ihtiyacını ve bu ihtiyacın arkasındaki mantığı özetleyen genel bir paragraf yaz.]
            ### 3.1. Detay İş Kuralları
            •	**BR-1:** [İş kuralı 1]
            •	**BR-2:** [İş kuralı 2]
            •	...
            ### 3.2. İş Modeli ve Kullanıcı Gereksinimleri
            •	**Roller/Personalar:** [Sistemdeki kullanıcı rollerini ve sorumluluklarını listele (Müşteri, Admin vb.)]
            •	**Senaryolar:** [Temel kullanıcı senaryolarını veya kullanım durumlarını madde imleriyle açıkla]
            ---
            ## 4. FONKSİYONEL GEREKSİNİMLER (FR)
            ### 4.1. Fonksiyonel Gereksinim Maddeleri
            •	**FR-1 ([Gereksinim Adı]):**
            •	**Kullanıcı Hikayesi:** Bir [Kullanıcı Tipi] olarak, [bir eylem yapmak] istiyorum, böylece [bir fayda elde edebilirim].
            •	**Kabul Kriterleri (GWT):** Durum [ön koşul] iken, Ne zaman ki [eylem], O zaman [beklenen sonuç].
            •	**Negatif Senaryo:** [Hata durumu veya olumsuz senaryo].
            •	... [Diğer tüm FR'lar için bu formatı tekrarla] ...
            ### 4.2. Süreç Akışı
            •	[Ana sürecin adımlarını özetle. Varsa alternatif veya hata akışlarını da belirt.]
            ---
            ## 5. FONKSİYONEL OLMAYAN GEREKSİNİMLER (NFR)
            •	**Performans:** [Yanıt süresi, kapasite gibi gereksinimler]
            •	**Kullanılabilirlik:** [Servis çalışma süresi (örn. %99.9), erişilebilirlik (WCAG) gibi gereksinimler]
            •	**Uyumluluk:** [KVKK, PII gibi yasal uyumluluk gereksinimleri]
            ### 5.1. Güvenlik ve Yetkilendirme Gereksinimleri
            •	**RBAC/ABAC:** [Rol bazlı veya öznitelik bazlı erişim kontrol kurallarını tanımla]
            •	**Şifreleme:** [Verinin nasıl şifreleneceğini belirt]
            •	**Denetim (Audit):** [Hangi işlemlerin loglanması gerektiğini belirt]
            ---
            ## 6. SÜREÇ RİSK ANALİZİ
            •	[Potansiyel operasyonel, teknik ve uyumluluk risklerini ve bu riskleri azaltma (mitigasyon) stratejilerini listele.]
            ### 6.1. Kısıtlar ve Varsayımlar
            •	**Kısıt:** [Projeyi sınırlayan teknik veya iş kısıtlamaları]
            •	**Varsayım:** [Projenin başarılı olması için doğru kabul edilen varsayımlar]
            ### 6.2. Bağımlılıklar
            •	[Projenin bağlı olduğu diğer sistemleri, ekipleri veya servisleri listele]
            ### 6.3. Süreç Etkileri
            •	[Bu projenin etkileyeceği diğer iş süreçlerini veya departmanları belirt]
            ---
            ## 7. ONAY
            ### 7.1. İş Analizi
            •	[Dokümanı gözden geçirmesi gereken paydaşları veya departmanları listele]
            ### 7.2. Değişiklik Kayıtları
            •	v0.1: İlk taslak oluşturuldu.
            ### 7.3. Doküman Onay
            •	[Onay sürecindeki rolleri belirt (RACI matrisi gibi)]
            ### 7.4. Referans Dokümanlar
            •	[Varsa, bu analize referans olan diğer dokümanları listele]
            ---
            ## 8. FONKSİYONEL TASARIM DOKÜMANLARI
            •	[API Sözleşmesi, ER Diyagramı, Akış Diyagramı, UI Mockup gibi ilgili tasarım dokümanlarına referanslar ekle. Eğer bu bilgiler konuşmadan çıkarılabiliyorsa, özetle.]
        `
    },
    {
        id: 'agile-story',
        name: 'Çevik (Agile) Kullanıcı Hikayesi',
        prompt: `
            **GÖREV:** Çevik (Agile) bir ortamda çalışan bir İş Analisti olarak, sağlanan konuşma geçmişini temel alarak Kullanıcı Hikayeleri odaklı bir analiz dokümanı oluştur.

            **FORMATLAMA KURALLARI:**
            - Çıktı, Markdown formatında olmalıdır.
            - Ana başlıklar için '##' kullan.

            **DOKÜMAN YAPISI:**
            ## 1. Proje Vizyonu
            - Projenin genel hedefini ve kullanıcıya katacağı değeri 1-2 cümle ile özetle.

            ## 2. Kapsam
            - Kapsam dahilindeki ve dışındaki ana özellikleri madde imleri ile kısaca listele.

            ## 3. Kullanıcı Hikayeleri
            - Her bir fonksiyonel gereksinim için aşağıdaki formatta bir kullanıcı hikayesi oluştur:
            
            **Hikaye ID:** US-001
            **Başlık:** [Kullanıcı Hikayesi Başlığı]
            **Kullanıcı Hikayesi:** Bir **[Kullanıcı Tipi]** olarak, **[bir hedef]** gerçekleştirmek istiyorum, böylece **[bir neden/fayda]** elde edebilirim.
            
            **Kabul Kriterleri:**
            - [ ] Kriter 1: [Beklenen davranış]
            - [ ] Kriter 2: [Beklenen davranış]
            - [ ] Kriter 3: [Hata durumu veya sınır koşulu]
            ---
        `
    },
     {
        id: 'mvp-spec',
        name: 'MVP (Minimum Uygulanabilir Ürün)',
        prompt: `
            **GÖREV:** Bir MVP (Minimum Viable Product) tanımlaması yapan bir Ürün Yöneticisi olarak, sağlanan konuşma geçmişindeki en temel gereksinimlere odaklanarak son derece yalın bir spesifikasyon dokümanı oluştur.

            **FORMATLAMA KURALLARI:**
            - Çıktı, Markdown formatında olmalıdır ve mümkün olduğunca kısa ve öz olmalıdır.
            - Ana başlıklar için '##' kullan.

            **DOKÜMAN YAPISI:**

            ## 1. Çözülen Temel Problem
            - Kullanıcının hangi acil sorununu çözüyoruz? (En fazla 2 cümle)

            ## 2. MVP Çözümü
            - Bu problemi çözmek için geliştirilecek olan **mutlak minimum** özellikler nelerdir? Madde imleri ile listele.

            ## 3. Ana Başarı Metriği
            - Bu MVP'nin başarılı olup olmadığını anlamak için takip edilecek **tek ve en önemli** metrik nedir? (Örn: Günlük aktif kullanıcı sayısı, % dönüşüm oranı vb.)
            
            ## 4. Kapsam Dışı
            - MVP'nin ilk versiyonunda **kesinlikle olmayacak** özellikler nelerdir?
        `
    }
];


export const TEST_SCENARIO_TEMPLATES: Template[] = [
    {
        id: 'default-test',
        name: 'Standart (Detaylı)',
        prompt: `
            **GÖREV:** Deneyimli ve titiz bir Kıdemli Kalite Güvence (QA) Mühendisi olarak hareket et. Sağlanan İş Analizi Dokümanındaki her bir fonksiyonel gereksinimi (FR) test etmek için kapsamlı test senaryoları oluştur.

            **FORMATLAMA KURALLARI:**
            - Çıktı, **yalnızca** aşağıda belirtilen sütunları içeren bir Markdown tablosu olmalıdır. Tablo dışında hiçbir metin (giriş, açıklama, sonuç vb.) ekleme.
            - 'Uygulama Adımları' sütununda numaralandırılmış bir liste kullan.

            **TEST KAPSAMI:**
            Her bir fonksiyonel gereksinim için pozitif, negatif ve sınır durumlarını kapsayan test senaryoları oluştur.

            **TABLO YAPISI:**

            | Senaryo ID | Test Durumu Açıklaması | Ön Koşullar | Test Verisi | Uygulama Adımları | Beklenen Sonuç |
            |------------|------------------------|-------------|-------------|-------------------|----------------|
            | TC-FR001-01| [Açıklama]             | [Koşul]     | [Veri]      | 1. ... <br> 2. ...  | [Sonuç]        |

            - **Senaryo ID:** Her test senaryosuna benzersiz bir kimlik ata. İlgili fonksiyonel gereksinim kimliğini (örn. FR-001) içermelidir. Örnek: \`TC-FR001-01\`.
            - **Test Durumu Açıklaması:** Test edilen senaryonun kısa ve net bir özeti.
            - **Ön Koşullar:** Testin yürütülebilmesi için sağlanması gereken durumlar (örn. 'Kullanıcı sisteme giriş yapmış olmalı'). Gerekmiyorsa 'Yok' yaz.
            - **Test Verisi:** Test sırasında kullanılacak spesifik veri örnekleri (örn. 'Kullanıcı adı: testuser, Şifre: P@ssword123'). Gerekmiyorsa 'Yok' yaz.
            - **Uygulama Adımları:** Testi yeniden oluşturmak için gereken adımların sıralı listesi.
            - **Beklenen Sonuç:** Uygulama adımları takip edildiğinde sistemin vermesi gereken spesifik ve doğrulanabilir sonuç.
        `
    },
    {
        id: 'bdd-test',
        name: 'Basit BDD (Davranış Odaklı Geliştirme)',
        prompt: `
            **GÖREV:** BDD (Behavior-Driven Development) yaklaşımını benimseyen bir otomasyon mühendisi olarak, sağlanan İş Analizi Dokümanındaki gereksinimler için Gherkin sözdiziminde test senaryoları yaz.

            **FORMATLAMA KURALLARI:**
            - Çıktı, Markdown formatında olmalıdır. Her senaryo arasında bir ayırıcı (---) kullan.
            - Başka hiçbir ek açıklama veya metin ekleme.

            **SENARYO YAPISI:**
            
            **Özellik:** [Test edilen özelliğin kısa açıklaması]
            
            **Senaryo:** [Senaryonun başlığı - Örn: Geçerli kimlik bilgileriyle kullanıcı girişi]
            **Verilen** [Ön koşul veya bağlam - Örn: Kullanıcı giriş sayfasındadır]
            **Ve** [Ek bir ön koşul]
            **Ne zaman** [Kullanıcının yaptığı eylem - Örn: Kullanıcı adı ve şifresini girip 'Giriş Yap' butonuna tıklar]
            **O zaman** [Beklenen sonuç - Örn: Kullanıcı ana sayfaya yönlendirilmelidir]
            **Ve** [Ek bir beklenen sonuç - Örn: Ekranda "Hoş geldiniz" mesajı görülmelidir]
            
            ---
        `
    },
    {
        id: 'checklist-test',
        name: 'Kontrol Listesi (Checklist)',
        prompt: `
            **GÖREV:** Bir Kullanıcı Kabul Testi (UAT) sürecini yürüten bir iş analisti olarak, sağlanan İş Analizi Dokümanına dayalı olarak basit ve anlaşılır bir kontrol listesi (checklist) formatında test maddeleri oluştur.

            **FORMATLAMA KURALLARI:**
            - Çıktı, **yalnızca** aşağıda belirtilen sütunları içeren bir Markdown tablosu olmalıdır. Başka hiçbir metin ekleme.
            
            **TABLO YAPISI:**

            | ID  | Test Edilecek Durum                                    | Durum (Başarılı/Başarısız) | Notlar |
            |-----|--------------------------------------------------------|--------------------------|--------|
            | 1   | [Test edilecek ilk durumun net açıklaması]              |                          |        |
            | 2   | [Test edilecek ikinci durumun net açıklaması]             |                          |        |
        `
    }
];