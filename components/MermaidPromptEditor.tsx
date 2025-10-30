import React, { useState, useEffect, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import mermaid from 'mermaid';

// TypeScript declaration for the global Prism object loaded from a script tag
declare const Prism: {
    highlight: (code: string, language: any, grammar: string) => string;
    languages: {
        mermaid: any;
    };
};

interface MermaidPromptEditorProps {
    value: string;
    onValueChange: (value: string) => void;
}

const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

const renderMermaid = async (id: string, code: string): Promise<{ svg: string; error?: undefined } | { svg: string; error: any }> => {
    try {
        const { svg } = await mermaid.render(id, code.trim());
        return { svg };
    } catch (e) {
        return { svg: '', error: e };
    }
};

const generateId = () => `mermaid-preview-${Math.random().toString(36).substring(2, 9)}`;


export const MermaidPromptEditor: React.FC<MermaidPromptEditorProps> = ({ value, onValueChange }) => {
    const [previewSvg, setPreviewSvg] = useState('');
    const [previewError, setPreviewError] = useState('');
    const debouncedValue = useDebounce(value, 500);
    const componentId = useRef<string>(generateId());
    
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: document.body.classList.contains('dark') ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: 'Inter, sans-serif'
        });
    }, []);

    useEffect(() => {
        if (debouncedValue) {
            const renderPreview = async () => {
                const result = await renderMermaid(componentId.current, debouncedValue);
                if (result.error) {
                    setPreviewError(result.error instanceof Error ? result.error.message : 'Geçersiz sözdizimi.');
                    setPreviewSvg('');
                } else {
                    setPreviewSvg(result.svg);
                    setPreviewError('');
                }
            };
            renderPreview();
        } else {
            setPreviewSvg('');
            setPreviewError('');
        }
    }, [debouncedValue]);


    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
            {/* Editor Panel */}
            <div className="relative h-full w-full bg-[#2d2d2d] rounded-md overflow-hidden border border-slate-300 dark:border-slate-600">
                 <style>
                    {`
                        .code-editor-textarea:focus {
                            outline: none;
                        }
                        .code-editor {
                            caret-color: white;
                        }
                    `}
                </style>
                <Editor
                    value={value}
                    onValueChange={onValueChange}
                    highlight={code => Prism.highlight(code, Prism.languages.mermaid, 'mermaid').replace(/&lt;/g, '<')}
                    padding={12}
                    textareaClassName="code-editor-textarea"
                    className="code-editor h-full w-full overflow-auto"
                    style={{
                        fontFamily: '"Fira Code", "Fira Mono", monospace',
                        fontSize: 14,
                        lineHeight: '1.5',
                    }}
                />
            </div>
            {/* Preview Panel */}
            <div className="relative h-full bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-600 flex items-center justify-center p-2 overflow-hidden">
                {previewError ? (
                    <div className="text-red-500 text-sm p-4 font-mono whitespace-pre-wrap">{previewError}</div>
                ) : previewSvg ? (
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: previewSvg }} />
                ) : (
                    <div className="text-slate-400">Kod yazarken önizleme burada görünecek...</div>
                )}
            </div>
        </div>
    );
};