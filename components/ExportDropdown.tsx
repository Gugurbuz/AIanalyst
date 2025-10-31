import React, { useState, useRef, useEffect } from 'react';
import { exportService } from '../services/exportService';
import { Download, ChevronDown } from 'lucide-react';

interface ExportDropdownProps {
    content: string;
    filename: string;
    isTable?: boolean;
    visualizationType?: 'mermaid' | 'bpmn' | null;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({ content, filename, isTable = false, visualizationType = null }) => {
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

    const handleExport = (format: 'pdf' | 'md' | 'svg' | 'mmd' | 'bpmn' | 'docx') => {
        if (format === 'svg') {
            const svgElement = document.getElementById('mermaid-diagram-container')?.querySelector('svg');
             if (svgElement) {
                if (!svgElement.getAttribute('xmlns')) {
                    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                }
                const svgContent = new XMLSerializer().serializeToString(svgElement);
                exportService.exportAsSvg(svgContent, `${filename}.svg`);
            } else {
                alert('Dışa aktarılacak SVG bulunamadı.');
            }
        } else if (format === 'mmd') {
            exportService.exportAsMermaid(content, `${filename}.md`);
        } else if (format === 'bpmn') {
             exportService.exportAsMermaid(content, `${filename}.bpmn`); // Uses same text export logic for the XML
        } else if (format === 'md') {
            exportService.exportAsMarkdown(content, `${filename}.md`);
        } else if (format === 'docx') {
             exportService.exportAsDocx(content, filename);
        } else { // format === 'pdf'
            exportService.exportAsPdf(content, filename, isTable);
        }
        setIsOpen(false);
    };

    const renderOptions = () => {
        if (visualizationType === 'bpmn') {
            return (
                <>
                    <button
                        onClick={() => handleExport('bpmn')}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        role="menuitem"
                    >
                         <span className="font-mono text-xs bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200 rounded px-1.5 py-0.5 mr-2">.bpmn</span>
                        BPMN olarak (XML)
                    </button>
                    {/* Future: Add SVG export for BPMN */}
                </>
            );
        }
        if (visualizationType === 'mermaid') {
             return (
                 <>
                    <button
                        onClick={() => handleExport('svg')}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        role="menuitem"
                    >
                         <span className="font-mono text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 rounded px-1.5 py-0.5 mr-2">.svg</span>
                        SVG olarak
                    </button>
                    <button
                        onClick={() => handleExport('mmd')}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        role="menuitem"
                    >
                        <span className="font-mono text-xs bg-slate-200 dark:bg-slate-600 rounded px-1.5 py-0.5 mr-2">.md</span>
                        Mermaid olarak
                    </button>
                 </>
            );
        }
        // Default for non-viz documents
        return (
            <>
                <button
                    onClick={() => handleExport('docx')}
                    className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    role="menuitem"
                >
                    <span className="font-mono text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded px-1.5 py-0.5 mr-2">.docx</span>
                    Word olarak
                </button>
                <button
                    onClick={() => handleExport('md')}
                    className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    role="menuitem"
                >
                    <span className="font-mono text-xs bg-slate-200 dark:bg-slate-600 rounded px-1.5 py-0.5 mr-2">.md</span>
                    Markdown olarak
                </button>
                <button
                    onClick={() => handleExport('pdf')}
                    className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    role="menuitem"
                >
                    <span className="font-mono text-xs bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 rounded px-1.5 py-0.5 mr-2">.pdf</span>
                    PDF olarak
                </button>
            </>
        );
    }


    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-indigo-500 transition"
            >
                <Download className="h-4 w-4 mr-2" />
                <span>Dışa Aktar</span>
                 <ChevronDown className="h-4 w-4 ml-1" />
            </button>
            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-full sm:w-48 min-w-0 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                       {renderOptions()}
                    </div>
                </div>
            )}
        </div>
    );
};