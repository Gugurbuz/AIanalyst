// components/Visualizations.tsx
import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw, AlertTriangle, LoaderCircle, Sparkles, GanttChartSquare, Maximize, Minimize, PanelRight, X } from 'lucide-react';
import { BPMNViewer } from './BPMNViewer';
import { ExportDropdown } from './ExportDropdown';

interface VisualizationsProps {
    content: string;
    onModifyDiagram: (prompt: string) => Promise<void>;
    onGenerateDiagram: () => void;
    isLoading: boolean;
    error: string | null;
    diagramType: 'bpmn';
    isAnalysisDocReady: boolean;
}

const VizSpinner: React.FC<{text?: string}> = ({text}) => (
     <div className="p-6 flex flex-col justify-center items-center text-center h-full">
        <LoaderCircle className="animate-spin h-8 w-8 text-indigo-500" />
        <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{text || 'Diyagram oluşturuluyor...'}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Bu işlem birkaç saniye sürebilir.</p>
    </div>
);

const VizError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
    <div className="p-6 flex flex-col justify-center items-center text-center h-full bg-red-50 dark:bg-red-900/50 rounded-lg">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h3 className="mt-2 text-md font-bold text-red-800 dark:text-red-200">Diyagram Hatası</h3>
        <p className="mt-1 text-sm text-red-700 dark:text-red-300 max-w-md">{message || "Beklenmedik bir hata oluştu."}</p>
        <button onClick={onRetry} className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition">
            Tekrar Dene
        </button>
    </div>
);

const EmptyState: React.FC<{ onGenerate: () => void; disabled: boolean }> = ({ onGenerate, disabled }) => (
    <div className="text-center text-slate-500 dark:text-slate-400 p-6 flex flex-col items-center justify-center h-full">
        <GanttChartSquare className="h-12 w-12 text-slate-400 mb-2" strokeWidth={1} />
        <h3 className="text-md font-semibold text-slate-700 dark:text-slate-300">Henüz Bir Diyagram Oluşturulmadı</h3>
        <p className="text-xs mt-1 max-w-xs">İş analizi dokümanınızdaki süreçleri görselleştirmek için aşağıdaki butonu kullanın.</p>
        <button
            onClick={onGenerate}
            disabled={disabled}
            title={disabled ? "Diyagram oluşturmak için önce geçerli bir analiz dokümanı gereklidir." : "AI ile diyagram oluştur"}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            Diyagram Oluştur
        </button>
    </div>
);


export const Visualizations: React.FC<VisualizationsProps> = ({ 
    content, 
    onModifyDiagram, 
    onGenerateDiagram,
    isLoading,
    error,
    diagramType,
    isAnalysisDocReady,
}) => {
    const [modificationPrompt, setModificationPrompt] = useState('');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isPaletteVisible, setIsPaletteVisible] = useState(true);
    const svgGetterRef = useRef<(() => Promise<string | null>) | null>(null);

    const setSvgContentGetterCallback = useCallback((getter: () => Promise<string | null>) => {
        svgGetterRef.current = getter;
    }, []);

    const getSvgContentForExport = useCallback(async () => {
        if (svgGetterRef.current) {
            return await svgGetterRef.current();
        }
        return null;
    }, []);

    const handleModificationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modificationPrompt.trim() || isLoading) return;
        
        await onModifyDiagram(modificationPrompt);
        setModificationPrompt('');
    };
    
    const renderDiagram = (isPaletteVisibleOverride?: boolean) => {
        if (isLoading) return <VizSpinner />;
        if (error) return <VizError message={error} onRetry={onGenerateDiagram} />;
        if (!content) return <EmptyState onGenerate={onGenerateDiagram} disabled={!isAnalysisDocReady} />;

        return (
            <BPMNViewer 
                xml={content} 
                setSvgContentGetter={setSvgContentGetterCallback}
                isPaletteVisible={isPaletteVisibleOverride ?? isPaletteVisible}
            />
        );
    }
    
    const DiagramControls = () => (
        <div className="absolute top-4 right-4 z-10 flex gap-2">
            {diagramType === 'bpmn' && (
                <button onClick={() => setIsPaletteVisible(!isPaletteVisible)} title="Araç Kutusunu Gizle/Göster" className="p-2 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                    <PanelRight className="h-5 w-5" />
                </button>
            )}
             <ExportDropdown 
                content={content} 
                filename={`diagram-${diagramType}`} 
                diagramType={diagramType}
                getSvgContent={getSvgContentForExport}
            />
             <button onClick={() => setIsFullScreen(true)} title="Tam Ekran" className="p-2 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                <Maximize className="h-5 w-5" />
            </button>
        </div>
    );

    const FullScreenModal = () => (
        <div className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-50 flex flex-col">
            <header className="flex-shrink-0 p-2 border-b border-slate-200 dark:border-slate-700 flex justify-end">
                 <button onClick={() => setIsFullScreen(false)} title="Tam Ekrandan Çık" className="p-2 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                    <Minimize className="h-5 w-5" />
                </button>
            </header>
            <main className="flex-1 overflow-hidden p-4 grid grid-cols-3 gap-4">
                <div className="col-span-2 relative h-full">
                     <div className="relative w-full h-full flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-md bg-dots-pattern">
                        {renderDiagram(true)}
                    </div>
                </div>
                <div className="col-span-1 flex flex-col bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                     <h3 className="text-lg font-bold mb-4">Diyagramı Düzenle</h3>
                     <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Diyagramı doğal dilde komutlar vererek değiştirebilirsiniz.</p>
                     <form onSubmit={handleModificationSubmit} className="flex-1 flex flex-col">
                         <textarea
                            value={modificationPrompt}
                            onChange={(e) => setModificationPrompt(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="Örn: 'Onay adımından sonra bir e-posta gönderimi ekle'"
                            disabled={isLoading}
                            className="w-full flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-700 disabled:opacity-50 resize-none"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !modificationPrompt.trim()}
                            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center"
                        >
                            {isLoading ? <LoaderCircle className="animate-spin h-5 w-5" /> : <><Sparkles className="h-4 w-4 mr-2" /> Uygula</>}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );

    return (
        <div className="relative p-2 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg h-full flex flex-col">
             <div className="relative flex-1 w-full h-full flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-md bg-dots-pattern">
                {renderDiagram()}
                {!isLoading && !error && content && <DiagramControls />}
            </div>
            {isFullScreen && <FullScreenModal />}
        </div>
    );
};