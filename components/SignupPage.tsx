import React, { useState } from 'react';
import { authService } from '../services/authService';

interface SignupPageProps {
    switchToLogin: () => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ switchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Şifreler eşleşmiyor.');
            return;
        }
        setError(null);
        setIsLoading(true);
        try {
            await authService.signup(email, password);
            // After successful signup, onAuthStateChange will handle the new session.
            // No need to manually log the user in.
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
             {error && <div className="p-3 text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600">{error}</div>}
            <div>
                <label htmlFor="email-signup" className="block text-sm font-medium text-slate-700 dark:text-slate-300">E-posta Adresi</label>
                <input
                    id="email-signup"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <label htmlFor="password-signup" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Şifre</label>
                <input
                    id="password-signup"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
             <div>
                <label htmlFor="confirm-password-signup" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Şifreyi Onayla</label>
                <input
                    id="confirm-password-signup"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    {isLoading ? 'Hesap oluşturuluyor...' : 'Kayıt Ol'}
                </button>
            </div>
             <p className="text-sm text-center text-slate-600 dark:text-slate-400">
                Zaten bir hesabınız var mı?{' '}
                <button type="button" onClick={switchToLogin} className="font-medium text-indigo-600 hover:text-indigo-500">
                    Giriş Yapın
                </button>
            </p>
        </form>
    );
};