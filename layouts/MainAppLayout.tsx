// layouts/MainAppLayout.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { ChatInterface } from '../components/ChatInterface';
import { ChatMessageHistory } from '../components/ChatMessageHistory';
import { PromptSuggestions } from '../components/PromptSuggestions';
import { ShareModal } from '../components/ShareModal';
import { ProjectBoard } from '../components/ProjectBoard';
import { DocumentWorkspace } from '../components/DocumentWorkspace';
import { NewAnalysisModal } from '../components/NewAnalysisModal';
import { FeatureSuggestionsModal } from '../components/FeatureSuggestionsModal';
import { RegenerateConfirmationModal } from '../components/RegenerateConfirmationModal';
import { DeveloperPanel } from '../components/DeveloperPanel';
import { FeedbackDashboard } from '../components/FeedbackDashboard';
import { UpgradeModal } from '../components/UpgradeModal';
import { AlertTriangle, FileText, GanttChartSquare, Beaker, PlusSquare, Search, Sparkles, X } from 'lucide-react';
import type { Conversation, GeneratedDocs } from '../types';

// --- Icons for the new smart button ---
const NextActionIcons = {
    DEEPEN: <Sparkles className="h-5 w-5" />,
    CREATE_ANALYSIS: <FileText className="h-5 w-5" />,
    CREATE_VIZ: <GanttChartSquare className="h-5 w-5" />,
    CREATE_TESTS: <Beaker className="h-5 w-5" />,
    CREATE_TASKS: <PlusSquare className="h-5 w-5" />,
    EVALUATE_DOC: <Search className="h-5 w-5" />,
};

const useNextBestAction = (
    conversation: (Conversation & { generatedDocs: GeneratedDocs }) | null,
    callbacks: {
        onGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => void;
        onNavigateToBacklogGeneration: () => void;
        onSendMessage: (content: string, isSystemMessage?: boolean) => void;
        onEvaluateDocument: () => void;
    }
) => {
    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;

    return useMemo(() => {
        if (!conversation) {
            return {
                label: "Başlamak için bir mesaj gönderin",
                action: () => {},
                icon: NextActionIcons.DEEPEN,
                disabled: true
            };
        }

        const { generatedDocs, messages } = conversation;
        const hasRealAnalysisDoc = !!generatedDocs?.analysisDoc && !generatedDocs.analysisDoc.includes("Bu bölüme projenin temel hedefini");
        const hasMessages = messages.filter(m => m.role !== 'system').length > 0;

        if (hasRealAnalysisDoc && !hasMessages) {
             return {
                label: "Dokümanı Değerlendir ve Soru Sor",
                action: () => callbacksRef.current.onEvaluateDocument(),
                icon: NextActionIcons.EVALUATE_DOC,
                disabled: false,
                tooltip: "AI'nın mevcut dokümanı analiz etmesini ve iyileştirme için sorular sormasını sağlayın."
            };
        }
        
        const hasVisualization = generatedDocs?.mermaidViz?.code || generatedDocs?.bpmnViz?.code || generatedDocs?.visualization;
        
        const hasTestScenarios = typeof generatedDocs.testScenarios === 'object' 
            ? !!generatedDocs.testScenarios.content 
            : !!generatedDocs.testScenarios;

        if (hasRealAnalysisDoc && hasVisualization && hasTestScenarios) {
            return {
                label: "Proje Görevleri Oluştur",
                action: () => callbacksRef.current.onNavigateToBacklogGeneration(),
                icon: NextActionIcons.CREATE_TASKS,
                disabled: false
            };
        }
        if (hasRealAnalysisDoc && hasVisualization && !hasTestScenarios) {
             return {
                label: "Test Senaryoları Oluştur",
                action: () => callbacksRef.current.onGenerateDoc('test'),
                icon: NextActionIcons.CREATE_TESTS,
                disabled: false
            };
        }
        if (hasRealAnalysisDoc && !hasVisualization) {
            return {
                label: "Süreç Akışını Görselleştir",
                action: () => callbacksRef.current.onGenerateDoc('viz'),
                icon: NextActionIcons.CREATE_VIZ,
                disabled: false
            };
        }
        if (generatedDocs?.maturityReport?.isSufficient && !hasRealAnalysisDoc) {
             return {
                label: "İş Analizi Dokümanı Oluştur",
                action: () => callbacksRef.current.onGenerateDoc('analysis'),
                icon: NextActionIcons.CREATE_ANALYSIS,
                disabled: false
            };
        }
        const firstQuestion = generatedDocs?.maturityReport?.suggestedQuestions?.[0];
        if (firstQuestion) {
             return {
                label: "Analizi Derinleştir",
                action: () => callbacksRef.current.onSendMessage(firstQuestion, false),
                icon: NextActionIcons.DEEPEN,
                disabled: false,
                tooltip: `Öneri: "${firstQuestion}" sorusunu sorun.`
            };
        }
        if (hasMessages) {
            return {
                label: "Analizi Derinleştirmek İçin Soru Sorun",
                action: () => {},
                icon: NextActionIcons.DEEPEN,
                disabled: true,
                tooltip: "Daha fazla detay için soru sorabilir veya olgunluk kontrolü yapabilirsiniz."
            };
        }

        return {
            label: "Başlamak için bir mesaj gönderin",
            action: () => {},
            icon: NextActionIcons.DEEPEN,
            disabled: true
        };
    }, [conversation]);
};

