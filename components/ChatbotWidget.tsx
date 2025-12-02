// components/ChatbotWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Bot, X, Send, LoaderCircle, Sparkles } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatbotMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

export const ChatbotWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatbotMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            chatRef.current = ai.chats.create({
              model: 'gemini-3-pro-preview',
            });
        } catch(e) {
            console.error("Failed to initialize Chatbot AI:", e);
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || !chatRef.current) return;

        const userInput = input;
        const userMessage: ChatbotMessage = { id: Date.now().toString(), role: 'user', content: userInput };
        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage: ChatbotMessage = { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true };
        
        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const streamResponse = await chatRef.current.sendMessageStream({ message: userInput });
            let accumulatedContent = '';
            for await (const chunk of streamResponse) {
                const c = chunk as GenerateContentResponse;
                const textChunk = c.text;
                if (textChunk) {
                    accumulatedContent += textChunk;
                    setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg
                    ));
                }
            }
        } catch (e: any) {
            console.error("Chatbot error:", e);
            setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                ? { ...msg, content: `Üzgünüm, bir hata oluştu: ${e.message}`, isStreaming: false } 
                : msg
            ));
        } finally {
            setIsLoading(false);
            setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
            ));
        }
    };
    
    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center z-50 transform hover:scale-110 transition-transform duration-200"
                aria-label={isOpen ? "Asistanı Kapat" : "Asistanı Aç"}
            >
                {isOpen ? <X className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
            </button>

            {isOpen && (
                <div className="fixed bottom-24 right-6 w-full max-w-sm h-[60vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-200 dark:border-slate-700 animate-fade-in-up" style={{animationDuration: '0.2s'}}>
                    <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <Bot className="w-6 h-6 text-indigo-500" />
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">AI Asistan</h2>
                        </div>
                    </header>
                    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
                                <Sparkles className="w-10 h-10 mb-2" />
                                <p>Size nasıl yardımcı olabilirim?</p>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`px-4 py-2 rounded-lg max-w-xs ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'}`}>
                                    {msg.isStreaming && !msg.content ? (
                                        <LoaderCircle className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <MarkdownRenderer content={msg.content} />
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Bir mesaj yazın..."
                                className="w-full p-3 pr-12 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-700"
                                disabled={isLoading}
                            />
                            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                                {isLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
