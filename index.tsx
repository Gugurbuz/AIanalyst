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
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<Session | null>(null);
    const [authFlowStep, setAuthFlowStep] = useState<'landing' | 'login' | 'signup'>('landing');

    const [loadResult, setLoadResult] = useState<{
        error?: string;
        publicConversation?: Conversation;
        appData?: AppData;
    }>({});

    // This effect handles getting the initial session and subscribing to auth changes.
    useEffect(() => {
        // We run this only once, on mount.
        // Initially, we are loading until we have checked for a session.
        setIsLoading(true);
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.warn('Error fetching session on initial load:', error.message);
                // If there's an error (like an invalid refresh token), treat it as logged out.
                // The Supabase client should also fire a SIGNED_OUT event, but this is a safeguard.
                setSession(null);
            } else {
                setSession(session);
            }
            // Now we know the auth status, we can stop the initial loading.
            // Data loading will be handled by the next effect based on the session.
            setIsLoading(false); 
        });

        const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    // This effect handles fetching data when the session changes or when a share link is present.
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('share');

        const fetchData = async () => {
            // Reset previous results before fetching new ones
            setLoadResult({});

            if (shareId) {
                setIsLoading(true);
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
            } else if (session) {
                setIsLoading(true);
                try {
                    const [profileResult, conversationsResult, templatesResult] = await Promise.all([
                        authService.getProfile(session.user.id),
                        supabase
                            .from('conversations')
                            .select('*, conversation_details(*), document_versions(*), documents(*)')
                            .eq('user_id', session.user.id)
                            .order('created_at', { ascending: false }),
                        authService.fetchTemplates(session.user.id)
                    ]);
                    
                    if (conversationsResult.error) {
                        throw new Error(`Sohbetler yüklenirken bir hata oluştu: ${conversationsResult.error.message}`);
                    }
                    
                    const conversationsWithDetails = (conversationsResult.data || []).map((conv: any) => {
                        const messagesWithThoughts = (conv.conversation_details || [])
                            .map((msg: any) => {
                                let thought: ThoughtProcess | null = null;
                                // Handle both old 'thoughts' (string) and new 'thought' (jsonb)
                                const thoughtSource = msg.thought || msg.thoughts;
                                
                                if (thoughtSource && typeof thoughtSource === 'string') {
                                    try {
                                        const parsed = JSON.parse(thoughtSource);
                                        // Check if it's the old ExpertStep[] format
                                        if (Array.isArray(parsed)) {
                                            thought = {
                                                title: "Düşünce Akışı",
                                                steps: parsed as ThinkingStep[]
                                            };
                                        } else { // Assume it's the new ThoughtProcess format
                                            thought = parsed as ThoughtProcess;
                                        }
                                    } catch (e) {
                                        console.warn("Could not parse 'thoughts' field from DB:", e);
                                        thought = { title: 'Düşünce Akışı (Hata)', steps: [{ id: 'db_parse_error', name: 'Veritabanından gelen düşünce verisi ayrıştırılamadı.', status: 'error' }] };
                                    }
                                } else if (thoughtSource && typeof thoughtSource === 'object') {
                                    // It's already a JSONB object, use it directly
                                    thought = thoughtSource as ThoughtProcess;
                                }
                                
                                return {
                                    ...msg,
                                    thought,
                                };
                            })
                            .sort(
                                (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                            );

                        return {
                            ...conv,
                            messages: messagesWithThoughts,
                            documentVersions: (conv.document_versions || []).sort(
                                (a: DocumentVersion, b: DocumentVersion) => a.version_number - b.version_number
                            ),
                            documents: conv.documents || [],
                        };
                    });


                    setLoadResult({
                        appData: {
                            conversations: conversationsWithDetails as Conversation[],
                            profile: profileResult,
                            templates: templatesResult,
                        }
                    });
                } catch (err: any) {
                    setLoadResult({ error: err.message || 'Veri yüklenirken bilinmeyen bir hata oluştu.' });
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchData();

    }, [session]);


    if (isLoading) {
      return <LoadingSpinner />;
    }

    if (loadResult.error) {
        return <ErrorScreen message={loadResult.error} />
    }
    
    if (loadResult.publicConversation) {
        return <PublicView conversation={loadResult.publicConversation} />;
    }

    if (session?.user && loadResult.appData) {
        return <App 
            user={session.user as User} 
            onLogout={() => authService.logout()} 
            initialData={loadResult.appData}
        />;
    }

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