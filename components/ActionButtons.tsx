import React from 'react';
import { Lightbulb } from 'lucide-react';

// Define a type for the dynamic action properties
interface NextAction {
    label: string;
    action: () => void;
    icon: React.ReactElement;
    disabled: boolean;
    tooltip?: string;
}

interface ActionButtonsProps {
    onSuggestNextFeature: () => void;
    isLoading: boolean;
    isConversationStarted: boolean;
    nextAction: NextAction;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
    onSuggestNextFeature,
    isLoading,
    isConversationStarted,
    nextAction
}) => {
    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            {/* The new primary, context-aware "Next Best Action" button */}
            <button
                onClick={nextAction.action}
                disabled={isLoading || nextAction.disabled}
                title={nextAction.tooltip}
                className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
                {nextAction.icon}
                {nextAction.label}
            </button>
            
             {/* Secondary Buttons for manual control */}
            <div className="flex items-center gap-2 border-l border-slate-300 dark:border-slate-600 pl-2 ml-2">
                 <button
                    onClick={onSuggestNextFeature}
                    disabled={isLoading || !isConversationStarted}
                    title="AI'nın mevcut analize dayanarak bir sonraki adımı önermesini sağlayın"
                    className="px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                    <Lightbulb className="h-5 w-5" />
                    Fikir Üret
                </button>
            </div>
        </div>
    );
};