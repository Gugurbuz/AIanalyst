import React, { useState, useEffect } from 'react';
import type { Task, TaskStatus, TaskPriority } from '../types';

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Partial<Task>) => void;
    task: Task | null;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ isOpen, onClose, onSave, task }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<TaskStatus>('todo');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [assignee, setAssignee] = useState('');

    useEffect(() => {
        if (task) {
            setTitle(task.title || '');
            setDescription(task.description || '');
            setStatus(task.status || 'todo');
            setPriority(task.priority || 'medium');
            setAssignee(task.assignee || '');
        } else {
            // Reset for new task
            setTitle('');
            setDescription('');
            setStatus('todo');
            setPriority('medium');
            setAssignee('');
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
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-lg h-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                    <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{task ? 'Görevi Düzenle' : 'Yeni Görev Oluştur'}</h2>
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