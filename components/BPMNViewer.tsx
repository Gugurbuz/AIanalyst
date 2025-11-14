// components/BPMNViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
// DEĞİŞİKLİK: Artık 'window' üzerinden değil, paketten import ediyoruz
import BpmnJS from 'bpmn-js/lib/Modeler'; 

// 'declare global' bloğu SİLİNDİ.

interface BPMNViewerProps {
    xml: string;
    setSvgContentGetter?: (getter: () => Promise<string | null>) => void;
    isPaletteVisible?: boolean;
}

export const BPMNViewer: React.FC<BPMNViewerProps> = ({ xml, setSvgContentGetter, isPaletteVisible = true }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        
        // DEĞİŞİKLİK: BpmnJS'i 'new window.BpmnJS' yerine doğrudan 'new BpmnJS' olarak kullanıyoruz
        const modeler = new BpmnJS({
            container: containerRef.current,
            keyboard: { bindTo: window },
        });
        modelerRef.current = modeler;
        
        if (setSvgContentGetter) {
            setSvgContentGetter(async () => {
                if (!modelerRef.current) return null;
                
                try {
                    const elementRegistry = modelerRef.current.get('elementRegistry');
                    if (!elementRegistry || elementRegistry.getAll().length <= 1) { 
                        console.warn("BPMN export aborted: Diagram is empty or not fully rendered.");
                        return null;
                    }
                } catch (e) {
                    console.error("Could not get BPMN element registry:", e);
                    return null;
                }

                try {
                    const { svg } = await modelerRef.current.saveSVG();
                    return svg;
                } catch (err) {
                    console.error("BPMN SVG export error:", err);
                    return null;
                }
            });
        }
        
        return () => {
            modeler.destroy();
        };
    }, [setSvgContentGetter]);

    // ... (dosyanın geri kalanı aynı) ...
    useEffect(() => {
        if (modelerRef.current) {
            const palette = modelerRef.current.get('palette');
            if (palette && palette._container) {
                palette._container.style.display = isPaletteVisible ? 'block' : 'none';
            }
        }
    }, [isPaletteVisible]);

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
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">BPMN diyagramı yükleniyor...</p>
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