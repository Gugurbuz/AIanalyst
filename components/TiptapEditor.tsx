// components/TiptapEditor.tsx
import React, { useCallback, useRef } from 'react';
// HATA DÜZELTMESİ: BubbleMenu bileşeni react paketinden import edilmeli
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
// HATA DÜZELTMESİ: BubbleMenu eklentisi ayrı import edilmeli
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';

import { supabase } from '../services/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// HATA DÜZELTMESİ: lowlight v3 import yapısı
import { createLowlight } from "lowlight";
import { common } from 'lowlight/common';

import { marked } from 'marked';
import TurndownService from 'turndown';
import * as turndownPluginGfm from 'turndown-plugin-gfm';
import DOMPurify from 'dompurify';
import { 
    Bold, Italic, Heading2, Heading3, List, ListOrdered,
    Strikethrough, Quote, Code, Minus, Undo, Redo, Eraser, Link as LinkIcon,
    Table2, Trash2, Columns, Rows, Sparkles, Code2, ListTodo, Highlighter,
    AlignLeft, AlignCenter, AlignRight, AlignJustify, Image as ImageIcon
} from 'lucide-react';

// HATA DÜZELTMESİ: lowlight v3 kullanımı
const lowlight = createLowlight(common);

interface TiptapEditorProps {
    content: string;
    onChange: (markdown: string) => void;
    onSelectionUpdate: (text: string) => void;
    isEditable: boolean; 
    onAiModifyClick: () => void;
}

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndownService.use(turndownPluginGfm.tables);
turndownService.keep(['img']);
turndownService.addRule('task-list', {
    filter: (node) => {
        return node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem';
    },
    replacement: (content, node) => {
        const checkbox = (node as HTMLLIElement).getAttribute('data-checked') === 'true' ? '[x]' : '[ ]';
        return `- ${checkbox} ${content}\n`;
    }
});


const MenuBar = ({ editor, onImageUpload }: { editor: any, onImageUpload: (file: File) => Promise<void> }) => {
    const imageInputRef = useRef<HTMLInputElement>(null);
    if (!editor) {
        return null;
    }

    const buttonClass = (isActive: boolean) => 
        `p-2 rounded-md ${isActive ? 'bg-slate-300 dark:bg-slate-600' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`;
    
    const plainButtonClass = 'p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed';

    const setLink = useCallback(() => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);

        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
    }, [editor]);

    return (
        <div className="flex items-center gap-1 p-2 border-b border-slate-300 dark:border-slate-600 flex-wrap">
            {/* History */}
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={plainButtonClass} title="Geri Al"><Undo className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={plainButtonClass} title="Yinele"><Redo className="h-4 w-4" /></button>

            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

            {/* Marks */}
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={buttonClass(editor.isActive('bold'))} title="Kalın"><Bold className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={buttonClass(editor.isActive('italic'))} title="İtalik"><Italic className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleStrike().run()} className={buttonClass(editor.isActive('strike'))} title="Üstü Çizili"><Strikethrough className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleCode().run()} className={buttonClass(editor.isActive('code'))} title="Satır İçi Kod"><Code className="h-4 w-4" /></button>
            <button onClick={setLink} className={buttonClass(editor.isActive('link'))} title="Link Ekle"><LinkIcon className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={buttonClass(editor.isActive('highlight'))} title="Vurgula"><Highlighter className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().unsetAllMarks().run()} className={plainButtonClass.replace(' disabled:opacity-50 disabled:cursor-not-allowed', '')} title="Formatı Temizle"><Eraser className="h-4 w-4" /></button>

            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

            {/* Nodes */}
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={buttonClass(editor.isActive('heading', { level: 2 }))} title="Başlık 1"><Heading2 className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={buttonClass(editor.isActive('heading', { level: 3 }))} title="Başlık 2"><Heading3 className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={buttonClass(editor.isActive('bulletList'))} title="Madde İşaretli Liste"><List className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={buttonClass(editor.isActive('orderedList'))} title="Numaralı Liste"><ListOrdered className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={buttonClass(editor.isActive('taskList'))} title="Görev Listesi"><ListTodo className="h-4 w-4" /></button>

            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

            {/* Alignment */}
            <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={buttonClass(editor.isActive({ textAlign: 'left' }))} title="Sola Hizala"><AlignLeft className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={buttonClass(editor.isActive({ textAlign: 'center' }))} title="Ortala"><AlignCenter className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={buttonClass(editor.isActive({ textAlign: 'right' }))} title="Sağa Hizala"><AlignRight className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={buttonClass(editor.isActive({ textAlign: 'justify' }))} title="Yasla"><AlignJustify className="h-4 w-4" /></button>

            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

            {/* Objects */}
            <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={buttonClass(editor.isActive('blockquote'))} title="Alıntı"><Quote className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={buttonClass(editor.isActive('codeBlock'))} title="Kod Bloğu"><Code2 className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className={plainButtonClass.replace(' disabled:opacity-50 disabled:cursor-not-allowed', '')} title="Ayırıcı Çizgi"><Minus className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={plainButtonClass.replace(' disabled:opacity-50 disabled:cursor-not-allowed', '')} title="Tablo Ekle"><Table2 className="h-4 w-4" /></button>
            <input
                type="file"
                accept="image/*"
                ref={imageInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                        onImageUpload(e.target.files[0]);
                        e.target.value = ''; // Reset to allow uploading same file again
                    }
                }}
            />
            <button onClick={() => imageInputRef.current?.click()} className={plainButtonClass.replace(' disabled:opacity-50 disabled:cursor-not-allowed', '')} title="Resim Ekle"><ImageIcon className="h-4 w-4" /></button>

            {/* Table Contextual Menu */}
            {editor.isActive('table') && (
                <>
                    <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => editor.chain().focus().addColumnAfter().run()} className={plainButtonClass} title="Sütun Ekle"><Columns className="h-4 w-4" /></button>
                    <button onClick={() => editor.chain().focus().addRowAfter().run()} className={plainButtonClass} title="Satır Ekle"><Rows className="h-4 w-4" /></button>
                    <button onClick={() => editor.chain().focus().deleteColumn().run()} className={plainButtonClass} title="Sütunu Sil"><Trash2 className="h-4 w-4" /></button>
                    <button onClick={() => editor.chain().focus().deleteRow().run()} className={plainButtonClass} title="Satırı Sil"><Trash2 className="h-4 w-4" /></button>
                    <button onClick={() => editor.chain().focus().deleteTable().run()} className={plainButtonClass} title="Tabloyu Sil"><Table2 className="h-4 w-4 text-red-500" /></button>
                </>
            )}
        </div>
    );
};

