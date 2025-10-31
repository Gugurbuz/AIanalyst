// components/StreamingIndicator.tsx
import React from 'react';

export const StreamingIndicator: React.FC = () => {
    return (
        <div className="inline-block ml-1">
            <span className="streaming-indicator">
                <span className="w-1.5 h-1.5 bg-slate-500 dark:bg-slate-400 rounded-full inline-block"></span>
                <span className="w-1.5 h-1.5 bg-slate-500 dark:bg-slate-400 rounded-full inline-block"></span>
                <span className="w-1.5 h-1.5 bg-slate-500 dark:bg-slate-400 rounded-full inline-block"></span>
            </span>
        </div>
    );
};