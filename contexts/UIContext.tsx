
import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import type { Theme, GeneratedDocs, FontSize } from '../types';
import { v4 as uuidv4 } from 'uuid';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface UIContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
    appMode: 'analyst' | 'backlog';
    setAppMode: (mode: 'analyst' | 'backlog') => void;
    isConversationListOpen: boolean;
    setIsConversationListOpen: (isOpen: boolean) => void;
    isWorkspaceVisible: boolean;
    setIsWorkspaceVisible: (isVisible: boolean) => void;
    isNewAnalysisModalOpen: boolean;
    setIsNewAnalysisModalOpen: (isOpen: boolean) => void;
    isShareModalOpen: boolean;
    setIsShareModalOpen: (isOpen: boolean) => void;
    showUpgradeModal: boolean;
    setShowUpgradeModal: (isOpen: boolean) => void;
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
    regenerateModalData: React.MutableRefObject<{ docType: 'analysis' | 'test' | 'traceability', newTemplateId: string } | null>;
    activeDocTab: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation';
    setActiveDocTab: (tab: 'request' | 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | 'backlog-generation') => void;
    isDeveloperPanelOpen: boolean;
    setIsDeveloperPanelOpen: (isOpen: boolean) => void;
    isFeedbackDashboardOpen: boolean;
    setIsFeedbackDashboardOpen: (isOpen: boolean) => void;
    isDeepAnalysisMode: boolean;
    setIsDeepAnalysisMode: (isOn: boolean) => void;
    isSearchEnabled: boolean;
    setIsSearchEnabled: (isOn: boolean) => void;
    isExpertMode: boolean;
    setIsExpertMode: (isOn: boolean) => void;
    longTextPrompt: { content: string; callback: (choice: 'analyze' | 'save') => void } | null;
    setLongTextPrompt: (prompt: { content: string; callback: (choice: 'analyze' | 'save') => void } | null) => void;
    resetConfirmation: { changedDocKey: keyof GeneratedDocs; changedDocName: string; impactedDocNames: string[] } | null;
    setResetConfirmation: (confirmation: { changedDocKey: keyof GeneratedDocs; changedDocName: string; impactedDocNames: string[] } | null) => void;
    error: string | null;
    setError: (error: string | null) => void; // Deprecated but kept for compat, maps to addToast
    handleToggleDeveloperPanel: () => void;
    confirmation: { title: string; message: string; onConfirm: () => void; confirmButtonText?: string; cancelButtonText?: string; confirmButtonVariant?: 'danger' | 'primary' } | null;
    setConfirmation: (conf: { title: string; message: string; onConfirm: () => void; confirmButtonText?: string; cancelButtonText?: string; confirmButtonVariant?: 'danger' | 'primary' } | null) => void;
    
    // Toast System
    toasts: Toast[];
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}

const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
    const [fontSize, setFontSizeState] = useState<FontSize>(() => (localStorage.getItem('fontSize') as FontSize) || 'medium');
    const [appMode, setAppMode] = useState<'analyst' | 'backlog'>('analyst');
    const [isConversationListOpen, setIsConversationListOpen] = useState(true);
    const [isWorkspaceVisible, setIsWorkspaceVisible] = useState(true);
    const [isNewAnalysisModalOpen, setIsNewAnalysisModalOpen] = useState(false);
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
    const [isSearchEnabled, setIsSearchEnabled] = useState(false);
    const [isExpertMode, setIsExpertMode] = useState(false);
    const [longTextPrompt, setLongTextPrompt] = useState<{ content: string; callback: (choice: 'analyze' | 'save') => void } | null>(null);
    const [resetConfirmation, setResetConfirmation] = useState<{ changedDocKey: keyof GeneratedDocs; changedDocName: string; impactedDocNames: string[] } | null>(null);
    const [confirmation, setConfirmation] = useState<{ title: string; message: string; onConfirm: () => void; confirmButtonText?: string; cancelButtonText?: string; confirmButtonVariant?: 'danger' | 'primary' } | null>(null);
    
    // Toast State
    const [toasts, setToasts] = useState<Toast[]>([]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const setFontSize = (newSize: FontSize) => {
        setFontSizeState(newSize);
        localStorage.setItem('fontSize', newSize);
    };

    const handleToggleDeveloperPanel = useCallback(() => {
        setIsDeveloperPanelOpen(prev => !prev);
    }, []);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration = 5000) => {
        const id = uuidv4();
        setToasts(prev => [...prev, { id, message, type, duration }]);
        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Backward compatibility for setError
    const setError = useCallback((message: string | null) => {
        if (message) {
            addToast(message, 'error');
        }
    }, [addToast]);

    return (
        <UIContext.Provider value={{
            theme, setTheme, fontSize, setFontSize, appMode, setAppMode,
            isConversationListOpen, setIsConversationListOpen,
            isWorkspaceVisible, setIsWorkspaceVisible,
            isNewAnalysisModalOpen, setIsNewAnalysisModalOpen,
            isShareModalOpen, setIsShareModalOpen,
            showUpgradeModal, setShowUpgradeModal,
            isFeatureSuggestionsModalOpen, setIsFeatureSuggestionsModalOpen,
            featureSuggestions, setFeatureSuggestions,
            isFetchingSuggestions, setIsFetchingSuggestions,
            suggestionError, setSuggestionError,
            isRegenerateModalOpen, setIsRegenerateModalOpen,
            regenerateModalData, activeDocTab, setActiveDocTab,
            isDeveloperPanelOpen, setIsDeveloperPanelOpen,
            isFeedbackDashboardOpen, setIsFeedbackDashboardOpen,
            isDeepAnalysisMode, setIsDeepAnalysisMode,
            isSearchEnabled, setIsSearchEnabled,
            isExpertMode, setIsExpertMode,
            longTextPrompt, setLongTextPrompt,
            resetConfirmation, setResetConfirmation,
            error: null, // Deprecated prop, always null
            setError, 
            handleToggleDeveloperPanel,
            confirmation, setConfirmation,
            toasts, addToast, removeToast
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUIContext = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUIContext must be used within a UIProvider');
    return context;
};
