// components/FeatureSuggestionsModal.tsx
import React from 'react';
import { Lightbulb, LoaderCircle, X } from 'lucide-react';

interface FeatureSuggestionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    suggestions: string[];
    onSelectSuggestion: (suggestion: string) => void;
    error: string | null;
    onRetry: () => void;
}

export const FeatureSuggestionsModal: React.FC<FeatureSuggestionsModalProps> = ({
    isOpen,
    onClose,
    isLoading,
    suggestions,
    onSelectSuggestion,
    error,
    onRetry
}) => {
    if (!isOpen) return null;

    const handleSelect = (suggestion: string) => {
        onSelectSuggestion(suggestion);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Lightbulb className="h-6 w-6 text-amber-500" />
                        Yeni Fikirler
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </button>
                </header>
                <div className="p-6">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center h-48">
                            <LoaderCircle className="animate-spin h-8 w-8 text-indigo-500" />
                            <p className="mt-4 text-slate-600 dark:text-slate-400">Analizinizden yeni fikirler üretiliyor...</p>
                        </div>
                    )}
                    {error && (
                        <div className="flex flex-col items-center justify-center text-center h-48">
                            <p className="text-red-600 dark:text-red-400">Bir hata oluştu: {error}</p>
                            <button
                                onClick={onRetry}
                                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700"
                            >
                                Tekrar Dene
                            </button>
                        </div>
                    )}
                    {!isLoading && !error && suggestions.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600 dark:text-slate-400">Projenizi bir sonraki adıma taşımak için AI tarafından üretilen bu fikirlerden birini seçin:</p>
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSelect(suggestion)}
                                    className="w-full text-left p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg border border-transparent hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all duration-200"
                                >
                                    <p className="font-medium text-slate-800 dark:text-slate-200">{suggestion}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};