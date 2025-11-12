// components/TiptapEditor.tsx
import React, { useRef, useState, useEffect } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import { marked } from 'marked';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';
import { Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, Code2, Minus, Undo2, Redo2, Table2, Columns2, Rows2, Trash, Trash2, ArrowUpDown, Image as ImageIcon, Film as EmbedIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, X, Highlighter, Palette, Sparkles, ChevronDown } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../services/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import IFrame from './IFrame';
import { RequirementNode } from './RequirementNode';
import { RequirementComponent } from './RequirementComponent';


interface TiptapEditorProps {
    content: string;
    onChange: (markdown: string) => void;
    onSelectionUpdate: (text: string) => void;
    isEditable: boolean;
    onAiAction: (action: 'summarize' | 'expand' | 'rephrase' | 'fix_grammar') => void;
    onCustomAiCommand: () => void;
    isStreaming?: boolean;
}

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndownService.addRule('iframe', {
  filter: 'iframe',
  replacement: function (content, node) {
    const src = (node as HTMLIFrameElement).getAttribute('src') || '';
    return `\n<iframe src="${src}"></iframe>\n`;
  }
});
turndownService.addRule('requirementBlock', {
    filter: (node) => node.nodeName === 'DIV' && node.hasAttribute('data-requirement-block'),
    replacement: (content, node) => {
        const reqId = (node as HTMLElement).getAttribute('data-req-id') || '';
        // Convert the inner content back to Markdown
        const innerMarkdown = turndownService.turndown(node.innerHTML);
        // Recreate the bolded requirement ID format
        return `\n\n**${reqId}:** ${innerMarkdown}\n\n`;
    }
});
// Add rule for highlights (mark tag)
turndownService.addRule('highlight', {
    filter: 'mark',
    replacement: function (content) {
        return `==${content}==`; // Common Markdown syntax for highlight
    }
});

// Add rule for colored text (span with style)
turndownService.addRule('color', {
    filter: function (node) {
        return node.nodeName === 'SPAN' && !!node.getAttribute('style')?.includes('color');
    },
    replacement: function (content, node) {
        const color = (node as HTMLElement).style.color;
        // This is a custom syntax; standard Markdown doesn't have it.
        // It's for internal consistency. When rendered back, it will be parsed.
        return `<span style="color: ${color}">${content}</span>`;
    }
});


const MenuBar = ({ editor, onImageUpload }: { editor: any; onImageUpload: (file: File) => Promise<void> }) => {
    if (!editor) {
        return null;
    }

    const buttonClass = (isActive: boolean) => 
        `p-2 rounded-md ${isActive ? 'bg-slate-300 dark:bg-slate-600' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`;
    
    const handleEmbed = () => {
        const url = window.prompt('Gömülecek URL\'i yapıştırın (YouTube, Figma, Loom, Miro vb.)');
        if (url && editor) {
            editor.chain().focus().setIframe({ src: url }).run();
        }
    };
    
    const handleImageFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onImageUpload(event.target.files[0]);
            event.target.value = '';
        }
    };

    return (
        <div className="flex items-center gap-1 p-2 border-b border-slate-300 dark:border-slate-600 flex-wrap">
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().chain().focus().undo().run()} className={buttonClass(false)} title="Geri Al"><Undo2 className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().chain().focus().redo().run()} className={buttonClass(false)} title="İleri Al"><Redo2 className="h-4 w-4" /></button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={buttonClass(editor.isActive('bold'))} title="Kalın"><Bold className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={buttonClass(editor.isActive('italic'))} title="İtalik"><Italic className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} className={buttonClass(editor.isActive('strike'))} title="Üstü Çizili"><Strikethrough className="h-4 w-4" /></button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <div className="flex items-center p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 relative group">
                <input
                    type="color"
                    onInput={event => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()}
                    value={editor.getAttributes('textStyle').color || (document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#334155')}
                    className="w-5 h-5 border-none bg-transparent cursor-pointer p-0 opacity-0 absolute inset-0"
                    title="Metin Rengi"
                />
                <Palette className="h-4 w-4 pointer-events-none" style={{ color: editor.getAttributes('textStyle').color || 'currentColor' }}/>
            </div>
            <button onClick={() => editor.chain().focus().unsetColor().run()} className={buttonClass(false)} title="Rengi Temizle"><X className="h-4 w-4" /></button>
            <button
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={buttonClass(editor.isActive('highlight'))}
                title="Vurgula"
            >
                <Highlighter className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={buttonClass(editor.isActive({ textAlign: 'left' }))} title="Sola Hizala"><AlignLeft className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={buttonClass(editor.isActive({ textAlign: 'center' }))} title="Ortala"><AlignCenter className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={buttonClass(editor.isActive({ textAlign: 'right' }))} title="Sağa Hizala"><AlignRight className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={buttonClass(editor.isActive({ textAlign: 'justify' }))} title="İki Yana Yasla"><AlignJustify className="h-4 w-4" /></button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={buttonClass(editor.isActive('heading', { level: 2 }))} title="Başlık 1"><Heading2 className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={buttonClass(editor.isActive('heading', { level: 3 }))} title="Başlık 2"><Heading3 className="h-4 w-4" /></button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={buttonClass(editor.isActive('bulletList'))} title="Madde İşaretli Liste"><List className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={buttonClass(editor.isActive('orderedList'))} title="Numaralı Liste"><ListOrdered className="h-4 w-4" /></button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={buttonClass(editor.isActive('blockquote'))} title="Alıntı Bloğu"><Quote className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={buttonClass(editor.isActive('codeBlock'))} title="Kod Bloğu"><Code2 className="h-4 w-4" /></button>
            <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className={buttonClass(false)} title="Yatay Çizgi"><Minus className="h-4 w-4" /></button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <input type="file" id="tiptap-image-upload" className="hidden" accept="image/*" onChange={handleImageFileSelected} />
            <button onClick={() => document.getElementById('tiptap-image-upload')?.click()} className={buttonClass(false)} title="Resim Ekle"><ImageIcon className="h-4 w-4" /></button>
            <button onClick={handleEmbed} className={buttonClass(false)} title="İçerik Göm"><EmbedIcon className="h-4 w-4" /></button>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={buttonClass(false)} title="Tablo Ekle">
                <Table2 className="h-4 w-4" />
            </button>
            {editor.isActive('table') && (
                <>
                    <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} className={buttonClass(editor.isActive('headerRow'))} title="Başlık Satırı Yap/Kaldır"><ArrowUpDown className="h-4 w-4" /></button>
                    <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => editor.chain().focus().addColumnAfter().run()} title="Sütun Ekle" className={buttonClass(false)}><Columns2 className="h-4 w-4" /></button>
                    <button onClick={() => editor.chain().focus().addRowAfter().run()} title="Satır Ekle" className={buttonClass(false)}><Rows2 className="h-4 w-4" /></button>
                    <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => editor.chain().focus().deleteColumn().run()} title="Sütunu Sil" className={buttonClass(false)}><Trash className="h-4 w-4" /></button>
                    <button onClick={() => editor.chain().focus().deleteRow().run()} title="Satırı Sil" className={buttonClass(false)}><Trash className="h-4 w-4" /></button>
                    <button onClick={() => editor.chain().focus().deleteTable().run()} title="Tabloyu Sil" className={buttonClass(false)}><Trash2 className="h-4 w-4 text-red-500" /></button>
                </>
            )}
        </div>
    );
};


