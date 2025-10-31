// components/RegeneratingOverlay.tsx
import React from 'react';

const AsistyLogoIcon = () => (
    <div className="relative h-12 w-12">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-pulse opacity-75">
            <path className="fill-indigo-400" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
            <circle className="fill-indigo-200" cx="50" cy="58" r="10"/>
        </svg>
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
            <path className="fill-indigo-600 dark:fill-indigo-500" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
            <circle className="fill-indigo-300 dark:fill-indigo-400" cx="50" cy="58" r="10"/>
        </svg>
    </div>
);

interface RegeneratingOverlayProps {
    text?: string;
}

export const RegeneratingOverlay: React.FC<RegeneratingOverlayProps> = ({ text }) => {
    return (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
            <AsistyLogoIcon />
            <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {text || 'Şablon değiştirildi. Doküman yeniden oluşturuluyor...'}
            </p>
        </div>
    );
};