// components/BacklogGenerationView.tsx
import React, { useState, useCallback } from 'react';
import type { Conversation, BacklogSuggestion, Task } from '../types';
import { supabase } from '../services/supabaseClient';
import { geminiService } from '../services/geminiService';
import { CheckSquare, LoaderCircle, Square, Layers, FileText, Beaker, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface BacklogGenerationViewProps {
    conversation: Conversation;
    onUpdateConversation: (id: string, updates: Partial<Conversation>) => void;
}

const typeInfo = {
    epic: { icon: <Layers className="h-5 w-5 text-purple-500" />, name: 'Epic' },
    story: { icon: <FileText className="h-5 w-5 text-blue-500" />, name: 'Story' },
    test_case: { icon: <Beaker className="h-5 w-5 text-green-500" />, name: 'Test Case' },
};

const priorityStyles: Record<BacklogSuggestion['priority'], string> = {
    low: 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200',
    medium: 'bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100',
    high: 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100',
    critical: 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100',
};

// Recursive component to render each item in the tree
const SuggestionItem: React.FC<{
    suggestion: BacklogSuggestion;
    level: number;
    isSelected: (id: string) => boolean;
    onToggle: (id: string, suggestion: BacklogSuggestion) => void;
}> = ({ suggestion, level, isSelected, onToggle }) => {
    const [isExpanded, setIsExpanded] = useState(level < 2); // Expand epics and stories by default
    const hasChildren = suggestion.children && suggestion.children.length > 0;

    return (
        <div style={{ paddingLeft: `${level * 20}px` }}>
            <div className={`flex items-start gap-3 p-2 rounded-md transition-colors ${isSelected(suggestion.id) ? 'bg-indigo-50 dark:bg-indigo-900/40' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                    {hasChildren ? (
                        <button onClick={() => setIsExpanded(!isExpanded)} className="p-0.5 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-600">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                    ) : (
                        <div className="w-5" /> // Placeholder for alignment
                    )}
                    <button onClick={() => onToggle(suggestion.id, suggestion)}>
                        {isSelected(suggestion.id) ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5 text-slate-400" />}
                    </button>
                    {typeInfo[suggestion.type].icon}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100">{suggestion.title}</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${priorityStyles[suggestion.priority]}`}>
                            {suggestion.priority.charAt(0).toUpperCase() + suggestion.priority.slice(1)}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{suggestion.description}</p>
                </div>
            </div>
            {hasChildren && isExpanded && (
                <div className="mt-1">
                    {suggestion.children.map(child => (
                        <SuggestionItem key={child.id} suggestion={child} level={level + 1} isSelected={isSelected} onToggle={onToggle} />
                    ))}
                </div>
            )}
        </div>
    );
};


export const BacklogGenerationView: React.FC<BacklogGenerationViewProps> = ({ conversation, onUpdateConversation }) => {
    const suggestions = conversation.generatedDocs.backlogSuggestions || [];
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const isReadyForGeneration = 
        !!conversation.generatedDocs.analysisDoc &&
        !!conversation.generatedDocs.testScenarios &&
        !!conversation.generatedDocs.traceabilityMatrix;

    const handleGenerateSuggestions = useCallback(async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const result = await geminiService.generateBacklogSuggestions(
                conversation.generatedDocs.analysisDoc,
                conversation.generatedDocs.testScenarios,
                conversation.generatedDocs.traceabilityMatrix,
                'gemini-2.5-pro' // Use a more powerful model for this complex task
            );
            onUpdateConversation(conversation.id, {
                generatedDocs: {
                    ...conversation.generatedDocs,
                    backlogSuggestions: result,
                }
            });
            // Auto-select all new suggestions
            const allIds = new Set<string>();
            const traverse = (items: BacklogSuggestion[]) => {
                items.forEach(item => {
                    allIds.add(item.id);
                    if (item.children) traverse(item.children);
                });
            };
            traverse(result);
            setSelectedIds(allIds);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Backlog önerileri oluşturulurken bir hata oluştu.');
        } finally {
            setIsGenerating(false);
        }
    }, [conversation, onUpdateConversation]);

    const handleToggleSelection = useCallback((id: string, toggledSuggestion: BacklogSuggestion) => {
        const newSelection = new Set(selectedIds);
        const childIds = new Set<string>();
        const traverse = (items: BacklogSuggestion[]) => {
            items.forEach(item => {
                childIds.add(item.id);
                if (item.children) traverse(item.children);
            });
        };
        traverse(toggledSuggestion.children);

        const isSelected = newSelection.has(id);
        if (isSelected) {
            newSelection.delete(id);
            childIds.forEach(childId => newSelection.delete(childId));
        } else {
            newSelection.add(id);
            childIds.forEach(childId => newSelection.add(childId));
        }
        setSelectedIds(newSelection);
    }, [selectedIds]);
    
    const handleAddToBacklog = async () => {
        setIsSaving(true);
        setError(null);

        const { data: existingTasks, error: fetchError } = await supabase
            .from('tasks')
            .select('task_key')
            .eq('user_id', conversation.user_id);

        if (fetchError) {
            setError(fetchError.message);
            setIsSaving(false);
            return;
        }

        let maxKeyNum = 0;
        if (existingTasks) {
            for (const task of existingTasks) {
                if (task.task_key && typeof task.task_key === 'string' && task.task_key.startsWith('TASK-')) {
                    const numPart = parseInt(task.task_key.split('-')[1], 10);
                    if (!isNaN(numPart) && numPart > maxKeyNum) {
                        maxKeyNum = numPart;
                    }
                }
            }
        }

        const flatSelectedSuggestions: { suggestion: BacklogSuggestion, parentSuggestionId: string | null }[] = [];
        const traverseAndCollect = (items: BacklogSuggestion[], parentId: string | null) => {
            items.forEach(item => {
                if (selectedIds.has(item.id)) {
                    flatSelectedSuggestions.push({ suggestion: item, parentSuggestionId: parentId });
                }
                if (item.children) {
                    traverseAndCollect(item.children, item.id);
                }
            });
        };
        traverseAndCollect(suggestions, null);
        
        if (flatSelectedSuggestions.length === 0) {
            setError("Lütfen panoya eklemek için en az bir görev seçin.");
            setIsSaving(false);
            return;
        }
        
        // Map old suggestion IDs to new database UUIDs to maintain hierarchy
        const suggestionIdToDbId = new Map<string, string>();
        
        const tasksToInsert = flatSelectedSuggestions.map(({ suggestion }, index) => {
            const newDbId = uuidv4();
            suggestionIdToDbId.set(suggestion.id, newDbId);
            const newKeyNum = maxKeyNum + index + 1;
            
            return {
                id: newDbId,
                task_key: `TASK-${newKeyNum}`,
                user_id: conversation.user_id,
                conversation_id: conversation.id,
                parent_id: null, // This will be updated in the next step
                title: suggestion.title,
                description: suggestion.description,
                priority: suggestion.priority,
                status: 'todo' as const,
                type: suggestion.type,
            };
        });
        
        // Now, set the correct parent_id using our map
        // FIX: Destructure `parentSuggestionId` correctly from the `flatSelectedSuggestions` array item.
        // The `suggestion` object itself does not contain `parentSuggestionId`.
        flatSelectedSuggestions.forEach(({ parentSuggestionId }, index) => {
            if (parentSuggestionId && suggestionIdToDbId.has(parentSuggestionId)) {
                tasksToInsert[index].parent_id = suggestionIdToDbId.get(parentSuggestionId)!;
            }
        });

        const { error: insertError } = await supabase.from('tasks').insert(tasksToInsert);

        if (insertError) {
            setError(insertError.message);
        } else {
            // Filter out added suggestions and their children from the UI
            const addedTopLevelIds = new Set(
                suggestions.filter(s => selectedIds.has(s.id)).map(s => s.id)
            );
            const remainingSuggestions = suggestions.filter(s => !addedTopLevelIds.has(s.id));

            onUpdateConversation(conversation.id, {
                generatedDocs: { ...conversation.generatedDocs, backlogSuggestions: remainingSuggestions }
            });
            setSelectedIds(new Set());
            alert(`${tasksToInsert.length} madde başarıyla Backlog panosuna eklendi.`);
        }
        setIsSaving(false);
    };

    if (isGenerating) {
         return (
            <div className="p-6 flex flex-col justify-center items-center text-center h-full">
                <LoaderCircle className="animate-spin h-8 w-8 text-indigo-500" />
                <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Akıllı Backlog Oluşturuluyor...</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Analiz, test ve izlenebilirlik dokümanları inceleniyor. Bu işlem biraz zaman alabilir.</p>
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 h-full flex flex-col justify-center items-center">
                <p className="text-lg font-semibold">Henüz backlog önerisi oluşturulmadı.</p>
                <p className="text-sm mt-1 max-w-md">Mevcut analiz dokümanlarını (analiz, test, izlenebilirlik) kullanarak AI'dan hiyerarşik bir backlog oluşturmasını isteyin.</p>
                 <button 
                    onClick={handleGenerateSuggestions}
                    disabled={!isReadyForGeneration}
                    title={!isReadyForGeneration ? "Önce Analiz, Test Senaryoları ve İzlenebilirlik Matrisi oluşturmalısınız." : ""}
                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    Backlog Önerileri Oluştur
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Onay Bekleyen Backlog Maddeleri</h3>
                 <button 
                    onClick={handleAddToBacklog}
                    disabled={isSaving || selectedIds.size === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition disabled:opacity-50 flex items-center"
                >
                     {isSaving && <LoaderCircle className="animate-spin -ml-1 mr-2 h-4 w-4" />}
                     {isSaving ? 'Ekleniyor...' : `Seçili ${selectedIds.size} Maddeyi Ekle`}
                </button>
            </div>

            {error && <div className="p-3 text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600 flex gap-2"><AlertTriangle className="h-5 w-5"/> {error}</div>}

            <div className="space-y-1">
                {suggestions.map((s) => (
                    <SuggestionItem 
                        key={s.id} 
                        suggestion={s} 
                        level={0} 
                        isSelected={(id) => selectedIds.has(id)}
                        onToggle={handleToggleSelection}
                    />
                ))}
            </div>
        </div>
    );
};
