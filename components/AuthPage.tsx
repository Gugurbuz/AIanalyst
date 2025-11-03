import React, { useState, useEffect, useRef } from 'react';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';
import { DeveloperPanel } from './DeveloperPanel';
import { ArrowLeft } from 'lucide-react';

const LogoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path className="fill-indigo-600 dark:fill-indigo-500" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
      <circle className="fill-indigo-300 dark:fill-indigo-400" cx="50" cy="58" r="10"/>
    </svg>
);

const Logo = () => (
    <div className="flex items-center justify-center gap-3">
         <LogoIcon className="h-9 w-9" />
        <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">Asisty.AI</span>
    </div>
);

interface AuthPageProps {
    initialView?: 'login' | 'signup';
    onNavigateBack?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialView = 'login', onNavigateBack }) => {
    const [isLogin, setIsLogin] = useState(initialView === 'login');

     useEffect(() => {
        setIsLogin(initialView === 'login');
    }, [initialView]);

    return (
        <>
            <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4">
                <div className="w-full max-w-md relative">
                     {onNavigateBack && (
                        <button 
                            onClick={onNavigateBack} 
                            className="absolute top-0 left-0 -translate-y-full mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Ana Sayfaya Dön
                        </button>
                    )}
                    <div className="text-center mb-8">
                        <div className="inline-block">
                            <Logo />
                        </div>
                        <h2 className="mt-4 text-2xl font-bold text-slate-800 dark:text-slate-200">
                            Asisty.AI'ye Hoş Geldiniz
                        </h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Yapay zeka iş analisti asistanınızla gereksinimlerinizi olgunlaştırın, kullanıcı hikayeleri ve test senaryoları oluşturun.
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                        {isLogin ? (
                            <LoginPage switchToSignup={() => setIsLogin(false)} />
                        ) : (
                            <SignupPage switchToLogin={() => setIsLogin(true)} />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};