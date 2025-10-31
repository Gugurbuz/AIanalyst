import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Task, TaskStatus } from '../types';
import { supabase } from '../services/supabaseClient';
import { TaskCard } from './TaskCard';
import { TaskDetailModal } from './TaskDetailModal';
import { ClipboardList } from 'lucide-react';

interface ProjectBoardProps {
    user: User;
}

const columnStyles: Record<TaskStatus, { bg: string; text: string }> = {
    todo: { bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
    inprogress: { bg: 'bg-indigo-100 dark:bg-indigo-900/50', text: 'text-indigo-800 dark:text-indigo-200' },
    done: { bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-800 dark:text-emerald-200' },
};

const columnNames: Record<TaskStatus, string> = {
    todo: 'Yapılacaklar',
    inprogress: 'Devam Ediyor',
    done: 'Tamamlandı'
};

// New recursive component to render tasks and their children
const TaskGroup: React.FC<{
    task: Task;
    level: number;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
    onClick: (task: Task) => void;
}> = ({ task, level, onDragStart, onClick }) => {
    return (
        <div style={{ marginLeft: `${level * 16}px` }}>
            <TaskCard task={task} onDragStart={onDragStart} onClick={() => onClick(task)} />
            {task.children && task.children.length > 0 && (
                <div className="mt-2 space-y-2">
                    {task.children.map(child => (
                        <TaskGroup key={child.id} task={child} level={level + 1} onDragStart={onDragStart} onClick={onClick} />
                    ))}
                </div>
            )}
        </div>
    );
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
        // Add a 'type' for new generic tasks if not specified
        const taskWithType = {
            ...taskToSave,
            type: taskToSave.type || 'task'
        };

        if (taskToSave.id) { // Update existing task
            const { data, error } = await supabase.from('tasks').update(taskWithType).eq('id', taskToSave.id).select().single();
            if (error) { setError(error.message); } 
            else if (data) {
                setTasks(prev => prev.map(t => t.id === data.id ? data as Task : t));
            }
        } else { // Create new task
            const { data: existingTasks, error: fetchError } = await supabase
                .from('tasks')
                .select('task_key')
                .eq('user_id', user.id);

            if (fetchError) {
                setError(fetchError.message);
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
            const taskKey = `TASK-${maxKeyNum + 1}`;
            
            const { data, error } = await supabase.from('tasks').insert({ ...taskWithType, task_key: taskKey, user_id: user.id }).select().single();
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

    const buildTaskTree = (taskList: Task[]): Task[] => {
        const taskMap = new Map<string, Task>();
        const rootTasks: Task[] = [];

        taskList.forEach(task => {
            taskMap.set(task.id, { ...task, children: [] });
        });

        taskList.forEach(task => {
            const currentTask = taskMap.get(task.id);
            if (currentTask) {
                if (task.parent_id && taskMap.has(task.parent_id)) {
                    const parentTask = taskMap.get(task.parent_id);
                    parentTask?.children?.push(currentTask);
                } else {
                    rootTasks.push(currentTask);
                }
            }
        });

        return rootTasks;
    };


    const renderColumn = (status: TaskStatus) => {
        const columnTasks = tasks.filter(task => task.status === status);
        const taskTree = buildTaskTree(columnTasks);
        const { bg, text } = columnStyles[status];
        
        return (
            <div
                key={status}
                onDrop={(e) => handleDrop(e, status)}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(status); }}
                onDragLeave={() => setDragOverColumn(null)}
                className={`flex-1 flex flex-col rounded-lg p-3 transition-colors min-w-[300px] ${dragOverColumn === status ? 'bg-indigo-200 dark:bg-indigo-800' : bg}`}
            >
                <h2 className={`font-bold text-lg mb-4 px-2 ${text}`}>{columnNames[status]} ({columnTasks.length})</h2>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {taskTree.map(task => (
                        <TaskGroup key={task.id} task={task} level={0} onDragStart={handleDragStart} onClick={handleOpenModal} />
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
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <p className="mt-4 text-slate-600 dark:text-slate-400">Backlog yükleniyor...</p>
                </div>
            </div>
        );
    }
    
    if (error) {
        return <div className="p-6 text-center text-red-500">Hata: {error}</div>;
    }

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 p-4">
                <ClipboardList className="w-16 h-16 text-slate-400 mb-4" strokeWidth={1} />
                <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Backlog'unuz Henüz Boş</h3>
                <p className="mt-2 max-w-lg">
                    'Analist' görünümüne geçip bir sohbet başlattıktan sonra, AI'dan iş analizi dokümanınıza göre proje görevleri oluşturmasını isteyerek backlog'unuzu doldurabilirsiniz.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full p-4 gap-4 overflow-x-auto whitespace-nowrap">
            {(['todo', 'inprogress', 'done'] as TaskStatus[]).map(status => renderColumn(status))}
            {isModalOpen && (
                <TaskDetailModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveTask}
                    task={selectedTask}
                    allTasks={tasks}
                />
            )}
        </div>
    );
};