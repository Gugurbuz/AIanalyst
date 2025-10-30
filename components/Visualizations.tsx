import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';

interface VisualizationsProps {
    content: string;
    onContentChange: (newContent: string) => void;
}

const MermaidSpinner: React.FC = () => (
     <div className="p-6 flex flex-col justify-center items-center text-center h-full">
        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Diyagram oluşturuluyor...</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Bu işlem birkaç saniye sürebilir.</p>
    </div>
);

const MermaidError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
    <div className="p-6 flex flex-col justify-center items-center text-center h-full bg-red-50 dark:bg-red-900/50 rounded-b-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <h3 className="mt-2 text-md font-bold text-red-800 dark:text-red-200">Diyagram Hatası</h3>
        <p className="mt-1 text-sm text-red-700 dark:text-red-300 max-w-md">{message}</p>
        <button onClick={onRetry} className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition">
            Tekrar Dene
        </button>
    </div>
);

const Controls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-2 left-2 z-10 flex gap-1 p-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg shadow-md">
      <button onClick={() => zoomIn()} title="Yakınlaş" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg></button>
      <button onClick={() => zoomOut()} title="Uzaklaş" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
      {/* FIX: The SVG path element had duplicate `d` attributes and invalid syntax. Replaced with a valid "X" icon path suitable for a reset button. */}
      <button onClick={() => resetTransform()} title="Sıfırla" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
    </div>
  );
};


const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};


export const Visualizations: React.FC<VisualizationsProps> = ({ content, onContentChange }) => {
    const [diagramSvg, setDiagramSvg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [localContent, setLocalContent] = useState(content);
    const debouncedLocalContent = useDebounce(localContent, 500);

    const diagramId = `mermaid-diagram-${useId()}`;
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isReadOnly = onContentChange === null || (onContentChange as Function).toString() === '() => {}';
    
    const renderDiagram = useCallback(async (code: string, isPreview = false) => {
        if (!code.trim()) {
            setDiagramSvg('');
            setError(null);
            return;
        }
        
        if (!isPreview) setIsLoading(true);
        setError(null);

        try {
            // Basic validation before attempting to render
            await mermaid.parse(code);
            const { svg } = await mermaid.render(diagramId, code);
            setDiagramSvg(svg);
        } catch (e: any) {
            console.error("Mermaid.js hatası:", e);
            const errorMessage = e.message || "Geçersiz diyagram sözdizimi. Lütfen kodu kontrol edin.";
            setError(errorMessage);
            setDiagramSvg(''); // Clear previous diagram on error
        } finally {
             if (!isPreview) setIsLoading(false);
        }
    }, [diagramId]);


    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral',
            securityLevel: 'loose',
        });
    }, []);

    useEffect(() => {
        setLocalContent(content);
        if (!isEditing) {
            renderDiagram(content);
        }
    }, [content, isEditing, renderDiagram]);

    useEffect(() => {
        if (isEditing) {
            renderDiagram(debouncedLocalContent, true);
        }
    }, [debouncedLocalContent, isEditing, renderDiagram]);


    const resizeTextarea = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, []);

    useEffect(() => {
        if (isEditing) {
            resizeTextarea();
        }
    }, [isEditing, localContent, resizeTextarea]);

    const handleSave = () => {
        onContentChange(localContent);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setLocalContent(content);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
             <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg h-full flex flex-col">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                    <div className="flex flex-col">
                         <label htmlFor="visualization-editor" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mermaid Kodu</label>
                         <textarea
                            id="visualization-editor"
                            ref={textareaRef}
                            value={localContent}
                            onChange={(e) => setLocalContent(e.target.value)}
                            className="w-full h-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md font-mono text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                        />
                    </div>
                    <div className="relative min-h-[300px] bg-white dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-600 flex items-center justify-center p-2 overflow-hidden">
                        <h4 className="absolute top-2 left-2 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Önizleme</h4>
                        {error ? (
                             <div className="text-center p-4">
                                <p className="text-sm font-semibold text-red-600">Önizleme Hatası</p>
                                <p className="text-xs text-slate-500 mt-1">{error}</p>
                            </div>
                        ) : diagramSvg ? (
                             <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: diagramSvg }} />
                        ) : (
                            <p className="text-slate-400">Diyagram önizlemesi burada görünecek.</p>
                        )}
                    </div>
                 </div>
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-end gap-3 flex-shrink-0">
                     <button onClick={handleCancel} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition">İptal</button>
                    <button onClick={handleSave} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition">Değişiklikleri Kaydet</button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative group p-4 md:p-6 overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-b-lg min-h-[300px] w-full h-full flex items-center justify-center">
             {isLoading ? <MermaidSpinner /> : 
              error ? <MermaidError message={error} onRetry={() => renderDiagram(content)} /> :
              diagramSvg ? (
                    <TransformWrapper>
                        <Controls />
                        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                            <div id="mermaid-diagram-container" className="w-full h-full" dangerouslySetInnerHTML={{ __html: diagramSvg }} />
                        </TransformComponent>
                    </TransformWrapper>
              ) : (
                <div className="text-center text-slate-500 dark:text-slate-400">
                    <p>Görselleştirilecek bir diyagram bulunmuyor.</p>
                    <p className="text-xs mt-1">AI'dan bir görselleştirme oluşturmasını isteyin.</p>
                </div>
              )}
             {!isReadOnly && content && (
                <button 
                    onClick={() => setIsEditing(true)}
                    className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                    Düzenle
                </button>
             )}
        </div>
    );
};