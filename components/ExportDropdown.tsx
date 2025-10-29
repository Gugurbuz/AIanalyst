import React, { useState, useRef, useEffect } from 'react';
import { exportService } from '../services/exportService';

interface ExportDropdownProps {
    content: string;
    filename: string;
    isTable?: boolean;
    isVisualization?: boolean;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({ content, filename, isTable = false, isVisualization = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExport = (format: 'pdf' | 'md' | 'mmd') => {
        if (format === 'md') {
            exportService.exportAsMarkdown(content, `${filename}.md`);
        } else if (format === 'mmd') {
            exportService.exportAsMermaid(content, `${filename}.mmd`);
        } else {
            exportService.exportAsPdf(content, filename, isTable);
        }
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-sky-500 transition"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Dışa Aktar</span>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        {isVisualization ? (
                             <button
                                onClick={() => handleExport('mmd')}
                                className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                role="menuitem"
                            >
                                <span className="font-mono text-xs bg-slate-200 dark:bg-slate-600 rounded px-1.5 py-0.5 mr-2">.mmd</span>
                                Mermaid olarak
                            </button>
                        ) : (
                            <button
                                onClick={() => handleExport('md')}
                                className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                role="menuitem"
                            >
                                <span className="font-mono text-xs bg-slate-200 dark:bg-slate-600 rounded px-1.5 py-0.5 mr-2">.md</span>
                                Markdown olarak
                            </button>
                        )}
                        
                        {!isVisualization && (
                             <button
                                onClick={() => handleExport('pdf')}
                                className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                role="menuitem"
                            >
                                 <span className="font-mono text-xs bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 rounded px-1.5 py-0.5 mr-2">.pdf</span>
                                PDF olarak
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};