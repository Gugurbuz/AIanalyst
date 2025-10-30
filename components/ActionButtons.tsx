import React from 'react';

// Define a type for the dynamic action properties
interface NextAction {
    label: string;
    action: () => void;
    icon: React.ReactElement;
    disabled: boolean;
    tooltip?: string;
}

interface ActionButtonsProps {
    onCheckMaturity: () => void;
    onStartLiveSession: () => void;
    onViewDocuments: () => void;
    onSuggestNextFeature: () => void;
    isLoading: boolean;
    isConversationStarted: boolean;
    nextAction: NextAction;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
    onCheckMaturity,
    onStartLiveSession,
    onViewDocuments,
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
                    onClick={onCheckMaturity}
                    disabled={isLoading || !isConversationStarted}
                    title="Mevcut analizin doküman oluşturmaya hazır olup olmadığını kontrol et"
                    className="px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 18.5a11.954 11.954 0 007.834-13.501m-15.668 0A2 2 0 015 3h10a2 2 0 011.834 1.999M10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                    Olgunluk Kontrolü
                </button>
                 <button
                    onClick={onSuggestNextFeature}
                    disabled={isLoading || !isConversationStarted}
                    title="AI'nın mevcut analize dayanarak bir sonraki adımı önermesini sağlayın"
                    className="px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v1.046a1 1 0 01-1.447.894l-1 1a1 1 0 01-1.414-1.414l1-1a1 1 0 01.894-.553zM5.447 3.954a1 1 0 011.414 0l1 1a1 1 0 01-1.414 1.414l-1-1a1 1 0 010-1.414zM12 18v-1.046a1 1 0 011.447-.894l1-1a1 1 0 011.414 1.414l-1 1a1 1 0 01-.894.553A1 1 0 0112 18zM4.046 12.553a1 1 0 01.553-.894l1-1a1 1 0 011.414 1.414l-1 1a1 1 0 01-1.967-.52zM15 9a1 1 0 01-1 1h-4a1 1 0 110-2h4a1 1 0 011 1z" clipRule="evenodd" /></svg>
                    Fikir Üret
                </button>
                <button
                    onClick={onViewDocuments}
                    disabled={isLoading || !isConversationStarted}
                     title="Oluşturulan tüm dokümanları görüntüle"
                    className="px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                    Dokümanlar
                </button>
                <button
                    onClick={onStartLiveSession}
                    disabled={isLoading || !isConversationStarted}
                     title="Sohbet ve dokümanları yan yana görüntüle"
                    className="px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 1h10v2H5V6zm0 4h10v2H5v-2z" clipRule="evenodd" /></svg>
                    Canlı Oturum
                </button>
            </div>
        </div>
    );
};