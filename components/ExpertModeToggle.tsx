// components/ExpertModeToggle.tsx
import React from 'react';
import { Bot } from 'lucide-react';

interface ExpertModeToggleProps {
    isExpertMode: boolean;
    setIsExpertMode: (isOn: boolean) => void;
    disabled?: boolean;
}

export const ExpertModeToggle: React.FC<ExpertModeToggleProps> = ({ isExpertMode, setIsExpertMode, disabled }) => {
    return (
        <div className="flex items-center gap-2" title="Exper Modu: AI'nın tüm analiz sürecini (analiz, görselleştirme, test, matris) otomatik olarak yürütmesini sağlar.">
            <Bot className={`h-5 w-5 transition-colors ${isExpertMode ? 'text-indigo-500' : 'text-slate-400'}`} />
            <label htmlFor="expert-mode-toggle" className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    id="expert-mode-toggle"
                    className="sr-only peer"
                    checked={isExpertMode}
                    onChange={(e) => setIsExpertMode(e.target.checked)}
                    disabled={disabled}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">Exper Modu</span>
            </label>
        </div>
    );
};