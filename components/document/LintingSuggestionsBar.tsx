
import React from 'react';
import { LintingIssue } from '../../types';
import { Wrench, X } from 'lucide-react';

interface LintingSuggestionsBarProps {
    issues: LintingIssue[];
    onFix: (issue: LintingIssue) => void;
    onDismiss: (issue: LintingIssue) => void;
    isFixing: boolean;
}

export const LintingSuggestionsBar: React.FC<LintingSuggestionsBarProps> = ({ issues, onFix, onDismiss, isFixing }) => {
    if (issues.length === 0) return null;
    const issue = issues[0];
    return (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl mt-2 z-20">
            <div className="bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg shadow-lg flex items-center justify-between gap-4">
                <div className="flex items-center gap-2"><Wrench className="h-5 w-5 flex-shrink-0" /><p className="text-sm font-medium">"{issue.section}" bölümündeki numaralandırmada bir tutarsızlık fark ettik. Otomatik olarak düzeltmek ister misiniz?</p></div>
                <div className="flex items-center gap-2 flex-shrink-0">
                     <button onClick={() => onFix(issue)} disabled={isFixing} className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">{isFixing ? 'Düzeltiliyor...' : 'Düzelt'}</button>
                    <button onClick={() => onDismiss(issue)} className="p-1.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800"><X className="h-4 w-4" /></button>
                </div>
            </div>
        </div>
    );
};
