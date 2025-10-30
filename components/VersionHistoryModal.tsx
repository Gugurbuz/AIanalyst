import React from 'react';
import type { PromptVersion } from '../types';

interface VersionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    versions: PromptVersion[];
    activeVersionId: string;
    promptName: string;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
    isOpen,
    onClose,
    versions,
    activeVersionId,
    promptName,
}) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                        "{promptName}" Versiyon Geçmişi
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto p-6">
                    <ul className="space-y-4">
                        {versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(version => (
                            <li key={version.versionId} className="p-4 border border-slate-200 dark:border-slate-700 rounded-md">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{version.name}</h3>
                                    {version.versionId === activeVersionId && (
                                        <span className="text-xs font-bold text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-900/50 px-2 py-1 rounded-full">
                                            Aktif
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Oluşturulma: {new Date(version.createdAt).toLocaleString('tr-TR')}
                                </p>
                                <pre className="mt-3 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-md text-xs whitespace-pre-wrap font-mono">
                                    <code>{version.prompt}</code>
                                </pre>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};
