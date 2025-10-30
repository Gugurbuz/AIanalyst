import React from 'react';
import { PROMPT_SUGGESTIONS } from '../constants';

interface PromptSuggestionsProps {
    onSelectPrompt: (prompt: string) => void;
}

export const PromptSuggestions: React.FC<PromptSuggestionsProps> = ({ onSelectPrompt }) => {
    return (
        <div className="mb-4">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 text-center">Yardıma mı ihtiyacınız var? Bu sorularla başlayın:</p>
            <div className="flex flex-wrap justify-center gap-2">
                {PROMPT_SUGGESTIONS.map((prompt, index) => (
                    <button
                        key={index}
                        onClick={() => onSelectPrompt(prompt)}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200"
                    >
                        {prompt}
                    </button>
                ))}
            </div>
        </div>
    );
};