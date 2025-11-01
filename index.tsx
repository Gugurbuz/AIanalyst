import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthPage } from './components/AuthPage';
import { authService } from './services/authService';
import type { User } from './types';
import type { Session } from '@supabase/supabase-js';
import { PublicView } from './components/PublicView';
import { LandingPage } from './components/LandingPage';


const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
    <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
);

const AuthWrapper = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authFlowStep, setAuthFlowStep] = useState<'landing' | 'login' | 'signup'>('landing');

    useEffect(() => {
        // Use onAuthStateChange as the single source of truth.
        // It fires once on load with the initial session state, and then on every auth change.
        // This prevents the flicker/race condition between getSession() and the listener.
        const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
            setSession(session);
            setIsLoading(false); // Only stop loading after the initial auth state is confirmed.
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    if (isLoading) {
      return <LoadingSpinner />;
    }

    if (!session?.user) {
        if (authFlowStep === 'landing') {
            return <LandingPage 
                onLoginClick={() => setAuthFlowStep('login')}
                onSignupClick={() => setAuthFlowStep('signup')}
            />;
        }
        return <AuthPage 
            initialView={authFlowStep} 
            onNavigateBack={() => setAuthFlowStep('landing')}
        />;
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
         return <LoadingSpinner />;
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