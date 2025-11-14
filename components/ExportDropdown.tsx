// components/ExportDropdown.tsx
import React, { useState, useRef, useEffect } from 'react';
import { exportService } from '../services/exportService';
import { Download, ChevronDown } from 'lucide-react';
// YENİ IMPORTLAR (npm'den)
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// YENİ: Turndown servisini SADECE dışa aktarma için burada tanımlayın
const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndownService.use(gfm);


interface ExportDropdownProps {
    content: string; // BU PROP ARTIK HTML İÇERİYOR (veya diyagram kodu)
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

    // GÜNCELLENMİŞ EXPORT FONKSİYONU
    const handleExport = async (format: 'pdf' | 'md' | 'svg' | 'png' | 'html' | 'bpmn' | 'docx') => {
        setIsOpen(false);

        // Diyagramlar (SVG/PNG/HTML/BPMN)
        if (diagramType) {
            if ((format === 'svg' || format === 'png') && getSvgContent) {
                const svgContent = await getSvgContent();
                if (svgContent) {
                    if (format === 'svg') exportService.exportAsSvg(svgContent, `${filename}.svg`);
                    else exportService.exportAsPng(svgContent, `${filename}.png`);
                } else {
                    alert('Dışa aktarılacak SVG içeriği bulunamadı.');
                }
            } else if (format === 'html') {
                if (diagramType === 'mermaid') exportService.exportAsHtml(content, filename);
                else if (diagramType === 'bpmn') exportService.exportBpmnAsHtml(content, filename);
            } else if (format === 'bpmn') {
                exportService.exportAsMarkdown(content, `${filename}.bpmn`); // XML'i metin olarak aktar
            } else if (format === 'md' && diagramType === 'mermaid') {
                 exportService.exportAsMarkdown(content, `${filename}.md`); // Mermaid kodunu metin olarak aktar
            }
            return; // Diyagram işlendiyse fonksiyonu bitir
        }

        // Tiptap Dokümanları (MD/DOCX/PDF)
        // 'content' prop'u HTML olduğu için önce Markdown'a dönüştürmeliyiz.
        let markdownContent = '';
        try {
            // !!!!!!!!!!!!!!! ÇÖZÜM - 3 (DIŞA AKTARMA) !!!!!!!!!!!!!!!
            // "Uncaught" hatasının oluşabileceği tek yer burası
            // ve artık bir try-catch bloğu içinde güvende.
            markdownContent = turndownService.turndown(content);
        } catch (e) {
            console.error("Dışa aktarma sırasında dönüştürme hatası:", e);
            alert("Hata: Doküman dışa aktarılamadı. Tablo yapısı çok karmaşık olabilir. Lütfen hücre birleştirmelerini kaldırıp tekrar deneyin.");
            return; // Hata durumunda işlemi durdur
        }

        // Dönüştürme başarılıysa devam et
        if (format === 'md') {
            exportService.exportAsMarkdown(markdownContent, `${filename}.md`);
        } else if (format === 'docx') {
             exportService.exportAsDocx(markdownContent, filename); // exportService Markdown bekler
        } else if (format === 'pdf') {
            exportService.exportAsPdf(markdownContent, filename, !!isTable); // exportService Markdown bekler
        }
    };

    // ... (renderOptions ve return bloğu aynı, değişiklik yok) ...
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
        // Tiptap dokümanları (Analiz, Test, İzlenebilirlik) için
        return (
            <>
                <button onClick={() => handleExport('docx')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                    <span className="font-mono text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded px-1.5 py-0.5 mr-2">.docx</span> Word olarak
                </button>
                <button onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                    <span className="font-mono text-xs bg-slate-200 dark:bg-slate-600 rounded px-1.5 py-0.5 mr-2">.md</span> Markdown olarak
                </button>
                 <button onClick={() => handleExport('pdf')} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                    <span className="font-mono text-xs bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 rounded px-1.5 py-0.5 mr-2">.pdf</span> PDF olarak
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