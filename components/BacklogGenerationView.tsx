// components/BacklogGenerationView.tsx
import React, { useState, useCallback } from 'react';
import type { Conversation, BacklogSuggestion, Task, GeneratedDocs, TaskType } from '../types';
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

    const requestContent = generatedDocs.requestDoc?.content || '';
    const analysisContent = generatedDocs.analysisDoc?.content || '';
    const testContent = generatedDocs.testScenarios?.content || '';
    const traceContent = generatedDocs.traceabilityMatrix?.content || '';

    const isReadyForGeneration = 
        !!analysisContent &&
        !!testContent &&
        !!traceContent;

    const handleGenerateSuggestions = useCallback(async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const { suggestions: result, reasoning, tokens } = await geminiService.generateBacklogSuggestions(
                requestContent,
                analysisContent,
                testContent,
                traceContent,
                'gemini-2.5-pro' // Use a more powerful model for this complex task
            );

            if (!result || result.length === 0) {
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
    }, [conversation.id, conversation.total_tokens_used, requestContent, analysisContent, testContent, traceContent, onUpdateConversation]);
    
    const handleToggleSelection = useCallback((id: string, toggledSuggestion: BacklogSuggestion) => {
        const newSelection = new Set(selectedIds);
        const childIds = new Set<string>();
        
        const traverse = (items: BacklogSuggestion[] | undefined) => {
            if (!items) return;
            items.forEach(item => {
                childIds.add(item.id);
                if (item.children) traverse(item.children);
            });
        };
        
        traverse(toggledSuggestion.children);
    
        const isCurrentlySelected = newSelection.has(id);
        if (isCurrentlySelected) {
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

        try {
            const { data: existingTasks, error: fetchError } = await supabase
                .from('tasks')
                .select('task_key')
                .eq('user_id', conversation.user_id);

            if (fetchError) throw fetchError;

            let maxKeyNum = 0;
            if (existingTasks) {
                for (const task of existingTasks) {
                    if (task.task_key?.startsWith('TASK-')) {
                        const numPart = parseInt(task.task_key.split('-')[1], 10);
                        if (!isNaN(numPart) && numPart > maxKeyNum) maxKeyNum = numPart;
                    }
                }
            }
            
            const insertTasksRecursively = async (suggestionsToProcess: BacklogSuggestion[], parentDbId: string | null): Promise<void> => {
                 for (const suggestion of suggestionsToProcess) {
                    if (!selectedIds.has(suggestion.id)) continue;

                    maxKeyNum++;
                    const newTask: Omit<Task, 'id' | 'created_at' | 'children'> = {
                        user_id: conversation.user_id,
                        conversation_id: conversation.id,
                        parent_id: parentDbId,
                        task_key: `TASK-${maxKeyNum}`,
                        title: suggestion.title,
                        description: suggestion.description,
                        status: 'todo',
                        priority: suggestion.priority,
                        type: suggestion.type as TaskType,
                        assignee: null,
                    };

                    const { data: insertedTask, error: insertError } = await supabase
                        .from('tasks')
                        .insert(newTask)
                        .select()
                        .single();

                    if (insertError) throw insertError;

                    if (insertedTask && suggestion.children) {
                        await insertTasksRecursively(suggestion.children, insertedTask.id);
                    }
                }
            };
            
            await insertTasksRecursively(suggestions, null);
            onUpdateConversation(conversation.id, { backlogSuggestions: [] });

        } catch (err: any) {
            setError(err.message || 'Görevler backlog\'a eklenirken bir hata oluştu.');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="flex flex-col h-full">
            <header className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Proje Backlog Oluşturma</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Mevcut dokümanlarınızdan proje görevleri oluşturun ve bunları Proje Panonuza ekleyin.
                </p>
            </header>

            {suggestions.length > 0 ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {suggestions.map(suggestion => (
                        <SuggestionItem
                            key={suggestion.id}
                            suggestion={suggestion}
                            level={0}
                            isSelected={(id) => selectedIds.has(id)}
                            onToggle={handleToggleSelection}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <CheckSquare className="w-16 h-16 text-slate-400 mb-4" strokeWidth={1} />
                    <h4 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Backlog Önerileri Oluşturun</h4>
                    <p className="mt-2 max-w-lg text-slate-500 dark:text-slate-400">
                        Analiz, Test ve İzlenebilirlik dokümanlarınızı kullanarak AI'dan projeniz için bir görev listesi (backlog) oluşturmasını isteyin.
                    </p>
                    <button
                        onClick={handleGenerateSuggestions}
                        disabled={isGenerating || !isReadyForGeneration}
                        className="mt-6 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center"
                        title={!isReadyForGeneration ? "Lütfen önce Analiz, Test ve İzlenebilirlik dokümanlarını oluşturun." : ""}
                    >
                        {isGenerating ? <><LoaderCircle className="animate-spin mr-2 h-5 w-5" /> Oluşturuluyor...</> : "Backlog Önerileri Oluştur"}
                    </button>
                    {error && <div className="mt-4 p-3 text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600"><AlertTriangle className="inline h-4 w-4 mr-2" />{error}</div>}
                </div>
            )}
            
            {suggestions.length > 0 && (
                <footer className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div className="text-sm font-medium">{selectedIds.size} görev seçildi</div>
                    <button
                        onClick={handleAddToBacklog}
                        disabled={isSaving || selectedIds.size === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 flex items-center"
                    >
                         {isSaving ? <><LoaderCircle className="animate-spin mr-2 h-5 w-5" /> Ekleniyor...</> : "Seçilenleri Panoya Ekle"}
                    </button>
                </footer>
            )}
        </div>
    );
};