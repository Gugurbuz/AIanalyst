import React, { useState, useEffect } from 'react';

interface DeveloperPanelProps {
    apiKey: string;
    onApiKeyChange: (key: string) => void;
    modelName: string;
    onModelNameChange: (name: string) => void;
    onClose: () => void;
}

export const DeveloperPanel: React.FC<DeveloperPanelProps> = ({
    apiKey,
    onApiKeyChange,
    modelName,
    onModelNameChange,
    onClose
}) => {
    const [localApiKey, setLocalApiKey] = useState(apiKey);
    const [localModelName, setLocalModelName] = useState(modelName);

    useEffect(() => {
        setLocalApiKey(apiKey);
    }, [apiKey]);
    
    useEffect(() => {
        setLocalModelName(modelName);
    }, [modelName]);

    const handleSave = () => {
        onApiKeyChange(localApiKey);
        onModelNameChange(localModelName);
    };

    return (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-4 border border-slate-300 dark:border-slate-600 z-50 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Geliştirici Paneli</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label htmlFor="api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        API Anahtarı
                    </label>
                    <input
                        type="password"
                        id="api-key"
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none bg-slate-100 dark:bg-slate-700"
                        placeholder="API Anahtarını buraya girin"
                    />
                </div>
                <div>
                    <label htmlFor="model-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Model Adı
                    </label>
                    <input
                        type="text"
                        id="model-name"
                        value={localModelName}
                        onChange={(e) => setLocalModelName(e.target.value)}
                        className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none bg-slate-100 dark:bg-slate-700"
                        placeholder="Örn: gemini-2.5-flash"
                    />
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                 <button 
                    onClick={handleSave} 
                    className="px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition duration-200"
                >
                    Ayarları Kaydet
                </button>
            </div>
        </div>
    );
};