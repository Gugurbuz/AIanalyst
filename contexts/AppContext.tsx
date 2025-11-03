// contexts/AppContext.tsx
import React, { createContext, useContext } from 'react';
import { useAppLogic } from '../hooks/useAppLogic';
import type { User } from '../types';
import type { AppData } from '../index';

// The return type of our custom hook will define the context's value type
type AppContextType = ReturnType<typeof useAppLogic>;

const AppContext = createContext<AppContextType | null>(null);

interface AppProviderProps {
    children: React.ReactNode;
    user: User;
    initialData: AppData;
    onLogout: () => void;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, user, initialData, onLogout }) => {
    const appLogic = useAppLogic({ user, initialData, onLogout });

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
