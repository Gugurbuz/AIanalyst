import React from 'react';
import type { User, Theme, AppMode, Conversation } from '../types';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ThinkingModeToggle } from './ThinkingModeToggle';

interface HeaderProps {
    user: User;
    onLogout: () => void;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    appMode: AppMode;
    onAppModeChange: (mode: AppMode) => void;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    activeConversation: Conversation | null;
    onOpenShareModal: () => void;
    isThinkingMode: boolean;
    onThinkingModeChange: (isOn: boolean) => void;
    isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
    user,
    onLogout,
    theme,
    onThemeChange,
    appMode,
    onAppModeChange,
    isSidebarOpen,
    onToggleSidebar,
    activeConversation,
    onOpenShareModal,
    isThinkingMode,
    onThinkingModeChange,
    isProcessing
}) => {
    // A simple dropdown for user menu
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);

     React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm p-2 flex items-center justify-between h-16 border-b border-slate-200 dark:border-slate-700 z-20 flex-shrink-0">
            <div className="flex items-center gap-2">
                {/* Sidebar toggle button */}
                <button onClick={onToggleSidebar} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                 <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                    <svg width="24" height="24" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                        <path fill="currentColor" className="text-indigo-600 dark:text-indigo-500" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
                        <circle fill="currentColor" className="text-indigo-300 dark:text-indigo-400" cx="50" cy="58" r="10"/>
                    </svg>
                    <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200 truncate">
                        Asisty.ai
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                 <div className="flex items-center gap-2 sm:gap-4"> {/* Made mode switcher visible on mobile, adjusted gap for sm screens */}
                    <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
                        <button onClick={() => onAppModeChange('analyst')} className={`px-2 py-1 text-xs sm:px-3 sm:py-1 sm:text-sm font-semibold rounded-md transition-colors ${appMode === 'analyst' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-600 dark:text-slate-300'}`}>
                            Analist
                        </button>
                        <button onClick={() => onAppModeChange('board')} className={`px-2 py-1 text-xs sm:px-3 sm:py-1 sm:text-sm font-semibold rounded-md transition-colors ${appMode === 'board' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-600 dark:text-slate-300'}`}>
                            Pano
                        </button>
                    </div>
                    {appMode === 'analyst' && <ThinkingModeToggle isThinkingMode={isThinkingMode} setIsThinkingMode={onThinkingModeChange} disabled={isProcessing} />}
                </div>
                
                <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />

                <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                        {user.email?.[0].toUpperCase()}
                    </button>
                    {isUserMenuOpen && (
                        <div className="origin-top-right absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-30">
                            <div className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                <p className="font-semibold truncate">{user.email}</p>
                            </div>
                            {activeConversation && appMode === 'analyst' && (
                                <button
                                    onClick={() => { onOpenShareModal(); setIsUserMenuOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
                                    Paylaş
                                </button>
                            )}
                            <button
                                onClick={onLogout}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                Çıkış Yap
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};