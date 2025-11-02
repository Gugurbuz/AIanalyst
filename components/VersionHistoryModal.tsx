import React from 'react';
import type { DocumentVersion } from '../types';
import { History, X } from 'lucide-react';

interface VersionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    versions: DocumentVersion[];
    documentName: string;
    onRestore: (version: DocumentVersion) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
    isOpen,
    onClose,
    versions,
    documentName,
    onRestore,
}) => {
    if (!isOpen) {
        return null;
    }

    const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number);

    const handleRestore = (version: DocumentVersion) => {
        if (window.confirm(`"${documentName}" dokümanını v${version.version_number} versiyonuna geri yüklemek istediğinizden emin misiniz? Mevcut içerik üzerine yazılacak ve bu işlem yeni bir versiyon olarak kaydedilecektir.`)) {
            onRestore(version);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-4xl h-full max-h-[90vh] flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <History className="h-6 w-6 text-indigo-500" />
                        "{documentName}" Versiyon Geçmişi
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto p-6">
                    {sortedVersions.length > 0 ? (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:text-slate-300 dark:bg-slate-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 w-24">Versiyon</th>
                                        <th scope="col" className="px-6 py-3 w-48">Tarih</th>
                                        <th scope="col" className="px-6 py-3">Değişiklik Sebebi</th>
                                        <th scope="col" className="px-6 py-3 w-32">Eylemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedVersions.map((version, index) => (
                                        <tr key={version.id} className={`border-b dark:border-slate-700 ${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'} `}>
                                            <td className="px-6 py-4 font-mono font-semibold text-slate-900 dark:text-white">
                                                v{version.version_number} {index === 0 && <span className="text-xs font-sans text-emerald-500 ml-1">(Aktif)</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {new Date(version.created_at).toLocaleString('tr-TR', {
                                                    year: 'numeric', month: 'long', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-6 py-4">
                                                {version.reason_for_change}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleRestore(version)}
                                                    disabled={index === 0}
                                                    className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                >
                                                    Geri Yükle
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-10">
                            Bu doküman için henüz bir versiyon geçmişi bulunmuyor.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};