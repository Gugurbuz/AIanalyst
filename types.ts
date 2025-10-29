// types.ts

export interface User {
  id: string;
  email?: string; // email can be undefined in some cases
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  feedback?: {
    rating: 'up' | 'down' | null;
    comment?: string;
  };
}

export interface GeneratedDocs {
    analysisDoc: string;
    testScenarios: string;
    visualization: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  messages: Message[];
  generatedDocs: GeneratedDocs;
  created_at?: string;
}

export interface MaturityReport {
    isSufficient: boolean;
    summary: string;
    missingTopics: string[];
    suggestedQuestions: string[];
}