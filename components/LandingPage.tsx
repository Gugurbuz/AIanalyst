import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface LandingPageProps {
    onStartChat: (initialMessage: string) => void;
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

export const LandingPage: React.FC<LandingPageProps> = ({ onStartChat }) => {
    const [inputMessage, setInputMessage] = useState('');

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
                                if (inputMessage.trim()) {
                                    onStartChat(inputMessage.trim());
                                }
                            }}
                            className="w-full max-w-3xl mt-10"
                        >
                           <div className="relative w-full p-2 bg-white rounded-2xl shadow-xl border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                                <textarea
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    rows={3}
                                    className="w-full p-4 pr-16 text-base text-gray-700 border-none resize-none outline-none focus:ring-0 placeholder:text-gray-400"
                                    placeholder="Örn: E-ticaret sitem için ödeme akışı test senaryoları oluştur..."
                                ></textarea>
                                <button
                                    type="submit"
                                    disabled={!inputMessage.trim()}
                                    className="absolute right-5 bottom-5 flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl shadow-lg transition-all
                                        hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Analizi Başlat"
                                >
                                    <Sparkles className="w-6 h-6 text-white" />
                                </button>
                            </div>
                        </form>
                    </main>

                    <div className="glow-arc" aria-hidden="true"></div>
                </div>

                <footer className="w-full py-16 bg-gray-900 z-20 border-t border-gray-700">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center text-gray-400">
                        <p>&copy; {new Date().getFullYear()} Asisty.AI. Tüm hakları saklıdır.</p>
                    </div>
                </footer>
            </div>
        </>
    );
}