import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';

interface VisualizationsProps {
    content: string;
}

const generateId = () => `mermaid-graph-${Math.random().toString(36).substring(2, 9)}`;

const Controls = () => {
    const { zoomIn, zoomOut, resetTransform } = useControls();
    return (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-md">
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


export const Visualizations: React.FC<VisualizationsProps> = ({ content }) => {
    const [svgContent, setSvgContent] = useState<string>('');
    const [error, setError] = useState<string>('');
    const componentId = useRef<string>(generateId());
    
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: document.body.classList.contains('dark') ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: 'Inter, sans-serif'
        });

        if (content) {
            const renderDiagram = async () => {
                try {
                    // Check for common diagram types to ensure valid code
                    const validDiagramTypes = ['graph', 'sequenceDiagram', 'mindmap'];
                    const isContentValid = validDiagramTypes.some(type => content.trim().startsWith(type));

                    if (!isContentValid) {
                        throw new Error("Oluşturulan metin geçerli bir Mermaid diyagramı değil.");
                    }

                    const { svg } = await mermaid.render(componentId.current, content.trim());
                    setSvgContent(svg);
                    setError('');
                } catch (e) {
                    console.error("Mermaid rendering failed:", e);
                    const errorMessage = e instanceof Error ? e.message : 'Diyagram oluşturulurken bir hata oluştu.';
                    setError(errorMessage);
                    setSvgContent('');
                }
            };
            renderDiagram();
        } else {
            setSvgContent('');
            setError('');
        }

    }, [content]);

    if (error) {
        return <div className="p-4 text-red-500"><strong>Görselleştirme Hatası:</strong> {error}</div>;
    }

    if (!content) {
        return null; // Don't render anything if there's no content
    }
    
    if (!svgContent) {
         return (
            <div className="p-6 flex justify-center items-center min-h-[200px]">
                <div className="text-slate-500 dark:text-slate-400">Diyagram yükleniyor...</div>
            </div>
        );
    }
    
    return (
        <div className="relative p-4 md:p-6 overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-b-lg min-h-[300px] w-full">
            <TransformWrapper
                key={content} // Reset state when content changes
                minScale={0.2}
                maxScale={8}
                initialScale={1}
                panning={{ disabled: false, velocityDisabled: false }}
                wheel={{ step: 0.2 }}
            >
                <Controls />
                <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%'}}
                    contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <div
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{ __html: svgContent }} 
                    />
                </TransformComponent>
            </TransformWrapper>
        </div>
    );
};