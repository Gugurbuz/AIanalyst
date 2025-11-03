// App.tsx
import React from 'react';
import { AppProvider } from './contexts/AppContext';
import { MainAppLayout } from './layouts/MainAppLayout';
import type { User } from './types';
import type { AppData } from './index';

interface AppProps {
  user: User;
  onLogout: () => void;
  initialData: AppData;
}

export const App: React.FC<AppProps> = ({ user, onLogout, initialData }) => {
    return (
        <AppProvider user={user} initialData={initialData} onLogout={onLogout}>
            <MainAppLayout />
        </AppProvider>
    );
};
