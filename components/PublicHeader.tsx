import React from 'react';

const LogoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path className="fill-indigo-600 dark:fill-indigo-500" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
      <circle className="fill-indigo-300 dark:fill-indigo-400" cx="50" cy="58" r="10"/>
    </svg>
);

export const PublicHeader: React.FC = () => {
    return (
        <header className="flex-shrink-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm p-2 flex items-center justify-between h-16 border-b border-slate-200 dark:border-slate-700 z-20">
            <a href="/" className="flex items-center gap-3 ml-4" aria-label="Asisty.AI Ana Sayfa">
                <LogoIcon className="h-8 w-8" />
                <h1 className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                    Asisty.AI
                </h1>
            </a>
            <div className="flex items-center gap-4 mr-4">
                <a href="/" className="text-sm font-semibold text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Giriş Yap</a>
                <a href="/" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                    Ücretsiz Başla
                </a>
            </div>
        </header>
    );
};