interface AnalystViewProps {
    nextBestAction: ReturnType<typeof useNextBestAction>;
}

const AnalystView: React.FC<AnalystViewProps> = ({ nextBestAction }) => {
    const {
        activeConversation,
        user,
        isProcessing,
        generatingDocType,
        sendMessage,
        handleFeedbackUpdate,
        handleEditLastUserMessage,
        handleStopGeneration,
        messageToEdit,
        handleSuggestNextFeature,
        isDeepAnalysisMode,
        handleDeepAnalysisModeChange,
        handleApplySuggestion,
    } = useAppContext();
    const scrollContainerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [activeConversation?.messages]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <main ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
                 <div className="max-w-4xl mx-auto w-full px-4 pt-4">
                    {activeConversation && activeConversation.messages.filter(m => m.role !== 'system').length > 0 ? (
                        <ChatMessageHistory
                            user={user}
                            chatHistory={activeConversation.messages}
                            onFeedbackUpdate={handleFeedbackUpdate}
                            onEditLastUserMessage={handleEditLastUserMessage}
                            onApplySuggestion={handleApplySuggestion}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full pt-10">
                            <PromptSuggestions onSelectPrompt={(p) => sendMessage(p)} />
                        </div>
                    )}
                 </div>
            </main>
            <footer className="p-4 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                <div className="max-w-4xl mx-auto w-full">
                    <ChatInterface
                        isLoading={isProcessing && !generatingDocType}
                        onSendMessage={sendMessage}
                        activeConversationId={activeConversation?.id || null}
                        onStopGeneration={handleStopGeneration}
                        initialText={messageToEdit}
                        isDeepAnalysisMode={isDeepAnalysisMode}
                        onDeepAnalysisModeChange={handleDeepAnalysisModeChange}
                        onSuggestNextFeature={handleSuggestNextFeature}
                        isConversationStarted={!!activeConversation && activeConversation.messages.filter(m => m.role !== 'system').length > 0}
                        nextAction={nextBestAction}
                    />
                </div>
            </footer>
        </div>
    );
}

