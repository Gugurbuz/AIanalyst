
// layouts/MainSidebar.tsx
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import type { User, Theme, UserProfile } from '../types';
import { MessageSquare, Pencil, ClipboardList } from 'lucide-react';
import { ConversationList } from '../components/sidebar/ConversationList';
import { UserProfileSection } from '../components/sidebar/UserProfileSection';

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

export const MainSidebar: React.FC<MainSidebarProps> = ({ user, profile, theme, onThemeChange, onLogout, onOpenShareModal }) => {
    const { 
        appMode, setAppMode, conversations, activeConversationId, setActiveConversationId, 
        handleNewConversation, updateConversationTitle, deleteConversation, setConfirmation,
        handleToggleDeveloperPanel
    } = useAppContext();

    const [searchTerm, setSearchTerm] = useState('');

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

                <ConversationList
                    conversations={conversations}
                    searchTerm={searchTerm}
                    activeConversationId={activeConversationId}
                    updateConversationTitle={updateConversationTitle}
                    deleteConversation={deleteConversation}
                    setActiveConversationId={setActiveConversationId}
                    setConfirmation={setConfirmation}
                />
            </div>

            <UserProfileSection
                user={user}
                profile={profile}
                theme={theme}
                onThemeChange={onThemeChange}
                onLogout={onLogout}
                onOpenShareModal={onOpenShareModal}
                handleToggleDeveloperPanel={handleToggleDeveloperPanel}
                setConfirmation={setConfirmation}
            />
        </nav>
    );
};
