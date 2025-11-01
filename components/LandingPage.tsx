import React, { useEffect, useState } from 'react';

interface LandingPageProps {
    onLoginClick: () => void;
    onSignupClick: () => void;
}

// --- ICON COMPONENTS ---
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const AuthModal = ({ onClose, onProceed }: { onClose: () => void; onProceed: () => void; }) => {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-70 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            <div className="bg-gray-900 text-white p-8 rounded-2xl w-full max-w-md relative border border-gray-700 shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <div className="flex justify-center mb-6">
                         <svg className="w-10 h-10 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"> 
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1.5-7.5h3v-3h-3v3zm0-4.5h3v-3h-3v3z"/>
                         </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-3">Devam etmek için giriş yapın</h2>
                    <p className="text-gray-400 mb-8">
                        Asisty.ai'yi kullanmak için mevcut bir hesapla giriş yapmalı veya yeni bir hesap oluşturmalısınız.
                    </p>

                    <div className="space-y-4">
                        <button disabled className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.599-1.506 12.49-4.07l-5.285-4.113c-1.746 1.182-4.055 1.887-6.71 1.887c-5.22 0-9.605-3.375-11.285-7.94l-6.522 5.023C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.285 4.113c3.044-2.822 4.955-7.042 4.955-11.684c0-1.341-.138-2.65-.389-3.917z"></path></svg>
                            <span className="font-semibold">Google ile Devam Et</span>
                        </button>
                        <button disabled className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12A12 12 0 0 0 12 0z"></path></svg>
                            <span className="font-semibold">GitHub ile Devam Et</span>
                        </button>
                        <button onClick={onProceed} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-semibold">
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


export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onSignupClick }) => {
    const [isAnnual, setIsAnnual] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    useEffect(() => {
        document.title = "Asisty.AI - İş Analizinizi Yapay Zeka ile Güçlendirin";
    }, []);

    const pageStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        html {
            scroll-behavior: smooth;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: #f7faff;
            color: #111827;
        }

        .glow-arc {
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 200%;
            height: 1000px;
            z-index: 10;
        }

        .glow-arc::before {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(to top, #f7faff 10%, transparent);
            z-index: 12;
        }

        .glow-arc::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            max-width: 1600px;
            height: 800px;
            border-top: 2px solid rgba(79, 70, 229, 0.4);
            border-radius: 50%;
            box-shadow: 0 -20px 100px 0px rgba(79, 70, 229, 0.2);
            z-index: 11;
        }

        .feature-icon-list svg {
            width: 1.25rem;
            height: 1.25rem;
            flex-shrink: 0;
            color: #4f46e5;
        }

        .pricing-toggle-bg {
            transition: background-color 0.3s ease;
        }
        .pricing-toggle-dot {
            transition: transform 0.3s ease;
            transform: translateX(0);
        }
        input:checked + .pricing-toggle-bg .pricing-toggle-dot {
            transform: translateX(100%);
        }
    `;

    const CheckCircleIcon = () => (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
    const SparklesIcon = (props: React.SVGProps<SVGSVGElement>) => ( 
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.624L16.5 21.75l-.398-1.126a3.375 3.375 0 00-2.456-2.456L12.75 18l1.126-.398a3.375 3.375 0 002.456-2.456L16.5 14.25l.398 1.126a3.375 3.375 0 002.456 2.456L20.25 18l-1.126.398a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
    );
    const ChatBubbleLeftRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.722.534c-1.104.15-2.096.6-2.884 1.255l-2.024 1.518a.75.75 0 01-1.06 0l-2.024-1.518c-.788-.656-1.78-1.106-2.884-1.256l-3.722-.534A2.25 2.25 0 012.25 15v-4.286c0-.97.609-1.813 1.5-2.097m16.5 0c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.722.534c-1.104.15-2.096.6-2.884 1.255l-2.024 1.518a.75.75 0 01-1.06 0l-2.024-1.518c-.788-.656-1.78-1.106-2.884-1.256l-3.722-.534A2.25 2.25 0 012.25 15v-4.286c0-.97.609-1.813 1.5-2.097m16.5 0a8.25 8.25 0 00-16.5 0H20.25z" />
        </svg>
    );
    const DocumentTextIcon = (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
    );
    const BoltIcon = (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
    );
    const PencilSquareIcon = (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
    );
    const ShareIcon = (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.19.02.38.05.57.09.57.15.99.53.99 1.1v.34c0 .57-.42 1.05-.99 1.1a.75.75 0 00-.57.09m0 0a2.25 2.25 0 100 2.186m0-2.186a2.25 2.25 0 110-2.186m11.623-1.428a2.25 2.25 0 01-.049 2.186m0 0a2.25 2.25 0 01-2.134 1.355m2.134-1.355a2.25 2.25 0 002.134-1.355m0 0c.046-.1.087-.202.12-.305m-2.134 2.186a2.25 2.25 0 00-.498-2.186m0 0a2.25 2.25 0 00-2.134-1.355M17.25 10.5a2.25 2.25 0 110 2.186m0-2.186c.19.02.38.05.57.09.57.15.99.53.99 1.1v.34c0 .57-.42 1.05-.99 1.1a.75.75 0 00-.57.09m0 0a2.25 2.25 0 110 2.186m0-2.186a2.25 2.25 0 100 2.186m-7.623-1.428a2.25 2.25 0 01-.049 2.186m0 0a2.25 2.25 0 01-2.134 1.355m2.134-1.355a2.25 2.25 0 002.134-1.355m0 0c.046-.1.087-.202.12-.305m-2.134 2.186a2.25 2.25 0 00-.498-2.186m0 0a2.25 2.25 0 00-2.134-1.355M6.75 10.5a2.25 2.25 0 110 2.186m0-2.186c.19.02.38.05.57.09.57.15.99.53.99 1.1v.34c0 .57-.42 1.05-.99 1.1a.75.75 0 00-.57.09m0 0a2.25 2.25 0 110 2.186m0-2.186a2.25 2.25 0 100 2.186" />
        </svg>
    );

    return (
        <>
            <style>{pageStyles}</style>
            
            <div className="flex flex-col w-full overflow-x-hidden antialiased">
                <div className="relative min-h-screen w-full flex flex-col items-center overflow-hidden" style={{backgroundColor: '#f7faff'}}>
                    <header className="absolute top-0 left-0 right-0 w-full py-4 z-50">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-14">
                            <a href="#" className="flex items-center gap-2" aria-label="Asisty.ai Ana Sayfa">
                                <svg className="w-8 h-8 text-indigo-600" fill="currentColor" viewBox="0 0 24 24"> 
                                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1.5-7.5h3v-3h-3v3zm0-4.5h3v-3h-3v3z"/>
                                </svg>
                                <span className="text-2xl font-bold text-gray-900">Asisty.ai</span>
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
                            dangerouslySetInnerHTML={{ __html: 'Yapay zeka ile <span class="text-indigo-600"> analiz </span> gücünüzü serbest bırakın.' }}
                        ></h1>
                        <p className="mt-6 max-w-2xl text-lg sm:text-xl text-gray-600">
                            Yapay zeka ile sohbet ederek kapsamlı iş analizleri, kullanıcı hikayeleri ve test senaryoları oluşturun.
                        </p>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                setIsAuthModalOpen(true);
                            }}
                            className="w-full max-w-3xl mt-10"
                        >
                           <div className="relative w-full p-2 bg-white rounded-2xl shadow-xl border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                                <textarea
                                    name="prompt"
                                    rows={3}
                                    className="w-full p-4 pr-16 text-base text-gray-700 border-none resize-none outline-none focus:ring-0 placeholder:text-gray-400"
                                    placeholder="Örn: E-ticaret sitem için ödeme akışı test senaryoları oluştur..."
                                ></textarea>
                                <button
                                    type="submit"
                                    className="absolute right-5 bottom-5 flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl shadow-lg transition-all
                                        hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    aria-label="Analizi Başlat"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L9.5 8.5L4 11L9.5 13.5L12 19L14.5 13.5L20 11L14.5 8.5L12 3Z" />
                                        <path d="M5 3L6 5" /> <path d="M19 13L18 15" /> <path d="M3 19L5 18" /> <path d="M13 19L15 18" />
                                    </svg>
                                </button>
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
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <ChatBubbleLeftRightIcon className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Sohbet Tabanlı Analiz</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Doğal dilde konuşarak gereksinimleri, kullanıcı hikayelerini ve kabul kriterlerini anında oluşturun.
                                </p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <DocumentTextIcon className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Canlı Canvas Editör</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Yapay zekanın ürettiği çıktılar, Markdown destekli zengin metin editörünüze anında yansır.
                                </p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <PencilSquareIcon className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Akıllı Düzenleme Araçları</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Mevcut dokümanlarınızı "Özetle", "Basitleştir" veya "Devam Et" komutlarıyla anında düzenleyin.
                                </p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <BoltIcon className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Hazır Şablonlar</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Test senaryoları, proje kapsamı veya gereksinim listeleri gibi kanıtlanmış şablonlar üzerinden ilerleyin.
                                </p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <ShareIcon className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Entegrasyonlar</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Çıktılarınızı tek tıkla Jira, Trello, Slack veya GitHub gibi araçlarınıza aktarın.
                                </p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <SparklesIcon className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Görselleştirme</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Analizlerinizi ve iş akışlarınızı otomatik olarak diyagramlara ve görsellere dönüştürün.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="pricing" className="w-full py-20 md:py-32 bg-gray-50 z-20">
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
                                    <li className="flex items-center gap-3"><CheckCircleIcon />5 Doküman Sınırı</li>
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Temel AI Özellikleri</li>
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Standart Şablonlar</li>
                                </ul>
                            </div>
                            <div className="bg-indigo-600 p-8 rounded-3xl shadow-2xl relative flex flex-col">
                                <span className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 inline-flex items-center px-4 py-1 text-sm font-medium text-white bg-indigo-800 rounded-full">
                                    Önerilen
                                </span>
                                <h3 className="text-xl font-semibold text-white">Pro</h3>
                                <p className="mt-4 text-4xl font-bold tracking-tight text-white">
                                    {isAnnual ? '160₺' : '200₺'}
                                    <span className="text-sm font-medium text-indigo-100">/ay</span>
                                </p>
                                <p className="mt-3 text-base text-indigo-100">Profesyoneller ve küçük ekipler için.</p>
                                <button onClick={onSignupClick} className="mt-8 block w-full text-center px-6 py-3 text-base font-medium text-indigo-700 bg-white rounded-lg hover:bg-gray-100 transition-colors">
                                    Pro'yu Başlat
                                </button>
                                <ul className="mt-8 space-y-3 text-sm text-indigo-50 feature-icon-list">
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Sınırsız Doküman</li>
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Gelişmiş AI Özellikleri</li>
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Tüm Şablonlar</li>
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Entegrasyonlar</li>
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
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Pro'daki Her Şey</li>
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Özel Güvenlik (SSO)</li>
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Öncelikli Destek</li>
                                    <li className="flex items-center gap-3"><CheckCircleIcon />Özel Entegrasyonlar</li>
                                </ul>
                            </div>
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
