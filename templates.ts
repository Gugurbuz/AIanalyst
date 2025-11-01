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
