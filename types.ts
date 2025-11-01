// types.ts
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Re-exporting Supabase user type for convenience
export type User = SupabaseUser;

export type Theme = 'light' | 'dark' | 'system';

export type AppMode = 'analyst' | 'backlog';

export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.5-flash-lite';

export interface Feedback {
    rating: 'up' | 'down' | null;
    comment?: string;
}

export interface ExpertStep {
    id: 'analysis' | 'viz' | 'test' | 'traceability';
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
    details?: string;
}

export interface GenerativeSuggestion {
    title: string;
    suggestions: string[]; // The list of suggestions from the AI
    targetSection: string; // The section of the doc to be replaced (e.g., "Hedefler")
    context: string; // The user's original command (e.g., "hedefleri genişlet")
}


export interface Message {
    id:string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string; // ISO 8601 date string
    feedback?: Feedback;
    expertRunChecklist?: ExpertStep[];
    generativeSuggestion?: GenerativeSuggestion;
}

export type MaturityLevel = 'Zayıf' | 'Gelişime Açık' | 'İyi' | 'Mükemmel';

export interface MaturityReport {
    isSufficient: boolean;
    summary: string;
    missingTopics: string[];
    suggestedQuestions: string[];
    // Replaced single score with a detailed breakdown
    scores: {
        scope: number;          // Kapsam
        technical: number;      // Teknik Detay
        userFlow: number;       // Kullanıcı Akışı
        nonFunctional: number;  // Fonksiyonel Olmayan Gereksinimler
    };
    overallScore: number; // The average/weighted score for a quick glance
    justification: string; // Puanın kısa açıklaması
    maturity_level: MaturityLevel; // Kalitatif değerlendirme
}

export interface AnalysisVersion {
    id: string;
    content: string;
    templateId: string;
    createdAt: string;
}

export interface VizData {
    code: string;
    sourceHash: string;
}

export interface GeneratedDocs {
    analysisDoc: string;
    analysisDocHistory?: AnalysisVersion[];
    testScenarios: string;
    visualization: string; // Legacy, for backward compatibility
    visualizationType?: 'mermaid' | 'bpmn'; // Legacy
    mermaidViz?: VizData;
    bpmnViz?: VizData;
    traceabilityMatrix: string;
    maturityReport?: MaturityReport | null;
    backlogSuggestions?: BacklogSuggestion[];
    // --- New flags for impact analysis ---
    isVizStale?: boolean;
    isTestStale?: boolean;
    isTraceabilityStale?: boolean;
    isBacklogStale?: boolean;
}

export interface Conversation {
    id: string;
    user_id: string;
    title: string;
    messages: Message[];
    generatedDocs: GeneratedDocs;
    is_shared: boolean;
    share_id: string | null;
    created_at: string;
}

// --- Project Board Types ---
export type TaskStatus = 'todo' | 'inprogress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'epic' | 'story' | 'test_case' | 'task';


export interface Task {
    id: string;
    user_id: string;
    conversation_id: string | null;
    parent_id: string | null;
    task_key: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    type: TaskType;
    assignee: string | null;
    created_at: string;
    // Client-side property for rendering hierarchy
    children?: Task[];
}

export interface BacklogSuggestion {
    id: string; // Temporary ID for UI key
    type: 'epic' | 'story' | 'test_case';
    title: string;
    description: string;
    priority: TaskPriority;
    children: BacklogSuggestion[];
}


// Types for prompt management
export interface Template {
    id: string;
    name: string;
    prompt: string;
}

export interface PromptVersion {
    versionId: string;
    name: string;
    prompt: string;
    createdAt: string;
}

export interface Prompt {
    id: string;
    name: string;
    description: string;
    versions: PromptVersion[];
    activeVersionId: string;
}

export interface PromptCategory {
    id: string;
    name: string;
    prompts: Prompt[];
}

export type PromptData = PromptCategory[];

// A type for the structured feedback data passed to the dashboard
export interface FeedbackItem {
    message: Message;
    conversationTitle: string;
}