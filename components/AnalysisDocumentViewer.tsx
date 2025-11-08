// components/AnalysisDocumentViewer.tsx
import React from 'react';
import type { StructuredAnalysisDoc, AnalysisSection } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AnalysisDocumentViewerProps {
    doc: StructuredAnalysisDoc;
}

// Helper to check if a section has sub-sections
function isAnalysisSection(section: any): section is AnalysisSection {
    return Array.isArray(section.altBasliklar);
}

export const AnalysisDocumentViewer: React.FC<AnalysisDocumentViewerProps> = ({ doc }) => {
    if (!doc || !doc.header || !doc.icindekiler) {
        // Render the raw content if it doesn't match the new structure
        return <MarkdownRenderer content={JSON.stringify(doc, null, 2)} />;
    }
    
    const { header, icindekiler } = doc;

    return (
        <div className="h-full overflow-y-auto p-4 md:p-8 bg-white dark:bg-slate-900">
            <div className="max-w-4xl mx-auto">
                {/* Header Card */}
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 mb-10">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6 border-b border-slate-300 dark:border-slate-600 pb-4">İş Talep Dokümanı</h1>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                        <div className="flex flex-col">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Talep Adı:</span>
                            <span className="text-slate-800 dark:text-slate-200">{header.talepAdi}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Revizyon:</span>
                            <span className="text-slate-800 dark:text-slate-200">{header.revizyon}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Talep No:</span>
                            <span className="text-slate-800 dark:text-slate-200">{header.talepNo}</span>
                        </div>
                         <div className="flex flex-col">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Tarih:</span>
                            <span className="text-slate-800 dark:text-slate-200">{header.tarih}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Talep Sahibi:</span>
                            <span className="text-slate-800 dark:text-slate-200">{header.talepSahibi}</span>
                        </div>
                         <div className="flex flex-col">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Hazırlayan:</span>
                            <span className="text-slate-800 dark:text-slate-200">{header.hazirlayan}</span>
                        </div>
                    </div>
                </div>

                {/* Table of Contents */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">İçindekiler</h2>
                    <ul className="space-y-2">
                        {icindekiler.map(section => (
                            <li key={section.id}>
                                <a href={`#${section.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">{section.baslik}</a>
                                {isAnalysisSection(section) && (
                                     <ul className="pl-6 mt-2 space-y-1">
                                        {section.altBasliklar.map(sub => (
                                            <li key={sub.id}>
                                                <a href={`#${sub.id}`} className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">{sub.baslik}</a>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Document Content */}
                <div className="prose prose-slate dark:prose-invert max-w-none">
                    {icindekiler.map(section => (
                         <section key={section.id} id={section.id} className="mb-8 scroll-mt-20">
                             <h2 className="text-3xl font-extrabold pb-3 mt-10 mb-5 border-b border-slate-200 dark:border-slate-700">{section.baslik}</h2>
                            {isAnalysisSection(section) ? (
                                section.altBasliklar.map(sub => (
                                     <section key={sub.id} id={sub.id} className="mt-6 scroll-mt-20">
                                         <h3 className="text-xl font-bold mt-8 mb-3">{sub.baslik}</h3>
                                        <MarkdownRenderer content={sub.icerik} />
                                    </section>
                                ))
                            ) : (
                                 <MarkdownRenderer content={section.icerik} />
                            )}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};