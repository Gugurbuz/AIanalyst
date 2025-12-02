// components/BPMNViewer.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';

declare global {
    interface Window {
        BpmnJS: any;
    }
}

interface BPMNViewerProps {
    xml: string;
    setSvgContentGetter: (getter: () => Promise<string | null>) => void;
    isPaletteVisible: boolean;
}

const BPMNViewerComponent: React.FC<BPMNViewerProps> = ({ xml, setSvgContentGetter, isPaletteVisible }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getSvg = useCallback(async (): Promise<string | null> => {
        if (!modelerRef.current) {
            console.error("BPMN Viewer not initialized");
            return null;
        }
        try {
            const { svg } = await modelerRef.current.saveSVG();
            return svg;
        } catch (e) {
            console.error("Could not save BPMN SVG", e);
            return null;
        }
    }, []);

    useEffect(() => {
        setSvgContentGetter(getSvg);
    }, [getSvg, setSvgContentGetter]);

    useEffect(() => {
        if (!containerRef.current) return;
        
        if (!window.BpmnJS) {
            setError("BPMN Modeler library could not be loaded.");
            setIsLoading(false);
            return;
        }

        const modeler = new window.BpmnJS({
            container: containerRef.current,
            keyboard: { bindTo: window },
        });
        modelerRef.current = modeler;
        
        return () => {
            if (modelerRef.current) {
                modelerRef.current.destroy();
                modelerRef.current = null;
            }
        };
    }, []); // Only runs once on mount
    
    useEffect(() => {
        const importXml = async () => {
            if (!xml || !modelerRef.current) {
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);
            setError(null);
            
            try {
                await modelerRef.current.importXML(xml);
                const canvas = modelerRef.current.get('canvas');
                canvas.zoom('fit-viewport', 'auto');
            } catch (err: any) {
                console.error("BPMN import error:", err);
                setError(err.message || "An error occurred while parsing the BPMN XML.");
            } finally {
                setIsLoading(false);
            }
        };

        importXml();
    }, [xml]);

    useEffect(() => {
        if (containerRef.current) {
            const palette = containerRef.current.querySelector('.djs-palette');
            if (palette) {
                (palette as HTMLElement).style.display = isPaletteVisible ? 'block' : 'none';
            }
        }
    }, [isPaletteVisible]);

    return (
        <div className="w-full h-full relative">
            <div className="w-full h-full" ref={containerRef}></div>
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10">
                    <LoaderCircle className="animate-spin h-8 w-8 text-indigo-500" />
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Loading BPMN diagram...</p>
                </div>
            )}
            {error && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/50 z-10 p-4">
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                    <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-200">Diagram Could Not Be Loaded</p>
                    <p className="mt-1 text-xs text-red-600 dark:text-red-300 text-center">{error}</p>
                </div>
            )}
        </div>
    );
};

export const BPMNViewer = BPMNViewerComponent;
