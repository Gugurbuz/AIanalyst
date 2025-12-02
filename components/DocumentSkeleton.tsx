
import React from 'react';

export const DocumentSkeleton: React.FC = () => {
    return (
        <div className="w-full h-full p-8 md:p-12 max-w-4xl mx-auto animate-pulse">
            {/* Header / Title Area */}
            <div className="space-y-4 mb-12">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-md w-3/4"></div>
                <div className="flex gap-4 pt-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                </div>
            </div>

            {/* Content Blocks */}
            <div className="space-y-8">
                {/* Section 1 */}
                <div className="space-y-3">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
                </div>

                {/* Section 2 */}
                <div className="space-y-3">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-11/12"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/5"></div>
                </div>

                {/* List Simulation */}
                <div className="space-y-4 pt-2">
                    <div className="flex gap-3">
                        <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0 mt-1"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                    </div>
                    <div className="flex gap-3">
                        <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0 mt-1"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-10/12"></div>
                    </div>
                    <div className="flex gap-3">
                        <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0 mt-1"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-11/12"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
