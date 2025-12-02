import { z } from 'zod';

// --- Düşünce Akışı Şemaları ---
export const ThinkingStepSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed', 'error']),
    details: z.string().optional(),
    description: z.string().optional()
});

export const ThoughtProcessSchema = z.object({
    title: z.string(),
    steps: z.array(ThinkingStepSchema)
});

// --- Linting Şemaları ---
export const LintingIssueSchema = z.object({
    type: z.literal('BROKEN_SEQUENCE'),
    section: z.string(),
    details: z.string()
});

export const LintingResponseSchema = z.array(LintingIssueSchema);

// --- Backlog Şemaları ---
export const TaskTypeEnum = z.enum(['epic', 'story', 'test_case', 'task']);
export const PriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);

// Recursive schema definition for Tasks
// z.lazy allows us to reference the schema inside itself for recursion
export const BacklogItemSchema: z.ZodType<any> = z.lazy(() => z.object({
    type: TaskTypeEnum.optional().default('task'),
    title: z.string().optional().default('Başlıksız'),
    description: z.string().optional().default(''),
    priority: PriorityEnum.optional().default('medium'),
    children: z.array(BacklogItemSchema).optional().default([]),
    items: z.array(BacklogItemSchema).optional().default([]) // Handle legacy 'items' key from AI
}).transform(data => ({
    ...data,
    // Merge 'items' into 'children' to normalize the structure
    children: [...(data.children || []), ...(data.items || [])]
})));

export const BacklogResponseSchema = z.object({
    reasoning: z.string().optional(),
    suggestions: z.array(BacklogItemSchema).optional().default([]),
    backlog: z.array(BacklogItemSchema).optional().default([]), // Handle legacy 'backlog' key
    items: z.array(BacklogItemSchema).optional().default([]) // Handle legacy 'items' root key
}).transform(data => ({
    reasoning: data.reasoning || '',
    // Merge all potential array sources into a single 'suggestions' array
    suggestions: [...(data.suggestions || []), ...(data.backlog || []), ...(data.items || [])]
}));

// --- Olgunluk Raporu Şeması ---
export const MaturityReportSchema = z.object({
    isSufficient: z.boolean(),
    summary: z.string(),
    missingTopics: z.array(z.string()),
    suggestedQuestions: z.array(z.string()),
    scores: z.object({
        comprehensiveness: z.number(),
        clarity: z.number(),
        consistency: z.number(),
        testability: z.number(),
        completeness: z.number()
    }),
    overallScore: z.number(),
    justification: z.string(),
    maturity_level: z.enum(['Zayıf', 'Gelişime Açık', 'İyi', 'Mükemmel'])
});

// --- Talep Dokümanı Şeması ---
export const IsBirimiTalepSchema = z.object({
    dokumanTipi: z.literal('IsBirimiTalep'),
    dokumanNo: z.string(),
    tarih: z.string(),
    revizyon: z.string(),
    talepAdi: z.string(),
    talepSahibi: z.string(),
    mevcutDurumProblem: z.string(),
    talepAmaciGerekcesi: z.string(),
    kapsam: z.object({
        inScope: z.array(z.string()),
        outOfScope: z.array(z.string()),
    }),
    beklenenIsFaydalari: z.array(z.string()),
});
