// components/TiptapEditor.tsx
import React from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
// YENİ EKLENEN IMPORTLAR (npm'den)
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import DOMPurify from 'dompurify';
import { 
    Bold, Italic, Heading2, Heading3, List, ListOrdered, Table as TableIcon,
    Trash2, GitMerge, Combine, Pilcrow,
    ArrowUpFromLine, ArrowDownFromLine, ArrowLeftFromLine, ArrowRightFromLine,
    Columns, Rows
} from 'lucide-react';

// ARTIK 'turndown' VEYA 'marked' IMPORT ETMİYORUZ

interface TiptapEditorProps {
    content: string; // Artık HTML alacak
    onChange: (html: string) => void; // Artık HTML döndürecek
    onSelectionUpdate: (text: string) => void;
    isEditable: boolean;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) return null;
    const buttonClass = (isActive: boolean) => 
        `p-2 rounded-md ${isActive ? 'bg-slate-300 dark:bg-slate-600' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`;

    return (
        <div className="flex items-center gap-1 p-2 border-b border-slate-300 dark:border-slate-600 flex-wrap">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={buttonClass(editor.isActive('bold'))} title="Kalın">
                <Bold className="h-4 w-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={buttonClass(editor.isActive('italic'))} title="İtalik">
                <Italic className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={buttonClass(editor.isActive('heading', { level: 2 }))} title="Başlık 1">
                <Heading2 className="h-4 w-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={buttonClass(editor.isActive('heading', { level: 3 }))} title="Başlık 2">
                <Heading3 className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={buttonClass(editor.isActive('bulletList'))} title="Liste">
                <List className="h-4 w-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={buttonClass(editor.isActive('orderedList'))} title="Numaralı Liste">
                <ListOrdered className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
             <button
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                className={buttonClass(false)} title="Tablo Ekle">
                <TableIcon className="h-4 w-4" />
            </button>
        </div>
    );
};


export const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, onSelectionUpdate, isEditable }) => {
    const isUpdatingRef = React.useRef(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({
                placeholder: 'Doküman içeriğini buraya yazın...',
            }),
            Table.configure({
                resizable: true,
                cellMinWidth: 50,
            }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        editable: isEditable,
        content: '',

        onUpdate: ({ editor }) => {
            if (isEditable && !isUpdatingRef.current) {
                const html = editor.getHTML();
                onChange(html);
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
        },
    });

    React.useEffect(() => {
        if (!editor || editor.isDestroyed) return;

        if (editor.isEditable !== isEditable) {
            editor.setEditable(isEditable);
        }

        const currentContentAsHTML = editor.getHTML();

        if (currentContentAsHTML !== content) {
            isUpdatingRef.current = true;
            const sanitizedHtml = DOMPurify.sanitize(content || '', {
                ADD_TAGS: ["table", "thead", "tbody", "tr", "th", "td", "col", "colgroup"],
                ADD_ATTR: ["colspan", "rowspan", "colwidth"]
            });
            editor.commands.setContent(sanitizedHtml, false);
            setTimeout(() => {
                isUpdatingRef.current = false;
            }, 0);
        }
    }, [content, isEditable, editor]);

    React.useEffect(() => {
        return () => {
            if (editor && !editor.isDestroyed) {
                editor.destroy();
            }
        };
    }, [editor]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {editor && isEditable && (
                // YENİ EKLENEN TABLO KONTROL MENÜSÜ
                <BubbleMenu 
                    editor={editor} 
                    tippyOptions={{ duration: 100, zIndex: 25 }}
                    shouldShow={({ editor }) => editor.isActive('table')}
                    className="flex items-center gap-1 p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700"
                >
                    <button onClick={() => editor.chain().focus().addColumnBefore().run()} title="Sola Sütun Ekle"><ArrowLeftFromLine className="h-4 w-4"/></button>
                    <button onClick={() => editor.chain().focus().addColumnAfter().run()} title="Sağa Sütun Ekle"><ArrowRightFromLine className="h-4 w-4"/></button>
                    <button onClick={() => editor.chain().focus().deleteColumn().run()} title="Sütunu Sil"><Columns className="h-4 w-4"/></button>
                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => editor.chain().focus().addRowBefore().run()} title="Yukarı Satır Ekle"><ArrowUpFromLine className="h-4 w-4"/></button>
                    <button onClick={() => editor.chain().focus().addRowAfter().run()} title="Aşağı Satır Ekle"><ArrowDownFromLine className="h-4 w-4"/></button>
                    <button onClick={() => editor.chain().focus().deleteRow().run()} title="Satırı Sil"><Rows className="h-4 w-4"/></button>
                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => editor.chain().focus().mergeCells().run()} title="Hücreleri Birleştir"><Combine className="h-4 w-4"/></button>
                    <button onClick={() => editor.chain().focus().splitCell().run()} title="Hücreyi Ayır"><GitMerge className="h-4 w-4"/></button>
                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                     <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Başlık Satırı"><Pilcrow className="h-4 w-4"/></button>
                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => editor.chain().focus().deleteTable().run()} title="Tabloyu Sil"><Trash2 className="h-4 w-4 text-red-500"/></button>
                </BubbleMenu>
            )}
            
            {isEditable && <MenuBar editor={editor} />}
            <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
        </div>
    );
};