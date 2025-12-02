
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Paperclip, Mic, Send, StopCircle, Lightbulb, Sparkles, Bot, BrainCircuit, Search } from 'lucide-react';
import { AiToolsMenu } from './chat/AiToolsMenu';
import { AttachmentPreview } from './chat/AttachmentPreview';

interface NextAction {
    label: string;
    action: () => void;
    icon: React.ReactElement;
    disabled: boolean;
    tooltip?: string;
}

interface ChatInterfaceProps {
    isLoading: boolean;
    onSendMessage: (text: string, file: File | null) => void;
    activeConversationId: string | null;
    onStopGeneration: () => void;
    initialText?: string | null;
    onSuggestNextFeature: () => void;
    isConversationStarted: boolean;
    nextAction: NextAction;
    isDeepAnalysisMode: boolean;
    onDeepAnalysisModeChange: (isOn: boolean) => void;
    isSearchEnabled: boolean;
    onSearchModeChange: (isOn: boolean) => void;
    isExpertMode: boolean;
    setIsExpertMode: (isOn: boolean) => void;
    onLongTextPaste: (content: string) => void;
}

// ... (Speech types - keeping them here or moving to a d.ts is fine)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
    isLoading, 
    onSendMessage, 
    activeConversationId, 
    onStopGeneration, 
    initialText, 
    onSuggestNextFeature,
    isConversationStarted,
    nextAction,
    isDeepAnalysisMode,
    onDeepAnalysisModeChange,
    isSearchEnabled,
    onSearchModeChange,
    isExpertMode,
    setIsExpertMode,
    onLongTextPaste
}) => {
    const [input, setInput] = useState('');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeechSupported, setIsSpeechSupported] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
    const toolsButtonRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            setIsSpeechSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'tr-TR';
            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                 setInput(prevInput => prevInput + finalTranscript);
            };
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event) => { console.error('Speech recognition error', event.error); setIsListening(false); };
            recognitionRef.current = recognition;
        } else {
            setIsSpeechSupported(false);
        }
        return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
    }, []);
    
    useEffect(() => {
        if (initialText) {
            setInput(initialText);
            textareaRef.current?.focus();
            setTimeout(() => textareaRef.current?.setSelectionRange(initialText.length, initialText.length), 0);
        }
    }, [initialText]);

    useEffect(() => {
        if (!initialText) {
            setInput('');
            handleRemoveFile();
        }
    }, [activeConversationId, initialText]);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [input]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && !attachedFile) || isLoading) return;
        onSendMessage(input, attachedFile);
        setInput('');
        handleRemoveFile();
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAttachedFile(file);
            if (file.type.startsWith('image/')) {
                setImagePreview(URL.createObjectURL(file));
            } else {
                setImagePreview(null);
            }
        }
    };

    const handleRemoveFile = () => {
        setAttachedFile(null);
        if (imagePreview) { URL.revokeObjectURL(imagePreview); setImagePreview(null); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) recognitionRef.current.stop();
        else recognitionRef.current.start();
        setIsListening(!isListening);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pastedText = e.clipboardData.getData('text');
        if (pastedText.length > 500 && !isLoading) {
            e.preventDefault();
            onLongTextPaste(pastedText);
        }
    };

    return (
        <div className="w-full bg-white dark:bg-slate-800 rounded-lg p-3">
            <form onSubmit={handleSubmit} className="flex items-end space-x-3">
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".txt,.md,image/*" />
                 <div className="flex-1 flex flex-col border border-slate-300 dark:border-slate-600 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 bg-slate-100 dark:bg-slate-700 transition-shadow">
                    
                    {(isConversationStarted || !nextAction.disabled) && (
                        <div className="flex flex-wrap items-center justify-center gap-2 p-2 border-b border-slate-200 dark:border-slate-600">
                            <button onClick={nextAction.action} disabled={isLoading || nextAction.disabled} title={nextAction.tooltip} className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2">
                                {nextAction.icon}
                                {nextAction.label}
                            </button>
                        </div>
                    )}
                    
                    <AttachmentPreview attachedFile={attachedFile} imagePreview={imagePreview} onRemove={handleRemoveFile} />

                    <div className="relative flex-1 flex items-end">
                        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                             <button type="button" onClick={() => fileInputRef.current?.click()} title="Dosya Ekle" disabled={isLoading} className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"><Paperclip className="h-5 w-5" /></button>
                             <button type="button" onClick={onSuggestNextFeature} disabled={isLoading || !isConversationStarted} title="AI'nın mevcut analize dayanarak bir sonraki adımı önermesini sağlayın" className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"><Lightbulb className="h-5 w-5" /></button>
                             <div className="relative">
                                <button ref={toolsButtonRef} type="button" onClick={() => setIsToolsMenuOpen(prev => !prev)} title="AI Modları" disabled={isLoading} className={`p-1.5 rounded-full transition-colors disabled:opacity-50 ${isDeepAnalysisMode || isExpertMode || isSearchEnabled ? 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><Sparkles className="h-5 w-5" /></button>
                                <AiToolsMenu isOpen={isToolsMenuOpen} onClose={() => setIsToolsMenuOpen(false)} buttonRef={toolsButtonRef} isExpertMode={isExpertMode} setIsExpertMode={setIsExpertMode} isDeepAnalysisMode={isDeepAnalysisMode} onDeepAnalysisModeChange={onDeepAnalysisModeChange} isSearchEnabled={isSearchEnabled} onSearchModeChange={onSearchModeChange} isLoading={isLoading} />
                            </div>
                        </div>
                        <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder="Bir iş analisti gibi sorun, Asisty yanıtlasın..." disabled={isLoading} className="w-full py-4 pl-36 pr-12 bg-transparent focus:outline-none disabled:opacity-50 resize-none overflow-y-auto" style={{ lineHeight: '1.5rem', maxHeight: '256px' }} />
                        <button type="button" onClick={toggleListening} title={isSpeechSupported ? (isListening ? 'Kaydı Durdur' : 'Sesle Yaz') : 'Tarayıcı desteklemiyor'} disabled={isLoading || !isSpeechSupported} className={`absolute right-3 bottom-3 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors ${isListening ? 'bg-red-100 dark:bg-red-800 text-red-600 animate-pulse' : ''}`}><Mic className="h-5 w-5" /></button>
                    </div>
                     {(isExpertMode || isDeepAnalysisMode || isSearchEnabled) && (
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs border-t border-slate-200 dark:border-slate-600">
                            {isExpertMode && <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 rounded-full font-medium"><Bot className="h-3.5 w-3.5" /> Exper Modu</div>}
                            {isDeepAnalysisMode && <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 rounded-full font-medium"><BrainCircuit className="h-3.5 w-3.5" /> Derin Analiz</div>}
                             {isSearchEnabled && <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded-full font-medium"><Search className="h-3.5 w-3.5" /> Google Search</div>}
                        </div>
                    )}
                </div>
                 {isLoading ? (
                     <button type="button" onClick={onStopGeneration} className="self-end p-4 bg-red-600 text-white font-semibold rounded-2xl shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition duration-200 flex-shrink-0" aria-label="Üretmeyi Durdur"><StopCircle className="h-6 w-6" /></button>
                 ) : (
                    <button type="submit" disabled={isLoading || (!input.trim() && !attachedFile)} className="self-end p-4 bg-indigo-600 text-white font-semibold rounded-2xl shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex-shrink-0" aria-label="Mesajı Gönder"><Send className="h-6 w-6" /></button>
                 )}
            </form>
        </div>
    );
};
