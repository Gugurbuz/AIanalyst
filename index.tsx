import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Correct module imports for App and types.
import App from './App';
import { AuthPage } from './components/AuthPage';
import { authService } from './services/authService';
import type { User } from './types';
import type { Session } from '@supabase/supabase-js';
import { PublicView } from './components/PublicView';


const AuthWrapper = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const getSession = async () => {
            const currentSession = await authService.getSession();
            setSession(currentSession);
            setIsLoading(false);
        };
        
        getSession();

        const subscription = authService.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
           {/* You can add a more sophisticated loading spinner here */}
        </div>
      );
    }

    if (!session?.user) {
        return <AuthPage />;
    }

    return <App user={session.user as User} onLogout={() => authService.logout()} />;
};

const Main = () => {
    const [shareId, setShareId] = useState<string | null>(null);
    const [isCheckingUrl, setIsCheckingUrl] = useState(true);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('share');
        if (id) {
            setShareId(id);
        }
        setIsCheckingUrl(false);
    }, []);

    if (isCheckingUrl) {
         return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900" />
         );
    }

    if (shareId) {
        return <PublicView shareId={shareId} />;
    }

    return <AuthWrapper />;
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
