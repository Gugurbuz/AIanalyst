import React, { useState, useRef, useEffect } from 'react';
import { exportService } from '../services/exportService';
import { Download, ChevronDown } from 'lucide-react';

interface ExportDropdownProps {
    content: string;
    filename: string;
    diagramType?: 'mermaid' | 'bpmn' | null;
    getSvgContent?: (() => Promise<string | null>) | null;
    isTable?: boolean;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({ content, filename, diagramType = null, getSvgContent, isTable }) => {
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

    const handleExport = async (format: 'pdf' | 'md' | 'svg' | 'png' | 'html' | 'bpmn' | 'docx') => {
        if ((format === 'svg' || format === 'png') && getSvgContent) {
            const svgContent = await getSvgContent();
            if (svgContent) {
                if (format === 'svg') {
                    exportService.exportAsSvg(svgContent, `${filename}.svg`);
                } else {
                    exportService.exportAsPng(svgContent, `${filename}.png`);
                }
            } else {
                alert('Dışa aktarılacak SVG içeriği bulunamadı.');
            }
        } else if (format === 'html') {
            if (diagramType === 'mermaid') {
                exportService.exportAsHtml(content, filename);
            } else if (diagramType === 'bpmn') {
                exportService.exportBpmnAsHtml(content, filename);
            }
        } else if (format === 'bpmn') {
             exportService.exportAsMarkdown(content, `${filename}.bpmn`); // Uses same text export logic for the XML
        } else if (format === 'md') {
            exportService.exportAsMarkdown(content, `${filename}.md`);
        } else if (format === 'docx') {
             exportService.exportAsDocx(content, filename);
        } else if (format === 'pdf') {
            // For diagrams, we can try to export the SVG as part of the PDF, but for now, we'll just print text content
            exportService.exportAsPdf(content, filename, !!isTable);
        }
        setIsOpen(false);
    };

    const renderOptions = () => {
        if (diagramType === 'bpmn') {
            return (
                <>
                    <button onClick={() => handleExport('png')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                        <span className="font-mono text-xs bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200 rounded px-1.5 py-0.5 mr-2">.png</span> PNG Olarak
                    </button>
                    <button onClick={() => handleExport('svg')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                         <span className="font-mono text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 rounded px-1.5 py-0.5 mr-2">.svg</span> SVG Olarak
                    </button>
                    <button onClick={() => handleExport('html')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                        <span className="font-mono text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 rounded px-1.5 py-0.5 mr-2">.html</span> HTML Olarak
                    </button>
                    <button onClick={() => handleExport('bpmn')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                         <span className="font-mono text-xs bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200 rounded px-1.5 py-0.5 mr-2">.bpmn</span> BPMN (XML)
                    </button>
                </>
            );
        }
        if (diagramType === 'mermaid') {
             return (
                 <>
                    <button onClick={() => handleExport('png')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                        <span className="font-mono text-xs bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200 rounded px-1.5 py-0.5 mr-2">.png</span> PNG Olarak
                    </button>
                    <button onClick={() => handleExport('svg')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                         <span className="font-mono text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 rounded px-1.5 py-0.5 mr-2">.svg</span> SVG Olarak
                    </button>
                     <button onClick={() => handleExport('html')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                        <span className="font-mono text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 rounded px-1.5 py-0.5 mr-2">.html</span> HTML Olarak
                    </button>
                    <button onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                        <span className="font-mono text-xs bg-slate-200 dark:bg-slate-600 rounded px-1.5 py-0.5 mr-2">.md</span> Mermaid Kodu
                    </button>
                 </>
            );
        }
        // Default for non-viz documents
        return (
            <>
                <button onClick={() => handleExport('docx')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                    <span className="font-mono text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded px-1.5 py-0.5 mr-2">.docx</span> Word olarak
                </button>
                <button onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                    <span className="font-mono text-xs bg-slate-200 dark:bg-slate-600 rounded px-1.5 py-0.5 mr-2">.md</span> Markdown olarak
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
                <div className="origin-top-right absolute right-0 mt-2 w-full sm:w-48 min-w-0 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                       {renderOptions()}
                    </div>
                </div>
            )}
        </div>
    );
};