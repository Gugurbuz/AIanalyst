
import React from 'react';

export const LoadingSpinner: React.FC = () => {
    return (
        <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Analiz ediliyor...</span>
        </div>
    );
};