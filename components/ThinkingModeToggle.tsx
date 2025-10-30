import React from 'react';

interface ThinkingModeToggleProps {
    isThinkingMode: boolean;
    setIsThinkingMode: (isOn: boolean) => void;
    disabled?: boolean;
}

export const ThinkingModeToggle: React.FC<ThinkingModeToggleProps> = ({ isThinkingMode, setIsThinkingMode, disabled }) => {
    return (
        <div className="flex items-center gap-2" title="Daha karmaşık görevler için derin düşünme modunu etkinleştirin. Bu mod, gemini-2.5-pro modelini kullanarak daha yavaş ancak daha kapsamlı sonuçlar üretir.">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors ${isThinkingMode ? 'text-indigo-500' : 'text-slate-400'}`} viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3.5a5.5 5.5 0 00-5.403 6.913 3.5 3.5 0 01-.13 6.915 5.5 5.5 0 0011.066 0 3.5 3.5 0 01-.13-6.915A5.5 5.5 0 0010 3.5zM5.5 11a.5.5 0 01.5-.5h8a.5.5 0 010 1h-8a.5.5 0 01-.5-.5z" />
            </svg>
            <label htmlFor="thinking-mode-toggle" className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    id="thinking-mode-toggle"
                    className="sr-only peer"
                    checked={isThinkingMode}
                    onChange={(e) => setIsThinkingMode(e.target.checked)}
                    disabled={disabled}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">Düşünme Modu</span>
            </label>
        </div>
    );
};
