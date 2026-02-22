
// layouts/MainAppLayout.tsx
import React, { useMemo, useEffect, useState, useRef, Suspense } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { ChatInterface } from '../components/ChatInterface';
import { ChatMessageHistory } from '../components/ChatMessageHistory';
import { PromptSuggestions } from '../components/PromptSuggestions';
import { DocumentWorkspace } from '../components/DocumentWorkspace';
import { ProjectBoard } from '../components/ProjectBoard';
import { ChatbotWidget } from '../components/ChatbotWidget';
import { FileText, GanttChartSquare, Beaker, PlusSquare, Search, Sparkles, PanelRightClose, PanelRightOpen, PanelLeft } from 'lucide-react';
import { MainSidebar } from './MainSidebar';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Toast } from '../components/Toast';

// Lazy load modals
const ShareModal = React.lazy(() => import('../components/ShareModal').then(m => ({ default: m.ShareModal })));
const FeatureSuggestionsModal = React.lazy(() => import('../components/FeatureSuggestionsModal').then(m => ({ default: m.FeatureSuggestionsModal })));
const RegenerateConfirmationModal = React.lazy(() => import('../components/RegenerateConfirmationModal').then(m => ({ default: m.RegenerateConfirmationModal })));
const DeveloperPanel = React.lazy(() => import('../components/DeveloperPanel').then(m => ({ default: m.DeveloperPanel })));
const FeedbackDashboard = React.lazy(() => import('../components/FeedbackDashboard').then(m => ({ default: m.FeedbackDashboard })));
const UpgradeModal = React.lazy(() => import('../components/UpgradeModal').then(m => ({ default: m.UpgradeModal })));
const LongTextModal = React.lazy(() => import('../components/LongTextModal').then(m => ({ default: m.LongTextModal })));
const ResetConfirmationModal = React.lazy(() => import('../components/ResetConfirmationModal').then(m => ({ default: m.ResetConfirmationModal })));


