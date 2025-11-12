// components/ProjectMapView.tsx
import React from 'react';
import type { GeneratedDocs, SourcedDocument } from '../types';
import { FileInput, FileText, GanttChartSquare, Beaker, GitBranch, ArrowDown, RefreshCw } from 'lucide-react';

type DocTabId = 'request' | 'analysis' | 'viz' | 'test' | 'traceability' | 'backlog-generation' | 'maturity' | 'overview';

interface ProjectMapViewProps {
    docs: GeneratedDocs;
    onNodeClick: (tabId: DocTabId) => void;
}

const nodeConfig = {
    request: { icon: FileInput, title: 'Talep Dokümanı', tabId: 'request' as DocTabId },
    analysis: { icon: FileText, title: 'İş Analizi', tabId: 'analysis' as DocTabId },
    viz: { icon: GanttChartSquare, title: 'Görselleştirme', tabId: 'viz' as DocTabId },
    test: { icon: Beaker, title: 'Test Senaryoları', tabId: 'test' as DocTabId },
    traceability: { icon: GitBranch, title: 'İzlenebilirlik', tabId: 'traceability' as DocTabId },
};

type NodeKey = keyof typeof nodeConfig;

const MapNode: React.FC<{
    nodeKey: NodeKey;
    status: 'complete' | 'pending' | 'stale';
    onNodeClick: (tabId: DocTabId) => void;
}> = ({ nodeKey, status, onNodeClick }) => {
    const config = nodeConfig[nodeKey];
    const Icon = config.icon;

    const statusClasses = {
        pending: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 opacity-60',
        complete: 'bg-white dark:bg-slate-800 border-emerald-500 text-slate-800 dark:text-slate-200',
        stale: 'bg-amber-50 dark:bg-amber-900/50 border-amber-500 text-amber-800 dark:text-amber-200',
    };

    return (
        <button
            onClick={() => onNodeClick(config.tabId)}
            disabled={status === 'pending'}
            className={`w-full max-w-xs p-4 rounded-lg border-2 shadow-md flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${statusClasses[status]}`}
        >
            <Icon className="h-8 w-8 flex-shrink-0" />
            <div className="text-left">
                <h3 className="font-bold">{config.title}</h3>
                {status === 'stale' && <p className="text-xs font-semibold flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Güncel Değil</p>}
            </div>
        </button>
    );
};

const Connector: React.FC = () => (
    <div className="h-12 w-full flex justify-center items-center">
        <ArrowDown className="h-6 w-6 text-slate-400 dark:text-slate-500" />
    </div>
);

export const ProjectMapView: React.FC<ProjectMapViewProps> = ({ docs, onNodeClick }) => {
    const has = {
        request: !!docs.requestDoc,
        analysis: !!docs.analysisDoc && !docs.analysisDoc.includes("Bu bölüme projenin temel hedefini"),
        viz: !!docs.bpmnViz?.code,
        test: typeof docs.testScenarios === 'object' ? !!(docs.testScenarios as SourcedDocument).content : !!docs.testScenarios,
        traceability: typeof docs.traceabilityMatrix === 'object' ? !!(docs.traceabilityMatrix as SourcedDocument).content : !!docs.traceabilityMatrix,
    };

    const status: Record<NodeKey, 'complete' | 'pending' | 'stale'> = {
        request: has.request ? 'complete' : 'pending',
        analysis: has.analysis ? 'complete' : 'pending',
        viz: has.viz ? (docs.isVizStale ? 'stale' : 'complete') : 'pending',
        test: has.test ? (docs.isTestStale ? 'stale' : 'complete') : 'pending',
        traceability: has.traceability ? (docs.isTraceabilityStale ? 'stale' : 'complete') : 'pending',
    };

    return (
        <div className="h-full w-full overflow-y-auto p-8 flex flex-col items-center bg-dots-pattern">
            <div className="text-center mb-12">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">Proje Haritası</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">Projenizin tüm adımlarını bir bakışta görün.</p>
            </div>
            
            <MapNode nodeKey="request" status={status.request} onNodeClick={onNodeClick} />
            
            {has.request && <Connector />}
            
            {has.request && <MapNode nodeKey="analysis" status={status.analysis} onNodeClick={onNodeClick} />}

            {has.analysis && <Connector />}

            {has.analysis && (
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <MapNode nodeKey="viz" status={status.viz} onNodeClick={onNodeClick} />
                    <MapNode nodeKey="test" status={status.test} onNodeClick={onNodeClick} />
                </div>
            )}
            
            {(has.viz || has.test) && <Connector />}

            {(has.viz || has.test) && <MapNode nodeKey="traceability" status={status.traceability} onNodeClick={onNodeClick} />}
        </div>
    );
};
