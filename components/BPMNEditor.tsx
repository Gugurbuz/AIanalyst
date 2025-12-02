// components/BPMNEditor.tsx
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';

declare global {
    interface Window {
        BpmnJS: any;
    }
}

interface BPMNEditorProps {
    xml: string;
    onChange: (newXml: string) => void;
}

const BPMNEditorComponent: React.ForwardRefRenderFunction<{ saveSVG: () => Promise<string>, saveXML: () => Promise<string> }, BPMNEditorProps> = ({ xml, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        saveSVG: async (): Promise<string> => {
            if (!modelerRef.current) throw new Error("Editor not initialized");
            const { svg } = await modelerRef.current.saveSVG();
            return svg;
        },
        saveXML: async (): Promise<string> => {
            if (!modelerRef.current) throw new Error("Editor not initialized");
            const { xml } = await modelerRef.current.saveXML({ format: true });
            return xml;
        }
    }));

    useEffect(() => {
        if (!containerRef.current) return;
        
        if (!window.BpmnJS) {
            setError("BPMN Modeler kütüphanesi yüklenemedi.");
            setIsLoading(false);
            return;
        }

        const modeler = new window.BpmnJS({
            container: containerRef.current,
            keyboard: { bindTo: window },
        });
        modelerRef.current = modeler;

        const handleModelChange = async () => {
            try {
                if (modelerRef.current) {
                    const { xml } = await modelerRef.current.saveXML({ format: true });
                    onChange(xml);
                }
            } catch (err) {
                console.error('Could not save BPMN XML', err);
            }
        };

        const debouncedHandleModelChange = setTimeout.bind(window, handleModelChange, 500);
        modeler.on('commandStack.changed', debouncedHandleModelChange);
        
        return () => {
            modeler.off('commandStack.changed', debouncedHandleModelChange);
            modeler.destroy();
        };
    }, [onChange]);
    
    useEffect(() => {
        const importXml = async () => {
            if (!xml || !modelerRef.current) {
                setIsLoading(false);
                return;
            }
            
            // Prevent re-importing if content is identical
            if (modelerRef.current.get('canvas').getGraphics(modelerRef.current.get('elementRegistry').get('Process_1'))) {
                try {
                    const currentXmlData = await modelerRef.current.saveXML({ format: false });
                    if(currentXmlData.xml === xml) {
                        return;
                    }
                } catch(e) {
                     // ignore if save fails
                }
            }
            
            setIsLoading(true);
            setError(null);
            
            try {
                await modelerRef.current.importXML(xml);
                const canvas = modelerRef.current.get('canvas');
                canvas.zoom('fit-viewport', 'auto');
            } catch (err: any) {
                console.error("BPMN import error:", err);
                setError(err.message || "BPMN XML ayrıştırılırken bir hata oluştu.");
            } finally {
                setIsLoading(false);
            }
        };

        importXml();
    }, [xml]);

    return (
        <div className="w-full h-full relative" ref={containerRef}>
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10">
                    <LoaderCircle className="animate-spin h-8 w-8 text-indigo-500" />
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">BPMN editörü yükleniyor...</p>
                </div>
            )}
            {error && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/50 z-10 p-4">
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                    <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-200">Diyagram Yüklenemedi</p>
                    <p className="mt-1 text-xs text-red-600 dark:text-red-300 text-center">{error}</p>
                </div>
            )}
        </div>
    );
};

export const BPMNEditor = forwardRef(BPMNEditorComponent);