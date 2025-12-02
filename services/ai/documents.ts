
import { Type, GenerateContentResponse } from "@google/genai";
import type { Message, GeminiModel, StreamChunk, GeneratedDocs, LintingIssue, BacklogSuggestion, ExpertStep, MaturityReport } from '../../types';
import { promptService } from '../promptService';
import { getApiKey, handleGeminiError, generateContent, generateContentStream } from './core';
import { v4 as uuidv4 } from 'uuid';
import { LintingResponseSchema, BacklogResponseSchema, MaturityReportSchema } from '../schemas';

export interface DocumentImpactAnalysis {
    changeType: 'minor' | 'major';
    summary: string;
    isVisualizationImpacted: boolean;
    isTestScenariosImpacted: boolean;
    isTraceabilityImpacted: boolean;
    isBacklogImpacted: boolean;
}

const isBirimiTalepSchema = {
    type: Type.OBJECT,
    properties: {
        dokumanTipi: { type: Type.STRING, enum: ["IsBirimiTalep"] },
        dokumanNo: { type: Type.STRING },
        tarih: { type: Type.STRING },
        revizyon: { type: Type.STRING },
        talepAdi: { type: Type.STRING },
        talepSahibi: { type: Type.STRING },
        mevcutDurumProblem: { type: Type.STRING },
        talepAmaciGerekcesi: { type: Type.STRING },
        kapsam: {
            type: Type.OBJECT,
            properties: {
                inScope: { type: Type.ARRAY, items: { type: Type.STRING } },
                outOfScope: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['inScope', 'outOfScope']
        },
        beklenenIsFaydalari: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: [
        'dokumanTipi', 'dokumanNo', 'tarih', 'revizyon', 'talepAdi', 'talepSahibi',
        'mevcutDurumProblem', 'talepAmaciGerekcesi', 'kapsam', 'beklenenIsFaydalari'
    ]
};

const lintingIssueSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING, enum: ['BROKEN_SEQUENCE'] },
      section: { type: Type.STRING },
      details: { type: Type.STRING },
    },
    required: ['type', 'section', 'details'],
  },
};

async function* docStreamer(stream: AsyncGenerator<GenerateContentResponse>, docKey: keyof GeneratedDocs): AsyncGenerator<StreamChunk> {
    for await (const chunk of stream) {
        if (chunk.usageMetadata) yield { type: 'usage_update', tokens: chunk.usageMetadata.totalTokenCount };
        if (chunk.text) yield { type: 'doc_stream_chunk', docKey, chunk: chunk.text };
    }
}

export const parseTextToRequestDocument = async (rawText: string): Promise<{ jsonString: string, tokens: number }> => {
    const prompt = promptService.getPrompt('parseTextToRequestDocument').replace('{raw_text}', rawText);
    const { text: jsonString, tokens } = await generateContent(prompt, 'gemini-2.5-flash', {
        config: {
            responseMimeType: 'application/json',
            responseSchema: isBirimiTalepSchema,
        }
    });
    return { jsonString, tokens };
};

export const convertMarkdownToRequestJson = async (markdownContent: string): Promise<{ jsonString: string, tokens: number }> => {
    const prompt = promptService.getPrompt('convertMarkdownToRequestJson').replace('{markdown_content}', markdownContent);
    const { text: jsonString, tokens } = await generateContent(prompt, 'gemini-2.5-flash', {
        config: {
            responseMimeType: 'application/json',
            responseSchema: isBirimiTalepSchema,
        }
    });
    return { jsonString, tokens };
};

export const summarizeDocumentChange = async (oldContent: string, newContent: string): Promise<{ summary: string, tokens: number }> => {
    const prompt = promptService.getPrompt('summarizeChange') + `\n\nESKİ VERSİYON:\n---\n${oldContent}\n---\n\nYENİ VERSİYON:\n---\n${newContent}\n---`;
    const { text: summary, tokens } = await generateContent(prompt, 'gemini-2.5-flash-lite');
    return { summary, tokens };
};

export const lintDocument = async (content: string): Promise<{ issues: LintingIssue[], tokens: number }> => {
    const prompt = promptService.getPrompt('lintDocument') + `\n\nDOKÜMAN:\n---\n${content}\n---`;
    const { text, tokens } = await generateContent(prompt, 'gemini-2.5-flash-lite', { 
        config: { 
            responseMimeType: "application/json",
            responseSchema: lintingIssueSchema,
        } 
    });
    try {
        let jsonString = text.trim();
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = jsonString.match(jsonRegex);
        if (match && match[1]) jsonString = match[1];
        
        if (!jsonString) return { issues: [], tokens };
        
        const parsed = JSON.parse(jsonString);
        const validated = LintingResponseSchema.safeParse(parsed);
        
        if (validated.success) {
            return { issues: validated.data, tokens };
        } else {
            console.warn("Linting result validation failed:", validated.error);
            return { issues: [], tokens };
        }
    } catch (e) {
        return { issues: [], tokens };
    }
};

export const fixDocumentLinterIssues = async (content: string, issue: LintingIssue): Promise<{ fixedContent: string, tokens: number }> => {
    const instruction = `"${issue.section}" bölümünde şu hatayı düzelt: ${issue.details}`;
    const prompt = promptService.getPrompt('fixLinterIssues').replace('{instruction}', instruction) + `\n\nDOKÜMAN:\n---\n${content}\n---`;
    const { text: fixedContent, tokens } = await generateContent(prompt, 'gemini-2.5-flash');
    return { fixedContent, tokens };
};

