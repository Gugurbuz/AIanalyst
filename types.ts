// types.ts

export interface User {
  id: string;
  email: string;
  password?: string; // Included for auth service, but should not be passed to client components
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
  userId: string;
  title: string;
  messages: Message[];
  generatedDocs: GeneratedDocs;
}

export interface MaturityReport {
    isSufficient: boolean;
    summary: string;
    missingTopics: string[];
    suggestedQuestions: string[];
}