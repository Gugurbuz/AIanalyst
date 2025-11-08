// components/AnalysisDocumentViewer.tsx
import React from 'react';
import type { StructuredAnalysisDoc } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AnalysisDocumentViewerProps {
    doc: StructuredAnalysisDoc;
}

export const AnalysisDocumentViewer: React.FC<AnalysisDocumentViewerProps> = ({ doc }) => {
    return (
        <div className="prose prose-slate dark:prose-invert max-w-none w-full h-full overflow-y-auto p-4 md:p-6">
            {doc.sections.map((section, secIndex) => (
                <section key={secIndex} className="mb-8">
                    <h2>{section.title}</h2>
                    {section.content && <MarkdownRenderer content={section.content} />}
                    {section.subSections?.map((subSection, subIndex) => (
                        <section key={subIndex} className="mt-6">
                            <h3>{subSection.title}</h3>
                            {subSection.content && <MarkdownRenderer content={subSection.content} />}
                            {subSection.requirements && (
                                <ul className="list-none !p-0">
                                    {subSection.requirements.map((req, reqIndex) => (
                                        <li key={reqIndex} className="!p-0 mb-6">
                                            <div className="!mb-2"><strong>{req.id}:</strong></div>
                                            <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                                                <MarkdownRenderer content={req.text} />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </section>
            ))}
        </div>
    );
};