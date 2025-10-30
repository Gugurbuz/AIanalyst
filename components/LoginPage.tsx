import React, { useState } from 'react';
import { authService } from '../services/authService';

interface LoginPageProps {
    switchToSignup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ switchToSignup }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            await authService.login(email, password);
            // onLoginSuccess is no longer needed; onAuthStateChange handles session.
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestLogin = async () => {
        setError(null);
        setIsLoading(true);
        try {
           await authService.loginWithTestUser();
           // onLoginSuccess is no longer needed.
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Test kullanıcısı ile giriş yapılamadı.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600">{error}</div>}
            <div>
                <label htmlFor="email-login" className="block text-sm font-medium text-slate-700 dark:text-slate-300">E-posta Adresi</label>
                <input
                    id="email-login"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <label htmlFor="password-login" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Şifre</label>
                <input
                    id="password-login"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </button>
            </div>
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                <span className="flex-shrink mx-4 text-xs text-slate-500 dark:text-slate-400">VEYA</span>
                <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
            </div>
             <div>
                <button
                    type="button"
                    onClick={handleTestLogin}
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 8a6 6 0 11-12 0 6 6 0 0112 0zM7 8a3 3 0 116 0 3 3 0 01-6 0z" clipRule="evenodd" />
                        <path d="M6.32 13.03a4.03 4.03 0 012.83-1.43h1.7a4.03 4.03 0 012.83 1.43 6.97 6.97 0 01-7.36 0z" />
                     </svg>
                    Test Kullanıcısı Olarak Giriş Yap
                </button>
            </div>
            <p className="text-sm text-center text-slate-600 dark:text-slate-400">
                Hesabınız yok mu?{' '}
                <button type="button" onClick={switchToSignup} className="font-medium text-indigo-600 hover:text-indigo-500">
                    Kayıt Olun
                </button>
            </p>
        </form>
    );
};