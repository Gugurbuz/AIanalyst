
import React, { useState, useRef, useEffect } from 'react';
import type { User, UserProfile, Theme, FontSize } from '../../types';
import { Share2, Code, LogOut, Sun, Moon, Monitor, Type } from 'lucide-react';
import { useUIContext } from '../../contexts/UIContext';

interface UserProfileSectionProps {
    user: User;
    profile: UserProfile | null;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    onLogout: () => void;
    onOpenShareModal: () => void;
    handleToggleDeveloperPanel: () => void;
    setConfirmation: (confirmation: any) => void;
}

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

const FontSizeButtons: React.FC<{ currentSize: FontSize, onSizeChange: (size: FontSize) => void }> = ({ currentSize, onSizeChange }) => {
    const sizes: { name: FontSize; label: string }[] = [
        { name: 'small', label: 'A' },
        { name: 'medium', label: 'A+' },
        { name: 'large', label: 'A++' },
    ];
    return (
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-700 rounded-md">
            {sizes.map(({ name, label }) => (
                <button
                    key={name}
                    onClick={() => onSizeChange(name)}
                    className={`flex-1 p-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors ${currentSize === name ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    title={`${name} Font`}
                >
                    <span className={name === 'small' ? 'text-xs' : name === 'medium' ? 'text-sm' : 'text-base'}>{label}</span>
                </button>
            ))}
        </div>
    );
};

export const UserProfileSection: React.FC<UserProfileSectionProps> = ({
    user, profile, theme, onThemeChange, onLogout, onOpenShareModal, handleToggleDeveloperPanel, setConfirmation
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const userMenuButtonRef = useRef<HTMLButtonElement>(null);
    const { fontSize, setFontSize } = useUIContext();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node) && userMenuButtonRef.current && !userMenuButtonRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 relative">
            {isUserMenuOpen && (
                <div ref={userMenuRef} className="origin-bottom-left absolute left-2 bottom-full mb-2 w-[calc(100%-1rem)] bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 p-2 z-30 space-y-3">
                    {profile && <UserTokenIndicator profile={profile} />}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-1">Tema</label>
                        <ThemeButtons currentTheme={theme} onThemeChange={onThemeChange} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-1">Yazı Boyutu</label>
                        <FontSizeButtons currentSize={fontSize} onSizeChange={setFontSize} />
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700 !mt-2 pt-2 space-y-1">
                         <button onClick={() => { onOpenShareModal(); setIsUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                            <Share2 className="h-4 w-4" /> Paylaş
                        </button>
                         <button onClick={() => { handleToggleDeveloperPanel(); setIsUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                            <Code className="h-4 w-4" /> Geliştirici Paneli
                        </button>
                        <button onClick={() => {
                            setConfirmation({
                                title: "Çıkış Yap",
                                message: "Oturumunuzu sonlandırmak istediğinizden emin misiniz?",
                                onConfirm: onLogout,
                                confirmButtonText: "Evet, Çıkış Yap",
                                cancelButtonText: "İptal",
                                confirmButtonVariant: 'primary'
                            });
                            setIsUserMenuOpen(false);
                        }} className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
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
    );
};