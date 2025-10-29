import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthPage } from './components/AuthPage';
import { authService } from './services/authService';
import type { User } from './types';

const Main = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const user = authService.getCurrentUser();
        if (user) {
            setCurrentUser(user);
        }
        setIsLoading(false);
    }, []);

    const handleLoginSuccess = (user: User) => {
        setCurrentUser(user);
    };

    const handleLogout = () => {
        authService.logout();
        setCurrentUser(null);
    };

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
           {/* You can add a more sophisticated loading spinner here */}
        </div>
      );
    }

    if (!currentUser) {
        return <AuthPage onLoginSuccess={handleLoginSuccess} />;
    }

    return <App user={currentUser} onLogout={handleLogout} />;
};


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>
);
