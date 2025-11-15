import React from 'react';
import type { User, Theme, UserProfile } from '../types';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Share2, Database, PanelRightOpen, PanelRightClose } from 'lucide-react';

interface HeaderProps {
    user: User;
    onLogout: () => void;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    onOpenShareModal: () => void;
    userProfile: UserProfile | null;
}

const LogoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path className="fill-indigo-600 dark:fill-indigo-500" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
      <circle className="fill-indigo-300 dark:fill-indigo-400" cx="50" cy="58" r="10"/>
    </svg>
);

const Logo = () => (
    <div className="flex items-center gap-2 cursor-pointer">
        <LogoIcon className="h-8 w-8" />
        <h1 className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            Asisty.AI
        </h1>
    </div>
);

const UserTokenIndicator: React.FC<{ profile: UserProfile }> = ({ profile }) => {
    const { tokens_used, token_limit } = profile;
    const usagePercentage = token_limit > 0 ? (tokens_used / token_limit) * 100 : 0;
    const remainingTokens = token_limit - tokens_used;
    let progressBarColor = 'bg-emerald-500';
    if (usagePercentage > 90) progressBarColor = 'bg-red-500';
    else if (usagePercentage > 75) progressBarColor = 'bg-amber-500';

    return (
        <div title={`Kalan: ${Math.max(0, remainingTokens).toLocaleString('tr-TR')} token`} className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 w-32">
            <Database className="h-4 w-4 flex-shrink-0" />
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div className={`${progressBarColor} h-2 rounded-full`} style={{ width: `${Math.min(usagePercentage, 100)}%` }}></div>
            </div>
        </div>
    );
};


export const Header: React.FC<HeaderProps> = ({
    user,
    onLogout,
    theme,
    onThemeChange,
    onOpenShareModal,
    userProfile,
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);

     React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // FIX: Corrected typo from `userMenu-ref` to `userMenuRef`.
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm p-2 flex items-center justify-between h-16 border-b border-slate-200 dark:border-slate-700 z-20 flex-shrink-0">
            <div className="flex items-center gap-2 ml-4">
                <Logo />
            </div>

            <div className="flex items-center gap-4 flex-shrink-0 mr-4">
                {userProfile && <UserTokenIndicator profile={userProfile} />}
                
                <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />

                <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                        {user.email?.[0]?.toUpperCase()}
                    </button>
                    {isUserMenuOpen && (
                        <div className="origin-top-right absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-30">
                            <div className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                <p className="font-semibold truncate">{user.email}</p>
                            </div>
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
        </header>
    );
};
