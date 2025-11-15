// layouts/MainSidebar.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import type { User, Theme, UserProfile, Conversation } from '../types';
import { MessageSquare, Share2, Pencil, ClipboardList, Trash2, MoreVertical, Sun, Moon, Monitor, LogOut, Code } from 'lucide-react';

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

const UserTokenIndicator: React.FC<{ profile: UserProfile }> = ({ profile }) => {
    const { tokens_used, token_limit } = profile;
    const usagePercentage = token_limit > 0 ? (tokens_used / token_limit) * 100 : 0;
    const remainingTokens = token_limit - tokens_used;
    let progressBarColor = 'bg-emerald-500';
    if (usagePercentage > 90) progressBarColor = 'bg-red-500';
    else if (usagePercentage > 75) progressBarColor = 'bg-amber-500';

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

// Simplified Theme Switcher buttons for the new menu
const ThemeButtons: React.FC<{ currentTheme: Theme, onThemeChange: (theme: Theme) => void }> = ({ currentTheme, onThemeChange }) => {
    const themes: { name: Theme; icon: React.ReactElement }[] = [
        { name: 'light', icon: <Sun className="h-4 w-4" /> },
        { name: 'dark', icon: <Moon className="h-4 w-4" /> },
        { name: 'system', icon: <Monitor className="h-4 w-4" /> },
    ];
    return (
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-700 rounded-md">
            {themes.map(({ name, icon }) => (
                <button
                    key={name}
                    onClick={() => onThemeChange(name)}
                    className={`flex-1 p-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${currentTheme === name ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    title={`${name.charAt(0).toUpperCase() + name.slice(1)} Tema`}
                >
                    {icon}
                </button>
            ))}
        </div>
    );
};


export const MainSidebar: React.FC<MainSidebarProps> = ({ user, profile, theme, onThemeChange, onLogout, onOpenShareModal }) => {
    const { 
        appMode, setAppMode, conversations, activeConversationId, setActiveConversationId, 
        handleNewConversation, updateConversationTitle, deleteConversation, setConfirmation,
        handleToggleDeveloperPanel
    } = useAppContext();

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
    
    const userMenuRef = useRef<HTMLDivElement>(null);
    const userMenuButtonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node) && userMenuButtonRef.current && !userMenuButtonRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpenForId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    const filteredConversations = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return conversations;

        return conversations.filter(c => {
            const titleMatch = c.title.toLowerCase().includes(term);
            if (titleMatch) return true;
            
            const messageMatch = c.messages?.some(m => 
                m.content && typeof m.content === 'string' && m.content.toLowerCase().includes(term)
            );
            return messageMatch;
        });
    }, [conversations, searchTerm]);

    const handleEditStart = (conv: Conversation) => {
        setMenuOpenForId(null);
        setEditingId(conv.id);
        setEditingTitle(conv.title);
    };

    const handleEditSave = () => {
        if (editingId && editingTitle.trim()) {
            updateConversationTitle(editingId, editingTitle.trim());
        }
        setEditingId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleEditSave();
        else if (e.key === 'Escape') setEditingId(null);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setMenuOpenForId(null);
        setConfirmation({
            title: "Analizi Sil",
            message: "Bu analizi ve tüm içeriğini kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.",
            onConfirm: () => deleteConversation(id),
        });
    };

    return (
        <nav className="h-full bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col w-80 flex-shrink-0">
            {/* Top Area: Logo + New Analysis */}
            <div className="p-4 space-y-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <a href="/" className="flex items-center gap-3" aria-label="Asisty.AI Ana Sayfa">
                    <LogoIcon className="h-8 w-8 flex-shrink-0" />
                    <span className="text-xl font-bold text-slate-800 dark:text-slate-200">Asisty.AI</span>
                </a>
                <button
                    onClick={() => handleNewConversation()}
                    title="Yeni Analiz Başlat"
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-lg transition-colors duration-200 text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                >
                    <Pencil className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm font-semibold">Yeni Analiz</span>
                </button>
            </div>
            
            {/* Middle Scrollable Area: Nav, Search, List */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Main Navigation */}
                <div className="p-2 space-y-1 flex-shrink-0">
                     <button
                        onClick={() => setAppMode('analyst')}
                        className={`w-full h-10 flex items-center justify-start px-3 gap-3 rounded-md text-sm font-semibold transition-colors ${appMode === 'analyst' ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                    >
                        <MessageSquare className="h-5 w-5" /> Analizler
                    </button>
                    <button
                        onClick={() => setAppMode('backlog')}
                        className={`w-full h-10 flex items-center justify-start px-3 gap-3 rounded-md text-sm font-semibold transition-colors ${appMode === 'backlog' ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                    >
                        <ClipboardList className="h-5 w-5" /> Backlog
                    </button>
                </div>

                <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                     <input
                        type="text"
                        placeholder="Analizlerde ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                        aria-label="Sohbet başlığında ara"
                    />
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredConversations.map(conv => (
                         <div key={conv.id} className="relative group">
                            {editingId === conv.id ? (
                                <input ref={inputRef} type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onBlur={handleEditSave} onKeyDown={handleKeyDown} className="w-full text-left px-3 py-2.5 rounded-md text-sm bg-white dark:bg-slate-900 border border-indigo-500 ring-1 ring-indigo-500 focus:outline-none" />
                            ) : (
                                <>
                                    <button onClick={() => setActiveConversationId(conv.id)} className={`w-full text-left pl-3 pr-16 py-2.5 rounded-md text-sm truncate transition-colors duration-150 ${conv.id === activeConversationId ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`} title={conv.title}>
                                        {conv.title}
                                    </button>
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); setMenuOpenForId(conv.id === menuOpenForId ? null : conv.id); }} className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600" title="Diğer seçenekler"><MoreVertical className="h-4 w-4" /></button>
                                    </div>
                                    {menuOpenForId === conv.id && (
                                        <div ref={menuRef} className="absolute right-2 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-30 animate-fade-in-up" style={{animationDuration: '0.1s'}}>
                                            <button onClick={() => handleEditStart(conv)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"><Pencil className="h-4 w-4" /><span>Yeniden Adlandır</span></button>
                                            <button onClick={(e) => handleDelete(e, conv.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"><Trash2 className="h-4 w-4" /><span>Sil</span></button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom User Bar */}
            <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 relative">
                {isUserMenuOpen && (
                    <div ref={userMenuRef} className="origin-bottom-left absolute left-2 bottom-full mb-2 w-[calc(100%-1rem)] bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 p-2 z-30 space-y-3">
                        {profile && <UserTokenIndicator profile={profile} />}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-1">Tema</label>
                            <ThemeButtons currentTheme={theme} onThemeChange={onThemeChange} />
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-700 !mt-2 pt-2 space-y-1">
                             <button onClick={() => { onOpenShareModal(); setIsUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                                <Share2 className="h-4 w-4" /> Paylaş
                            </button>
                             <button onClick={() => { handleToggleDeveloperPanel(); setIsUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                                <Code className="h-4 w-4" /> Geliştirici Paneli
                            </button>
                            <button onClick={onLogout} className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                                <LogOut className="h-4 w-4" /> Çıkış Yap
                            </button>
                        </div>
                    </div>
                )}
                <button ref={userMenuButtonRef} onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                        {user.email?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{user.email}</span>
                </button>
            </div>
        </nav>
    );
};