export const MainAppLayout: React.FC = () => {
    const context = useAppContext();
    const {
        user,
        userProfile,
        conversations,
        activeConversationId,
        activeConversation,
        isProcessing,
        generatingDocType,
        error,
        theme,
        appMode,
        isSidebarOpen,
        isWorkspaceVisible,
        isNewAnalysisModalOpen,
        isShareModalOpen,
        showUpgradeModal,
        isFeatureSuggestionsModalOpen,
        // FIX: Destructure the setter for the feature suggestions modal.
        setIsFeatureSuggestionsModalOpen,
        featureSuggestions,
        isFetchingSuggestions,
        suggestionError,
        isRegenerateModalOpen,
        regenerateModalData,
        activeDocTab,
        isDeveloperPanelOpen,
        isFeedbackDashboardOpen,
        allFeedback,
        isFetchingFeedback,
        inlineModificationState,
        saveStatus,
        diagramType,
        selectedTemplates,
        displayedMaturityScore,
        analysisTemplates,
        testTemplates,
        traceabilityTemplates,
        onLogout,
        setActiveConversationId,
        setError,
        handleThemeChange,
        setAppMode,
        setIsSidebarOpen,
        setIsWorkspaceVisible,
        setIsNewAnalysisModalOpen,
        setIsShareModalOpen,
        setShowUpgradeModal,
        setActiveDocTab,
        handleToggleDeveloperPanel,
        handleToggleFeedbackDashboard,
        handleNewConversation,
        handleStartFromScratch,
        handleStartWithDocument,
        updateConversationTitle,
        deleteConversation,
        updateConversation,
        sendMessage,
        handleGenerateDoc,
        handleEvaluateDocument,
        handleModifySelection,
        handleModifyDiagram,
        handleSuggestNextFeature,
        handleTemplateChange,
        handleConfirmRegenerate,
        handleRestoreVersion,
        commitTokenUsage,
    } = context;

    const nextBestAction = useNextBestAction(activeConversation, { 
        onGenerateDoc: handleGenerateDoc, 
        onNavigateToBacklogGeneration: () => setActiveDocTab('backlog-generation'), 
        onSendMessage: sendMessage, 
        onEvaluateDocument: handleEvaluateDocument
    });

    return (
        <div className="font-sans bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 h-screen flex flex-col overflow-hidden">
             {error && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 error-banner-enter dark:bg-red-900/80 dark:text-red-200 dark:border-red-600">
                    <AlertTriangle className="h-5 w-5"/>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-4 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800">
                        <X className="h-4 w-4"/>
                    </button>
                </div>
            )}
            <Header
                user={user}
                onLogout={onLogout}
                theme={theme}
                onThemeChange={handleThemeChange}
                appMode={appMode}
                onAppModeChange={setAppMode}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                onOpenShareModal={() => setIsShareModalOpen(true)}
                isWorkspaceVisible={appMode === 'analyst' ? isWorkspaceVisible : false}
                onToggleWorkspace={() => setIsWorkspaceVisible(!isWorkspaceVisible)}
                saveStatus={saveStatus}
                maturityScore={displayedMaturityScore}
                isProcessing={isProcessing}
                onToggleDeveloperPanel={handleToggleDeveloperPanel}
                userProfile={userProfile}
            />
            <div className="flex-1 flex min-h-0 relative">
                <Sidebar
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onSelectConversation={setActiveConversationId}
                    onNewConversation={handleNewConversation}
                    onUpdateConversationTitle={updateConversationTitle}
                    onDeleteConversation={deleteConversation}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                />
                <div className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-72' : 'ml-0'}`}>
                    {appMode === 'analyst' ? (
                        <div className="flex-1 flex flex-row min-h-0">
                            <div className={`flex flex-col border-r border-slate-200 dark:border-slate-700 ${isWorkspaceVisible ? 'w-full lg:w-1/3' : 'w-full'}`}>
                                 <AnalystView 
                                    nextBestAction={nextBestAction}
                                 />
                             </div>
                             {isWorkspaceVisible && activeConversation && (
                                 <div className="flex-1 h-full bg-white dark:bg-slate-800 hidden lg:flex">
                                     <DocumentWorkspace 
                                        conversation={{...activeConversation, generatedDocs: activeConversation.generatedDocs}}
                                        isProcessing={isProcessing}
                                        generatingDocType={generatingDocType}
                                        onUpdateDocument={context.saveDocumentVersion}
                                        onModifySelection={handleModifySelection}
                                        onModifyDiagram={handleModifyDiagram}
                                        onGenerateDoc={handleGenerateDoc}
                                        inlineModificationState={inlineModificationState}
                                        templates={{ analysis: analysisTemplates, test: testTemplates, traceability: traceabilityTemplates }}
                                        selectedTemplates={selectedTemplates}
                                        onTemplateChange={{
                                            analysis: handleTemplateChange('analysis'),
                                            test: handleTemplateChange('test'),
                                            traceability: handleTemplateChange('traceability'),
                                        }}
                                        activeDocTab={activeDocTab}
                                        setActiveDocTab={setActiveDocTab}
                                        onPrepareQuestionForAnswer={context.handlePrepareQuestionForAnswer}
                                        diagramType={diagramType}
                                        setDiagramType={context.setDiagramType}
                                        onAddTokens={commitTokenUsage}
                                        onRestoreVersion={handleRestoreVersion}
                                     />
                                 </div>
                             )}
                        </div>
                    ) : (
                        <ProjectBoard user={user} />
                    )}
                </div>
            </div>
            {isNewAnalysisModalOpen && <NewAnalysisModal isOpen={isNewAnalysisModalOpen} onClose={() => setIsNewAnalysisModalOpen(false)} onStartFromScratch={handleStartFromScratch} onStartWithDocument={handleStartWithDocument} isProcessing={isProcessing} />}
            {isShareModalOpen && activeConversation && <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} conversation={activeConversation} onUpdateShareSettings={(id, updates) => updateConversation(id, updates)} />}
            {showUpgradeModal && <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />}
            {isFeatureSuggestionsModalOpen && <FeatureSuggestionsModal isOpen={isFeatureSuggestionsModalOpen} onClose={() => setIsFeatureSuggestionsModalOpen(false)} isLoading={isFetchingSuggestions} suggestions={featureSuggestions} onSelectSuggestion={(s) => sendMessage(s)} error={suggestionError} onRetry={handleSuggestNextFeature} />}
            {isRegenerateModalOpen && regenerateModalData.current && (
                <RegenerateConfirmationModal 
                    isOpen={isRegenerateModalOpen}
                    onClose={() => setIsRegenerateModalOpen(false)}
                    onConfirm={handleConfirmRegenerate}
                    documentName={regenerateModalData.current.docType === 'analysis' ? 'Analiz Dokümanı' : regenerateModalData.current.docType === 'test' ? 'Test Senaryoları' : 'İzlenebilirlik Matrisi'}
                    templateName={(regenerateModalData.current.docType === 'analysis' ? analysisTemplates : regenerateModalData.current.docType === 'test' ? testTemplates : traceabilityTemplates).find(t => t.id === regenerateModalData.current!.newTemplateId)?.name || ''}
                />
            )}
             {isDeveloperPanelOpen && (
                <DeveloperPanel
                    onClose={handleToggleDeveloperPanel}
                    modelName={localStorage.getItem('geminiModel') || 'gemini-2.5-flash'}
                    onModelNameChange={(name) => localStorage.setItem('geminiModel', name)}
                    supabaseUrl={localStorage.getItem('supabaseUrl') || ''}
                    onSupabaseUrlChange={(url) => localStorage.setItem('supabaseUrl', url)}
                    supabaseAnonKey={localStorage.getItem('supabaseAnonKey') || ''}
                    onSupabaseAnonKeyChange={(key) => localStorage.setItem('supabaseAnonKey', key)}
                    testUserEmail={localStorage.getItem('devTestUserEmail') || ''}
                    onTestUserEmailChange={(email) => localStorage.setItem('devTestUserEmail', email)}
                    testUserPassword={localStorage.getItem('devTestUserPassword') || ''}
                    onTestUserPasswordChange={(pw) => localStorage.setItem('devTestUserPassword', pw)}
                    isFetchingFeedback={isFetchingFeedback}
                    onToggleFeedbackDashboard={handleToggleFeedbackDashboard}
                />
            )}
            {isFeedbackDashboardOpen && (
                <FeedbackDashboard
                    isOpen={isFeedbackDashboardOpen}
                    // FIX: Use the dedicated handler function to toggle the dashboard state.
                    onClose={handleToggleFeedbackDashboard}
                    feedbackData={allFeedback}
                />
            )}
        </div>
    );
};