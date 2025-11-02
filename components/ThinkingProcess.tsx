// components/ThinkingProcess.tsx
import React, { useState } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';

interface ThinkingProcessProps {
  content: string;
}

export const ThinkingProcess: React.FC<ThinkingProcessProps> = ({ content }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) {
    return null;
  }

  return (
    <div className="px-4 pt-3">
      <div className="border-b border-slate-300 dark:border-slate-600 mb-2 pb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex justify-between items-center text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            Düşünme sürecini göster
          </span>
          <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap font-mono bg-slate-100 dark:bg-slate-800/50 p-3 rounded-md animate-fade-in-up" style={{animationDuration: '0.2s'}}>
            {content}
          </div>
        )}
      </div>
    </div>
  );
};
