// components/DocumentEmptyState.tsx
import React from 'react';
import { LoaderCircle } from 'lucide-react';

interface DocumentEmptyStateProps {
    icon: React.ReactElement;
    title: string;
    description: string;
    buttonText: string;
    onAction: () => void;
    isLoading?: boolean;
    isDisabled?: boolean;
    disabledTooltip?: string;
}

export const DocumentEmptyState: React.FC<DocumentEmptyStateProps> = ({
    icon,
    title,
    description,
    buttonText,
    onAction,
    isLoading = false,
    isDisabled = false,
    disabledTooltip
}) => {
    return (
        <div className="p-6 text-center text-slate-500 dark:text-slate-400 h-full flex flex-col justify-center items-center">
            <div className="w-16 h-16 flex items-center justify-center text-slate-400 mb-4">
                {/* FIX: Cast the icon to allow adding props with cloneElement. The 'icon' prop is a generic ReactElement, and TypeScript can't guarantee it accepts className or strokeWidth. This cast informs TypeScript that we expect a component that can handle these props (like lucide-react icons). */}
                {React.cloneElement(icon as React.ReactElement<{ className: string; strokeWidth: number }>, { className: "w-full h-full", strokeWidth: 1 })}
            </div>
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
            <p className="mt-2 max-w-lg text-sm">{description}</p>
            <button
                onClick={onAction}
                disabled={isDisabled || isLoading}
                title={disabledTooltip}
                className="mt-6 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[180px]"
            >
                {isLoading ? (
                    <>
                        <LoaderCircle className="animate-spin -ml-1 mr-2 h-4 w-4" />
                        Oluşturuluyor...
                    </>
                ) : (
                    buttonText
                )}
            </button>
        </div>
    );
};
