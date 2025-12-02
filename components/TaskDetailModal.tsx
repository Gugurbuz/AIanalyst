import React, { useState, useEffect } from 'react';
import type { Task, TaskStatus, TaskPriority, TaskType } from '../types';
import { Layers, FileText, Beaker, CheckSquare } from 'lucide-react';

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Partial<Task>) => void;
    task: Task | null;
    allTasks: Task[]; // Pass all tasks to find the parent
}

// FIX: Store the component type (e.g., `Layers`) instead of a pre-rendered element.
// This allows for dynamic prop assignment (like changing className) in a type-safe way.
const typeInfo: Record<TaskType, { icon: React.ComponentType<{ className?: string }>; name: string; color: string }> = {
    epic: { icon: Layers, name: 'Epic', color: 'text-purple-500' },
    story: { icon: FileText, name: 'Story', color: 'text-blue-500' },
    test_case: { icon: Beaker, name: 'Test Case', color: 'text-green-500' },
    task: { icon: CheckSquare, name: 'Task', color: 'text-slate-500' },
};

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ isOpen, onClose, onSave, task, allTasks }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<TaskStatus>('todo');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [assignee, setAssignee] = useState('');
    const [type, setType] = useState<TaskType>('task');
    const [parentId, setParentId] = useState<string | null>(null);

    const parentTask = allTasks.find(t => t.id === parentId);
    const taskTypeInfo = typeInfo[type] || typeInfo.task;
    const IconComponent = taskTypeInfo.icon;

    useEffect(() => {
        if (task) {
            setTitle(task.title || '');
            setDescription(task.description || '');
            setStatus(task.status || 'todo');
            setPriority(task.priority || 'medium');
            setAssignee(task.assignee || '');
            setType(task.type || 'task');
            setParentId(task.parent_id || null);
        } else {
            // Reset for new task
            setTitle('');
            setDescription('');
            setStatus('todo');
            setPriority('medium');
            setAssignee('');
            setType('task');
            setParentId(null);
        }
    }, [task, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: task?.id,
            title,
            description,
            status,
            priority,
            assignee,
            type,
            parent_id: parentId,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-lg h-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                    <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <div className="flex flex-col gap-1">
                             <div className="flex items-center gap-3">
                                <span className={taskTypeInfo.color} title={taskTypeInfo.name}>
                                    <IconComponent className="h-5 w-5" />
                                </span>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{task ? 'Görevi Düzenle' : 'Yeni Görev Oluştur'}</h2>
                                {task && task.task_key && <span className="font-mono text-sm text-slate-500 dark:text-slate-400">{task.task_key}</span>}
                            </div>
                            {parentTask && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 pl-8">
                                    Parent: <span className="font-semibold">{parentTask.task_key} - {parentTask.title}</span>
                                </div>
                            )}
                        </div>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </header>
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div>
                            <label htmlFor="task-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Başlık</label>
                            <input id="task-title" type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700" />
                        </div>
                        <div>
                            <label htmlFor="task-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Açıklama</label>
                            <textarea id="task-desc" value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="task-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Durum</label>
                                <select id="task-status" value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700">
                                    <option value="todo">Yapılacak</option>
                                    <option value="inprogress">Devam Ediyor</option>
                                    <option value="done">Tamamlandı</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="task-priority" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Öncelik</label>
                                <select id="task-priority" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700">
                                    <option value="low">Düşük</option>
                                    <option value="medium">Orta</option>
                                    <option value="high">Yüksek</option>
                                    <option value="critical">Kritik</option>
                                </select>
                            </div>
                        </div>
                         <div>
                            <label htmlFor="task-assignee" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Atanan Kişi</label>
                            <input id="task-assignee" type="text" value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="isim@ornek.com" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700" />
                        </div>
                    </div>
                    <footer className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700 gap-3 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition">İptal</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition">Kaydet</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};