const AnalystWorkspace = () => {
    const context = useAppContext();
    const { activeConversation, isWorkspaceVisible, fontSize } = context;
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Font scaling classes
    const fontClasses = {
        small: 'text-sm',
        medium: 'text-base',
        large: 'text-lg',
    };

    const nextBestAction = useNextBestAction(activeConversation, {
        onGenerateDoc: context.handleGenerateDoc,
        onNavigateToBacklogGeneration: () => context.setActiveDocTab('backlog-generation'),
        onSendMessage: context.sendMessage,
        onEvaluateDocument: context.handleEvaluateDocument
    });

    const handleLongTextPaste = (content: string) => {
        context.setLongTextPrompt({
            content: content,
            callback: (choice: 'analyze' | 'save') => {
                const saveAsAnalysisDoc = async (isNew: boolean) => {
                    let convId = context.activeConversationId;
                    if (isNew || !convId) {
                        const result = await context.handleNewConversation();
                        convId = result?.newConvId ?? null;
                        if (convId) {
                            context.updateConversationTitle(convId, 'Yeni Yapıştırılan Doküman');
                        }
                    }
                    if (convId) {
                        context.saveDocumentVersion('analysisDoc', content, 'Doküman olarak kaydedildi (yapıştırıldı)');
                        context.setActiveDocTab('analysis');
                    }
                };

                if (choice === 'analyze') {
                    context.handleNewConversation(content);
                } else if (choice === 'save') {
                    saveAsAnalysisDoc(!context.activeConversationId);
                }
                context.setLongTextPrompt(null);
            }
        });
    };

    if (!activeConversation) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 p-4">
                <FileText className="w-16 h-16 text-slate-400 mb-4" strokeWidth={1} />
                <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Hoş Geldiniz!</h3>
                <p className="mt-2 max-w-lg">
                    Başlamak için sol taraftan yeni bir analiz başlatın veya mevcut bir sohbeti seçin.
                </p>
            </div>
        );
    }
    
    const gridLayoutClass = isWorkspaceVisible ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1';

    return (
        <div className={`grid ${gridLayoutClass} h-full w-full ${fontClasses[fontSize] || 'text-base'}`}>
            <div className={`relative flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-900 ${isWorkspaceVisible ? 'lg:col-span-2' : 'col-span-1'}`}>
                 <button
                    onClick={() => context.setIsWorkspaceVisible(!context.isWorkspaceVisible)}
                    title={context.isWorkspaceVisible ? "Çalışma Alanını Gizle" : "Çalışma Alanını Göster"}
                    className="absolute top-4 right-4 z-10 p-2 rounded-md bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                >
                    {context.isWorkspaceVisible ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
                </button>
                <main ref={scrollContainerRef} className="flex-1 p-4 h-full relative">
                     <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
                         {activeConversation && activeConversation.messages.filter(m => m.role !== 'system').length > 0 ? (
                            <ChatMessageHistory
                                user={context.user}
                                chatHistory={activeConversation.messages}
                                onFeedbackUpdate={context.handleFeedbackUpdate}
                                onEditLastUserMessage={context.handleEditLastUserMessage}
                                onApplySuggestion={context.handleApplySuggestion}
                                onRetry={context.handleRetryMessage}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full pt-10">
                                <PromptSuggestions onSelectPrompt={(p) => context.sendMessage(p, null)} />
                            </div>
                        )}
                    </div>
                </main>
                 <footer className="p-4 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <div className="max-w-4xl mx-auto w-full">
                        <ChatInterface
                            isLoading={context.isProcessing && !context.generatingDocType}
                            onSendMessage={context.sendMessage}
                            activeConversationId={context.activeConversation?.id || null}
                            onStopGeneration={context.handleStopGeneration}
                            initialText={context.messageToEdit}
                            onSuggestNextFeature={context.handleSuggestNextFeature}
                            isConversationStarted={!!context.activeConversation && context.activeConversation.messages.filter(m => m.role !== 'system').length > 0}
                            nextAction={nextBestAction}
                            isDeepAnalysisMode={context.isDeepAnalysisMode}
                            onDeepAnalysisModeChange={context.handleDeepAnalysisModeChange}
                            isSearchEnabled={context.isSearchEnabled}
                            onSearchModeChange={context.setIsSearchEnabled}
                            isExpertMode={context.isExpertMode}
                            setIsExpertMode={context.setIsExpertMode}
                            onLongTextPaste={handleLongTextPaste}
                        />
                    </div>
                </footer>
            </div>

            {isWorkspaceVisible && (
                 <div className="flex lg:col-span-3 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 overflow-hidden relative">
                     <DocumentWorkspace 
                        conversation={activeConversation}
                        onUpdateConversation={context.updateConversation}
                        isProcessing={context.isProcessing}
                        generatingDocType={context.generatingDocType}
                        onUpdateDocument={context.saveDocumentVersion}
                        onModifySelection={context.handleModifySelection}
                        onModifyDiagram={context.handleModifyDiagram}
                        onGenerateDoc={context.handleGenerateDoc}
                        inlineModificationState={context.inlineModificationState}
                        templates={{ analysis: context.analysisTemplates, test: context.testTemplates, traceability: context.traceabilityTemplates }}
                        selectedTemplates={context.selectedTemplates}
                        onTemplateChange={{
                            analysis: context.handleTemplateChange('analysis'),
                            test: context.handleTemplateChange('test'),
                            traceability: context.handleTemplateChange('traceability'),
                        }}
                        activeDocTab={context.activeDocTab}
                        setActiveDocTab={context.setActiveDocTab}
                        onPrepareQuestionForAnswer={context.handlePrepareQuestionForAnswer}
                        onAddTokens={context.commitTokenUsage}
                        onRestoreVersion={context.handleRestoreVersion}
                     />
                 </div>
            )}
        </div>
    );
};

