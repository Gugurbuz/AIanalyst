
import React from 'react';
import { Template, DocumentVersion } from '../../types';
import { History, Sparkles, Eye, Edit, LoaderCircle, Check } from 'lucide-react';
import { TokenCostIndicator } from '../TokenCostIndicator';
import { TemplateSelector } from '../TemplateSelector';
import { ExportDropdown } from '../ExportDropdown';

interface DocumentToolbarProps {
    latestVersion: DocumentVersion | null;
    filteredHistory: DocumentVersion[];
    onHistoryClick: () => void;
    templates?: Template[];
    selectedTemplate?: string;
    onTemplateChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    isGenerating: boolean;
    isStreaming: boolean;
    saveState: 'idle' | 'saving' | 'saved';
    isEditing: boolean;
    onToggleEditing: () => void;
    onAiEditClick: () => void;
    hasSelection: boolean;
    showAiButton: boolean;
    content: string;
    filename: string;
    isTable?: boolean;
}

export const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
    latestVersion,
    filteredHistory,
    onHistoryClick,
    templates,
    selectedTemplate,
    onTemplateChange,
    isGenerating,
    isStreaming,
    saveState,
    isEditing,
    onToggleEditing,
    onAiEditClick,
    hasSelection,
    showAiButton,
    content,
    filename,
    isTable
}) => {
    const renderSaveButtonContent = () => {
        if (saveState === 'saving') {
            return <><LoaderCircle className="h-4 w-4 animate-spin" /> Kaydediliyor...</>;
        }
        if (saveState === 'saved') {
            return <><Check className="h-4 w-4" /> Kaydedildi</>;
        }
        return isEditing 
            ? <><Eye className="h-4 w-4" /> Görünüm</> 
            : <><Edit className="h-4 w-4" /> Düzenle</>;
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-2 md:p-4 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 flex-wrap">
                 {showAiButton && isEditing && (
                    <button onClick={onAiEditClick} disabled={!hasSelection} title="AI ile düzenle" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed">
                        <Sparkles className="h-4 w-4" /> <span className="text-sm font-semibold">Seçimi Düzenle</span>
                    </button>
                 )}
            </div>
            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md">v{latestVersion?.version_number || 0}</span>
                    {latestVersion?.tokens_used && latestVersion.tokens_used > 0 && (
                        <TokenCostIndicator tokens={latestVersion.tokens_used} />
                    )}
                    <button onClick={onHistoryClick} title="Versiyon Geçmişi" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" disabled={filteredHistory.length === 0}><History className="h-4 w-4"/></button>
                 </div>
                {templates && selectedTemplate && onTemplateChange && <TemplateSelector label="Şablon" templates={templates} selectedValue={selectedTemplate} onChange={onTemplateChange} disabled={isGenerating} />}
                 {isStreaming && <div className="flex items-center gap-2"><LoaderCircle className="animate-spin h-5 w-5 text-indigo-500" /><span className="text-sm font-medium text-slate-600 dark:text-slate-400">Oluşturuluyor</span></div>}
                 <button 
                    onClick={onToggleEditing} 
                    disabled={saveState === 'saving' || isStreaming} 
                    className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 disabled:opacity-50 transition-colors
                        ${saveState === 'saved' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' 
                            : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                >
                    {renderSaveButtonContent()}
                </button>
                <ExportDropdown content={content} filename={filename} isTable={isTable} />
            </div>
        </div>
    );
};
