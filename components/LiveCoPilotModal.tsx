// components/LiveCoPilotModal.tsx
import React from 'react';
import type { Conversation, Template, User } from '../types';
import { ChatInterface } from './ChatInterface';
import { ChatMessageHistory } from './ChatMessageHistory';
import { DocumentWorkspace } from './DocumentWorkspace';
import { PromptSuggestions } from './PromptSuggestions';
import { X } from 'lucide-react';

interface LiveCoPilotModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    user: User; // Added user prop
    isProcessing: boolean;
    generatingDocType: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability' | null;
    inlineModificationState: { docKey: 'analysisDoc' | 'testScenarios'; originalText: string } | null;
    selectedTemplates: { analysis: string; test: string; };
    activeDocTab: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability';
    setActiveDocTab: (tab: 'analysis' | 'viz' | 'test' | 'maturity' | 'traceability') => void;
    onSendMessage: (content: string) => Promise<void>;
    onUpdateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
    onModifySelection: (selectedText: string, userPrompt: string, docKey: 'analysisDoc' | 'testScenarios') => Promise<void>;
    onModifyDiagram: (userPrompt: string) => Promise<void>;
    onGenerateDoc: (type: 'analysis' | 'test' | 'viz' | 'traceability', newTemplateId?: string, newDiagramType?: 'mermaid' | 'bpmn') => void;
    onTemplateChange: {
        analysis: (event: React.ChangeEvent<HTMLSelectElement>) => void;
        test: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    };
    onSelectMaturityQuestion: (question: string) => void;
    onRecheckMaturity: () => void;
    templates: {
        analysis: Template[];
        test: Template[];
    };
    diagramType: 'mermaid' | 'bpmn';
    setDiagramType: (type: 'mermaid' | 'bpmn') => void;
}

export const LiveCoPilotModal: React.FC<LiveCoPilotModalProps> = ({
    isOpen,
    onClose,
    conversation,
    user,
    isProcessing,
    generatingDocType,
    inlineModificationState,
    selectedTemplates,
    activeDocTab,
    setActiveDocTab,
    onSendMessage,
    onUpdateConversation,
    onModifySelection,
    onModifyDiagram,
    onGenerateDoc,
    onTemplateChange,
    onSelectMaturityQuestion,
    onRecheckMaturity,
    templates,
    diagramType,
    setDiagramType,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }} onClick={onClose}>
            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 rounded-t-lg">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Canlı Oturum</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </button>
                </header>
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 min-h-0">
                    {/* Left Pane: Chat */}
                    <div className="lg:col-span-5 flex flex-col h-full min-h-0 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            {conversation.messages.length === 0 ? (
                               <PromptSuggestions onSelectPrompt={(p) => onSendMessage(p)} />
                            ) : (
                               <ChatMessageHistory
                                    user={user}
                                    chatHistory={conversation.messages}
                                    isLoading={isProcessing && !generatingDocType}
                                    onFeedbackUpdate={(messageId, feedbackData) => {
                                         const updatedMessages = conversation.messages.map(msg => msg.id === messageId ? { ...msg, feedback: feedbackData } : msg);
                                         onUpdateConversation(conversation.id, { messages: updatedMessages });
                                    }}
                                />
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                            <ChatInterface
                                isLoading={isProcessing || !!inlineModificationState}
                                onSendMessage={onSendMessage}
                                activeConversationId={conversation.id}
                            />
                        </div>
                    </div>
                    {/* Right Pane: Documents */}
                     <div className="lg:col-span-7 flex flex-col h-full min-h-0 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                         <DocumentWorkspace
                            conversation={conversation}
                            isGenerating={isProcessing}
                            generatingDocType={generatingDocType}
                            onUpdateConversation={onUpdateConversation}
                            onModifySelection={onModifySelection}
                            onModifyDiagram={onModifyDiagram}
                            inlineModificationState={inlineModificationState}
                            onGenerateDoc={onGenerateDoc}
                            templates={templates}
                            selectedTemplates={selectedTemplates}
                            onTemplateChange={onTemplateChange}
                            activeDocTab={activeDocTab}
                            setActiveDocTab={setActiveDocTab}
                            onSelectMaturityQuestion={onSelectMaturityQuestion}
                            onRecheckMaturity={onRecheckMaturity}
                            diagramType={diagramType}
                            setDiagramType={setDiagramType}
                         />
                    </div>
                </div>
            </div>
        </div>
    );
};