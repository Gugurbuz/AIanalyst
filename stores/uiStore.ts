// stores/uiStore.ts
// FIX: Changed import to be a named import, which is the correct way to import `create` from zustand.
import { create } from 'zustand';
import type { Theme, GeneratedDocs } from '../types';

// useRef cannot be used in Zustand store, so we'll handle this differently for regenerateModalData
// A simple module-level variable is fine for this case.
let regenerateModalData: { docType: 'analysis' | 'test' | 'traceability', newTemplateId: string } | null = null;

interface UIState {
    theme: Theme;
    setTheme: (newTheme: Theme) => void;
    isConversationListOpen: boolean;
    setIsConversationListOpen: (isOpen: boolean) => void;
    isShareModalOpen: boolean;
    setIsShareModalOpen: (isOpen: boolean) => void;
    showUpgradeModal: boolean;
    setShowUpgradeModal: (show: boolean) => void;
    isFeatureSuggestionsModalOpen: boolean;
    setIsFeatureSuggestionsModalOpen: (isOpen: boolean) => void;
    featureSuggestions: string[];
    setFeatureSuggestions: (suggestions: string[]) => void;
    isFetchingSuggestions: boolean;
    setIsFetchingSuggestions: (isFetching: boolean) => void;
    suggestionError: string | null;
    setSuggestionError: (error: string | null) => void;
    isRegenerateModalOpen: boolean;
    setIsRegenerateModalOpen: (isOpen: boolean) => void;
    getRegenerateModalData: () => typeof regenerateModalData,
    setRegenerateModalData: (data: typeof regenerateModalData) => void;
    activeDocTab: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation';
    setActiveDocTab: (tab: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation') => void;
    isDeveloperPanelOpen: boolean;
    handleToggleDeveloperPanel: () => void;
    isFeedbackDashboardOpen: boolean;
    setIsFeedbackDashboardOpen: (isOpen: boolean) => void;
    isDeepAnalysisMode: boolean;
    setIsDeepAnalysisMode: (isOn: boolean) => void;
    isExpertMode: boolean;
    setIsExpertMode: (isOn: boolean) => void;
    diagramType: 'mermaid' | 'bpmn';
    setDiagramType: (type: 'mermaid' | 'bpmn') => void;
    longTextPrompt: { content: string; callback: (choice: 'analyze' | 'save') => void } | null;
    setLongTextPrompt: (prompt: { content: string; callback: (choice: 'analyze' | 'save') => void } | null) => void;
    resetConfirmation: { changedDocKey: keyof GeneratedDocs; changedDocName: string; impactedDocNames: string[] } | null;
    setResetConfirmation: (confirmation: { changedDocKey: keyof GeneratedDocs; changedDocName: string; impactedDocNames: string[] } | null) => void;
    error: string | null;
    setError: (message: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
    theme: (localStorage.getItem('theme') as Theme) || 'light',
    setTheme: (newTheme) => {
        set({ theme: newTheme });
        localStorage.setItem('theme', newTheme);
    },
    isConversationListOpen: true,
    setIsConversationListOpen: (isOpen) => set({ isConversationListOpen: isOpen }),
    isShareModalOpen: false,
    setIsShareModalOpen: (isOpen) => set({ isShareModalOpen: isOpen }),
    showUpgradeModal: false,
    setShowUpgradeModal: (show) => set({ showUpgradeModal: show }),
    isFeatureSuggestionsModalOpen: false,
    setIsFeatureSuggestionsModalOpen: (isOpen) => set({ isFeatureSuggestionsModalOpen: isOpen }),
    featureSuggestions: [],
    setFeatureSuggestions: (suggestions) => set({ featureSuggestions: suggestions }),
    isFetchingSuggestions: false,
    setIsFetchingSuggestions: (isFetching) => set({ isFetchingSuggestions: isFetching }),
    suggestionError: null,
    setSuggestionError: (error) => set({ suggestionError: error }),
    isRegenerateModalOpen: false,
    setIsRegenerateModalOpen: (isOpen) => set({ isRegenerateModalOpen: isOpen }),
    getRegenerateModalData: () => regenerateModalData,
    setRegenerateModalData: (data) => { regenerateModalData = data; },
    activeDocTab: 'analysis',
    setActiveDocTab: (tab) => set({ activeDocTab: tab }),
    isDeveloperPanelOpen: false,
    handleToggleDeveloperPanel: () => set(state => ({ isDeveloperPanelOpen: !state.isDeveloperPanelOpen })),
    isFeedbackDashboardOpen: false,
    setIsFeedbackDashboardOpen: (isOpen) => set({ isFeedbackDashboardOpen: isOpen }),
    isDeepAnalysisMode: false,
    setIsDeepAnalysisMode: (isOn) => set({ isDeepAnalysisMode: isOn }),
    isExpertMode: false,
    setIsExpertMode: (isOn) => set({ isExpertMode: isOn }),
    diagramType: 'mermaid',
    setDiagramType: (type) => set({ diagramType: type }),
    longTextPrompt: null,
    setLongTextPrompt: (prompt) => set({ longTextPrompt: prompt }),
    resetConfirmation: null,
    setResetConfirmation: (confirmation) => set({ resetConfirmation: confirmation }),
    error: null,
    setError: (message) => {
        set({ error: message });
        if (message) {
            setTimeout(() => set({ error: null }), 5000);
        }
    },
}));