import React from 'react';
import type { Task, TaskPriority, TaskType } from '../types';
import { Layers, FileText, Beaker, CheckSquare } from 'lucide-react';

interface TaskCardProps {
    task: Task;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
    onClick: () => void;
}

const priorityStyles: Record<TaskPriority, { bg: string; text: string; label: string }> = {
    low: { bg: 'bg-slate-200 dark:bg-slate-600', text: 'text-slate-800 dark:text-slate-200', label: 'Düşük' },
    medium: { bg: 'bg-indigo-200 dark:bg-indigo-800', text: 'text-indigo-800 dark:text-indigo-100', label: 'Orta' },
    high: { bg: 'bg-amber-200 dark:bg-amber-800', text: 'text-amber-800 dark:text-amber-100', label: 'Yüksek' },
    critical: { bg: 'bg-red-200 dark:bg-red-800', text: 'text-red-800 dark:text-red-100', label: 'Kritik' },
};

const typeInfo: Record<TaskType, { icon: React.ReactElement; color: string }> = {
    epic: { icon: <Layers className="h-4 w-4" />, color: 'text-purple-500' },
    story: { icon: <FileText className="h-4 w-4" />, color: 'text-blue-500' },
    test_case: { icon: <Beaker className="h-4 w-4" />, color: 'text-green-500' },
    task: { icon: <CheckSquare className="h-4 w-4" />, color: 'text-slate-500' },
};


export const TaskCard: React.FC<TaskCardProps> = ({ task, onDragStart, onClick }) => {
    const { bg, text, label } = priorityStyles[task.priority] || priorityStyles.medium;
    const taskTypeInfo = typeInfo[task.type] || typeInfo.task;

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            onClick={onClick}
            className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm cursor-grab hover:shadow-md transition-shadow border border-transparent hover:border-indigo-400 dark:hover:border-indigo-600"
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 pr-2 flex-1 min-w-0">
                    <span className={taskTypeInfo.color} title={task.type}>{taskTypeInfo.icon}</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{task.title}</p>
                </div>
                {task.task_key && <span className="text-slate-400 dark:text-slate-500 font-mono text-xs flex-shrink-0">{task.task_key}</span>}
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${bg} ${text}`}>{label}</span>
                {task.assignee && <span className="text-slate-500 dark:text-slate-400">{task.assignee}</span>}
            </div>
        </div>
    );
};