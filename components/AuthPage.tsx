import React, { useState } from 'react';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';
import type { User } from '../types';

interface AuthPageProps {
    onLoginSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
    const [isLoginView, setIsLoginView] = useState(true);

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 font-sans">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl dark:bg-slate-800">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                        AI İş Analisti Asistanı
                    </h1>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">
                        {isLoginView ? 'Devam etmek için giriş yapın' : 'Başlamak için bir hesap oluşturun'}
                    </p>
                </div>

                {isLoginView ? (
                    <LoginPage 
                        onLoginSuccess={onLoginSuccess} 
                        switchToSignup={() => setIsLoginView(false)} 
                    />
                ) : (
                    <SignupPage 
                        onSignupSuccess={onLoginSuccess} 
                        switchToLogin={() => setIsLoginView(true)} 
                    />
                )}
            </div>
        </div>
    );
};