export const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, onSelectionUpdate, isEditable, onAiAction, onCustomAiCommand, isStreaming }) => {
    const { user, activeConversation } = useAppContext();
    const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
    const aiMenuRef = useRef<HTMLDivElement>(null);
    const aiButtonRef = useRef<HTMLButtonElement>(null);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node) &&
                aiButtonRef.current && !aiButtonRef.current.contains(event.target as Node)
            ) {
                setIsAiMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const uploadImage = React.useCallback(async (file: File) => {
        if (!user || !activeConversation) {
            alert("Resim yüklemek için lütfen giriş yapın ve bir analiz seçin.");
            throw new Error("Kullanıcı oturumu aktif değil.");
        }
        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${user.id}/${activeConversation.id}/${fileName}`;

        const { error } = await supabase.storage.from('documents').upload(filePath, file);
        if (error) {
            alert(`Resim yüklenemedi: ${error.message}`);
            throw error;
        }

        const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
        if (!data.publicUrl) {
            alert("Yüklenen dosyanın URL'i alınamadı.");
            throw new Error("Yüklenen dosyanın URL'i alınamadı.");
        }
        return data.publicUrl;
    }, [user, activeConversation]);

    const handleImageUpload = React.useCallback(async (file: File, pos?: number) => {
        if (!editor) return;
        try {
            const url = await uploadImage(file);
            const { schema } = editor.view.state;
            const node = schema.nodes.image.create({ src: url });
            const transaction = pos !== undefined
                ? editor.view.state.tr.insert(pos, node)
                : editor.view.state.tr.replaceSelectionWith(node);
            editor.view.dispatch(transaction);
        } catch (error) {
            console.error("Resim yükleme başarısız:", error);
        }
    }, [uploadImage]);
    
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ 
                heading: { levels: [1, 2, 3] }, 
                codeBlock: true,
            }),
            Placeholder.configure({ placeholder: 'Doküman içeriğini buraya yazın...' }),
            Table.configure({ resizable: true }),
            TableRow, TableHeader, TableCell,
            Image,
            IFrame,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            RequirementNode,
            Highlight,
            TextStyle,
            Color,
        ],
        editable: isEditable,
        content: '',
        onCreate({ editor }) {
            const { state, schema, view } = editor;
            const { tr } = state;
            let modified = false;

            const requirementRegex = /\*\*(FR-\d+):\*\*\s*(.*)/g;

            state.doc.descendants((node, pos) => {
                if (node.isText) {
                    const text = node.text ?? '';
                    let match;
                    while ((match = requirementRegex.exec(text)) !== null) {
                        const [fullMatch, reqId, contentText] = match;
                        const start = pos + match.index;
                        const end = start + fullMatch.length;
                        
                        const newNode = schema.nodes.requirementBlock.create(
                            { reqId },
                            schema.text(contentText.trim())
                        );
                        tr.replaceWith(start, end, newNode);
                        modified = true;
                    }
                }
            });
            
            if (modified) {
                view.dispatch(tr);
            }
        },
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
                 if (editor.state.selection.empty) {
                    setIsAiMenuOpen(false);
                }
            }
        },
        editorProps: {
            attributes: {
                class: `prose prose-slate dark:prose-invert max-w-none focus:outline-none p-4 md:p-6 h-full ${isEditable ? '' : 'cursor-text'}`,
            },
            handleDrop: (view, event, slice, moved) => {
                if (!isEditable || moved || !event.dataTransfer || !event.dataTransfer.files || event.dataTransfer.files.length === 0) return false;
                
                const file = event.dataTransfer.files[0];
                if (file.type.startsWith("image/")) {
                    event.preventDefault();
                    const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                    if (coordinates) handleImageUpload(file, coordinates.pos);
                    return true;
                }
                return false;
            },
            handlePaste: (view, event, slice) => {
                 if (!isEditable || !event.clipboardData || !event.clipboardData.files || event.clipboardData.files.length === 0) return false;

                const file = event.clipboardData.files[0];
                if (file.type.startsWith("image/")) {
                    event.preventDefault();
                    handleImageUpload(file);
                    return true;
                }
                return false;
            }
        },
    });

    useEffect(() => {
        if (isStreaming && editor?.view.dom.parentElement) {
            const container = editor.view.dom.parentElement;
            container.scrollTop = container.scrollHeight;
        }
    }, [isStreaming, content, editor]);

    React.useEffect(() => {
        if (editor && !editor.isDestroyed) {
            if (editor.isEditable !== isEditable) editor.setEditable(isEditable);
            
            const currentContentAsMarkdown = turndownService.turndown(editor.getHTML());
            
            const strippedContent = (content || '').replace(/^```(?:markdown|md)?\s*|```\s*$/g, '').trim();

            if (currentContentAsMarkdown !== strippedContent) {
                try {
                    const html = marked.parse(strippedContent, {
                        gfm: true,
                        breaks: true,
                    });
                    const sanitizedHtml = DOMPurify.sanitize(html, { ADD_TAGS: ["iframe", "mark", "span"], ADD_ATTR: ['allowfullscreen', 'frameborder', 'src', 'style'] });
                    editor.commands.setContent(sanitizedHtml, false);
                } catch (e) {
                    console.error("Markdown ayrıştırılırken hata oluştu:", e, "İçerik:", strippedContent);
                    // Fallback to prevent crash, show raw text safely
                    editor.commands.setContent(strippedContent.replace(/</g, "&lt;").replace(/>/g, "&gt;"), false);
                }
            }
        }
    }, [content, isEditable, editor]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {isEditable && editor && <MenuBar editor={editor} onImageUpload={(file) => handleImageUpload(file)} />}
            
            {editor && isEditable && (
                <BubbleMenu
                    editor={editor}
                    tippyOptions={{ duration: 100, animation: 'fade' }}
                    shouldShow={({ state, from, to }) => {
                        const { doc, selection } = state;
                        const { empty } = selection;
                        const text = doc.textBetween(from, to, ' ');
                        return !empty && text.trim().length > 0;
                    }}
                >
                    <div ref={aiMenuRef} className="relative">
                        <button
                            ref={aiButtonRef}
                            onClick={() => setIsAiMenuOpen(prev => !prev)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-xl border border-slate-700"
                        >
                            <Sparkles className="h-4 w-4 text-indigo-400" />
                            AI Asistanı
                            <ChevronDown className="h-4 w-4" />
                        </button>

                        {isAiMenuOpen && (
                            <div className="absolute bottom-full mb-2 w-48 bg-slate-800 text-white rounded-lg shadow-xl border border-slate-700 overflow-hidden py-1 z-10 animate-fade-in-up" style={{animationDuration: '0.1s'}}>
                                <button onClick={() => { onAiAction('summarize'); setIsAiMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2">Özetle</button>
                                <button onClick={() => { onAiAction('expand'); setIsAiMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2">Genişlet</button>
                                <button onClick={() => { onAiAction('rephrase'); setIsAiMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2">Yeniden Yaz</button>
                                <button onClick={() => { onAiAction('fix_grammar'); setIsAiMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2">Dilbilgisini Düzelt</button>
                                <div className="h-px bg-slate-700 my-1"></div>
                                <button onClick={() => { onCustomAiCommand(); setIsAiMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 transition-colors font-semibold">Özel Komut...</button>
                            </div>
                        )}
                    </div>
                </BubbleMenu>
            )}

            <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
        </div>
    );
};