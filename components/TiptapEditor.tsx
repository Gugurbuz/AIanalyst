// components/TiptapEditor.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table as TiptapTable } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Highlight } from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextAlign } from '@tiptap/extension-text-align';
import { marked } from 'marked';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';
import { 
    Bold, Italic, Heading2, Heading3, List, ListOrdered, Table2, ChevronDown, Trash2,
    Undo, Redo, Strikethrough, Quote, Code2, Minus, Sparkles, Pencil,
    Underline as UnderlineIcon, Highlighter, ListTodo, AlignLeft, AlignCenter, AlignRight, Link2, RemoveFormatting
} from 'lucide-react';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Extension } from '@tiptap/core';
import { StreamingIndicator } from './StreamingIndicator';

// Custom FontSize extension
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
          renderHTML: attributes => {
            if (!attributes.fontSize) { return {}; }
            return { style: `font-size: ${attributes.fontSize}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).run();
      },
    };
  },
});


interface TiptapEditorProps {
    content: string;
    onChange: (markdown: string) => void;
    onSelectionUpdate: (text: string) => void;
    isEditable: boolean;
    onExplainSelection: (text: string) => void;
    onEditWithAI: (text: string) => void;
    isStreaming?: boolean;
}

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndownService.addRule('tables', {
  filter: ['table'],
  replacement: function (content, node) {
    const table = node as HTMLTableElement;
    let markdown = '';
    const rows = Array.from(table.querySelectorAll('tr'));
    rows.forEach((row, i) => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      markdown += '| ' + cells.map(cell => turndownService.turndown((cell as HTMLElement).innerHTML).replace(/\|/g, '\\|')).join(' | ') + ' |\n';
      if (i === 0 && row.querySelector('th')) {
        markdown += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
      }
    });
    return '\n' + markdown + '\n';
  }
});

const TableMenu = ({ editor }: { editor: Editor }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const menuItems = [
        { label: 'Tablo Ekle', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), disabled: editor.isActive('table') },
        { label: 'Sütun Ekle (Önce)', action: () => editor.chain().focus().addColumnBefore().run() },
        { label: 'Sütun Ekle (Sonra)', action: () => editor.chain().focus().addColumnAfter().run() },
        { label: 'Sütunu Sil', action: () => editor.chain().focus().deleteColumn().run() },
        { label: 'Satır Ekle (Önce)', action: () => editor.chain().focus().addRowBefore().run() },
        { label: 'Satır Ekle (Sonra)', action: () => editor.chain().focus().addRowAfter().run() },
        { label: 'Satırı Sil', action: () => editor.chain().focus().deleteRow().run() },
        { label: 'Tabloyu Sil', action: () => editor.chain().focus().deleteTable().run() },
        { label: 'Başlık Satırı Ekle/Kaldır', action: () => editor.chain().focus().toggleHeaderRow().run() },
    ];
    return (
        <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className={`p-2 rounded-md flex items-center gap-1 ${editor.isActive('table') ? 'bg-slate-300 dark:bg-slate-600' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`} title="Tablo İşlemleri">
                <Table2 className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 z-10">
                    <div className="p-1">
                        {menuItems.map((item, index) => {
                            const isDisabled = item.disabled || (index > 0 && !editor.isActive('table'));
                            return <button key={item.label} onClick={() => { item.action(); setIsOpen(false); }} disabled={isDisabled} className="w-full text-left px-3 py-1.5 text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{item.label}</button>;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const FONT_FACES = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px'];

const MenuBar = ({ editor }: { editor: any | null }) => {
    if (!editor) return null;

    const setLink = useCallback(() => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);
        if (url === null) return;
        if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'default') {
            (editor.chain().focus() as any).unsetFontFamily().run();
        } else {
            (editor.chain().focus() as any).setFontFamily(value).run();
        }
    };

    const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'default') {
            (editor.chain().focus() as any).unsetFontSize().run();
        } else {
            (editor.chain().focus() as any).setFontSize(value).run();
        }
    };
    
    // Optional chaining to prevent crash if getAttributes returns undefined
    const activeFontFamily = editor.getAttributes('textStyle')?.fontFamily?.replace(/['"]+/g, '') || 'default';
    const activeFontSize = editor.getAttributes('textStyle')?.fontSize || 'default';


    const buttonClass = (isActive: boolean) => `p-2 rounded-md ${isActive ? 'bg-slate-300 dark:bg-slate-600' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`;
    const Divider = () => <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>;

    return (
        <div className="flex items-center gap-1 p-2 border-b border-slate-300 dark:border-slate-600 flex-wrap">
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={buttonClass(false)} title="Geri Al"><Undo className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={buttonClass(false)} title="İleri Al"><Redo className="h-4 w-4" /></button>
            <Divider />
            <select value={activeFontFamily} onChange={handleFontFamilyChange} className="tiptap-select" title="Yazı Tipi">
                <option value="default">Varsayılan</option>
                {FONT_FACES.map(font => <option key={font} value={font} style={{fontFamily: font}}>{font}</option>)}
            </select>
             <select value={activeFontSize} onChange={handleFontSizeChange} className="tiptap-select" title="Yazı Tipi Boyutu">
                <option value="default">Varsayılan</option>
                {FONT_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <Divider />
            <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={buttonClass(editor.isActive('bold'))} title="Kalın"><Bold className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={buttonClass(editor.isActive('italic'))} title="İtalik"><Italic className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={!editor.can().chain().focus().toggleUnderline().run()} className={buttonClass(editor.isActive('underline'))} title="Altı Çizili"><UnderlineIcon className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} className={buttonClass(editor.isActive('strike'))} title="Üstü Çizili"><Strikethrough className="h-4 w-4" /></button>
            <button onClick={() => (editor.chain().focus() as any).toggleHighlight().run()} disabled={!editor.can().chain().focus().toggleHighlight().run()} className={buttonClass(editor.isActive('highlight'))} title="Vurgula"><Highlighter className="h-4 w-4" /></button>
            <Divider />
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={buttonClass(editor.isActive('heading', { level: 2 }))} title="Başlık 1"><Heading2 className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={buttonClass(editor.isActive('heading', { level: 3 }))} title="Başlık 2"><Heading3 className="h-4 w-4" /></button>
            <Divider />
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={buttonClass(editor.isActive('bulletList'))} title="Sırasız Liste"><List className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={buttonClass(editor.isActive('orderedList'))} title="Sıralı Liste"><ListOrdered className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={buttonClass(editor.isActive('taskList'))} title="Görev Listesi"><ListTodo className="h-4 w-4" /></button>
            <Divider />
            <button onClick={() => (editor.chain().focus() as any).setTextAlign('left').run()} className={buttonClass(editor.isActive({ textAlign: 'left' }))} title="Sola Hizala"><AlignLeft className="h-4 w-4" /></button>
            <button onClick={() => (editor.chain().focus() as any).setTextAlign('center').run()} className={buttonClass(editor.isActive({ textAlign: 'center' }))} title="Ortala"><AlignCenter className="h-4 w-4" /></button>
            <button onClick={() => (editor.chain().focus() as any).setTextAlign('right').run()} className={buttonClass(editor.isActive({ textAlign: 'right' }))} title="Sağa Hizala"><AlignRight className="h-4 w-4" /></button>
            <Divider />
            <button onClick={setLink} disabled={editor.isActive('link')} className={buttonClass(editor.isActive('link'))} title="Link Ekle"><Link2 className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={buttonClass(editor.isActive('blockquote'))} title="Alıntı Bloğu"><Quote className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={buttonClass(editor.isActive('codeBlock'))} title="Kod Bloğu"><Code2 className="h-4 w-4" /></button>
            <TableMenu editor={editor} />
            <Divider />
            <button onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={buttonClass(false)} title="Formatı Temizle"><RemoveFormatting className="h-4 w-4" /></button>
        </div>
    );
};

export const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, onSelectionUpdate, isEditable, onExplainSelection, onEditWithAI, isStreaming }) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
            }),
            Placeholder.configure({
                placeholder: 'Dokümanınızı buraya yazın veya AI\'nın oluşturmasını bekleyin...',
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                autolink: true,
            }),
            Highlight,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            TiptapTable.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            TextStyle,
            FontFamily,
            FontSize,
        ],
        content: '',
        editable: isEditable,
        onUpdate: ({ editor }) => {
            if (isEditable) {
                const html = editor.getHTML();
                const markdown = turndownService.turndown(html);
                onChange(markdown);
            }
        },
        onSelectionUpdate: ({ editor }) => {
            const { from, to } = editor.state.selection;
            const text = editor.state.doc.textBetween(from, to, ' ');
            onSelectionUpdate(text);
        },
    });

    useEffect(() => {
        if (editor) {
            const html = DOMPurify.sanitize(marked(content) as string);
            const currentHTML = editor.getHTML();
            
            // Only update content if:
            // 1. The content is actually different (ignoring minor whitespace differences if possible, but basic check is usually enough)
            // 2. We are NOT actively streaming (prevent jumping while generating)
            // 3. The editor is NOT focused (prevent jumping while user is typing/editing)
            if (currentHTML !== html && !isStreaming && !editor.isFocused) {
                editor.commands.setContent(html, { emitUpdate: false });
            } else if (currentHTML !== html && isStreaming) {
                // If streaming, we MUST update, but we rely on Tiptap's efficient diffing to try and keep cursor.
                // However, Tiptap setContent usually resets cursor. 
                // For streaming text, we usually append. But here we are setting full content.
                // To support true streaming without cursor jump, we'd need a different approach (insertContent at end),
                // but for now, checking !isFocused prevents the most annoying jumps when USER types.
                editor.commands.setContent(html, { emitUpdate: false });
            }
        }
    }, [content, editor, isStreaming]);
    
    useEffect(() => {
        if (editor) {
            editor.setEditable(isEditable);
        }
    }, [isEditable, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-col h-full tiptap-editor-container">
            {isEditable && <MenuBar editor={editor} />}
            <EditorContent editor={editor} className="flex-1 overflow-y-auto p-4 tiptap-content" />
             {isStreaming && (
                <div className="absolute bottom-4 left-4 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg shadow-md z-20">
                    <StreamingIndicator />
                </div>
            )}
        </div>
    );
};