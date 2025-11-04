// hooks/useUIState.ts
import { useState, useRef, useCallback } from 'react';
// FIX: Add missing import for GeneratedDocs type.
import type { Theme, GeminiModel, GeneratedDocs } from '../types';

export const useUIState = () => {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
    const [currentView, setCurrentView] = useState<'analyst' | 'backlog'>('analyst');
    const [isConversationListOpen, setIsConversationListOpen] = useState(false);
    const [isWorkspaceVisible, setIsWorkspaceVisible] = useState(true);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isFeatureSuggestionsModalOpen, setIsFeatureSuggestionsModalOpen] = useState(false);
    const [featureSuggestions, setFeatureSuggestions] = useState<string[]>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
    const regenerateModalData = useRef<{ docType: 'analysis' | 'test' | 'traceability', newTemplateId: string } | null>(null);
    const [activeDocTab, setActiveDocTab] = useState<'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation'>('analysis');
    const [isDeveloperPanelOpen, setIsDeveloperPanelOpen] = useState(false);
    const [isFeedbackDashboardOpen, setIsFeedbackDashboardOpen] = useState(false);
    const [isDeepAnalysisMode, setIsDeepAnalysisMode] = useState(false);
    const [isExpertMode, setIsExpertMode] = useState(false);
    const [diagramType, setDiagramType] = useState<'mermaid' | 'bpmn'>('mermaid');
    const [displayedMaturityScore, setDisplayedMaturityScore] = useState<{ score: number; justification: string } | null>(null);
    const maturityScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [longTextPrompt, setLongTextPrompt] = useState<{ content: string; callback: (choice: 'analyze' | 'save') => void } | null>(null);
    const [requestConfirmation, setRequestConfirmation] = useState<{ summary: string } | null>(null);
    const [resetConfirmation, setResetConfirmation] = useState<{ changedDocKey: keyof GeneratedDocs; changedDocName: string; impactedDocNames: string[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const handleToggleDeveloperPanel = useCallback(() => {
        setIsDeveloperPanelOpen(prev => !prev);
    }, []);

    // Set error with a timeout to automatically clear it
    const setDisplayError = useCallback((message: string | null) => {
        setError(message);
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        if (message) {
            errorTimerRef.current = setTimeout(() => setError(null), 5000);
        }
    }, []);

    return {
        theme,
        setTheme: handleThemeChange,
        currentView,
        setCurrentView,
        isConversationListOpen,
        setIsConversationListOpen,
        isWorkspaceVisible,
        setIsWorkspaceVisible,
        isShareModalOpen,
        setIsShareModalOpen,
        showUpgradeModal,
        setShowUpgradeModal,
        isFeatureSuggestionsModalOpen,
        setIsFeatureSuggestionsModalOpen,
        featureSuggestions,
        setFeatureSuggestions,
        isFetchingSuggestions,
        setIsFetchingSuggestions,
        suggestionError,
        setSuggestionError,
        isRegenerateModalOpen,
        setIsRegenerateModalOpen,
        regenerateModalData,
        activeDocTab,
        setActiveDocTab,
        isDeveloperPanelOpen,
        setIsDeveloperPanelOpen,
        isFeedbackDashboardOpen,
        setIsFeedbackDashboardOpen,
        isDeepAnalysisMode,
        setIsDeepAnalysisMode,
        isExpertMode,
        setIsExpertMode,
        diagramType,
        setDiagramType,
        displayedMaturityScore,
        setDisplayedMaturityScore,
        maturityScoreTimerRef,
        longTextPrompt,
        setLongTextPrompt,
        requestConfirmation,
        setRequestConfirmation,
        resetConfirmation,
        setResetConfirmation,
        error,
        setError: setDisplayError,
        handleToggleDeveloperPanel,
    };
};
