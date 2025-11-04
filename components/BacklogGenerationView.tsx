// components/BacklogGenerationView.tsx
import React, { useState, useCallback } from 'react';
// FIX: Add GeneratedDocs to the type import to correctly type component props.
import type { Conversation, BacklogSuggestion, Task, GeneratedDocs, SourcedDocument, TaskType } from '../types';
import { supabase } from '../services/supabaseClient';
import { geminiService } from '../services/geminiService';
import { CheckSquare, LoaderCircle, Square, Layers, FileText, Beaker, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface BacklogGenerationViewProps {
    conversation: Conversation;
    onUpdateConversation: (id: string, updates: Partial<Conversation>) => void;
}

const typeInfo: Record<TaskType, { icon: React.ReactElement; name: string }> = {
    epic: { icon: <Layers className="h-5 w-5 text-purple-500" />, name: 'Epic' },
    story: { icon: <FileText className="h-5 w-5 text-blue-500" />, name: 'Story' },
    test_case: { icon: <Beaker className="h-5 w-5 text-green-500" />, name: 'Test Case' },
    task: { icon: <CheckSquare className="h-5 w-5 text-slate-500" />, name: 'Task' },
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
    const info = typeInfo[suggestion.type as TaskType] || typeInfo.task;
    const priority = suggestion.priority || 'medium';

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
                    {info.icon}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100">{suggestion.title}</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${priorityStyles[priority]}`}>
                            {priority.charAt(0).toUpperCase() + priority.slice(1)}
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
    const suggestions = conversation.backlogSuggestions || [];
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // This is now derived from the conversation object which has the generatedDocs property added in the parent
    const generatedDocs = (conversation as any).generatedDocs as GeneratedDocs;

    const isReadyForGeneration = 
        !!generatedDocs.analysisDoc &&
        !!generatedDocs.testScenarios &&
        !!generatedDocs.traceabilityMatrix;

    const handleGenerateSuggestions = useCallback(async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const testScenariosContent = typeof generatedDocs.testScenarios === 'object'
                ? (generatedDocs.testScenarios as SourcedDocument).content
                : generatedDocs.testScenarios;
            const traceabilityMatrixContent = typeof generatedDocs.traceabilityMatrix === 'object'
                ? (generatedDocs.traceabilityMatrix as SourcedDocument).content
                : generatedDocs.traceabilityMatrix;

            // FIX: Correctly call the 'generateBacklogSuggestions' method which now exists on geminiService.
            const { suggestions: result, reasoning, tokens } = await geminiService.generateBacklogSuggestions(
                generatedDocs.requestDoc,
                generatedDocs.analysisDoc,
                testScenariosContent,
                traceabilityMatrixContent,
                'gemini-2.5-pro' // Use a more powerful model for this complex task
            );

            if (!result || result.length === 0) {
                // If the result is empty, use the AI's reasoning as the error message.
                const errorMessage = reasoning || "Yapay zeka, sağlanan dokümanlardan bir backlog oluşturamadı. Lütfen dokümanlarınızın içeriğini kontrol edip tekrar deneyin.";
                throw new Error(errorMessage);
            }

            onUpdateConversation(conversation.id, {
                backlogSuggestions: result,
                total_tokens_used: (conversation.total_tokens_used || 0) + tokens
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
    }, [conversation.id, conversation.total_tokens_used, generatedDocs, onUpdateConversation]);

    const handleToggleSelection = useCallback((id: string, toggledSuggestion: BacklogSuggestion) => {
        const newSelection = new Set(selectedIds);
        const childIds = new Set<string>();
        
        // Recursive function to collect all child IDs
        const traverse = (items: BacklogSuggestion[] | undefined) => {
            // GUARD: Prevent crash if an item has no `children` property.
            if (!items) {
                return;
            }
            items.forEach(item => {
                childIds.add(item.id);
                // Recursively traverse if children exist
                if (item.children) {
                    traverse(item.children);
                }
            });
        };
        
        // Start traversal with the toggled suggestion's children
        traverse(toggledSuggestion.children);
    
        const isSelected = newSelection.has(id);
        if (isSelected) {
            // If it was selected, deselect it and all its children
            newSelection.delete(id);
            childIds.forEach(childId => newSelection.delete(childId));
        } else {
            // If it was not selected, select it and all its children
            newSelection.add(id);
            // BUG FIX: The second argument to `add` should be the `childId`, not the parent `id`.
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
        // FIX: The `parentSuggestionId` is on the `item` object, not inside the `suggestion` object.
        // The previous code `suggestion.parentSuggestionId` was incorrect. This is now corrected to `item.parentSuggestionId`.
        flatSelectedSuggestions.forEach((item, index) => {
            if (item.parentSuggestionId && suggestionIdToDbId.has(item.parentSuggestionId)) {
                tasksToInsert[index].parent_id = suggestionIdToDbId.get(item.parentSuggestionId)!;
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
                backlogSuggestions: remainingSuggestions
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
                {error && (
                    <div className="mb-4 w-full max-w-xl p-3 text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600 flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" /> 
                        <span className="text-left">{error}</span>
                    </div>
                )}
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