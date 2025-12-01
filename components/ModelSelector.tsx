import React from 'react';
import { Brain, Sparkles } from 'lucide-react';
import type { AIProvider, AIModel, GeminiModel, OpenAIModel } from '../types';

interface ModelSelectorProps {
    currentProvider: AIProvider;
    currentModel: AIModel;
    onProviderChange: (provider: AIProvider) => void;
    onModelChange: (model: AIModel) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
    currentProvider,
    currentModel,
    onProviderChange,
    onModelChange
}) => {
    const geminiModels: { value: GeminiModel; label: string }[] = [
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
        { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
    ];

    const openaiModels: { value: OpenAIModel; label: string }[] = [
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
    ];

    const handleProviderChange = (provider: AIProvider) => {
        onProviderChange(provider);
        if (provider === 'openai') {
            onModelChange('gpt-4-turbo');
        } else {
            onModelChange('gemini-2.5-pro');
        }
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Provider:
                </label>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleProviderChange('gemini')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                            currentProvider === 'gemini'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Gemini
                    </button>
                    <button
                        onClick={() => handleProviderChange('openai')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                            currentProvider === 'openai'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                        <Brain className="w-4 h-4" />
                        OpenAI
                    </button>
                </div>
            </div>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Model:
                </label>
                <select
                    value={currentModel}
                    onChange={(e) => onModelChange(e.target.value as AIModel)}
                    className="px-3 py-1.5 rounded-md text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {currentProvider === 'gemini'
                        ? geminiModels.map((model) => (
                              <option key={model.value} value={model.value}>
                                  {model.label}
                              </option>
                          ))
                        : openaiModels.map((model) => (
                              <option key={model.value} value={model.value}>
                                  {model.label}
                              </option>
                          ))}
                </select>
            </div>
        </div>
    );
};
