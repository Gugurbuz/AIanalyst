import React, { useState, useEffect } from 'react';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';
import { DeveloperPanel } from './DeveloperPanel';

const LogoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path className="fill-indigo-600 dark:fill-indigo-500" d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
      <circle className="fill-indigo-300 dark:fill-indigo-400" cx="50" cy="58" r="10"/>
    </svg>
);

const Logo = () => (
    <div className="flex items-center justify-center gap-3">
         <LogoIcon className="h-9 w-9" />
        <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">Asisty.ai</span>
    </div>
);


export const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isDeveloperPanelOpen, setIsDeveloperPanelOpen] = useState(false);

    useEffect(() => {
        let keySequence = '';
        const targetSequence = 'devmode';
        const handler = (e: KeyboardEvent) => {
            keySequence += e.key.toLowerCase();
            if (keySequence.length > targetSequence.length) {
                keySequence = keySequence.slice(1);
            }
            if (keySequence === targetSequence) {
                setIsDeveloperPanelOpen(true);
                keySequence = '';
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    return (
        <>
            <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <Logo />
                        <h2 className="mt-4 text-2xl font-bold text-slate-800 dark:text-slate-200">
                            Asisty.ai'ye Hoş Geldiniz
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
            {isDeveloperPanelOpen && (
                 <DeveloperPanel
                    onClose={() => setIsDeveloperPanelOpen(false)}
                    modelName={localStorage.getItem('geminiModel') || 'gemini-2.5-flash'}
                    onModelNameChange={(name) => localStorage.setItem('geminiModel', name)}
                    supabaseUrl={localStorage.getItem('supabaseUrl') || ''}
                    onSupabaseUrlChange={(url) => localStorage.setItem('supabaseUrl', url)}
                    supabaseAnonKey={localStorage.getItem('supabaseAnonKey') || ''}
                    onSupabaseAnonKeyChange={(key) => localStorage.setItem('supabaseAnonKey', key)}
                    testUserEmail={localStorage.getItem('devTestUserEmail') || ''}
                    onTestUserEmailChange={(email) => localStorage.setItem('devTestUserEmail', email)}
                    testUserPassword={localStorage.getItem('devTestUserPassword') || ''}
                    onTestUserPasswordChange={(pw) => localStorage.setItem('devTestUserPassword', pw)}
                    isFetchingFeedback={false}
                    onToggleFeedbackDashboard={() => alert('Geri bildirim panelini görüntülemek için lütfen giriş yapın.')}
                />
            )}
        </>
    );
};