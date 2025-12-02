import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PublicHeader } from './PublicHeader';
import { BPMNEditor } from './BPMNEditor';
import { geminiService } from '../services/geminiService';
import { Bot, Send, Sparkles, LoaderCircle, Download } from 'lucide-react';

const emptyBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="159" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

function decodeBase64ToString(b64: string): string {
    try {
        const decodedUri = decodeURIComponent(b64);
        const binary = atob(decodedUri);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    } catch (e) {
        console.error("Base64 decode error:", e);
        // Fallback for non-URL-encoded base64
        try {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const decoder = new TextDecoder();
            return decoder.decode(bytes);
        } catch (e2) {
             console.error("Secondary decode error:", e2);
             return emptyBpmnXml;
        }
    }
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export const PublicFlowStudio: React.FC = () => {
    const [bpmnXml, setBpmnXml] = useState<string>(emptyBpmnXml);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const editorRef = useRef<{ saveSVG: () => Promise<string>, saveXML: () => Promise<string> }>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type');
        const data = params.get('data');

        if (type === 'bpmn' && data) {
            const decodedXml = decodeBase64ToString(data);
            setBpmnXml(decodedXml);
        }
    }, []);

    const handleSendMessage = async () => {
        if (!userInput.trim() || isLoading) return;

        const newUserMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: userInput };
        setChatHistory(prev => [...prev, newUserMessage]);
        setUserInput('');
        setIsLoading(true);
        setError(null);

        try {
            const { newXml, tokens } = await geminiService.updateBpmnDiagram(bpmnXml, userInput);
            setBpmnXml(newXml);
            const newAssistantMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Diyagram isteğiniz doğrultusunda güncellendi.' };
            setChatHistory(prev => [...prev, newAssistantMessage]);
        } catch (e: any) {
            const errorMessage = `Diyagram güncellenirken bir hata oluştu: ${e.message}`;
            setError(errorMessage);
             const errorAssistantMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: errorMessage };
            setChatHistory(prev => [...prev, errorAssistantMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = async (format: 'svg' | 'xml') => {
        if (!editorRef.current) return;
        try {
            const content = format === 'svg' ? await editorRef.current.saveSVG() : await editorRef.current.saveXML();
            const blob = new Blob([content], { type: format === 'svg' ? 'image/svg+xml' : 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `asisty-diyagram.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(`Error downloading ${format}:`, e);
            alert(`Dışa aktarma sırasında bir hata oluştu.`);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900 font-sans">
            <PublicHeader />
            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 min-h-0">
                {/* Editor Panel */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex flex-col min-h-0">
                    <div className="p-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                         <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 ml-2">Süreç Tasarım Stüdyosu</h2>
                         <div className="flex items-center gap-2">
                            <button onClick={() => handleDownload('svg')} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600"><Download className="h-4 w-4" /> SVG</button>
                            <button onClick={() => handleDownload('xml')} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600"><Download className="h-4 w-4" /> BPMN</button>
                         </div>
                    </div>
                    <div className="flex-1 relative min-h-0">
                        <BPMNEditor ref={editorRef} xml={bpmnXml} onChange={setBpmnXml} />
                    </div>
                </div>

                {/* Chat Panel */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex flex-col">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                        <Bot className="h-6 w-6 text-indigo-500" />
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Asisty Sohbet</h2>
                    </div>
                    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                        {chatHistory.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`px-4 py-2 rounded-lg max-w-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                         {isLoading && (
                             <div className="flex justify-start">
                                 <div className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                     <LoaderCircle className="h-4 w-4 animate-spin" />
                                     <span>Diyagram güncelleniyor...</span>
                                 </div>
                             </div>
                         )}
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                         {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
                        <div className="relative">
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Diyagramı nasıl değiştirelim?"
                                className="w-full p-3 pr-12 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700"
                                disabled={isLoading}
                            />
                            <button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                                <Send className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};