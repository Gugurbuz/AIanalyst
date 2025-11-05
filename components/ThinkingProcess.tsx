import React from 'react';
import { ThinkingStep } from '../types';
import { CheckCircle, RefreshCw, AlertCircle, Circle } from 'lucide-react';

interface ThinkingProcessProps {
  steps: ThinkingStep[];
  isThinking: boolean;
  error: string | null;
}

const ThinkingProcess: React.FC<ThinkingProcessProps> = ({ steps, isThinking, error }) => {
  if (!isThinking && steps.length === 0 && !error) {
    return null;
  }

  // Determine if we should show the generic "Thinking..." placeholder.
  // This is true if we are in a thinking state AND either have no steps yet,
  // or only have the initial placeholder step from the app logic.
  const showPlaceholder = isThinking && !error && (
    steps.length === 0 ||
    (steps.length === 1 && steps[0].name === 'Düşünülüyor...')
  );

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
        // Use a subtle dot for steps that are just text from the stream
        return <div className="h-1.5 w-1.5 bg-slate-400 rounded-full flex-shrink-0 mt-1.5" />;
    }
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-800/70 p-4 rounded-lg shadow-inner mb-4 border border-slate-200 dark:border-slate-700/50">
      <h3 className="text-md font-bold mb-3 text-slate-800 dark:text-slate-200">Düşünce Süreci</h3>
      
      {error && (
        <div className="text-red-600 dark:text-red-400 mb-2 p-3 bg-red-100 dark:bg-red-900/40 rounded-md flex items-start gap-2">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <strong className="font-semibold">Bir Hata Oluştu:</strong>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {showPlaceholder && (
        <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-lg">
                <RefreshCw className="animate-spin h-4 w-4" />
                <span className="text-sm font-medium">Düşünülüyor...</span>
            </div>
        </div>
      )}
      
      {!showPlaceholder && steps.length > 0 && (
        <div className="space-y-2.5">
            {steps.map((step, index) => (
                <div key={step.id || index} className="flex items-start gap-3 animate-fade-in-up" style={{ animationDuration: '0.3s', animationDelay: `${index * 50}ms`}}>
                    <div className="mt-0.5">{getStepIcon(step.status)}</div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{step.name}</span>
                        {step.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.description}</p>}
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default ThinkingProcess;