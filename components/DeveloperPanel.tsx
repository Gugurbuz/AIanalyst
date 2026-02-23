import React, { useState, useEffect } from 'react';
import { PromptManager } from './PromptManager';
import { supabase } from '../services/supabaseClient';

interface DeveloperPanelProps {
    modelName: string;
    onModelNameChange: (name: string) => void;
    supabaseUrl: string;
    onSupabaseUrlChange: (url: string) => void;
    supabaseAnonKey: string;
    onSupabaseAnonKeyChange: (key: string) => void;
    testUserEmail: string;
    onTestUserEmailChange: (email: string) => void;
    testUserPassword: string;
    onTestUserPasswordChange: (password: string) => void;
    isFetchingFeedback: boolean;
    onToggleFeedbackDashboard: () => void;
    onClose: () => void;
}

export const DeveloperPanel: React.FC<DeveloperPanelProps> = ({
    modelName,
    onModelNameChange,
    supabaseUrl,
    onSupabaseUrlChange,
    supabaseAnonKey,
    onSupabaseAnonKeyChange,
    testUserEmail,
    onTestUserEmailChange,
    testUserPassword,
    onTestUserPasswordChange,
    isFetchingFeedback,
    onToggleFeedbackDashboard,
    onClose
}) => {
    const [localModelName, setLocalModelName] = useState(modelName);
    const [localSupabaseUrl, setLocalSupabaseUrl] = useState(supabaseUrl);
    const [localSupabaseAnonKey, setLocalSupabaseAnonKey] = useState(supabaseAnonKey);
    const [localTestUserEmail, setLocalTestUserEmail] = useState(testUserEmail);
    const [localTestUserPassword, setLocalTestUserPassword] = useState(testUserPassword);
    const [openaiApiKey, setOpenaiApiKey] = useState('');
    const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);
    const [savedMessage, setSavedMessage] = useState('');
    const [isPromptManagerOpen, setIsPromptManagerOpen] = useState(false);

    useEffect(() => { setLocalModelName(modelName); }, [modelName]);
    useEffect(() => { setLocalSupabaseUrl(supabaseUrl); }, [supabaseUrl]);
    useEffect(() => { setLocalSupabaseAnonKey(supabaseAnonKey); }, [supabaseAnonKey]);
    useEffect(() => { setLocalTestUserEmail(testUserEmail); }, [testUserEmail]);
    useEffect(() => { setLocalTestUserPassword(testUserPassword); }, [testUserPassword]);

    useEffect(() => {
        const loadApiKey = async () => {
            try {
                const { data } = await supabase
                    .from('settings')
                    .select('value')
                    .eq('key', 'OPENAI_API_KEY')
                    .maybeSingle();

                setOpenaiApiKey(data?.value || '');
            } catch (error) {
                console.error('API anahtarı yüklenemedi:', error);
            } finally {
                setIsLoadingApiKey(false);
            }
        };
        loadApiKey();
    }, []);


    const handleSave = async () => {
        onModelNameChange(localModelName);
        onSupabaseUrlChange(localSupabaseUrl);
        onSupabaseAnonKeyChange(localSupabaseAnonKey);
        onTestUserEmailChange(localTestUserEmail);
        onTestUserPasswordChange(localTestUserPassword);

        try {
            await supabase
                .from('settings')
                .upsert({ key: 'OPENAI_API_KEY', value: openaiApiKey }, { onConflict: 'key' });
        } catch (error) {
            console.error('API anahtarı kaydedilemedi:', error);
        }

        setSavedMessage('Ayarlar kaydedildi. Uygulama yeniden başlatılıyor...');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center mb-4 p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Geliştirici Paneli</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                
                <div className="space-y-4 overflow-y-auto px-4 pb-4 flex-1">
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 p-2 rounded-md">
                            <strong>Not:</strong> Uygulama artık OpenAI (ChatGPT) kullanmaktadır. API anahtarınız güvenli bir şekilde Supabase'de saklanır.
                        </p>
                    </div>
                    <div>
                        <label htmlFor="openai-api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            OpenAI API Anahtarı
                        </label>
                        <input
                            type="password"
                            id="openai-api-key"
                            value={openaiApiKey}
                            onChange={(e) => setOpenaiApiKey(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-100 dark:bg-slate-700"
                            placeholder="sk-..."
                            disabled={isLoadingApiKey}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            OpenAI hesabınızdan API anahtarı alabilirsiniz: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">platform.openai.com</a>
                        </p>
                    </div>
                    <hr className="border-slate-300 dark:border-slate-600"/>
                    <div>
                        <label htmlFor="model-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Gemini Model Adı
                        </label>
                        <input
                            type="text"
                            id="model-name"
                            value={localModelName}
                            onChange={(e) => setLocalModelName(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-100 dark:bg-slate-700"
                            placeholder="Örn: gemini-2.5-flash"
                        />
                    </div>
                    <hr className="border-slate-300 dark:border-slate-600"/>
                    <div>
                        <label htmlFor="supabase-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Supabase URL
                        </label>
                        <input
                            type="text"
                            id="supabase-url"
                            value={localSupabaseUrl}
                            onChange={(e) => setLocalSupabaseUrl(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-100 dark:bg-slate-700"
                            placeholder="Supabase Proje URL'si"
                        />
                    </div>
                     <div>
                        <label htmlFor="supabase-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Supabase Anon Key
                        </label>
                        <input
                            type="password"
                            id="supabase-key"
                            value={localSupabaseAnonKey}
                            onChange={(e) => setLocalSupabaseAnonKey(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-100 dark:bg-slate-700"
                            placeholder="Supabase Proje Anon Key"
                        />
                    </div>
                     <hr className="border-slate-300 dark:border-slate-600"/>
                     <div>
                        <label htmlFor="test-user-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Test Kullanıcısı E-posta
                        </label>
                        <input
                            type="email"
                            id="test-user-email"
                            value={localTestUserEmail}
                            onChange={(e) => setLocalTestUserEmail(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-100 dark:bg-slate-700"
                            placeholder="test@ornek.com"
                        />
                    </div>
                     <div>
                        <label htmlFor="test-user-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Test Kullanıcısı Şifresi
                        </label>
                        <input
                            type="text"
                            id="test-user-password"
                            value={localTestUserPassword}
                            onChange={(e) => setLocalTestUserPassword(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-100 dark:bg-slate-700"
                            placeholder="Güçlü bir test şifresi"
                        />
                    </div>
                     <hr className="border-slate-300 dark:border-slate-600"/>
                     <div>
                         <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Gelişmiş Araçlar</h4>
                         <button
                            onClick={() => setIsPromptManagerOpen(true)}
                            className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 mb-2"
                        >
                            Prompt Yöneticisi
                        </button>
                         <button
                            onClick={onToggleFeedbackDashboard}
                            disabled={isFetchingFeedback}
                            className="w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50"
                        >
                            {isFetchingFeedback ? 'Yükleniyor...' : 'Geri Bildirim Panelini Aç'}
                        </button>
                    </div>
                </div>

                <div className="mt-auto p-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                    {savedMessage ? 
                        <span className="text-sm text-emerald-600 dark:text-emerald-400 flex-1">{savedMessage}</span>
                        : <div/>
                    }
                     <button 
                        onClick={handleSave} 
                        disabled={!!savedMessage}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition duration-200 disabled:opacity-50"
                    >
                        Kaydet ve Yeniden Başlat
                    </button>
                </div>
                
                {isPromptManagerOpen && (
                    <PromptManager
                        isOpen={isPromptManagerOpen}
                        onClose={() => setIsPromptManagerOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};