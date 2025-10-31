import React, { useState, useEffect } from 'react';
import type { Conversation, Task, TaskSuggestion, GeminiModel } from '../types';
import { geminiService } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface TaskGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    isGenerating: boolean;
    setIsGenerating: (isGenerating: boolean) => void;
    model: GeminiModel;
}

const priorityStyles = {
    low: 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200',
    medium: 'bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100',
    high: 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100',
    critical: 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100',
};

export const TaskGenerationModal: React.FC<TaskGenerationModalProps> = ({ isOpen, onClose, conversation, isGenerating, setIsGenerating, model }) => {
    const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && conversation.generatedDocs.analysisDoc) {
            const generate = async () => {
                setError(null);
                setSuggestions([]);
                try {
                    const modelToUse = model;
                    const modelConfig = undefined;
                    const result = await geminiService.generateTasksFromAnalysis(conversation.generatedDocs.analysisDoc, modelToUse, modelConfig);
                    setSuggestions(result);
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Görevler oluşturulurken bir hata oluştu.');
                } finally {
                    setIsGenerating(false);
                }
            };
            generate();
        }
    }, [isOpen, conversation.generatedDocs.analysisDoc, model, setIsGenerating]);

    const handleAddTask = async () => {
        setIsSaving(true);
        setError(null);
        
        const tasksToInsert = suggestions.map(s => ({
            user_id: conversation.user_id,
            conversation_id: conversation.id,
            title: s.title,
            description: s.description,
            priority: s.priority,
            status: 'todo' as const, // Explicitly type as 'todo'
        }));

        const { error } = await supabase.from('tasks').insert(tasksToInsert);

        if (error) {
            setError(error.message);
        } else {
            // Success
            onClose();
            // Optionally, we could have a callback to refresh the board view.
            // For now, the user can switch to the board to see the new tasks.
        }
        setIsSaving(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-3xl h-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">AI Tarafından Önerilen Görevler</h2>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <div className="p-6 max-h-[60vh] overflow-y-auto flex-1">
                    {isGenerating && (
                        <div className="flex flex-col items-center justify-center h-48">
                            <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <p className="mt-4 text-slate-600 dark:text-slate-400">Analiz dokümanı inceleniyor ve görevler oluşturuluyor...</p>
                        </div>
                    )}
                    {error && <div className="p-3 text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600">{error}</div>}
                    
                    {!isGenerating && !error && (
                        <div className="space-y-4">
                            {suggestions.map((s, index) => (
                                <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{s.title}</h3>
                                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${priorityStyles[s.priority]}`}>
                                            {s.priority.charAt(0).toUpperCase() + s.priority.slice(1)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{s.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <footer className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{suggestions.length} görev bulundu.</p>
                    <div className="flex gap-3">
                         <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition">İptal</button>
                        <button 
                            onClick={handleAddTask}
                            disabled={isSaving || isGenerating || suggestions.length === 0}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition disabled:opacity-50 flex items-center"
                        >
                            {isSaving && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {isSaving ? 'Kaydediliyor...' : 'Panoya Ekle'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};