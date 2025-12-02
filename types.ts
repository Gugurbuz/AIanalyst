// types.ts
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { z } from 'zod';
import { 
    ThinkingStepSchema, 
    ThoughtProcessSchema, 
    LintingIssueSchema, 
    BacklogItemSchema, 
    MaturityReportSchema,
    IsBirimiTalepSchema
} from './services/schemas';

// Re-exporting Supabase user type for convenience
export type User = SupabaseUser;

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large';

export type AppMode = 'analyst' | 'backlog';

export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.5-flash-lite' | 'gemini-3-pro-preview';

export type PlanID = 'free' | 'pro' | 'corporate';

export interface UserProfile {
    id: string;
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

export type ThinkingStep = z.infer<typeof ThinkingStepSchema>;
export type ThoughtProcess = z.infer<typeof ThoughtProcessSchema>;
export type ExpertStep = ThinkingStep;

export interface GenerativeSuggestion {
    title: string;
    suggestions: string[];
    targetSection: string;
    context: string;
}

export interface WebSource {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web: WebSource;
}

export interface Message {
    id:string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
    isStreaming?: boolean;
    error?: { name: string; message: string; } | null;
    thought?: ThoughtProcess | null;
    feedback?: Feedback | null;
    documentType?: DocumentType | null;
    imageUrl?: string;
    groundingMetadata?: GroundingChunk[];
    expertRunChecklist?: ExpertStep[]; 
    generativeSuggestion?: GenerativeSuggestion;
}

export type StreamChunk =
  | { type: 'text_chunk'; text: string }
  | { type: 'thought_chunk'; payload: ThoughtProcess }
  | { type: 'doc_stream_chunk'; docKey: keyof GeneratedDocs; chunk: any }
  | { type: 'stream_complete'; finalMessage?: string }
  | { type: 'stream_error'; error: { name: string; message: string; } }
  | { type: 'function_call'; name: string; args: any }
  | { type: 'doc_lint_result'; results: LintingIssue[] }
  | { type: 'chat_stream_chunk'; chunk: string }
  | { type: 'expert_run_update'; checklist: ExpertStep[]; isComplete: boolean; finalMessage?: string; }
  | { type: 'usage_update'; tokens: number }
  | { type: 'visualization_update', content: string }
  | { type: 'error', message: string }
  | { type: 'grounding_chunk'; payload: GroundingChunk[] };

export type MaturityLevel = 'Zayıf' | 'Gelişime Açık' | 'İyi' | 'Mükemmel';
export type MaturityReport = z.infer<typeof MaturityReportSchema>;

export type DocumentType = 'analysis' | 'test' | 'traceability' | 'bpmn' | 'maturity_report' | 'request';

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
    tokens_used?: number;
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

// Normalized Document Structure for UI
export interface GeneratedDocument {
    content: string;
    isStale: boolean;
    metadata?: any; // For structured data like BPMN sourceHash, parsed JSON objects, etc.
}

export interface GeneratedDocs {
    requestDoc: GeneratedDocument | null;
    analysisDoc: GeneratedDocument | null;
    testScenarios: GeneratedDocument | null;
    bpmnViz: GeneratedDocument | null;
    traceabilityMatrix: GeneratedDocument | null;
    maturityReport: GeneratedDocument | null;
    backlog: GeneratedDocument | null; // Placeholder for future use if backlog becomes a doc
}

// Legacy types support (can be removed later if fully cleaned up)
export interface VizData {
    code: string;
    sourceHash: string;
}

export interface SourcedDocument {
    content: string;
    sourceHash: string;
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
    backlogSuggestions?: BacklogSuggestion[];
}

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
    children?: Task[];
}

// BacklogSuggestion inferred from Zod schema but needs manual interface for recursive structure if strict types needed in components
export interface BacklogSuggestion {
    id: string;
    type: string; // Zod enum result
    title: string;
    description: string;
    priority: TaskPriority;
    children?: BacklogSuggestion[];
}

export interface Template {
    id: string;
    user_id: string | null;
    name: string;
    document_type: 'analysis' | 'test' | 'traceability' | 'bpmn';
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
    is_system_template?: boolean;
    document_type?: DocumentType;
    versions: PromptVersion[];
    activeVersionId: string;
}

export interface PromptCategory {
    id: string;
    name: string;
    prompts: Prompt[];
}

export type PromptData = PromptCategory[];

export interface FeedbackItem {
    message: Message;
    conversationTitle: string;
}

export type LintingIssue = z.infer<typeof LintingIssueSchema>;

export type IsBirimiTalep = z.infer<typeof IsBirimiTalepSchema>;

export function isIsBirimiTalep(obj: any): obj is IsBirimiTalep {
    return IsBirimiTalepSchema.safeParse(obj).success;
}

export interface StructuredTestScenario {
    "Test Senaryo ID": string;
    "İlgili Gereksinim": string;
    "Senaryo Açıklaması": string;
    "Test Adımları": string;
    "Beklenen Sonuç": string;
}

export interface StructuredTraceabilityRow {
    "Gereksinim ID": string;
    "Gereksinim Açıklaması": string;
    "İlgili Test Senaryo ID'leri": string;
}