import React from 'react';
import type { User, Theme, AppMode, Conversation } from '../types';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Menu, Share2 } from 'lucide-react';

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
    isProcessing: boolean;
}

const LogoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path className="fill-indigo-600 dark:fill-indigo-500" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
      <circle className="fill-indigo-300 dark:fill-indigo-400" cx="50" cy="58" r="10"/>
    </svg>
);

const Logo = () => (
    <div className="flex items-center gap-2">
        <LogoIcon className="h-6 w-6" />
         <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200 truncate">
            Asisty.ai
        </h1>
    </div>
);


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
    isProcessing
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);

     React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // FIX: Corrected a typo in the variable name from `userMenu-ref` to `userMenuRef`.
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
                <button onClick={onToggleSidebar} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">
                   <Menu className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </button>
                 <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                    <Logo />
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                 <div className="flex items-center gap-2 sm:gap-4">
                    <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
                        <button onClick={() => onAppModeChange('analyst')} className={`px-2 py-1 text-xs sm:px-3 sm:py-1 sm:text-sm font-semibold rounded-md transition-colors ${appMode === 'analyst' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-600 dark:text-slate-300'}`}>
                            Analist
                        </button>
                        <button onClick={() => onAppModeChange('board')} className={`px-2 py-1 text-xs sm:px-3 sm:py-1 sm:text-sm font-semibold rounded-md transition-colors ${appMode === 'board' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-600 dark:text-slate-300'}`}>
                            Pano
                        </button>
                    </div>
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
                                    <Share2 className="h-4 w-4" />
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