const useNextBestAction = (conversation: any, callbacks: any) => {
    if (!conversation) return { label: "Başlamak için bir mesaj gönderin", action: () => {}, icon: <Sparkles className="h-5 w-5" />, disabled: true };

    const { generatedDocs, messages } = conversation;
    const hasRealAnalysisDoc = !!generatedDocs?.analysisDoc && !!generatedDocs.analysisDoc.content && !generatedDocs.analysisDoc.content.includes("Bu bölüme projenin temel hedefini");
    const hasMessages = messages.filter((m: any) => m.role !== 'system').length > 0;

    if (hasRealAnalysisDoc && !hasMessages) {
         return { label: "Dokümanı Değerlendir ve Soru Sor", action: () => callbacks.onEvaluateDocument(), icon: <Search className="h-5 w-5" />, disabled: false, tooltip: "AI'nın mevcut dokümanı analiz etmesini ve iyileştirme için sorular sormasını sağlayın." };
    }
    
    const hasVisualization = generatedDocs?.mermaidViz?.content || generatedDocs?.bpmnViz?.content || generatedDocs?.visualization;
    const hasTestScenarios = typeof generatedDocs.testScenarios === 'object' ? !!generatedDocs.testScenarios.content : !!generatedDocs.testScenarios;

    if (hasRealAnalysisDoc && hasVisualization && hasTestScenarios) return { label: "Proje Görevleri Oluştur", action: () => callbacks.onNavigateToBacklogGeneration(), icon: <PlusSquare className="h-5 w-5" />, disabled: false };
    if (hasRealAnalysisDoc && hasVisualization && !hasTestScenarios) return { label: "Test Senaryoları Oluştur", action: () => callbacks.onGenerateDoc('test'), icon: <Beaker className="h-5 w-5" />, disabled: false };
    if (hasRealAnalysisDoc && !hasVisualization) return { label: "Süreç Akışını Görselleştir", action: () => callbacks.onGenerateDoc('viz'), icon: <GanttChartSquare className="h-5 w-5" />, disabled: false };
    if (generatedDocs?.maturityReport?.metadata?.isSufficient && !hasRealAnalysisDoc) return { label: "İş Analizi Dokümanı Oluştur", action: () => callbacks.onGenerateDoc('analysis'), icon: <FileText className="h-5 w-5" />, disabled: false };
    
    const firstQuestion = generatedDocs?.maturityReport?.metadata?.suggestedQuestions?.[0];
    if (firstQuestion) return { label: "Analizi Derinleştir", action: () => callbacks.onSendMessage(firstQuestion, false), icon: <Sparkles className="h-5 w-5" />, disabled: false, tooltip: `Öneri: "${firstQuestion}" sorusunu sorun.` };
    
    if (hasMessages) return { label: "Analizi Derinleştirmek İçin Soru Sorun", action: () => {}, icon: <Sparkles className="h-5 w-5" />, disabled: true, tooltip: "Daha fazla detay için soru sorabilir veya olgunluk kontrolü yapabilirsiniz." };
    
    return { label: "Başlamak için bir mesaj gönderin", action: () => {}, icon: <Sparkles className="h-5 w-5" />, disabled: true };
};

