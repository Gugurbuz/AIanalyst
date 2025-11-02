// types.ts
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Re-exporting Supabase user type for convenience
export type User = SupabaseUser;

export type Theme = 'light' | 'dark' | 'system';

export type AppMode = 'analyst' | 'backlog';

export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.5-flash-lite';

export type PlanID = 'free' | 'pro' | 'corporate';

export interface UserProfile {
    id: string; // Corresponds to auth.users.id
    plan: PlanID;
    token_limit: number;
    tokens_used: number;
    plan_start_date: string;
    plan_end_date: string | null;
}

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
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string; // ISO 8601 date string
    feedback?: Feedback;
    expertRunChecklist?: ExpertStep[];
    generativeSuggestion?: GenerativeSuggestion;
    thinking?: string;
    created_at: string;
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

export type DocumentType = 'analysis' | 'test' | 'traceability' | 'mermaid' | 'bpmn' | 'maturity_report';

export interface DocumentVersion {
    id: string;
    conversation_id: string;
    user_id: string;
    created_at: string;
    document_type: DocumentType;
    content: string;
    version_number: number;
    reason_for_change: string;
    template_id?: string | null;
}


export interface Document {
    id: string;
    conversation_id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    document_type: DocumentType;
    content: string;
    current_version_id: string | null;
    is_stale: boolean;
    template_id?: string | null;
}


export interface VizData {
    code: string;
    sourceHash: string;
}

export interface SourcedDocument {
    content: string;
    sourceHash: string;
}

export interface GeneratedDocs {
    analysisDoc: string;
    testScenarios: SourcedDocument | string;
    visualization: string; // Legacy, for backward compatibility
    visualizationType?: 'mermaid' | 'bpmn'; // Legacy
    mermaidViz?: VizData;
    bpmnViz?: VizData;
    traceabilityMatrix: SourcedDocument | string;
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
    documents: Document[];
    documentVersions: DocumentVersion[];
    is_shared: boolean;
    share_id: string | null;
    created_at: string;
    total_tokens_used?: number;
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
    user_id: string | null;
    name: string;
    document_type: 'analysis' | 'test' | 'traceability' | 'visualization';
    prompt: string;
    is_system_template: boolean;
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

// A type for structural issues found in a document
export interface LintingIssue {
    type: 'BROKEN_SEQUENCE';
    section: string; // e.g., "Fonksiyonel Gereksinimler"
    details: string; // e.g., "FR-001'den sonra FR-003 geliyor."
}