import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Message, Conversation, User, MaturityReport } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { GeneratedDocument } from './components/GeneratedDocument';
import { geminiService } from './services/geminiService';
import { ChatMessageHistory } from './components/ChatMessageHistory';
import { ExportDropdown } from './components/ExportDropdown';
import { PromptSuggestions } from './components/PromptSuggestions';
import { ANALYSIS_TEMPLATES, TEST_SCENARIO_TEMPLATES } from './templates';
import { DeveloperPanel } from './components/DeveloperPanel';
import { Visualizations } from './components/Visualizations';
import { MaturityCheckReport } from './components/MaturityCheckReport';
import { TemplateSelector } from './components/TemplateSelector';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import type { Theme } from './components/ThemeSwitcher';
import { supabase } from './services/supabaseClient';

interface AppProps {
    user: User;
    onLogout: () => void;
}


// Custom hook to get the previous value of a state or prop
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const createMessage = (role: 'user' | 'assistant', content: string): Message => ({
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    role,
    content,
});

const ActionSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


const App: React.FC<AppProps> = ({ user, onLogout }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => window.innerWidth > 768);
    const [maturityReport, setMaturityReport] = useState<MaturityReport | null>(null);
    const [runningAction, setRunningAction] = useState<string | null>(null);
    
    const [selectedAnalysisTemplateId, setSelectedAnalysisTemplateId] = useState<string>(ANALYSIS_TEMPLATES[0].id);
    const [selectedTestTemplateId, setSelectedTestTemplateId] = useState<string>(TEST_SCENARIO_TEMPLATES[0].id);

    const analysisDocRef = useRef<HTMLDivElement>(null);
    const testScenariosRef = useRef<HTMLDivElement>(null);
    const visualizationRef = useRef<HTMLDivElement>(null);
    const actionPanelRef = useRef<HTMLDivElement>(null);
    const bottomOfChatRef = useRef<HTMLDivElement>(null);


    // --- Developer Mode State ---
    const [isDevMode, setIsDevMode] = useState(false);
    // Hardcoded defaults to match supabaseClient.ts
    const defaultSupabaseUrl = 'https://mjrshqlpomrezudlpmoj.supabase.co';
    const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcnNocWxwb21yZXp1ZGxwbW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzY1MDcsImV4cCI6MjA3NzM1MjUwN30.CY46g7Qnua63CrsWteAAFvMHeU75hwfZzeLfjOKCKNI';

    // It's considered configured if we have localStorage values OR hardcoded defaults.
    const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(() => {
        const url = localStorage.getItem('supabaseUrl');
        const key = localStorage.getItem('supabaseAnonKey');
        return !!(url && key) || !!(defaultSupabaseUrl && defaultSupabaseAnonKey);
    });
    
    const [devApiKey, setDevApiKey] = useState(() => localStorage.getItem('devApiKey') || process.env.API_KEY || '');
    const [devModelName, setDevModelName] = useState(() => localStorage.getItem('devModelName') || 'gemini-2.5-flash');
    const [devSupabaseUrl, setDevSupabaseUrl] = useState(() => localStorage.getItem('supabaseUrl') || defaultSupabaseUrl);
    const [devSupabaseAnonKey, setDevSupabaseAnonKey] = useState(() => localStorage.getItem('supabaseAnonKey') || defaultSupabaseAnonKey);

    const geminiConfig = useMemo(() => ({ apiKey: devApiKey, modelName: devModelName }), [devApiKey, devModelName]);
    

    // --- Data Fetching from Supabase ---
    useEffect(() => {
        const fetchConversations = async () => {
            if (!user || !isSupabaseConfigured) return;
            // Set a loading state specific to fetching data, if needed
            const { data, error } = await supabase
                .from('conversations')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching conversations:', error);
                setError('Geçmiş konuşmalar yüklenemedi. Supabase ayarlarınızı kontrol edin.');
            } else {
                setConversations(data as Conversation[] || []);
            }
        };
        fetchConversations();
    }, [user, isSupabaseConfigured]);

    // --- Theme Management ---
    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (theme === 'system') {
            root.classList.toggle('dark', prefersDark);
        } else {
            root.classList.toggle('dark', isDark);
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                root.classList.toggle('dark', mediaQuery.matches);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    // Save dev settings to localStorage
    useEffect(() => { localStorage.setItem('devApiKey', devApiKey); }, [devApiKey]);
    useEffect(() => { localStorage.setItem('devModelName', devModelName); }, [devModelName]);
    useEffect(() => { localStorage.setItem('supabaseUrl', devSupabaseUrl); }, [devSupabaseUrl]);
    useEffect(() => { localStorage.setItem('supabaseAnonKey', devSupabaseAnonKey); }, [devSupabaseAnonKey]);


    // Dev mode key sequence listener
    useEffect(() => {
        let keySequence = '';
        const targetSequence = 'devmode';

        const handler = (e: KeyboardEvent) => {
            keySequence += e.key.toLowerCase();
            if (keySequence.length > targetSequence.length) {
                keySequence = keySequence.slice(keySequence.length - targetSequence.length);
            }
            if (keySequence === targetSequence) {
                setIsDevMode(prev => {
                    setNotification(!prev ? 'Geliştirici Modu Aktif' : 'Geliştirici Modu Devre Dışı');
                    return !prev;
                });
                keySequence = '';
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);


     useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 3000); 
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConversationId) || null;
    }, [conversations, activeConversationId]);
    
    const prevActiveConversation = usePrevious(activeConversation);

    // Effect to scroll to newly generated content
    useEffect(() => {
        if (!activeConversation || !prevActiveConversation) return;
        const currentDocs = activeConversation.generatedDocs;
        const prevDocs = prevActiveConversation.generatedDocs;

        if (currentDocs.analysisDoc && !prevDocs.analysisDoc) {
             setTimeout(() => analysisDocRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        } else if (currentDocs.testScenarios && !prevDocs.testScenarios) {
            setTimeout(() => testScenariosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        } else if (currentDocs.visualization && !prevDocs.visualization) {
            setTimeout(() => visualizationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }

    }, [activeConversation, prevActiveConversation]);

    // Effect to scroll down when a maturity report is generated
    useEffect(() => {
        if (maturityReport) {
            // Scroll after the report component has had a chance to render
            const timer = setTimeout(() => {
                bottomOfChatRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [maturityReport]);


    const handleNewConversation = () => {
        setActiveConversationId(null);
        setError(null);
        setMaturityReport(null);
    };

    const handleSelectConversation = (id: string) => {
        setActiveConversationId(id);
        setError(null);
        setMaturityReport(null);
    };
    
    const handleUpdateConversationTitle = useCallback(async (id: string, title: string) => {
        if (!isSupabaseConfigured) return;
        const newTitle = title.trim() || "Başlıksız Analiz";
        const originalConversations = conversations;
        setConversations(prev =>
            prev.map(c => c.id === id ? { ...c, title: newTitle } : c)
        );

        const { error } = await supabase
            .from('conversations')
            .update({ title: newTitle })
            .eq('id', id);

        if (error) {
            console.error('Error updating title:', error);
            setError('Başlık güncellenemedi.');
            setConversations(originalConversations);
        }
    }, [conversations, isSupabaseConfigured]);
    
    const updateConversationInDb = async (id: string, updates: Partial<Omit<Conversation, 'id' | 'user_id' | 'created_at'>>) => {
        if (!isSupabaseConfigured) return;
        const originalConversations = [...conversations];
        setConversations(prev => 
            prev.map(c => c.id === id ? { ...c, ...updates } : c)
        );

        const { error } = await supabase
            .from('conversations')
            .update(updates)
            .eq('id', id);
        
        if (error) {
            console.error('Error updating conversation:', error);
            setError('Konuşma güncellenemedi.');
            setConversations(originalConversations);
        }
    };
    
    const handleSendMessage = useCallback(async (message: string) => {
        if (!message.trim() || !isSupabaseConfigured) return;
        
        setMaturityReport(null); 
        const userMessage = createMessage('user', message);

        if (!activeConversationId) { 
            setIsLoading(true);
            setError(null);

            try {
                const initialConversation = {
                    user_id: user.id,
                    title: 'Yeni Analiz...',
                    messages: [userMessage],
                    generatedDocs: { analysisDoc: '', testScenarios: '', visualization: '' }
                };
                
                const { data: newConvData, error: insertError } = await supabase
                    .from('conversations')
                    .insert(initialConversation)
                    .select()
                    .single();

                if (insertError) throw insertError;
                
                // Immediately add to state and set active
                setConversations(prev => [newConvData as Conversation, ...prev]);
                setActiveConversationId(newConvData.id);

                const [title, response] = await Promise.all([
                    geminiService.generateConversationTitle(message, geminiConfig),
                    geminiService.continueConversation(newConvData.messages as Message[], geminiConfig)
                ]);
                
                const assistantMessage = createMessage('assistant', response);
                
                const finalConversationData = {
                    title: title || "Başlıksız Analiz",
                    messages: [userMessage, assistantMessage]
                };

                await updateConversationInDb(newConvData.id, finalConversationData);

            } catch (e) {
                 const errorMessage = e instanceof Error ? e.message : 'Bilinmeyen bir hata oluştu.';
                 setError(`API çağrısı veya veritabanı işlemi başarısız oldu: ${errorMessage}`);
                 // Optionally remove the conversation from state if creation failed midway
            } finally {
                 setIsLoading(false);
            }

        } else {
            const currentMessages = conversations.find(c => c.id === activeConversationId)?.messages || [];
            const updatedMessages = [...currentMessages, userMessage];

            updateConversationInDb(activeConversationId, { messages: updatedMessages });
            setIsLoading(true);
            setError(null);

            try {
                const result = await geminiService.continueConversation(updatedMessages, geminiConfig);
                const assistantMessage = createMessage('assistant', result);
                const finalMessages = [...updatedMessages, assistantMessage];
                await updateConversationInDb(activeConversationId, { messages: finalMessages });
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'Bilinmeyen bir hata oluştu.';
                setError(`API çağrısı başarısız oldu: ${errorMessage}`);
                const errorMsg = createMessage('assistant', `Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin. Hata: ${errorMessage}`);
                const finalMessages = [...updatedMessages, errorMsg];
                await updateConversationInDb(activeConversationId, { messages: finalMessages });
            } finally {
                setIsLoading(false);
            }
        }
    }, [activeConversationId, conversations, geminiConfig, user.id, isSupabaseConfigured]);

    const handleMaturityCheck = useCallback(async () => {
        if (isLoading || !activeConversation) return;
        
        setIsLoading(true);
        setRunningAction('maturity');
        setError(null);
        setMaturityReport(null);
        try {
            const report = await geminiService.checkAnalysisMaturity(activeConversation.messages, geminiConfig);
            setMaturityReport(report);
            setNotification("Analiz olgunluk raporu oluşturuldu.");
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Bilinmeyen bir hata oluştu.';
            setError(`API çağrısı başarısız oldu: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setRunningAction(null);
        }
    }, [activeConversation, isLoading, geminiConfig]);

    const handleSendSuggestedQuestion = useCallback((question: string) => {
        handleSendMessage(question);
    }, [handleSendMessage]);

    const handleGenerateDocument = useCallback(async () => {
        if (isLoading || !activeConversation) return;

        const selectedTemplate = ANALYSIS_TEMPLATES.find(t => t.id === selectedAnalysisTemplateId);
        if (!selectedTemplate) {
            setError("Geçerli bir analiz şablonu seçilmedi.");
            return;
        }

        setIsLoading(true);
        setRunningAction('document');
        setError(null);
        try {
            const doc = await geminiService.generateAnalysisDocument(activeConversation.messages, selectedTemplate.prompt, geminiConfig);
            
            if (doc && doc.trim()) {
                const newDocs = { ...activeConversation.generatedDocs, analysisDoc: doc };
                await updateConversationInDb(activeConversation.id, { generatedDocs: newDocs });
                setNotification("Analiz dokümanınız başarıyla oluşturuldu.");
            } else {
                 const errorMsg = createMessage('assistant', "Üzgünüm, analiz dokümanı oluşturulamadı. Lütfen konuşmayı biraz daha detaylandırıp tekrar deneyin.");
                 const newMessages = [...activeConversation.messages, errorMsg];
                 await updateConversationInDb(activeConversation.id, { messages: newMessages });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Bilinmeyen bir hata oluştu.';
            setError(`API çağrısı başarısız oldu: ${errorMessage}`);
            const errorMsg = createMessage('assistant', `Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin. Hata: ${errorMessage}`);
            const newMessages = [...activeConversation.messages, errorMsg];
            await updateConversationInDb(activeConversation.id, { messages: newMessages });
        } finally {
            setIsLoading(false);
            setRunningAction(null);
        }
    }, [activeConversation, isLoading, selectedAnalysisTemplateId, geminiConfig]);

    const handleGenerateTestScenarios = useCallback(async () => {
        if (isLoading || !activeConversation || !activeConversation.generatedDocs.analysisDoc) return;

        const selectedTemplate = TEST_SCENARIO_TEMPLATES.find(t => t.id === selectedTestTemplateId);
         if (!selectedTemplate) {
            setError("Geçerli bir test senaryosu şablonu seçilmedi.");
            return;
        }

        setIsLoading(true);
        setRunningAction('test-scenarios');
        setError(null);
        try {
            const scenarios = await geminiService.generateTestScenarios(activeConversation.generatedDocs.analysisDoc, selectedTemplate.prompt, geminiConfig);

            if (scenarios && scenarios.trim()) {
                 const newDocs = { ...activeConversation.generatedDocs, testScenarios: scenarios };
                 await updateConversationInDb(activeConversation.id, { generatedDocs: newDocs });
                setNotification("Test senaryolarınız başarıyla oluşturuldu.");
            } else {
                 const errorMsg = createMessage('assistant', "Üzgünüm, test senaryoları oluşturulamadı. Analiz dokümanını kontrol edip tekrar deneyin.");
                 const newMessages = [...activeConversation.messages, errorMsg];
                 await updateConversationInDb(activeConversation.id, { messages: newMessages });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Bilinmeyen bir hata oluştu.';
            setError(`API çağrısı başarısız oldu: ${errorMessage}`);
            const errorMsg = createMessage('assistant', `Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin. Hata: ${errorMessage}`);
            const newMessages = [...activeConversation.messages, errorMsg];
            await updateConversationInDb(activeConversation.id, { messages: newMessages });
        } finally {
            setIsLoading(false);
            setRunningAction(null);
        }
    }, [activeConversation, isLoading, selectedTestTemplateId, geminiConfig]);

    const handleGenerateVisualization = useCallback(async () => {
        if (isLoading || !activeConversation) return;

        setIsLoading(true);
        setRunningAction('visualize');
        setError(null);
        try {
            const mermaidCode = await geminiService.generateVisualization(activeConversation.messages, geminiConfig);
            if (mermaidCode && mermaidCode.trim()) {
                const newDocs = { ...activeConversation.generatedDocs, visualization: mermaidCode };
                await updateConversationInDb(activeConversation.id, { generatedDocs: newDocs });
                setNotification("Özet görselleştirme başarıyla oluşturuldu.");
            } else {
                 const errorMsg = createMessage('assistant', "Üzgünüm, bir görselleştirme oluşturulamadı. Lütfen konuşmayı biraz daha detaylandırıp tekrar deneyin.");
                 const newMessages = [...activeConversation.messages, errorMsg];
                 await updateConversationInDb(activeConversation.id, { messages: newMessages });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Bilinmeyen bir hata oluştu.';
            setError(`API çağrısı başarısız oldu: ${errorMessage}`);
            const errorMsg = createMessage('assistant', `Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin. Hata: ${errorMessage}`);
            const newMessages = [...activeConversation.messages, errorMsg];
            await updateConversationInDb(activeConversation.id, { messages: newMessages });
        } finally {
            setIsLoading(false);
            setRunningAction(null);
        }
    }, [activeConversation, isLoading, geminiConfig]);

    const handleDocumentUpdate = useCallback((docType: 'analysisDoc' | 'testScenarios', newContent: string) => {
        if (!activeConversationId) return;
        const newDocs = { ...activeConversation?.generatedDocs, [docType]: newContent };
        updateConversationInDb(activeConversationId, { generatedDocs: newDocs });
    }, [activeConversation, activeConversationId]);

    const handleFeedbackUpdate = useCallback((messageId: string, feedbackData: { rating: 'up' | 'down' | null; comment?: string }) => {
        if (!activeConversationId) return;

        const updatedMessages = activeConversation?.messages.map(m => {
            if (m.id === messageId) {
                return {
                    ...m,
                    feedback: {
                        ...(m.feedback || { rating: null }),
                        ...feedbackData
                    }
                };
            }
            return m;
        });

        if (updatedMessages) {
            updateConversationInDb(activeConversationId, { messages: updatedMessages });
        }
        setNotification("Geri bildiriminiz için teşekkürler!");

    }, [activeConversation]);
    
    const canPerformActions = useMemo(() => activeConversation && activeConversation.messages.length > 0, [activeConversation]);

    return (
        <div className="flex h-screen font-sans bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Sidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
                onUpdateConversationTitle={handleUpdateConversationTitle}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
            <main className="flex-1 flex flex-col overflow-hidden">
                 {!isSupabaseConfigured && (
                    <div className="p-3 bg-yellow-50 border-b border-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-700 dark:text-yellow-300 text-sm font-semibold text-center z-30">
                        <strong>Uyarı:</strong> Supabase ayarları yapılmamış. Uygulama düzgün çalışmayacaktır. Lütfen Geliştirici Panelini açıp (klavyeden 'devmode' yazın) bilgilerinizi girin.
                    </div>
                )}
                <header className="flex-shrink-0 bg-white dark:bg-slate-800 shadow-sm p-2 flex items-center justify-between h-16 border-b border-slate-200 dark:border-slate-700 z-20">
                     <div className="flex items-center">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none">
                            <svg className="w-6 h-6 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                        </button>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200 ml-2">AI İş Analisti Asistanı</h1>
                    </div>
                     <div className="flex items-center gap-4 mr-4">
                        <ThemeSwitcher theme={theme} onThemeChange={handleThemeChange} />
                        <span className="text-sm text-slate-600 dark:text-slate-400 hidden sm:block">{user.email}</span>
                        <button onClick={onLogout} className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-sky-500 transition">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                               <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                           </svg>
                           <span>Çıkış Yap</span>
                        </button>
                    </div>
                </header>

                {notification && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-fade-in-up">
                        <div className="bg-sky-50 border border-sky-500 text-sky-800 dark:bg-sky-900/50 dark:border-sky-700 dark:text-sky-200 px-4 py-3 rounded-lg shadow-lg flex items-center" role="alert">
                            <span className="block sm:inline flex-1">{notification}</span>
                            <button onClick={() => setNotification(null)} className="ml-4">
                                <svg className="fill-current h-6 w-6 text-sky-600 dark:text-sky-400" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Kapat</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                            </button>
                        </div>
                    </div>
                )}
                
                {error && (
                     <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300 text-sm">
                        <strong>Hata:</strong> {error}
                    </div>
                )}

                 <div className="flex-1 flex flex-col min-h-0">
                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto">
                        {!activeConversation ? (
                             <div className="flex flex-col justify-center items-center p-4 text-center h-full">
                                 <div className="max-w-2xl mx-auto">
                                     <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">AI İş Analisti Asistanına Hoş Geldiniz</h2>
                                     <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                                         Fikirlerinizi ve taleplerinizi netleştirmek, analiz dokümanları oluşturmak ve test senaryoları üretmek için buradayım. Yeni bir analize başlamak için sol menüyü kullanın veya aşağıdaki mesaj kutusuna yazmaya başlayın.
                                     </p>
                                    <div className="mt-8 w-full">
                                        <PromptSuggestions onSelectPrompt={handleSendMessage} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 md:p-6">
                                    <div className="max-w-4xl mx-auto w-full">
                                        <ChatMessageHistory 
                                            chatHistory={activeConversation.messages} 
                                            isLoading={isLoading}
                                            onFeedbackUpdate={handleFeedbackUpdate}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-6 bg-slate-200/50 dark:bg-slate-900/50">
                                    {(activeConversation.generatedDocs.visualization || activeConversation.generatedDocs.analysisDoc) && (
                                        <div className="p-4 md:p-6 pt-0 space-y-6">
                                             {activeConversation.generatedDocs.visualization && (
                                                <div ref={visualizationRef} className="max-w-4xl mx-auto w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 animate-fade-in-up">
                                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                                        <h3 className="text-md font-bold">Özet Görselleştirme</h3>
                                                        <ExportDropdown content={activeConversation.generatedDocs.visualization} filename={`${activeConversation.title}-visualization`} isVisualization />
                                                    </div>
                                                    <Visualizations content={activeConversation.generatedDocs.visualization} />
                                                </div>
                                            )}
                                            {activeConversation.generatedDocs.analysisDoc && (
                                                <div ref={analysisDocRef} className="max-w-4xl mx-auto w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 animate-fade-in-up">
                                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                                        <h3 className="text-md font-bold">Analiz Dokümanı</h3>
                                                        <div className="flex items-center gap-4">
                                                            <TemplateSelector 
                                                                label="Şablon"
                                                                templates={ANALYSIS_TEMPLATES}
                                                                selectedValue={selectedAnalysisTemplateId}
                                                                onChange={(e) => setSelectedAnalysisTemplateId(e.target.value)}
                                                                disabled={isLoading}
                                                            />
                                                            <ExportDropdown content={activeConversation.generatedDocs.analysisDoc} filename={`${activeConversation.title}-analiz`} />
                                                        </div>
                                                    </div>
                                                    <GeneratedDocument
                                                        content={activeConversation.generatedDocs.analysisDoc}
                                                        onContentChange={(newContent) => handleDocumentUpdate('analysisDoc', newContent)}
                                                    />
                                                </div>
                                            )}
                                             {activeConversation.generatedDocs.analysisDoc && (
                                                <div ref={testScenariosRef} className="max-w-4xl mx-auto w-full bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 animate-fade-in-up">
                                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                                        <h3 className="text-md font-bold">Test Senaryoları</h3>
                                                         <div className="flex items-center gap-4">
                                                            <TemplateSelector 
                                                                label="Şablon"
                                                                templates={TEST_SCENARIO_TEMPLATES}
                                                                selectedValue={selectedTestTemplateId}
                                                                onChange={(e) => setSelectedTestTemplateId(e.target.value)}
                                                                disabled={isLoading}
                                                            />
                                                            <ExportDropdown content={activeConversation.generatedDocs.testScenarios} filename={`${activeConversation.title}-test-senaryolari`} isTable />
                                                        </div>
                                                    </div>
                                                     {!activeConversation.generatedDocs.testScenarios ? (
                                                        <div className="p-6 text-center">
                                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Analiz dokümanından test senaryoları oluşturun.</p>
                                                            <button 
                                                                onClick={handleGenerateTestScenarios} 
                                                                disabled={isLoading} 
                                                                className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center"
                                                            >
                                                                {runningAction === 'test-scenarios' ? (
                                                                    <>
                                                                        <ActionSpinner />
                                                                        <span>Oluşturuluyor...</span>
                                                                    </>
                                                                ) : (
                                                                    <span>AI ile Oluştur/Güncelle</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <GeneratedDocument
                                                            content={activeConversation.generatedDocs.testScenarios}
                                                            onContentChange={(newContent) => handleDocumentUpdate('testScenarios', newContent)}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                     )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Fixed Bottom Input Area */}
                    <div ref={bottomOfChatRef} className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
                        <div className="max-w-4xl mx-auto w-full space-y-4">
                             {maturityReport && activeConversationId && (
                                <MaturityCheckReport 
                                    report={maturityReport}
                                    onSendQuestion={handleSendSuggestedQuestion}
                                    onClose={() => setMaturityReport(null)}
                                />
                            )}
                            
                            {canPerformActions && !maturityReport && activeConversationId && (
                                <div ref={actionPanelRef} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-md animate-fade-in-up">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aksiyonlar:</div>
                                        <div className="flex items-center gap-2 flex-wrap justify-center">
                                            <button onClick={handleGenerateVisualization} disabled={isLoading} className="flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-100 rounded-md hover:bg-sky-200 disabled:opacity-50 dark:bg-sky-900/50 dark:text-sky-200 dark:hover:bg-sky-900">
                                                 {runningAction === 'visualize' ? <><ActionSpinner /><span>Oluşturuluyor...</span></> : <span>Görselleştir</span>}
                                            </button>
                                            <button onClick={handleMaturityCheck} disabled={isLoading} className="flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-900">
                                                {runningAction === 'maturity' ? <><ActionSpinner /><span>Kontrol Ediliyor...</span></> : <span>Olgunluk Kontrolü</span>}
                                            </button>
                                            <button onClick={handleGenerateDocument} disabled={isLoading} className="flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-md hover:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-900/50 dark:text-emerald-200 dark:hover:bg-emerald-900">
                                                {runningAction === 'document' ? <><ActionSpinner /><span>Oluşturuluyor...</span></> : <span>Analiz Dokümanı Oluştur</span>}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <ChatInterface 
                                isLoading={isLoading}
                                onSendMessage={handleSendMessage}
                                activeConversationId={activeConversationId}
                            />
                        </div>
                    </div>
                </div>

                {isDevMode && (
                    <DeveloperPanel 
                        apiKey={devApiKey}
                        onApiKeyChange={setDevApiKey}
                        modelName={devModelName}
                        onModelNameChange={setDevModelName}
                        supabaseUrl={devSupabaseUrl}
                        onSupabaseUrlChange={setDevSupabaseUrl}
                        supabaseAnonKey={devSupabaseAnonKey}
                        onSupabaseAnonKeyChange={setDevSupabaseAnonKey}
                        onClose={() => setIsDevMode(false)}
                    />
                )}
            </main>
        </div>
    );
};

export default App;