const EditorBubbleMenu = ({ editor, onAiModifyClick }: { editor: any, onAiModifyClick: () => void }) => {
    if (!editor) return null;

    const buttonClass = (isActive: boolean) => 
        `p-2 rounded ${isActive ? 'bg-slate-300 dark:bg-slate-600' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`;

    return (
        <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100 }}
            shouldShow={({ editor, view, state, from, to }) => {
                const { doc, selection } = state;
                const { empty } = selection;
                if (empty || !editor.isEditable) return false;
                const text = doc.textBetween(from, to, ' ');
                return text.trim().length > 0;
            }}
        >
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                <button onClick={() => editor.chain().focus().toggleBold().run()} className={buttonClass(editor.isActive('bold'))} title="Kalın"><Bold className="h-4 w-4" /></button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={buttonClass(editor.isActive('italic'))} title="İtalik"><Italic className="h-4 w-4" /></button>
                <button onClick={() => editor.chain().focus().toggleStrike().run()} className={buttonClass(editor.isActive('strike'))} title="Üstü Çizili"><Strikethrough className="h-4 w-4" /></button>
                <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                <button onClick={onAiModifyClick} className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-500" title="AI ile Düzenle">
                    <Sparkles className="h-4 w-4" />
                </button>
            </div>
        </BubbleMenu>
    );
};


export const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, onSelectionUpdate, isEditable, onAiModifyClick }) => {
    
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: false,
            }),
            BubbleMenuExtension, // Eklentiyi buraya ekleyin
            Placeholder.configure({
                placeholder: 'Doküman içeriğini buraya yazın...',
            }),
            Link.configure({
                openOnClick: true,
                autolink: true,
            }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            CodeBlockLowlight.configure({ lowlight }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Highlight,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Image.configure({
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg my-4',
                },
            }),
        ],
        editable: isEditable,
        content: '',
        onUpdate: ({ editor }) => {
            if (isEditable) {
                const markdown = turndownService.turndown(editor.getHTML());
                onChange(markdown);
            }
        },
        onSelectionUpdate: ({ editor }) => {
            if (isEditable) {
                const { from, to } = editor.state.selection;
                const selectedText = editor.state.doc.textBetween(from, to, ' ');
                onSelectionUpdate(selectedText);
            }
        },
        editorProps: {
            attributes: {
                class: `prose prose-slate dark:prose-invert max-w-none focus:outline-none p-4 md:p-6 h-full ${isEditable ? '' : 'cursor-text'}`,
            },
            handleDrop: (view, event, slice, moved) => {
                if (!isEditable) return false;
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        event.preventDefault();
                        handleImageUpload(file);
                        return true;
                    }
                }
                return false;
            },
            handlePaste: (view, event, slice) => {
                if (!isEditable) return false;
                if (event.clipboardData && event.clipboardData.files && event.clipboardData.files[0]) {
                    const file = event.clipboardData.files[0];
                     if (file.type.startsWith('image/')) {
                        event.preventDefault();
                        handleImageUpload(file);
                        return true;
                    }
                }
                return false;
            }
        },
    });

    const handleImageUpload = useCallback(async (file: File) => {
        if (!editor || editor.isDestroyed) return;
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `public/${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('document-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('document-assets')
                .getPublicUrl(filePath);

            if (data.publicUrl) {
                editor.chain().focus().setImage({ src: data.publicUrl }).run();
            } else {
                throw new Error("Yüklenen resim için genel URL alınamadı.");
            }
        } catch (error) {
            console.error("Resim yükleme hatası:", error);
            alert(`Resim yüklenirken bir hata oluştu: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [editor]);

    React.useEffect(() => {
        const updateContent = async () => {
            if (editor && !editor.isDestroyed) {
                if (editor.isEditable !== isEditable) {
                    editor.setEditable(isEditable);
                }
                
                const currentContentAsMarkdown = turndownService.turndown(editor.getHTML());
                if (currentContentAsMarkdown.trim() !== content.trim()) {
                    const html = await marked.parse(content || ''); // marked.parse asenkron
                    const sanitizedHtml = DOMPurify.sanitize(html, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'] });
                    editor.commands.setContent(sanitizedHtml, { emitUpdate: false }); // 2. parametre obje olmalı
                }
            }
        };
        updateContent();
    }, [content, isEditable, editor]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {isEditable && editor && <MenuBar editor={editor} onImageUpload={handleImageUpload} />}
            {editor && <EditorBubbleMenu editor={editor} onAiModifyClick={onAiModifyClick} />}
            <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
        </div>
    );
};