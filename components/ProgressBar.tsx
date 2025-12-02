import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
    progress: number;
    showLabel?: boolean;
    label?: string;
    className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    progress,
    showLabel = false,
    label,
    className = '',
}) => {
    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
        <div className={`w-full ${className}`}>
            {showLabel && (
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {label || 'İlerleme'}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {clampedProgress.toFixed(0)}%
                    </span>
                </div>
            )}
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${clampedProgress}%` }}
                    transition={{
                        duration: 0.3,
                        ease: 'easeInOut',
                    }}
                />
            </div>
        </div>
    );
};

interface CircularProgressProps {
    progress: number;
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
    progress,
    size = 48,
    strokeWidth = 4,
    showLabel = true,
}) => {
    const clampedProgress = Math.min(100, Math.max(0, progress));
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (clampedProgress / 100) * circumference;

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="text-slate-200 dark:text-slate-700"
                />
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="text-indigo-600 dark:text-indigo-400"
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{
                        duration: 0.5,
                        ease: 'easeInOut',
                    }}
                />
            </svg>
            {showLabel && (
                <span className="absolute text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {clampedProgress.toFixed(0)}%
                </span>
            )}
        </div>
    );
};
