import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, MessagesSquare, FileText, Zap, Workflow, Sparkles, Mail, Github, Users, Briefcase, Rocket, ChevronDown } from 'lucide-react';

interface LandingPageProps {
    onLoginClick: () => void;
    onSignupClick: () => void;
}

const LogoIcon = ({ className, theme = 'light' }: { className?: string; theme?: 'light' | 'dark' }) => {
    const colors = theme === 'light'
        ? { path: '#4f46e5', circle: '#a5b4fc' } 
        : { path: '#6366f1', circle: '#818cf8' };

    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
          <path fill={colors.path} d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
          <circle fill={colors.circle} cx="50" cy="58" r="10"/>
        </svg>
    );
};

const AuthModal = ({ onClose, onProceed }: { onClose: () => void; onProceed: () => void; }) => {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-70 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            <div className="bg-gray-900 text-white p-8 rounded-2xl w-full max-w-md relative border border-gray-700 shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <div className="flex justify-center mb-6">
                         <LogoIcon className="w-12 h-12" theme="dark" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3">Devam etmek için giriş yapın</h2>
                    <p className="text-gray-400 mb-8">
                        Asisty.AI'yi kullanmak için mevcut bir hesapla giriş yapmalı veya yeni bir hesap oluşturmalısınız.
                    </p>
                    <div className="space-y-4">
                        <button onClick={onProceed} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-semibold">
                           <Mail className="w-5 h-5" />
                           E-posta ile Devam Et
                        </button>
                    </div>
                     <p className="text-xs text-gray-500 mt-8">
                        Devam ederek <a href="#" className="underline hover:text-white">Hizmet Şartları</a>'nı kabul etmiş ve <a href="#" className="underline hover:text-white">Gizlilik Politikası</a>'nı onaylamış olursunuz.
                    </p>
                </div>
            </div>
        </div>
    );
};

const FAQItem: React.FC<{ question: string; answer: string; isOpen: boolean; onClick: () => void }> = ({ question, answer, isOpen, onClick }) => (
    <div className="border-b border-gray-200 py-6">
        <button onClick={onClick} className="w-full flex justify-between items-center text-left">
            <span className="text-lg font-medium text-gray-900">{question}</span>
            <ChevronDown className={`w-6 h-6 text-indigo-600 transition-transform duration-300 ${isOpen ? 'transform rotate-180' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 mt-4' : 'max-h-0'}`}>
            <p className="text-base text-gray-600">{answer}</p>
        </div>
    </div>
);


