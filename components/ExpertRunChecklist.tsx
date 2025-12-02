
// components/ExpertRunChecklist.tsx
import React from 'react';
import type { ExpertStep } from '../types';
import { CheckCircle2, LoaderCircle, Circle, AlertTriangle } from 'lucide-react';

interface ExpertRunChecklistProps {
    steps: ExpertStep[];
    initialMessage: string;
}

const statusIcons: Record<ExpertStep['status'], React.ReactElement> = {
    pending: <Circle className="h-5 w-5 text-slate-400" />,
    in_progress: <LoaderCircle className="h-5 w-5 text-indigo-500 animate-spin" />,
    completed: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    error: <AlertTriangle className="h-5 w-5 text-red-500" />,
};

const statusTextStyles: Record<ExpertStep['status'], string> = {
    pending: 'text-slate-500 dark:text-slate-400',
    in_progress: 'text-indigo-600 dark:text-indigo-400 font-semibold',
    completed: 'text-emerald-700 dark:text-emerald-300 font-semibold',
    error: 'text-red-700 dark:text-red-400 font-semibold',
};

export const ExpertRunChecklist: React.FC<ExpertRunChecklistProps> = ({ steps, initialMessage }) => {
    const completedCount = steps.filter(s => s.status === 'completed').length;
    const totalCount = steps.length;
    const progressPercentage = (completedCount / totalCount) * 100;

    return (
        <div className="p-4 space-y-4">
            {initialMessage && (
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{initialMessage}</p>
            )}
            
            <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span>İlerleme</span>
                    <span>%{Math.round(progressPercentage)}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div 
                        className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${progressPercentage}%` }}
                    ></div>
                </div>
            </div>

            <div className="border-t border-slate-300 dark:border-slate-600 pt-3 space-y-2">
                {steps.map(step => (
                    <div key={step.id} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">{statusIcons[step.status]}</div>
                        <div className="flex-1">
                             <p className={`text-sm transition-colors ${statusTextStyles[step.status]}`}>
                                {step.name}
                            </p>
                            {step.status === 'error' && step.details && (
                                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                                    Hata: {step.details}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
