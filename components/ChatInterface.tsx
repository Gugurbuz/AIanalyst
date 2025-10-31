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

import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, Mic, X, Send } from 'lucide-react';

interface ChatInterfaceProps {
    isLoading: boolean;
    onSendMessage: (reply: string) => void;
    activeConversationId: string | null;
}

// Helper to read file content as a promise
const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ isLoading, onSendMessage, activeConversationId }) => {
    const [input, setInput] = useState('');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    
    // --- Speech Recognition State ---
    const [isListening, setIsListening] = useState(false);
    const [isSpeechSupported, setIsSpeechSupported] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    
    // Clear input and file when conversation changes
    useEffect(() => {
        setInput('');
        setAttachedFile(null);
    }, [activeConversationId]);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            // Max height increased to 180px
            const maxHeight = 180;
            textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        }
    }, [input]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && !attachedFile) || isLoading) return;

        let messageToSend = input;

        if (attachedFile) {
            try {
                const fileContent = await readFileAsText(attachedFile);
                const fileInfo = `[EK DOSYA İÇERİĞİ: ${attachedFile.name}]\n\n---\n\n${fileContent}\n\n---\n\n`;
                messageToSend = fileInfo + input;
            } catch (error) {
                console.error("Error reading file:", error);
                // Optionally show an error to the user
                return;
            }
        }

        onSendMessage(messageToSend);
        setInput('');
        setAttachedFile(null);
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachedFile(e.target.files[0]);
        }
    };

    const handleRemoveFile = () => {
        setAttachedFile(null);
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

    return (
        <div className="w-full bg-white dark:bg-slate-800 rounded-lg p-2 space-y-2">
            {attachedFile && (
                <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-md flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                        Ekli: {attachedFile.name}
                    </span>
                    <button onClick={handleRemoveFile} className="p-1 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400">
                         <X className="h-4 w-4" />
                    </button>
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-end space-x-2">
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept=".txt,.md"
                 />
                 <div className="relative flex-1 flex items-end">
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Dosya Ekle"
                        disabled={isLoading}
                        className="absolute left-3 bottom-3 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                         <Paperclip className="h-5 w-5" />
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Bir iş analisti gibi sorun, Asisty yanıtlasın..."
                        disabled={isLoading}
                        className="w-full p-3 pl-12 pr-12 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-100 dark:bg-slate-700 disabled:opacity-50 transition-colors resize-none overflow-y-auto"
                        rows={2}
                        style={{ lineHeight: '1.5rem', maxHeight: '180px' }}
                    />
                     <button
                        type="button"
                        onClick={toggleListening}
                        title={isSpeechSupported ? (isListening ? 'Kaydı Durdur' : 'Sesle Yaz') : 'Tarayıcı desteklemiyor'}
                        disabled={isLoading || !isSpeechSupported}
                        className={`absolute right-3 bottom-3 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors ${isListening ? 'text-red-500 animate-pulse' : ''}`}
                    >
                        <Mic className="h-5 w-5" />
                    </button>
                 </div>
                <button
                    type="submit"
                    disabled={isLoading || (!input.trim() && !attachedFile)}
                    className="self-end p-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex-shrink-0"
                    aria-label="Mesajı Gönder"
                >
                     <Send className="h-6 w-6" />
                </button>
            </form>
        </div>
    );
};