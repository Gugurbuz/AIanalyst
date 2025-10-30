import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';

interface VisualizationsProps {
    content: string;
    onContentChange: (newContent: string) => void;
}

const generateId = () => `mermaid-graph-${Math.random().toString(36).substring(2, 9)}`;

const Controls = () => {
    const { zoomIn, zoomOut, resetTransform } = useControls();
    return (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-md z-10">
            <button onClick={() => zoomIn()} title="Yakınlaştır" className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            </button>
            <button onClick={() => zoomOut()} title="Uzaklaştır" className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            </button>
            <button onClick={() => resetTransform()} title="Sıfırla" className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1.158A8.002 8.002 0 0116.32 7.754a1 1 0 11-1.642.926A6.002 6.002 0 006 8.083V10a1 1 0 11-2 0V3a1 1 0 011-1zm10 4a1 1 0 01-1-1V3.842a8.002 8.002 0 01-10.32 6.404a1 1 0 111.642-.926A6.002 6.002 0 0014 11.917V10a1 1 0 112 0V7a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            </button>
        </div>
    );
};

const renderMermaid = async (id: string, code: string): Promise<{ svg: string; error?: undefined } | { svg: string; error: any }> => {
    try {
        const validDiagramTypes = ['graph', 'sequenceDiagram', 'mindmap'];
        const isContentValid = validDiagramTypes.some(type => code.trim().startsWith(type));
        if (!isContentValid) {
            throw new Error("Oluşturulan metin geçerli bir Mermaid diyagramı değil.");
        }
        const { svg } = await mermaid.render(id, code.trim());
        return { svg };
    } catch (e) {
        return { svg: '', error: e };
    }
};

// FIX: Correctly define the generic type parameter 'T' for the useDebounce hook.
// In a .tsx file, <T> can be ambiguous with JSX syntax. Using <T,> clarifies that it's a generic type parameter, which resolves a cascade of parsing errors.
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
    const [svgContent, setSvgContent] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);
    const [localContent, setLocalContent] = useState(content);
    const [previewSvg, setPreviewSvg] = useState<string>('');
    const [previewError, setPreviewError] = useState<string>('');
    
    const debouncedLocalContent = useDebounce(localContent, 300);

    const mainComponentId = useRef<string>(generateId());
    const previewComponentId = useRef<string>(generateId());

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: document.body.classList.contains('dark') ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: 'Inter, sans-serif'
        });
    }, []);
    
    // Update local state and exit edit mode when parent content changes
    useEffect(() => {
        setLocalContent(content);
        if (isEditing) {
            setIsEditing(false);
        }
    }, [content]);

    // Render the main diagram when not in edit mode
    useEffect(() => {
        if (!isEditing && content) {
            const render = async () => {
                const result = await renderMermaid(mainComponentId.current, content);
                if (result.error) {
                    console.error("Mermaid rendering failed:", result.error);
                    setError(result.error instanceof Error ? result.error.message : 'Diyagram oluşturulurken bir hata oluştu.');
                    setSvgContent('');
                } else {
                    setSvgContent(result.svg);
                    setError('');
                }
            };
            render();
        }
    }, [content, isEditing]);
    
    // Render the preview diagram when editing
    useEffect(() => {
        if (isEditing && debouncedLocalContent) {
            const renderPreview = async () => {
                const result = await renderMermaid(previewComponentId.current, debouncedLocalContent);
                if (result.error) {
                    setPreviewError(result.error instanceof Error ? result.error.message : 'Geçersiz sözdizimi.');
                    setPreviewSvg('');
                } else {
                    setPreviewSvg(result.svg);
                    setPreviewError('');
                }
            };
            renderPreview();
        }
    }, [debouncedLocalContent, isEditing]);


    const handleSave = () => {
        onContentChange(localContent);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setLocalContent(content);
        setIsEditing(false);
    };
    
    if (!content) return null;
    
    if (isEditing) {
        return (
             <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                         <label htmlFor="mermaid-editor" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mermaid Kodu</label>
                         <textarea
                            id="mermaid-editor"
                            value={localContent}
                            onChange={(e) => setLocalContent(e.target.value)}
                            className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md font-mono text-xs leading-relaxed focus:ring-2 focus:ring-sky-500 focus:outline-none resize-y min-h-[300px] h-full"
                        />
                    </div>
                    <div className="relative min-h-[300px] bg-white dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-600 flex items-center justify-center p-2">
                        {previewError ? (
                            <div className="text-red-500 text-sm p-4">{previewError}</div>
                        ) : previewSvg ? (
                             <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: previewSvg }} />
                        ) : (
                            <div className="text-slate-400">Önizleme yükleniyor...</div>
                        )}
                    </div>
                 </div>
                <div className="mt-4 flex items-center justify-end gap-3">
                     <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition">İptal</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition">Değişiklikleri Kaydet</button>
                </div>
            </div>
        )
    }

    return (
        <div className="relative group p-4 md:p-6 overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-b-lg min-h-[300px] w-full">
            {error ? (
                <div className="p-4 text-red-500"><strong>Görselleştirme Hatası:</strong> {error}</div>
            ) : !svgContent ? (
                <div className="p-6 flex justify-center items-center min-h-[200px]">
                    <div className="text-slate-500 dark:text-slate-400">Diyagram yükleniyor...</div>
                </div>
            ) : (
                <TransformWrapper key={content} minScale={0.2} maxScale={8} initialScale={1} panning={{ disabled: false, velocityDisabled: false }} wheel={{ step: 0.2 }}>
                    <Controls />
                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svgContent }} />
                    </TransformComponent>
                </TransformWrapper>
            )}
             <button 
                onClick={() => setIsEditing(true)}
                className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                Düzenle
            </button>
        </div>
    );
};
