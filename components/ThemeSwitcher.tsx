import React, { useState, useRef, useEffect } from 'react';
import type { Theme } from '../types';
import { Sun, Moon, Monitor } from 'lucide-react';

interface ThemeSwitcherProps {
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
}

const icons = {
    light: <Sun className="h-5 w-5" />,
    dark: <Moon className="h-5 w-5" />,
    system: <Monitor className="h-5 w-5" />
};

const themeOptions: { value: Theme; label: string; icon: React.ReactElement }[] = [
    { value: 'light', label: 'Açık', icon: icons.light },
    { value: 'dark', label: 'Koyu', icon: icons.dark },
    { value: 'system', label: 'Sistem', icon: icons.system },
];

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, onThemeChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (newTheme: Theme) => {
        onThemeChange(newTheme);
        setIsOpen(false);
    };
    
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-indigo-500 transition"
                aria-label={`Current theme: ${theme}`}
            >
                {theme === 'light' && icons.light}
                {theme === 'dark' && icons.dark}
                {theme === 'system' && icons.system}
            </button>
            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        {themeOptions.map((option) => (
                             <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`w-full text-left flex items-center px-4 py-2 text-sm ${
                                    theme === option.value 
                                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200' 
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                                role="menuitem"
                            >
                                <span className="mr-3">{option.icon}</span>
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};