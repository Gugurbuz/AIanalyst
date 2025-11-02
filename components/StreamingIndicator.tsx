// components/StreamingIndicator.tsx
import React from 'react';

export const StreamingIndicator: React.FC = () => {
    return (
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <div className="inline-block">
                <span className="streaming-indicator">
                    <span className="w-1.5 h-1.5 bg-current rounded-full inline-block"></span>
                    <span className="w-1.5 h-1.5 bg-current rounded-full inline-block"></span>
                    <span className="w-1.5 h-1.5 bg-current rounded-full inline-block"></span>
                </span>
            </div>
            <span className="text-sm">Yazıyor...</span>
        </div>
    );
};