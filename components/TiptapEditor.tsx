// components/TiptapEditor.tsx
import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered } from 'lucide-react';

interface TiptapEditorProps {
    content: string;
    onChange: (markdown: string) => void;
    onSelectionUpdate: (text: string) => void;
    isEditable: boolean; // <-- YENİ PROP
}

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null;
    }

    const buttonClass = (isActive: boolean) => 
        `p-2 rounded-md ${isActive ? 'bg-slate-300 dark:bg-slate-600' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`;

    return (
        <div className="flex items-center gap-1 p-2 border-b border-slate-300 dark:border-slate-600 flex-wrap">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={buttonClass(editor.isActive('bold'))}
                title="Kalın"
            >
                <Bold className="h-4 w-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={buttonClass(editor.isActive('italic'))}
                title="İtalik"
            >
                <Italic className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={buttonClass(editor.isActive('heading', { level: 2 }))}
                title="Başlık 1"
            >
                <Heading2 className="h-4 w-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={buttonClass(editor.isActive('heading', { level: 3 }))}
                 title="Başlık 2"
            >
                <Heading3 className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={buttonClass(editor.isActive('bulletList'))}
                title="Madde İşaretli Liste"
            >
                <List className="h-4 w-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={buttonClass(editor.isActive('orderedList'))}
                title="Numaralı Liste"
            >
                <ListOrdered className="h-4 w-4" />
            </button>
        </div>
    );
};


export const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, onSelectionUpdate, isEditable }) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: false, // Using simple code for now
            }),
            Placeholder.configure({
                placeholder: 'Doküman içeriğini buraya yazın...',
            }),
        ],
        editable: isEditable, // <-- DEĞİŞİKLİK
        content: '', // Start empty, will be populated by useEffect
        onUpdate: ({ editor }) => {
            if (isEditable) { // <-- DEĞİŞİKLİK
                const markdown = turndownService.turndown(editor.getHTML());
                onChange(markdown);
            }
        },
        onSelectionUpdate: ({ editor }) => {
            if (isEditable) { // <-- DEĞİŞİKLİK
                const { from, to } = editor.state.selection;
                const selectedText = editor.state.doc.textBetween(from, to, ' ');
                onSelectionUpdate(selectedText);
            }
        },
        editorProps: {
            attributes: {
                class: `prose prose-slate dark:prose-invert max-w-none focus:outline-none p-4 md:p-6 h-full ${isEditable ? '' : 'cursor-text'}`, // <-- DEĞİŞİKLİK
            },
        },
    });

    React.useEffect(() => {
        if (editor && !editor.isDestroyed) {
            // Sadece 'isEditable' prop'u değiştiyse (örn: düzenle'den çıkıldıysa)
            // editörün düzenlenebilirlik durumunu senkronize et.
            if (editor.isEditable !== isEditable) {
                editor.setEditable(isEditable);
            }
            
            const currentContentAsMarkdown = turndownService.turndown(editor.getHTML());
            if (currentContentAsMarkdown !== content) {
                const html = marked.parse(content || '');
                const sanitizedHtml = DOMPurify.sanitize(html);
                editor.commands.setContent(sanitizedHtml, false); 
            }
        }
    }, [content, isEditable, editor]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {isEditable && <MenuBar editor={editor} />} {/* <-- DEĞİŞİKLİK: Menü çubuğunu sadece düzenlenebilirken göster */}
            <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
        </div>
    );
};