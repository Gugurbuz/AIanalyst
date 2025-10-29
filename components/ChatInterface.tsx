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
            // Clear previous input before starting new dictation
            setInput(''); 
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
    };

    return (
        <div className="w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-2 space-y-2">
            {attachedFile && (
                <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-md flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                        Ekli: {attachedFile.name}
                    </span>
                    <button onClick={handleRemoveFile} className="p-1 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept=".txt,.md"
                 />
                 <div className="relative flex-1">
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Dosya Ekle"
                        disabled={isLoading}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a3 3 0 106 0V7a1 1 0 112 0v4a5 5 0 11-10 0V7a5 5 0 0110 0v4a1 1 0 11-2 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Mesajınızı buraya yazın veya mikrofonu kullanın..."
                        disabled={isLoading}
                        className="w-full p-3 pl-12 pr-12 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none bg-slate-100 dark:bg-slate-700 disabled:opacity-50 transition-colors"
                    />
                     <button
                        type="button"
                        onClick={toggleListening}
                        title={isSpeechSupported ? (isListening ? 'Kaydı Durdur' : 'Sesle Yaz') : 'Tarayıcı desteklemiyor'}
                        disabled={isLoading || !isSpeechSupported}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors ${isListening ? 'text-red-500 animate-pulse' : ''}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                           <path d="M5.5 8.5a.5.5 0 01.5.5v1.5a.5.5 0 01-1 0V9a.5.5 0 01.5-.5z" />
                           <path d="M14.5 8.5a.5.5 0 01.5.5v1.5a.5.5 0 01-1 0V9a.5.5 0 01.5-.5z" />
                           <path fillRule="evenodd" d="M4 8a1 1 0 011 1v1a1 1 0 11-2 0V9a1 1 0 011-1zM15 8a1 1 0 011 1v1a1 1 0 11-2 0V9a1 1 0 011-1z" clipRule="evenodd" />
                           <path fillRule="evenodd" d="M10 18a4 4 0 004-4H6a4 4 0 004 4z" clipRule="evenodd" />
                        </svg>
                    </button>
                 </div>
                <button
                    type="submit"
                    disabled={isLoading || (!input.trim() && !attachedFile)}
                    className="px-5 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex-shrink-0"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                </button>
            </form>
        </div>
    );
};