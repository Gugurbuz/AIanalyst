// types.ts
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Re-exporting Supabase user type for convenience
export type User = SupabaseUser;

export type Theme = 'light' | 'dark' | 'system';

export type AppMode = 'analyst';

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

export interface ThinkingStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  details?: string;
  description?: string;
}

// YENİ Birleşik Düşünce Tipi (ExpertStep'ten uyarlandı)
export interface ThoughtProcess {
  title: string;
  steps: ThinkingStep[];
}

// FIX: Define ExpertStep as an alias for ThinkingStep to resolve missing type errors.
export type ExpertStep = ThinkingStep;


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
    created_at: string;
    isStreaming?: boolean;
    error?: { name: string; message: string; } | null;
    thought?: ThoughtProcess | null; // <-- YENİ ALAN (Veritabanıyla eşleşecek)
    feedback?: Feedback | null;
    documentType?: DocumentType | null;
    // DEPRECATED:
    timestamp?: string;
    expertRunChecklist?: ExpertStep[]; 
    generativeSuggestion?: GenerativeSuggestion;
    thoughts?: string | null; // Legacy DB field
}


// StreamChunk'ı bu yeni tipi kullanacak şekilde güncelleyin
export type StreamChunk =
  | { type: 'text_chunk'; text: string }
  | { type: 'thought_chunk'; payload: ThoughtProcess } // YENİ TİP (expert_run_update yerine)
  | { type: 'doc_stream_chunk'; docKey: keyof GeneratedDocs; chunk: any }
  | { type: 'stream_complete'; finalMessage?: string }
  | { type: 'stream_error'; error: { name: string; message: string; } }
  | { type: 'function_call'; name: string; args: any }
  | { type: 'doc_lint_result'; results: LintingIssue[] }
  // expert_run_update kaldırıldı
  | { type: 'chat_stream_chunk'; chunk: string } // for backward compatibility in geminiService
  | { type: 'expert_run_update'; checklist: ExpertStep[]; isComplete: boolean; finalMessage?: string; } // for expert mode
  | { type: 'usage_update'; tokens: number }
  | { type: 'visualization_update', content: string }
  | { type: 'error', message: string };



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
    requestDoc: string;
    analysisDoc: string;
    testScenarios: SourcedDocument | string;
    visualization: string; // Legacy, for backward compatibility
    visualizationType?: 'mermaid' | 'bpmn'; // Legacy
    bpmnViz?: VizData;
    traceabilityMatrix: SourcedDocument | string;
    maturityReport?: MaturityReport | null;
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
    backlogSuggestions?: BacklogSuggestion[];
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
    type: TaskType;
    title: string;
    description: string;
    priority: TaskPriority;
    children?: BacklogSuggestion[];
}


// Types for prompt management
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

export interface IsBirimiTalep {
  dokumanTipi: "IsBirimiTalep";
  dokumanNo: string;
  tarih: string;
  revizyon: string;
  talepAdi: string;
  talepSahibi: string;
  mevcutDurumProblem: string;
  talepAmaciGerekcesi: string;
  kapsam: {
    inScope: string[];
    outOfScope: string[];
  };
  beklenenIsFaydalari: string[];
}

export function isIsBirimiTalep(obj: any): obj is IsBirimiTalep {
    return obj &&
        obj.dokumanTipi === "IsBirimiTalep" &&
        typeof obj.dokumanNo === 'string' &&
        typeof obj.talepAdi === 'string' &&
        typeof obj.kapsam === 'object' &&
        Array.isArray(obj.kapsam.inScope) &&
        Array.isArray(obj.kapsam.outOfScope);
}


// NEW: Structured types for JSON-based document generation
export interface StructuredTestScenario {
    "Test Senaryo ID": string;
    "İlgili Gereksinim": string;
    "Senaryo Açıklaması": string;
    "Test Adımları": string[];
    "Beklenen Sonuç": string;
}

export interface StructuredTraceabilityRow {
    "Gereksinim ID": string;
    "Gereksinim Açıklaması": string;
    "İlgili Test Senaryo ID'leri": string; // Comma separated string
}