export const MainAppLayout: React.FC = () => {
    const context = useAppContext();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

     useEffect(() => {
        const root = window.document.documentElement;
        const isDark = context.theme === 'dark';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (context.theme === 'system') {
            root.classList.toggle('dark', prefersDark);
        } else {
            root.classList.toggle('dark', isDark);
        }
    }, [context.theme]);

    return (
        <div className="font-sans bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 h-screen flex overflow-hidden">
            {/* Toast Container */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4">
                {context.toasts.map(toast => (
                    <Toast key={toast.id} toast={toast} onClose={context.removeToast} />
                ))}
            </div>
            
            <div className={`h-full flex-shrink-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-80' : 'w-0'} overflow-hidden`}>
                <MainSidebar
                    user={context.user}
                    profile={context.userProfile}
                    theme={context.theme}
                    onThemeChange={context.setTheme}
                    onLogout={context.onLogout}
                    onOpenShareModal={() => context.setIsShareModalOpen(true)}
                />
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 relative">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    title={isSidebarOpen ? "Kenar çubuğunu gizle" : "Kenar çubuğunu göster"}
                    className="absolute top-4 left-0 z-30 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-r-lg shadow-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                >
                    {isSidebarOpen ? <PanelLeft className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
                </button>

                {context.appMode === 'analyst' && <AnalystWorkspace />}
                {context.appMode === 'backlog' && context.user && <ProjectBoard user={context.user} />}
            </div>

            <ChatbotWidget />

            <Suspense fallback={null}>
                {context.isShareModalOpen && context.activeConversation && <ShareModal isOpen={context.isShareModalOpen} onClose={() => context.setIsShareModalOpen(false)} conversation={context.activeConversation} onUpdateShareSettings={(id, updates) => context.updateConversation(id, updates)} />}
                {context.showUpgradeModal && <UpgradeModal isOpen={context.showUpgradeModal} onClose={() => context.setShowUpgradeModal(false)} />}
                {context.isFeatureSuggestionsModalOpen && <FeatureSuggestionsModal isOpen={context.isFeatureSuggestionsModalOpen} onClose={() => context.setIsFeatureSuggestionsModalOpen(false)} isLoading={context.isFetchingSuggestions} suggestions={context.featureSuggestions} onSelectSuggestion={(s) => context.sendMessage(s, null)} error={context.suggestionError} onRetry={context.handleSuggestNextFeature} />}
                {context.isRegenerateModalOpen && context.regenerateModalData.current && (
                    <RegenerateConfirmationModal isOpen={context.isRegenerateModalOpen} onClose={() => context.setIsRegenerateModalOpen(false)} onConfirm={context.handleConfirmRegenerate} documentName={context.regenerateModalData.current.docType === 'analysis' ? 'Analiz Dokümanı' : context.regenerateModalData.current.docType === 'test' ? 'Test Senaryoları' : 'İzlenebilirlik Matrisi'} templateName={(context.regenerateModalData.current.docType === 'analysis' ? context.analysisTemplates : context.regenerateModalData.current.docType === 'test' ? context.testTemplates : context.traceabilityTemplates).find(t => t.id === context.regenerateModalData.current!.newTemplateId)?.name || ''} />
                )}
                 {context.isDeveloperPanelOpen && (
                    <DeveloperPanel onClose={context.handleToggleDeveloperPanel} modelName={localStorage.getItem('geminiModel') || 'gemini-2.5-flash'} onModelNameChange={(name) => localStorage.setItem('geminiModel', name)} supabaseUrl={localStorage.getItem('supabaseUrl') || ''} onSupabaseUrlChange={(url) => localStorage.setItem('supabaseUrl', url)} supabaseAnonKey={localStorage.getItem('supabaseAnonKey') || ''} onSupabaseAnonKeyChange={(key) => localStorage.setItem('supabaseAnonKey', key)} testUserEmail={localStorage.getItem('devTestUserEmail') || ''} onTestUserEmailChange={(email) => localStorage.setItem('devTestUserEmail', email)} testUserPassword={localStorage.getItem('devTestUserPassword') || ''} onTestUserPasswordChange={(pw) => localStorage.setItem('devTestUserPassword', pw)} isFetchingFeedback={context.isFetchingFeedback} onToggleFeedbackDashboard={context.fetchAllFeedback} />
                )}
                {context.isFeedbackDashboardOpen && (
                    <FeedbackDashboard isOpen={context.isFeedbackDashboardOpen} onClose={() => context.setIsFeedbackDashboardOpen(false)} feedbackData={context.allFeedback} />
                )}
                 {context.longTextPrompt && (
                    <LongTextModal isOpen={!!context.longTextPrompt} onClose={() => context.setLongTextPrompt(null)} onSelectChoice={(choice) => { context.longTextPrompt?.callback(choice); }} />
                )}
                {context.resetConfirmation && (
                     <ResetConfirmationModal isOpen={!!context.resetConfirmation} onClose={() => context.setResetConfirmation(null)} onConfirm={context.handleConfirmReset} documentName={context.resetConfirmation.changedDocName} impactedDocs={context.resetConfirmation.impactedDocNames} />
                )}
            </Suspense>
            
            {context.confirmation && (
                <ConfirmationModal
                    isOpen={!!context.confirmation}
                    title={context.confirmation.title}
                    message={context.confirmation.message}
                    onConfirm={() => {
                        if (context.confirmation) {
                            context.confirmation.onConfirm();
                        }
                        context.setConfirmation(null);
                    }}
                    onClose={() => context.setConfirmation(null)}
                    confirmButtonText={context.confirmation.confirmButtonText}
                    cancelButtonText={context.confirmation.cancelButtonText}
                    confirmButtonVariant={context.confirmation.confirmButtonVariant}
                />
            )}
        </div>
    );
};
