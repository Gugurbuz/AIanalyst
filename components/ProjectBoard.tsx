import React, { useState, useEffect, useCallback } from 'react';
import type { User, Task, TaskStatus } from '../types';
import { supabase } from '../services/supabaseClient';
import { TaskCard } from './TaskCard';
import { TaskDetailModal } from './TaskDetailModal';

interface ProjectBoardProps {
    user: User;
}

const columnStyles: Record<TaskStatus, { bg: string; text: string }> = {
    todo: { bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
    inprogress: { bg: 'bg-sky-100 dark:bg-sky-900/50', text: 'text-sky-800 dark:text-sky-200' },
    done: { bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-800 dark:text-emerald-200' },
};

const columnNames: Record<TaskStatus, string> = {
    todo: 'Yapılacaklar',
    inprogress: 'Devam Ediyor',
    done: 'Tamamlandı'
};

export const ProjectBoard: React.FC<ProjectBoardProps> = ({ user }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        if (error) {
            setError(error.message);
        } else {
            setTasks(data as Task[]);
        }
        setIsLoading(false);
    }, [user.id]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const handleOpenModal = (task: Task | null) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedTask(null);
    };

    const handleSaveTask = async (taskToSave: Partial<Task>) => {
        if (taskToSave.id) { // Update existing task
            const { data, error } = await supabase.from('tasks').update(taskToSave).eq('id', taskToSave.id).select().single();
            if (error) { setError(error.message); } 
            else if (data) {
                setTasks(prev => prev.map(t => t.id === data.id ? data as Task : t));
            }
        } else { // Create new task
            const { data, error } = await supabase.from('tasks').insert({ ...taskToSave, user_id: user.id }).select().single();
            if (error) { setError(error.message); }
            else if (data) {
                setTasks(prev => [...prev, data as Task]);
            }
        }
        handleCloseModal();
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
        e.dataTransfer.setData('taskId', taskId);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: TaskStatus) => {
        const taskId = e.dataTransfer.getData('taskId');
        setDragOverColumn(null);

        const taskToMove = tasks.find(t => t.id === taskId);
        if (!taskToMove || taskToMove.status === newStatus) return;

        // Optimistic UI update
        const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
        setTasks(updatedTasks);
        
        // Update database
        const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
        if (error) {
            setError(error.message);
            // Revert UI on error
            setTasks(tasks);
        }
    };

    const renderColumn = (status: TaskStatus) => {
        const columnTasks = tasks.filter(task => task.status === status);
        const { bg, text } = columnStyles[status];
        
        return (
            <div
                key={status}
                onDrop={(e) => handleDrop(e, status)}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(status); }}
                onDragLeave={() => setDragOverColumn(null)}
                className={`flex-1 flex flex-col rounded-lg p-3 transition-colors ${dragOverColumn === status ? 'bg-sky-200 dark:bg-sky-800' : bg}`}
            >
                <h2 className={`font-bold text-lg mb-4 px-2 ${text}`}>{columnNames[status]} ({columnTasks.length})</h2>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {columnTasks.map(task => (
                        <TaskCard key={task.id} task={task} onDragStart={handleDragStart} onClick={() => handleOpenModal(task)} />
                    ))}
                </div>
                {status === 'todo' && (
                    <button onClick={() => handleOpenModal(null)} className="mt-4 w-full text-left text-sm p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                        + Yeni Görev Ekle
                    </button>
                )}
            </div>
        );
    };

    if (isLoading) {
        return <div className="p-6 text-center">Yükleniyor...</div>;
    }
    
    if (error) {
        return <div className="p-6 text-center text-red-500">Hata: {error}</div>;
    }

    return (
        <div className="flex h-full p-4 gap-4">
            {(['todo', 'inprogress', 'done'] as TaskStatus[]).map(status => renderColumn(status))}
            {isModalOpen && (
                <TaskDetailModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveTask}
                    task={selectedTask}
                />
            )}
        </div>
    );
};