export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onSignupClick }) => {
    const [isAnnual, setIsAnnual] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [openFAQ, setOpenFAQ] = useState<number | null>(null);

    useEffect(() => {
        document.title = "Asisty.AI - İş Analizinizi Yapay Zeka ile Güçlendirin";
    }, []);

    const pageStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', sans-serif; background-color: #f7faff; color: #111827; }
        .glow-arc { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 200%; height: 1000px; z-index: 10; }
        .glow-arc::before { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 50%; background: linear-gradient(to top, #f7faff 10%, transparent); z-index: 12; }
        .glow-arc::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 1600px; height: 800px; border-top: 2px solid rgba(79, 70, 229, 0.4); border-radius: 50%; box-shadow: 0 -20px 100px 0px rgba(79, 70, 229, 0.2); z-index: 11; }
        .feature-icon-list svg { width: 1.25rem; height: 1.25rem; flex-shrink: 0; color: #4f46e5; }
        .pricing-toggle-bg { transition: background-color 0.3s ease; }
        .pricing-toggle-dot { transition: transform 0.3s ease; transform: translateX(0); }
        input:checked + .pricing-toggle-bg .pricing-toggle-dot { transform: translateX(100%); }
    `;

    const faqs = [
        { q: "Asisty.AI tam olarak nasıl çalışır?", a: "Asisty.AI, sizinle bir iş analisti gibi sohbet ederek proje gereksinimlerinizi anlar. Bu sohbeti temel alarak otomatik olarak iş analizi dokümanı, test senaryoları, süreç diyagramları ve proje görevleri gibi kritik dokümanları oluşturur." },
        { q: "Verilerim güvende mi?", a: "Evet, veri güvenliği bizim için en önemli önceliktir. Tüm verileriniz endüstri standardı şifreleme yöntemleriyle korunur ve asla üçüncü partilerle paylaşılmaz." },
        { q: "Hangi dilleri destekliyor?", a: "Asisty.AI şu anda öncelikli olarak Türkçe dilinde en iyi performansı göstermektedir, ancak İngilizce gibi diğer dilleri anlama ve yanıtlama yeteneğine de sahiptir." },
        { q: "Ücretsiz planda neler var?", a: "Ücretsiz plan, bireysel kullanıcıların ve küçük projelerin Asisty.AI'nin temel özelliklerini denemesi için tasarlanmıştır. Belirli bir token kullanım limiti ve doküman sınırı içerir. Detaylar için fiyatlandırma bölümümüzü inceleyebilirsiniz." }
    ];

    return (
        <>
            <style>{pageStyles}</style>
            
            <div className="flex flex-col w-full overflow-x-hidden antialiased">
                <div className="relative min-h-screen w-full flex flex-col items-center overflow-hidden" style={{backgroundColor: '#f7faff'}}>
                    <header className="absolute top-0 left-0 right-0 w-full py-4 z-50">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-14">
                            <a href="#" className="flex items-center gap-2" aria-label="Asisty.AI Ana Sayfa">
                                <LogoIcon className="w-8 h-8" theme="light" />
                                <span className="text-2xl font-bold text-gray-900">Asisty.AI</span>
                            </a>
                            <div className="hidden md:flex items-center gap-6">
                                <a href="#features" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Özellikler</a>
                                <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Fiyatlandırma</a>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={onLoginClick} className="text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors">Giriş Yap</button>
                                <button onClick={onSignupClick} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                                    Ücretsiz Başla
                                </button>
                            </div>
                        </div>
                    </header>
                    <main className="flex-1 flex flex-col justify-center items-center w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-10 pb-40 z-20">
                        <div className="mb-5">
                            <span className="inline-flex items-center gap-2 px-4 py-1 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-full">
                                <span className="font-bold">Asisty.AI</span> İş Analiz Asistanınız
                            </span>
                        </div>
                        <h1 
                            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter text-gray-900 leading-tight"
                            dangerouslySetInnerHTML={{ __html: 'Fikirlerinizi, Yapay Zeka ile <span class="text-indigo-600">Projelere</span> Dönüştürün' }}
                        ></h1>
                        <p className="mt-6 max-w-2xl text-lg sm:text-xl text-gray-600">
                           Asisty.AI, iş analizi süreçlerinizi otomatikleştirerek zaman kazandırır ve projelerinizin başarı oranını artırır. Sohbet ederek kapsamlı iş analizleri, kullanıcı hikayeleri ve test senaryoları oluşturun.
                        </p>
                        <form
                            onSubmit={(e) => { e.preventDefault(); setIsAuthModalOpen(true); }}
                            className="w-full max-w-3xl mt-10"
                        >
                           <div className="relative w-full p-2 bg-white rounded-2xl shadow-xl border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                                <textarea
                                    name="prompt" rows={3}
                                    className="w-full p-4 pr-16 text-base text-gray-700 border-none resize-none outline-none focus:ring-0 placeholder:text-gray-400"
                                    placeholder="Örn: E-ticaret sitem için ödeme akışı test senaryoları oluştur..."
                                ></textarea>
                                <button type="submit"
                                    className="absolute right-5 bottom-5 flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    aria-label="Analizi Başlat"
                                > <Sparkles className="w-6 h-6 text-white" /> </button>
                            </div>
                        </form>
                    </main>
                    <div className="glow-arc" aria-hidden="true"></div>
                </div>
                
                <section id="features" className="w-full py-20 md:py-32 bg-white z-20">
                     <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="max-w-3xl mx-auto text-center">
                            <span className="text-base font-semibold leading-7 text-indigo-600">Özellikler</span>
                            <h2 className="mt-2 text-4xl font-extrabold tracking-tighter text-gray-900 sm:text-5xl">
                                İş Akışınızı Güçlendirecek Her Şey
                            </h2>
                            <p className="mt-6 text-lg text-gray-600">
                                Asisty.AI, fikir aşamasından dokümantasyona kadar tüm iş analizi sürecinizi tek bir platformda birleştirir.
                            </p>
                        </div>
                        
                        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><MessagesSquare className="w-6 h-6" /></div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Sohbet Tabanlı Analiz</h3>
                                <p className="mt-2 text-base text-gray-600">Doğal dilde konuşarak gereksinimleri, kullanıcı hikayelerini ve kabul kriterlerini anında oluşturun.</p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><FileText className="w-6 h-6" /></div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Otomatik Dokümantasyon</h3>
                                <p className="mt-2 text-base text-gray-600">Yapay zekanın ürettiği çıktılar, Markdown destekli zengin metin editörünüze anında yansır.</p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><Sparkles className="w-6 h-6" /></div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Akıllı Fikir Üretimi</h3>
                                <p className="mt-2 text-base text-gray-600">Mevcut dokümanlarınızı "Özetle", "Basitleştir" veya "Devam Et" komutlarıyla anında düzenleyin.</p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><Zap className="w-6 h-6" /></div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Hazır Şablonlar</h3>
                                <p className="mt-2 text-base text-gray-600">Test senaryoları, proje kapsamı veya gereksinim listeleri gibi kanıtlanmış şablonlar üzerinden ilerleyin.</p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><Workflow className="w-6 h-6" /></div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Süreç Görselleştirme</h3>
                                <p className="mt-2 text-base text-gray-600">Analizlerinizi ve iş akışlarınızı otomatik olarak Mermaid veya BPMN diyagramlarına dönüştürün.</p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><Briefcase className="w-6 h-6" /></div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Backlog Yönetimi</h3>
                                <p className="mt-2 text-base text-gray-600">Oluşturulan analizlerden tek tıkla proje görevleri (backlog) oluşturun ve Kanban panosunda yönetin.</p>
                            </div>
                        </div>
                    </div>
                </section>
                
                 <section className="w-full py-20 md:py-32 bg-gray-50 z-20">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="max-w-3xl mx-auto text-center">
                             <span className="text-base font-semibold leading-7 text-indigo-600">Kimin İçin?</span>
                            <h2 className="mt-2 text-4xl font-extrabold tracking-tighter text-gray-900 sm:text-5xl">
                                Her Rol İçin Güçlü Bir Araç
                            </h2>
                        </div>
                        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-gray-200">
                                <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-indigo-100 rounded-full"><Briefcase className="w-8 h-8 text-indigo-600"/></div>
                                <h3 className="text-xl font-bold text-gray-900">İş Analistleri</h3>
                                <p className="mt-2 text-gray-600">Tekrarlayan dokümantasyon işlerini otomatikleştirin, gereksinimleri daha hızlı toplayın ve paydaşlarla daha verimli iletişim kurun.</p>
                            </div>
                             <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-gray-200">
                                <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-indigo-100 rounded-full"><Users className="w-8 h-8 text-indigo-600"/></div>
                                <h3 className="text-xl font-bold text-gray-900">Ürün Yöneticileri</h3>
                                <p className="mt-2 text-gray-600">Fikirleri hızla yapılandırılmış planlara dönüştürün, kullanıcı hikayeleri oluşturun ve ürün yol haritanızı netleştirin.</p>
                            </div>
                             <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-gray-200">
                                <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-indigo-100 rounded-full"><Rocket className="w-8 h-8 text-indigo-600"/></div>
                                <h3 className="text-xl font-bold text-gray-900">Startup Kurucuları</h3>
                                <p className="mt-2 text-gray-600">MVP'nizin kapsamını hızla belirleyin, teknik ekibiniz için net görevler oluşturun ve yatırımcılara sunumlarınızı güçlendirin.</p>
                            </div>
                        </div>
                    </div>
                 </section>

                <section id="pricing" className="w-full py-20 md:py-32 bg-white z-20">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="max-w-3xl mx-auto text-center">
                            <span className="text-base font-semibold leading-7 text-indigo-600">Fiyatlandırma</span>
                            <h2 className="mt-2 text-4xl font-extrabold tracking-tighter text-gray-900 sm:text-5xl">
                                Size Uygun Planı Seçin
                            </h2>
                            <p className="mt-6 text-lg text-gray-600">
                                Bireysel kullanım için ücretsiz başlayın veya ekibiniz için gelişmiş özellikleri açın.
                            </p>
                        </div>

                        <div className="mt-16 flex justify-center items-center gap-4">
                            <span className={`text-sm font-medium ${isAnnual ? 'text-gray-500' : 'text-indigo-600'}`}>Aylık</span>
                            <label htmlFor="pricing-toggle" className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="pricing-toggle" className="sr-only peer" checked={isAnnual} onChange={() => setIsAnnual(!isAnnual)} />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 pricing-toggle-bg peer-checked:bg-indigo-600">
                                    <div className="absolute top-0.5 left-[2px] bg-white border border-gray-300 rounded-full h-5 w-5 pricing-toggle-dot"></div>
                                </div>
                            </label>
                            <span className={`text-sm font-medium ${isAnnual ? 'text-indigo-600' : 'text-gray-500'}`}>
                                Yıllık (%20 İndirim)
                            </span>
                        </div>

                        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-200 flex flex-col">
                                <h3 className="text-xl font-semibold text-gray-900">Temel</h3>
                                <p className="mt-4 text-4xl font-bold tracking-tight text-gray-900">0₺</p>
                                <p className="mt-3 text-base text-gray-600">Bireysel kullanım ve denemeler için.</p>
                                <button onClick={onSignupClick} className="mt-8 block w-full text-center px-6 py-3 text-base font-medium text-indigo-600 bg-white border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                                    Ücretsiz Başla
                                </button>
                                <ul className="mt-8 space-y-3 text-sm text-gray-600 feature-icon-list">
                                    <li className="flex items-center gap-3"><CheckCircle2 />1,000,000 Token (Tek Seferlik)</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />5 Doküman Sınırı</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Temel AI Özellikleri</li>
                                </ul>
                            </div>
                            <div className="bg-indigo-600 p-8 rounded-3xl shadow-2xl relative flex flex-col">
                                <span className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 inline-flex items-center px-4 py-1 text-sm font-medium text-white bg-indigo-800 rounded-full">
                                    Önerilen
                                </span>
                                <h3 className="text-xl font-semibold text-white">Pro</h3>
                                <p className="mt-4 text-4xl font-bold tracking-tight text-white">
                                    {isAnnual ? '160₺' : '200₺'}
                                    <span className="text-sm font-medium text-indigo-100">/kullanıcı/ay</span>
                                </p>
                                <p className="mt-3 text-base text-indigo-100">Profesyoneller ve küçük ekipler için.</p>
                                <button onClick={onSignupClick} className="mt-8 block w-full text-center px-6 py-3 text-base font-medium text-indigo-700 bg-white rounded-lg hover:bg-gray-100 transition-colors">
                                    Pro'yu Başlat
                                </button>
                                <ul className="mt-8 space-y-3 text-sm text-indigo-50 feature-icon-list">
                                    <li className="flex items-center gap-3"><CheckCircle2 />15,000,000 Token/ay</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Sınırsız Doküman</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Gelişmiş AI Özellikleri</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Entegrasyonlar</li>
                                </ul>
                            </div>
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-200 flex flex-col">
                                <h3 className="text-xl font-semibold text-gray-900">Kurumsal</h3>
                                <p className="mt-4 text-4xl font-bold tracking-tight text-gray-900">Özel</p>
                                <p className="mt-3 text-base text-gray-600">Büyük ölçekli ekipler ve özel ihtiyaçlar için.</p>
                                <a href="mailto:destek@asisty.ai" className="mt-8 block w-full text-center px-6 py-3 text-base font-medium text-indigo-600 bg-white border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                                    İletişime Geçin
                                </a>
                                <ul className="mt-8 space-y-3 text-sm text-gray-600 feature-icon-list">
                                    <li className="flex items-center gap-3"><CheckCircle2 />Özelleştirilebilir Token Limiti</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Pro'daki Her Şey</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Özel Güvenlik (SSO)</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Öncelikli Destek</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>
                
                 <section className="w-full py-20 md:py-32 bg-gray-50 z-20">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="max-w-3xl mx-auto text-center">
                            <h2 className="text-4xl font-extrabold tracking-tighter text-gray-900 sm:text-5xl">
                                Sıkça Sorulan Sorular
                            </h2>
                        </div>
                        <div className="mt-12 max-w-3xl mx-auto">
                            {faqs.map((faq, index) => (
                                <FAQItem 
                                    key={index}
                                    question={faq.q}
                                    answer={faq.a}
                                    isOpen={openFAQ === index}
                                    onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                                />
                            ))}
                        </div>
                    </div>
                </section>
                
                <section className="w-full py-20 md:py-32 bg-gray-900 z-20">
                    <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
                        <h2 className="text-4xl font-extrabold tracking-tighter text-white">
                            İş analiz süreçlerinizi otomatikleştirmeye hazır mısınız?
                        </h2>
                        <p className="mt-6 text-xl text-indigo-100">
                            Hemen ücretsiz başlayın ve Asisty.AI'nin gücünü keşfedin. Kredi kartı gerekmez.
                        </p>
                        <button 
                            onClick={onSignupClick}
                            className="mt-10 inline-flex items-center px-8 py-4 text-lg font-medium text-indigo-700 bg-white rounded-lg shadow-sm hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
                        >
                            Analize Başla
                        </button>
                    </div>
                </section>
                
                <footer className="w-full py-16 bg-gray-900 z-20 border-t border-gray-700">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center text-gray-400">
                        <p>&copy; {new Date().getFullYear()} Asisty.AI. Tüm hakları saklıdır.</p>
                    </div>
                </footer>
            </div>
            {isAuthModalOpen && (
                <AuthModal
                    onClose={() => setIsAuthModalOpen(false)}
                    onProceed={onLoginClick}
                />
            )}
        </>
    );
}