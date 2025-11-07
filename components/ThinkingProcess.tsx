import React, { useState } from 'react';
import { ThinkingStep } from '../types';
import { CheckCircle, RefreshCw, AlertCircle, Circle, ChevronUp } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ThinkingProcessProps {
  steps: ThinkingStep[];
  isThinking: boolean;
  error: string | null;
}

const ThinkingProcess: React.FC<ThinkingProcessProps> = ({ steps, isThinking, error }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!isThinking && steps.length === 0 && !error) {
        return null;
    }

    const isFreeFormThought = steps.length > 0 && steps.every(step => step.name === 'Düşünce Akışı');
    const freeFormContent = steps.map(s => s.description).join('\n\n');

    const getStepIcon = (status: ThinkingStep['status']) => {
        switch (status) {
            case 'in_progress':
                return <RefreshCw className="animate-spin h-4 w-4 text-indigo-400 flex-shrink-0" />;
            case 'pending':
                return <Circle className="h-4 w-4 text-slate-400 flex-shrink-0" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
            default:
                return <div className="h-1.5 w-1.5 bg-slate-400 rounded-full flex-shrink-0 mt-1.5" />;
        }
    };

    const showSpinner = isThinking || steps.some(s => s.status === 'in_progress');

    return (
        <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg mb-4 border border-slate-200 dark:border-slate-700/50">
            <button
                className="w-full flex justify-between items-center p-3 text-left"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    {showSpinner && <RefreshCw className="animate-spin h-4 w-4 text-slate-500 dark:text-slate-400" />}
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Thinking...</h3>
                </div>
                <ChevronUp className={`h-5 w-5 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${!isExpanded && 'rotate-180'}`} />
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700/50">
                    {error && (
                        <div className="text-red-600 dark:text-red-400 mt-3 p-3 bg-red-100 dark:bg-red-900/40 rounded-md flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                            <div>
                                <strong className="font-semibold">Bir hata oluştu:</strong>
                                <p className="text-sm">{error}</p>
                            </div>
                        </div>
                    )}

                    {!error && (
                        isFreeFormThought ? (
                            <div className="pt-2">
                                <MarkdownRenderer content={freeFormContent} />
                            </div>
                        ) : (
                            <div className="space-y-2.5 pt-3">
                                {steps.map((step, index) => (
                                    <div key={step.id || index} className="flex items-start gap-3">
                                        <div className="mt-0.5">{getStepIcon(step.status)}</div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{step.name}</span>
                                            {step.details && (
                                                <p className="text-xs text-red-600 dark:text-red-500 mt-1">{step.details}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default ThinkingProcess;
