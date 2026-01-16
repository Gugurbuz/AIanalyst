import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthPage } from './components/AuthPage';
import { authService } from './services/authService';
import { supabase } from './services/supabaseClient'; 
import type { User, Conversation, Document, DocumentVersion, Message, UserProfile, Template, ThoughtProcess, ThinkingStep } from './types';
import type { Session } from '@supabase/supabase-js';
import { PublicView } from './components/PublicView';
import { LandingPage } from './components/LandingPage';
import { PublicFlowStudio } from './components/PublicFlowStudio';


const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
    <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
);

const ErrorScreen: React.FC<{ message: string }> = ({ message }) => (
     <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Bir Hata Oluştu</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{message}</p>
        </div>
    </div>
);

// Props for the main App component, to be loaded async
export interface AppData {
    conversations: Conversation[];
    profile: UserProfile | null;
    templates: Template[];
}

const Main = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [showLanding, setShowLanding] = useState(true);
    const [initialMessage, setInitialMessage] = useState<string>('');
    const [loadResult, setLoadResult] = useState<{
        error?: string;
        publicConversation?: Conversation;
    }>({});

    // Check for the public /studio route first.
    if (window.location.pathname.startsWith('/studio')) {
        return <PublicFlowStudio />;
    }

    // Check for share link on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('share');

        const fetchData = async () => {
            if (shareId) {
                setIsLoading(true);
                setShowLanding(false);
                const { data, error } = await supabase
                    .from('conversations')
                    .select('*, conversation_details(*), documents(*), document_versions(*)')
                    .eq('share_id', shareId)
                    .eq('is_shared', true)
                    .single();

                if (error || !data) {
                    setLoadResult({ error: 'Bu analize erişilemiyor. Linkin doğru olduğundan emin olun veya paylaşım ayarları değiştirilmiş olabilir.' });
                } else {
                    const convWithDetails = {
                        ...data,
                        messages: (data.conversation_details || []).sort(
                            (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                        ),
                        documents: data.documents || [],
                        documentVersions: (data.document_versions || []).sort(
                            (a: DocumentVersion, b: DocumentVersion) => a.version_number - b.version_number
                        )
                    };
                    setLoadResult({ publicConversation: convWithDetails as Conversation });
                }
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    if (isLoading) {
      return <LoadingSpinner />;
    }

    if (loadResult.error) {
        return <ErrorScreen message={loadResult.error} />
    }

    if (loadResult.publicConversation) {
        return <PublicView conversation={loadResult.publicConversation} />;
    }

    if (!showLanding) {
        const anonymousUser: User = {
            id: 'anonymous-' + Date.now(),
            email: 'anonim@kullanici.com',
            created_at: new Date().toISOString()
        };

        const appData: AppData = {
            conversations: [],
            profile: null,
            templates: []
        };

        return <App
            user={anonymousUser}
            onLogout={() => {}}
            initialData={appData}
            initialMessage={initialMessage}
        />;
    }

    return <LandingPage
        onStartChat={(message: string) => {
            setInitialMessage(message);
            setShowLanding(false);
        }}
    />;
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