// FIX: Add type definitions for the experimental Web Speech API.
// This resolves errors where 'SpeechRecognition' and 'webkitSpeechRecognition'
// were not recognized by TypeScript.
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

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Paperclip, Mic, X, Send, StopCircle, Bot, Lightbulb, Sparkles, BrainCircuit } from 'lucide-react';

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
    isExpertMode: boolean;
    setIsExpertMode: (isOn: boolean) => void;
    onLongTextPaste: (content: string) => void;
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
    isExpertMode,
    setIsExpertMode,
    onLongTextPaste
}) => {
    const [input, setInput] = useState('');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    // --- Speech Recognition State ---
    const [isListening, setIsListening] = useState(false);
    const [isSpeechSupported, setIsSpeechSupported] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // --- Tools Menu State ---
    const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
    const toolsMenuRef = useRef<HTMLDivElement>(null);
    const toolsButtonRef = useRef<HTMLButtonElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

     // Effect for closing tools menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node) &&
                toolsButtonRef.current && !toolsButtonRef.current.contains(event.target as Node)
            ) {
                setIsToolsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect for initializing and managing Speech Recognition
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

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        } else {
            setIsSpeechSupported(false);
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);
    
    // Effect to handle editing a message
    useEffect(() => {
        if (initialText) {
            setInput(initialText);
            textareaRef.current?.focus();
            // Move cursor to the end
            setTimeout(() => {
                textareaRef.current?.setSelectionRange(initialText.length, initialText.length);
            }, 0);
        }
    }, [initialText]);

    // Clear input and file when conversation changes, but not if there's an initial text for editing
    useEffect(() => {
        if (!initialText) {
            setInput('');
            handleRemoveFile(); // Use the new handler to clear all file-related state
        }
    }, [activeConversationId, initialText]);


    // Auto-resize textarea. Use useLayoutEffect to run synchronously after DOM mutations
    // but before the browser paints, preventing layout jumps and incorrect scrollHeight calculations.
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
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
            setImagePreview(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset file input
        }
    };
    
    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
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
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept=".txt,.md,image/*"
                 />
                 <div className="flex-1 flex flex-col border border-slate-300 dark:border-slate-600 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 bg-slate-100 dark:bg-slate-700 transition-shadow">
                    
                    {(isConversationStarted || !nextAction.disabled) && (
                        <div className="flex flex-wrap items-center justify-center gap-2 p-2 border-b border-slate-200 dark:border-slate-600">
                            <button
                                onClick={nextAction.action}
                                disabled={isLoading || nextAction.disabled}
                                title={nextAction.tooltip}
                                className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                            >
                                {nextAction.icon}
                                {nextAction.label}
                            </button>
                        </div>
                    )}
                    {imagePreview && (
                         <div className="p-2">
                            <div className="relative w-24 h-24 rounded-md overflow-hidden group">
                                <img src={imagePreview} alt="Ekli görsel" className="w-full h-full object-cover"/>
                                <button
                                    onClick={handleRemoveFile}
                                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Görseli kaldır"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                    {attachedFile && !imagePreview && (
                        <div className="mx-2 mt-2 px-3 py-2 bg-slate-200 dark:bg-slate-600 rounded-md flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                                Ekli: {attachedFile.name}
                            </span>
                            <button onClick={handleRemoveFile} className="p-1 rounded-full hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-500 dark:text-slate-400">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    <div className="relative flex-1 flex items-end">
                        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                             <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                title="Dosya Ekle"
                                disabled={isLoading}
                                className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                            >
                                <Paperclip className="h-5 w-5" />
                            </button>
                             <button
                                type="button"
                                onClick={onSuggestNextFeature}
                                disabled={isLoading || !isConversationStarted}
                                title="AI'nın mevcut analize dayanarak bir sonraki adımı önermesini sağlayın"
                                className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                            >
                                <Lightbulb className="h-5 w-5" />
                            </button>
                             <div className="relative">
                                <button
                                    ref={toolsButtonRef}
                                    type="button"
                                    onClick={() => setIsToolsMenuOpen(prev => !prev)}
                                    title="AI Modları"
                                    disabled={isLoading}
                                    className={`p-1.5 rounded-full transition-colors disabled:opacity-50 ${isDeepAnalysisMode || isExpertMode ? 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                >
                                    <Sparkles className="h-5 w-5" />
                                </button>
                                {isToolsMenuOpen && (
                                     <div ref={toolsMenuRef} className="absolute bottom-full mb-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-2 z-20">
                                        <div className="p-2">
                                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Modlar</h3>
                                            <ul>
                                                <li className="flex items-start justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
                                                    <div className="flex items-start gap-3">
                                                        <Bot className="h-5 w-5 text-indigo-500 mt-0.5" />
                                                        <div>
                                                            <label htmlFor="expert-mode-toggle-chat" className="font-semibold text-sm text-slate-700 dark:text-slate-300 cursor-pointer">Exper Modu</label>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">AI'nın tüm analiz sürecini otomatik olarak yürütmesini sağlar.</p>
                                                        </div>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer ml-2">
                                                        <input type="checkbox" className="sr-only peer" checked={isExpertMode} onChange={(e) => setIsExpertMode(e.target.checked)} disabled={isLoading} />
                                                        <div className="w-9 h-5 bg-slate-200 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-500 peer-checked:bg-indigo-600"></div>
                                                    </label>
                                                </li>
                                                 <li className="flex items-start justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
                                                    <div className="flex items-start gap-3">
                                                        <BrainCircuit className="h-5 w-5 text-indigo-500 mt-0.5" />
                                                        <div>
                                                            <label htmlFor="deep-analysis-toggle-chat" className="font-semibold text-sm text-slate-700 dark:text-slate-300 cursor-pointer">Derin Analiz</label>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Daha yavaş ama kapsamlı yanıtlar için gemini-2.5-pro modelini kullanır.</p>
                                                        </div>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer ml-2">
                                                        <input type="checkbox" className="sr-only peer" checked={isDeepAnalysisMode} onChange={(e) => onDeepAnalysisModeChange(e.target.checked)} disabled={isLoading} />
                                                        <div className="w-9 h-5 bg-slate-200 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-500 peer-checked:bg-indigo-600"></div>
                                                    </label>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder="Bir iş analisti gibi sorun, Asisty yanıtlasın..."
                            disabled={isLoading}
                            className="w-full py-4 pl-36 pr-12 bg-transparent focus:outline-none disabled:opacity-50 resize-none overflow-y-auto"
                            style={{ lineHeight: '1.5rem', maxHeight: '256px' }}
                        />
                        <button
                            type="button"
                            onClick={toggleListening}
                            title={isSpeechSupported ? (isListening ? 'Kaydı Durdur' : 'Sesle Yaz') : 'Tarayıcı desteklemiyor'}
                            disabled={isLoading || !isSpeechSupported}
                            className={`absolute right-3 bottom-3 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors ${isListening ? 'bg-red-100 dark:bg-red-800 text-red-600 animate-pulse' : ''}`}
                        >
                            <Mic className="h-5 w-5" />
                        </button>
                    </div>
                     {(isExpertMode || isDeepAnalysisMode) && (
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs border-t border-slate-200 dark:border-slate-600">
                            {isExpertMode && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 rounded-full font-medium">
                                    <Bot className="h-3.5 w-3.5" />
                                    Exper Modu
                                </div>
                            )}
                            {isDeepAnalysisMode && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 rounded-full font-medium">
                                    <BrainCircuit className="h-3.5 w-3.5" />
                                    Derin Analiz
                                </div>
                            )}
                        </div>
                    )}
                </div>
                 {isLoading ? (
                     <button
                        type="button"
                        onClick={onStopGeneration}
                        className="self-end p-4 bg-red-600 text-white font-semibold rounded-2xl shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition duration-200 flex-shrink-0"
                        aria-label="Üretmeyi Durdur"
                    >
                         <StopCircle className="h-6 w-6" />
                    </button>
                 ) : (
                    <button
                        type="submit"
                        disabled={isLoading || (!input.trim() && !attachedFile)}
                        className="self-end p-4 bg-indigo-600 text-white font-semibold rounded-2xl shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex-shrink-0"
                        aria-label="Mesajı Gönder"
                    >
                         <Send className="h-6 w-6" />
                    </button>
                 )}
            </form>
        </div>
    );
};