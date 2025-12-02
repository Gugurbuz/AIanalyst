
import React, { useRef, useEffect } from 'react';
import { Bot, BrainCircuit, Search } from 'lucide-react';

interface AiToolsMenuProps {
    isOpen: boolean;
    onClose: () => void;
    buttonRef: React.RefObject<HTMLButtonElement>;
    isExpertMode: boolean;
    setIsExpertMode: (isOn: boolean) => void;
    isDeepAnalysisMode: boolean;
    onDeepAnalysisModeChange: (isOn: boolean) => void;
    isSearchEnabled: boolean;
    onSearchModeChange: (isOn: boolean) => void;
    isLoading: boolean;
}

export const AiToolsMenu: React.FC<AiToolsMenuProps> = ({
    isOpen, onClose, buttonRef, isExpertMode, setIsExpertMode, isDeepAnalysisMode, onDeepAnalysisModeChange, isSearchEnabled, onSearchModeChange, isLoading
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, buttonRef]);

    if (!isOpen) return null;

    return (
        <div ref={menuRef} className="absolute bottom-full mb-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-2 z-20">
            <div className="p-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Modlar</h3>
                <ul>
                    <li className="flex items-start justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
                        <div className="flex items-start gap-3">
                            <Bot className="h-5 w-5 text-indigo-500 mt-0.5" />
                            <div>
                                <label htmlFor="expert-mode-toggle-chat" className="font-semibold text-sm text-slate-700 dark:text-slate-300 cursor-pointer">Exper Modu</label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">AI'nın tüm analiz sürecini otomatik olarak yürütmesini sağlar.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-2">
                            <input type="checkbox" className="sr-only peer" checked={isExpertMode} onChange={(e) => setIsExpertMode(e.target.checked)} disabled={isLoading} />
                            <div className="w-9 h-5 bg-slate-200 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-500 peer-checked:bg-indigo-600"></div>
                        </label>
                    </li>
                     <li className="flex items-start justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
                        <div className="flex items-start gap-3">
                            <BrainCircuit className="h-5 w-5 text-indigo-500 mt-0.5" />
                            <div>
                                <label htmlFor="deep-analysis-toggle-chat" className="font-semibold text-sm text-slate-700 dark:text-slate-300 cursor-pointer">Derin Analiz</label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Daha yavaş ama kapsamlı yanıtlar için gemini-2.5-pro modelini kullanır.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-2">
                            <input type="checkbox" className="sr-only peer" checked={isDeepAnalysisMode} onChange={(e) => onDeepAnalysisModeChange(e.target.checked)} disabled={isLoading} />
                            <div className="w-9 h-5 bg-slate-200 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-500 peer-checked:bg-indigo-600"></div>
                        </label>
                    </li>
                    <li className="flex items-start justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
                        <div className="flex items-start gap-3">
                            <Search className="h-5 w-5 text-indigo-500 mt-0.5" />
                            <div>
                                <label htmlFor="search-mode-toggle-chat" className="font-semibold text-sm text-slate-700 dark:text-slate-300 cursor-pointer">Google Search</label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Yanıtları güncel web verileriyle zenginleştirir.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-2">
                            <input id="search-mode-toggle-chat" type="checkbox" className="sr-only peer" checked={isSearchEnabled} onChange={(e) => onSearchModeChange(e.target.checked)} disabled={isLoading} />
                            <div className="w-9 h-5 bg-slate-200 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-500 peer-checked:bg-indigo-600"></div>
                        </label>
                    </li>
                </ul>
            </div>
        </div>
    );
};
