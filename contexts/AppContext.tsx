// contexts/AppContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
// FIX: The import path was incorrect. `contexts` and `hooks` are sibling directories.
import { useAppLogic } from '../hooks/useAppLogic';
import type { User } from '../types';
import type { AppData } from '../index';

// The return type of our custom hook will define the context's value type
type AppContextType = ReturnType<typeof useAppLogic>;

const AppContext = createContext<AppContextType | null>(null);

interface AppProviderProps {
    children: ReactNode;
    user: User;
    initialData: AppData;
    onLogout: () => void;
    initialMessage?: string;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, user, initialData, onLogout, initialMessage }) => {
    const appLogic = useAppLogic({ user, initialData, onLogout, initialMessage });

    return (
        <AppContext.Provider value={appLogic}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
