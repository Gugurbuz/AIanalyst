
// layouts/MainSidebar.tsx
import React, { useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { MessageSquare, ClipboardList } from 'lucide-react';

export const MainSidebar: React.FC = () => {
    const { currentView, setCurrentView, handleToggleDeveloperPanel } = useAppContext();

    const devPanelClickCount = useRef(0);
    const devPanelClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleBacklogClick = () => {
        // First, do the normal action of switching view
        setCurrentView('backlog');

        // Then, handle the dev panel trigger logic
        devPanelClickCount.current += 1;

        if (devPanelClickTimer.current) {
            clearTimeout(devPanelClickTimer.current);
        }

        devPanelClickTimer.current = setTimeout(() => {
            devPanelClickCount.current = 0;
        }, 1500); // Reset after 1.5 seconds

        if (devPanelClickCount.current >= 5) {
            handleToggleDeveloperPanel();
            devPanelClickCount.current = 0;
            if (devPanelClickTimer.current) {
                clearTimeout(devPanelClickTimer.current);
            }
        }
    };

    const navItems = [
        { id: 'analyst', label: 'Analizler', icon: MessageSquare, action: () => setCurrentView('analyst') },
        { id: 'backlog', label: 'Backlog Panosu', icon: ClipboardList, action: handleBacklogClick },
    ];

    return (
        <nav className="w-20 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col items-center py-4 space-y-6">
            <div className="flex flex-col items-center space-y-2 w-full mt-12">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={item.action}
                        title={item.label}
                        className={`w-16 h-16 flex flex-col items-center justify-center rounded-lg transition-colors duration-200
                            ${currentView === item.id 
                                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`
                        }
                    >
                        <item.icon className="h-6 w-6" />
                        <span className="text-[10px] font-bold mt-1">{item.label.split(' ')[0]}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
};
