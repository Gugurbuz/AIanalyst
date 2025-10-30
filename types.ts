// types.ts
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Re-exporting Supabase user type for convenience
export type User = SupabaseUser;

export type Theme = 'light' | 'dark' | 'system';

export type AppMode = 'analyst' | 'board';

export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.5-flash-lite';

export interface Feedback {
    rating: 'up' | 'down' | null;
    comment?: string;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    feedback?: Feedback;
}

export interface MaturityReport {
    isSufficient: boolean;
    summary: string;
    missingTopics: string[];
    suggestedQuestions: string[];
}

export interface GeneratedDocs {
    analysisDoc: string;
    testScenarios: string;
    visualization: string;
    traceabilityMatrix: string;
    maturityReport?: MaturityReport | null;
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

export interface Task {
    id: string;
    user_id: string;
    conversation_id: string | null;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: string | null;
    created_at: string;
}

export interface TaskSuggestion {
    title: string;
    description: string;
    priority: TaskPriority;
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