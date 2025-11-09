// layouts/MainSidebar.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import type { User, Theme, UserProfile } from '../types';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { MessageSquare, Database, Share2, PanelLeft, PanelRight, Pencil } from 'lucide-react';

interface MainSidebarProps {
    user: User;
    profile: UserProfile | null;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    onLogout: () => void;
    onOpenShareModal: () => void;
}

const LogoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path className="fill-indigo-600 dark:fill-indigo-500" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
      <circle className="fill-indigo-300 dark:fill-indigo-400" cx="50" cy="58" r="10"/>
    </svg>
);

const UserTokenIndicator: React.FC<{ profile: UserProfile, isExpanded: boolean }> = ({ profile, isExpanded }) => {
    const { tokens_used, token_limit } = profile;
    const usagePercentage = token_limit > 0 ? (tokens_used / token_limit) * 100 : 0;
    const remainingTokens = token_limit - tokens_used;
    let progressBarColor = 'bg-emerald-500';
    if (usagePercentage > 90) progressBarColor = 'bg-red-500';
    else if (usagePercentage > 75) progressBarColor = 'bg-amber-500';

    if (!isExpanded) {
        return (
             <div title={`Kalan: ${Math.max(0, remainingTokens).toLocaleString('tr-TR')} token`} className="flex items-center justify-center h-10 w-10">
                <Database className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </div>
        )
    }

    return (
        <div className="w-full px-2">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Token Kullanımı</span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{Math.max(0, remainingTokens).toLocaleString('tr-TR')}</span>
            </div>
            <div title={`${usagePercentage.toFixed(1)}% kullanıldı`} className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                <div className={`${progressBarColor} h-1.5 rounded-full`} style={{ width: `${Math.min(usagePercentage, 100)}%` }}></div>
            </div>
        </div>
    );
};


export const MainSidebar: React.FC<MainSidebarProps> = ({ user, profile, theme, onThemeChange, onLogout, onOpenShareModal }) => {
    const { isConversationListOpen, setIsConversationListOpen, handleNewConversation } = useAppContext();
    const [isExpanded, setIsExpanded] = useState(true);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAnalystViewToggle = () => {
        setIsConversationListOpen(!isConversationListOpen);
    };

    const navItems = [
        { id: 'analyst', label: 'Analizler', icon: MessageSquare, action: handleAnalystViewToggle, isView: true },
    ];

    return (
        <nav className={`bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col items-center justify-between transition-all duration-300 ${isExpanded ? 'w-64' : 'w-20'}`}>
            <div className="w-full">
                <div className={`flex items-center h-16 transition-all duration-300 px-4 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
                     <a href="/" className={`flex items-center gap-3 ${isExpanded ? '' : 'w-full justify-center'}`} aria-label="Asisty.AI Ana Sayfa">
                        <LogoIcon className="h-8 w-8 flex-shrink-0" />
                        {isExpanded && <span className="text-xl font-bold text-slate-800 dark:text-slate-200">Asisty.AI</span>}
                    </a>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 ${isExpanded ? '' : 'absolute left-1/2 -translate-x-1/2 top-4'}`}
                    >
                         {isExpanded ? <PanelLeft className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
                    </button>
                </div>
                <div className="flex flex-col items-center space-y-2 w-full px-4 py-4 border-y border-slate-200 dark:border-slate-700">
                     <button
                        key="new-analysis"
                        onClick={handleNewConversation}
                        title="Yeni Analiz Başlat"
                        className={`w-full h-12 flex items-center rounded-lg transition-colors duration-200 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 ${isExpanded ? 'px-4' : 'justify-center'}`}
                    >
                        <Pencil className="h-6 w-6 flex-shrink-0" />
                        {isExpanded && <span className="text-sm font-semibold ml-4">Yeni Analiz</span>}
                    </button>

                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={item.action}
                            title={item.label}
                            className={`w-full h-12 flex items-center rounded-lg transition-colors duration-200 ${isExpanded ? 'px-4' : 'justify-center'}
                                ${item.isView
                                    ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-700' 
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`
                            }
                        >
                            <item.icon className="h-6 w-6 flex-shrink-0" />
                            {isExpanded && <span className="text-sm font-semibold ml-4">{item.label}</span>}
                        </button>
                    ))}
                </div>
            </div>

             <div className="w-full px-2 py-4">
                 <div className={`flex flex-col items-center gap-2 w-full p-2 border-t border-slate-200 dark:border-slate-700 ${isExpanded ? '' : 'pt-4'}`}>
                    {profile && <UserTokenIndicator profile={profile} isExpanded={isExpanded} />}
                    
                     <div className={`relative w-full border-t border-slate-200 dark:border-slate-700 mt-2 pt-2 ${isExpanded ? 'px-2' : ''}`}>
                        <div className={`flex items-center ${isExpanded ? 'justify-between' : 'flex-col gap-4'}`}>
                            <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className={`flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 ${isExpanded ? '' : 'justify-center'}`}>
                                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                                    {user.email?.[0]?.toUpperCase()}
                                </div>
                                {isExpanded && <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{user.email}</span>}
                            </button>
                             <div className={isExpanded ? 'hidden' : 'block'}>
                                <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
                            </div>
                        </div>
                        {isUserMenuOpen && (
                            <div ref={userMenuRef} className={`origin-bottom-left absolute left-0 bottom-full mb-2 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 py-1 z-30 ${isExpanded ? 'w-56' : 'w-48'}`}>
                                {isExpanded && (
                                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                         <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
                                    </div>
                                )}
                                <button onClick={() => { onOpenShareModal(); setIsUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                                    <Share2 className="h-4 w-4" /> Paylaş
                                </button>
                                <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                                    Çıkış Yap
                                </button>
                            </div>
                        )}
                    </div>
                 </div>
            </div>
        </nav>
    );
};