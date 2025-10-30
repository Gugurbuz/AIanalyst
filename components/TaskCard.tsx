import React from 'react';
import type { Task, TaskPriority } from '../types';

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

export const TaskCard: React.FC<TaskCardProps> = ({ task, onDragStart, onClick }) => {
    const { bg, text, label } = priorityStyles[task.priority] || priorityStyles.medium;

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            onClick={onClick}
            className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm cursor-grab hover:shadow-md transition-shadow border-l-4"
            style={{ borderLeftColor: priorityStyles[task.priority]?.bg.startsWith('bg-red') ? '#ef4444' : priorityStyles[task.priority]?.bg.startsWith('bg-amber') ? '#f59e0b' : priorityStyles[task.priority]?.bg.startsWith('bg-indigo') ? '#6366f1' : '#cbd5e1' }}
        >
            <p className="font-semibold text-slate-800 dark:text-slate-100">{task.title}</p>
            <div className="flex items-center justify-between mt-3 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${bg} ${text}`}>{label}</span>
                {task.assignee && <span className="text-slate-500 dark:text-slate-400">{task.assignee}</span>}
            </div>
        </div>
    );
};