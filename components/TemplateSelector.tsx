import React from 'react';
// FIX: Import the 'Template' type from the central types file.
import type { Template } from '../types';

interface TemplateSelectorProps {
    label: string;
    templates: Template[];
    selectedValue: string;
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    disabled?: boolean;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ label, templates, selectedValue, onChange, disabled = false }) => {
    return (
        <div className="flex flex-col w-full sm:w-auto sm:flex-row sm:items-center sm:space-x-2">
            <label htmlFor={`template-select-${label}`} className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 sm:mb-0 flex-shrink-0">{label}:</label>
            <select
                id={`template-select-${label}`}
                value={selectedValue}
                onChange={onChange}
                disabled={disabled}
                className="w-full sm:w-auto px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
                {templates.map(template => (
                    <option key={template.id} value={template.id}>
                        {template.name}
                    </option>
                ))}
            </select>
        </div>
    );
};