export const generateAnalysisDocument = async function* (requestDoc: string, history: Message[], template: string, model: GeminiModel): AsyncGenerator<StreamChunk> {
    const conversationHistory = history
        .filter(m => m && m.content) // Filter nulls
        .map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = template.replace('{request_document_content}', requestDoc).replace('{conversation_history}', conversationHistory);
    const stream = await generateContentStream(prompt, model);
    yield* docStreamer(stream, 'analysisDoc');
};

export const generateTestScenarios = async function* (analysisDoc: string, template: string, model: GeminiModel): AsyncGenerator<StreamChunk> {
    const prompt = template.replace('{analysis_document_content}', analysisDoc);
    const stream = await generateContentStream(prompt, model);
    yield* docStreamer(stream, 'testScenarios');
};

export const generateTraceabilityMatrix = async function* (analysisDoc: string, testScenarios: string, template: string, model: GeminiModel): AsyncGenerator<StreamChunk> {
    const prompt = template.replace('{analysis_document_content}', analysisDoc).replace('{test_scenarios_content}', testScenarios);
    const stream = await generateContentStream(prompt, model);
    yield* docStreamer(stream, 'traceabilityMatrix');
};

export const generateTemplateFromText = async (fileContent: string): Promise<{ template: string, tokens: number }> => {
    const prompt = promptService.getPrompt('generateTemplateFromText').replace('{file_content}', fileContent);
    const { text, tokens } = await generateContent(prompt, 'gemini-2.5-flash');
    const template = text.replace(/```(markdown)?\s*|\s*```/g, '').trim();
    return { template, tokens };
};

export const generateBacklogSuggestions = async (main_request: string, analysis_document: string, test_scenarios: string, traceability_matrix: string, model: GeminiModel): Promise<{ suggestions: BacklogSuggestion[], reasoning: string, tokens: number }> => {
    const prompt = promptService.getPrompt('generateBacklogFromArtifacts')
        .replace('{main_request}', main_request)
        .replace('{analysis_document}', analysis_document)
        .replace('{test_scenarios}', test_scenarios)
        .replace('{traceability_matrix}', traceability_matrix);

    const { text, tokens } = await generateContent(prompt, model, { config: { responseMimeType: 'application/json' } });
    try {
        const cleanText = text.replace(/^[\s\S]*?```json/, '').replace(/```[\s\S]*$/, '').replace(/^[\s\S]*?({)/, '$1');
        let jsonString = cleanText.trim();
        
        const lastBraceIndex = jsonString.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
            jsonString = jsonString.substring(0, lastBraceIndex + 1);
        }

        const result = JSON.parse(jsonString);
        
        // Use Zod schema to validate and normalize
        const parsed = BacklogResponseSchema.safeParse(result);
        
        if (!parsed.success) {
            console.error("Backlog validation failed:", parsed.error);
            throw new Error("Backlog verisi doğrulanamadı.");
        }

        const normalizedData = parsed.data;

        // Helper to add IDs recursively (since Zod schema doesn't generate IDs)
        const addIds = (items: any[]): BacklogSuggestion[] => {
            return items.map(item => ({
                id: uuidv4(),
                type: item.type,
                title: item.title,
                description: item.description,
                priority: item.priority,
                children: addIds(item.children || [])
            }));
        };

        return { 
            suggestions: addIds(normalizedData.suggestions), 
            reasoning: normalizedData.reasoning, 
            tokens 
        };
    } catch (e) {
        console.error("Backlog parsing error:", e, text);
        throw new Error("Backlog önerileri ayrıştırılamadı.");
    }
};

export const checkAnalysisMaturity = async (history: Message[], docs: GeneratedDocs, model: GeminiModel): Promise<{ report: MaturityReport, tokens: number }> => {
    // FIX: Filter out null/undefined messages to prevent "Cannot read properties of null (reading 'content')"
    const conversationHistory = history
        .filter(m => m && m.content)
        .map(m => `${m.role}: ${m.content}`).join('\n');
    
    // FIX: Correctly access the .content property safely.
    // Previously: `Talep: ${docs.requestDoc}` caused [object Object] because docs.requestDoc is an object.
    const requestContent = docs.requestDoc?.content || "Mevcut Değil";
    const analysisContent = docs.analysisDoc?.content || "Mevcut Değil";
    
    const docContext = `Talep: ${requestContent}\n\nAnaliz: ${analysisContent}`;
    
    const prompt = promptService.getPrompt('checkAnalysisMaturity') + `\n\nKONUŞMA GEÇMİŞİ:\n---\n${conversationHistory}\n---\n\nMEVCUT DOKÜMANLAR:\n---\n${docContext}\n---`;
    const { text, tokens } = await generateContent(prompt, model, { config: { responseMimeType: "application/json" } });
    try {
        let jsonString = text.trim();
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = jsonString.match(jsonRegex);
        if (match && match[1]) jsonString = match[1];
        
        const parsed = JSON.parse(jsonString);
        const validated = MaturityReportSchema.safeParse(parsed);
        
        if (validated.success) {
            return { report: validated.data, tokens };
        } else {
            throw new Error("Olgunluk raporu şema doğrulamasından geçemedi.");
        }
    } catch (e) {
        throw new Error("Olgunluk raporu ayrıştırılamadı.");
    }
};

export const analyzeDocumentChange = async (oldContent: string, newContent: string, model: GeminiModel): Promise<{ impact: DocumentImpactAnalysis, tokens: number }> => {
    const summary = await summarizeDocumentChange(oldContent, newContent);
    return {
        impact: {
            changeType: 'minor',
            summary: summary.summary,
            isVisualizationImpacted: true,
            isTestScenariosImpacted: true,
            isTraceabilityImpacted: true,
            isBacklogImpacted: true,
        },
        tokens: summary.tokens
    };
};
