// components/RichTextEditor.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill';
import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';

interface RichTextEditorProps {
    value: string; // Markdown content
    onChange: (value: string) => void; // Called with Markdown content
    placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
    const md = useMemo(() => new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true
    }), []);
    
    const turndownService = useMemo(() => {
        const service = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        // Add rules for consistent markdown
        service.addRule('strong', {
            filter: ['strong', 'b'],
            replacement: (content) => '**' + content + '**'
        });
         service.addRule('emphasis', {
            filter: ['em', 'i'],
            replacement: (content) => '*' + content + '*'
        });
        return service;
    }, []);

    // This state holds the HTML content for ReactQuill
    const [editorHtml, setEditorHtml] = useState(() => md.render(value || ''));
    
    // Ref to prevent re-rendering from our own onChange call
    const lastMarkdownValue = useRef(value);

    // When the parent `value` (Markdown) changes, update the editor's HTML
    useEffect(() => {
        if (value !== lastMarkdownValue.current) {
            const newHtml = md.render(value || '');
            setEditorHtml(newHtml);
            lastMarkdownValue.current = value;
        }
    }, [value, md]);

    const handleChange = (html: string) => {
        setEditorHtml(html);
        const markdown = turndownService.turndown(html);
        // Only call onChange if the markdown has actually changed
        if (markdown !== lastMarkdownValue.current) {
            lastMarkdownValue.current = markdown;
            onChange(markdown);
        }
    };

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{'list': 'ordered'}, {'list': 'bullet'}],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            ['link'],
            ['clean']
        ],
    };

    return (
        <div className="h-full w-full bg-white dark:bg-slate-900 overflow-hidden quill-editor-container">
             <style>{`
                .quill-editor-container,
                .quill-editor-container .ql-container,
                .quill-editor-container .ql-editor {
                    height: 100%;
                }
                .quill-editor-container .ql-container {
                     height: calc(100% - 42px); /* Subtract toolbar height */
                }
            `}</style>
            <ReactQuill
                theme="snow"
                value={editorHtml}
                onChange={handleChange}
                modules={modules}
                placeholder={placeholder}
                className="h-full border-none"
            />
        </div>
    );
};
