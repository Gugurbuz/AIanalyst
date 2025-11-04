

import React from 'react';
import type { User, Theme, UserProfile } from '../types';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Share2, LoaderCircle, CheckCircle, AlertCircle, TrendingUp, Database, Info, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { ExpertModeToggle } from './ExpertModeToggle';

interface HeaderProps {
    user: User;
    onLogout: () => void;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    onOpenShareModal: () => void;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    maturityScore: { score: number; justification: string } | null;
    isProcessing: boolean;
    userProfile: UserProfile | null;
    isExpertMode: boolean;
    setIsExpertMode: (isOn: boolean) => void;
    isDeepAnalysisMode: boolean;
    onDeepAnalysisModeChange: (isOn: boolean) => void;
    isWorkspaceVisible: boolean;
    onToggleWorkspace: () => void;
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

const SaveStatusIndicator: React.FC<{ status: 'idle' | 'saving' | 'saved' | 'error' }> = ({ status }) => {
    if (status === 'idle') return null;
    const statusConfig = {
        saving: { icon: <LoaderCircle className="h-4 w-4 animate-spin" />, text: 'Kaydediliyor...', color: 'text-slate-500 dark:text-slate-400' },
        saved: { icon: <CheckCircle className="h-4 w-4" />, text: 'Kaydedildi', color: 'text-emerald-500 dark:text-emerald-400' },
        error: { icon: <AlertCircle className="h-4 w-4" />, text: 'Kaydetme hatası', color: 'text-red-500 dark:text-red-400' }
    };
    const { icon, text, color } = statusConfig[status];
    return <div className={`flex items-center gap-2 text-xs font-medium ${color}`}>{icon}<span>{text}</span></div>;
};

const MaturityScoreIndicator: React.FC<{ score: number; justification: string }> = ({ score, justification }) => (
    <div title={justification} className="flex items-center gap-2 text-xs font-medium text-sky-600 dark:text-sky-400">
        <TrendingUp className="h-4 w-4" />
        <span>Olgunluk: <strong>{score}/100</strong></span>
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

const StatusIndicatorGroup: React.FC<Pick<HeaderProps, 'saveStatus' | 'maturityScore' | 'userProfile'>> = ({ saveStatus, maturityScore, userProfile }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

     React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasActiveIndicator = saveStatus !== 'idle' || !!maturityScore || !!userProfile;

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-md transition-colors ${hasActiveIndicator ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
                <Info className="h-5 w-5" />
            </button>
             {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 p-3 z-30 space-y-3">
                    <SaveStatusIndicator status={saveStatus} />
                    {maturityScore && <MaturityScoreIndicator score={maturityScore.score} justification={maturityScore.justification} />}
                    {userProfile && <UserTokenIndicator profile={userProfile} />}
                    {!hasActiveIndicator && <p className="text-xs text-slate-500 dark:text-slate-400">Her şey güncel.</p>}
                </div>
            )}
        </div>
    );
};

const DeepAnalysisToggle: React.FC<{ isDeep: boolean; onChange: (isOn: boolean) => void; disabled?: boolean; }> = ({ isDeep, onChange, disabled }) => {
    return (
        <div className="flex items-center gap-2" title="Derin Analiz Modu: Daha kapsamlı fakat yavaş yanıtlar için gemini-2.5-pro modelini kullanır.">
            <label htmlFor="deep-analysis-toggle" className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="deep-analysis-toggle" className="sr-only peer" checked={isDeep} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">Derin Analiz</span>
            </label>
        </div>
    );
};


export const Header: React.FC<HeaderProps> = ({
    user,
    onLogout,
    theme,
    onThemeChange,
    onOpenShareModal,
    saveStatus,
    maturityScore,
    isProcessing,
    userProfile,
    isExpertMode,
    setIsExpertMode,
    isDeepAnalysisMode,
    onDeepAnalysisModeChange,
    isWorkspaceVisible,
    onToggleWorkspace
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
                 <button
                    onClick={onToggleWorkspace}
                    title={isWorkspaceVisible ? "Çalışma Alanını Gizle" : "Çalışma Alanını Göster"}
                    className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hidden lg:flex"
                >
                    {isWorkspaceVisible ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
                </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 mr-4">
                <StatusIndicatorGroup saveStatus={saveStatus} maturityScore={maturityScore} userProfile={userProfile} />
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 hidden sm:block" />
                
                <DeepAnalysisToggle isDeep={isDeepAnalysisMode} onChange={onDeepAnalysisModeChange} disabled={isProcessing} />
                <ExpertModeToggle isExpertMode={isExpertMode} setIsExpertMode={setIsExpertMode} disabled={isProcessing} />
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />
                
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