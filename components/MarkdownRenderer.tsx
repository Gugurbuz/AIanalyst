import React, { useMemo } from 'react';

interface MarkdownRendererProps {
    content: string;
}

const parseMarkdown = (text: string): string => {
    if (!text) return '';

    const lines = text.split('\n');
    let html = '';
    let inUnorderedList = false;
    let inOrderedList = false;
    let inTable = false;

    const closeLists = () => {
        if (inUnorderedList) { html += '</ul>'; inUnorderedList = false; }
        if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
    };
    
    // Process inline formatting like bold text and line breaks
    const processInline = (line: string) => {
        return line
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>')
            .replace(/<br\s*\/?>/gi, '<br>');
    };
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Check for start of a table
        const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');
        // A more robust regex to check for the separator line, with or without alignment colons.
        const isHeaderSeparator = i + 1 < lines.length && lines[i+1].match(/^\|(?:\s*:?-+:?\s*\|)+$/);

        if (isTableLine && isHeaderSeparator) {
            closeLists();
            if (inTable) html += '</tbody></table></div>'; // Close previous table
            
            const headers = line.split('|').slice(1, -1).map(h => h.trim());
            html += `<div class="overflow-x-auto my-5"><table class="w-full text-sm border-collapse border border-slate-300 dark:border-slate-600">
                        <thead class="bg-slate-100 dark:bg-slate-800">
                            <tr>${headers.map(h => `<th class="p-3 font-semibold text-left border border-slate-300 dark:border-slate-600">${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>`;
            inTable = true;
            i++; // Skip separator line
            continue;
        }

        if (inTable) {
            if (isTableLine) {
                const cells = line.split('|').slice(1, -1).map(c => c.trim());
                html += `<tr class="border-t border-slate-200 dark:border-slate-700 even:bg-slate-50 dark:even:bg-slate-800/50">${cells.map(c => `<td class="p-3 border border-slate-300 dark:border-slate-600">${processInline(c)}</td>`).join('')}</tr>`;
                continue;
            } else {
                html += '</tbody></table></div>';
                inTable = false;
                // Fall through to process this line as normal text
            }
        }
        
        // Headings
        if (line.startsWith('## ')) {
            closeLists();
            html += `<h2 class="text-2xl font-bold text-slate-800 dark:text-slate-200">${processInline(line.substring(3))}</h2>`;
            continue;
        }
        if (line.startsWith('### ')) {
            closeLists();
            html += `<h3 class="text-xl font-semibold text-slate-700 dark:text-slate-300">${processInline(line.substring(4))}</h3>`;
            continue;
        }
        
        // Special "Improvement Area" Quote Block
        if (line.startsWith('> **İyileştirme Alanı:**')) {
             closeLists();
             let blockContent = `<p class="font-semibold mb-2">${processInline(line.substring(2))}</p><ul class="space-y-1">`;
             // Collect all subsequent lines of the block
             while (i + 1 < lines.length && lines[i+1].startsWith('>')) {
                 i++;
                 const blockLine = lines[i].substring(1).trim(); // Remove ">"
                 if (blockLine.startsWith('- ')) {
                    blockContent += `<li class="text-sm list-disc list-inside">${processInline(blockLine.substring(2))}</li>`;
                 } else {
                    blockContent += `<p class="text-sm">${processInline(blockLine)}</p>`;
                 }
             }
             blockContent += '</ul>';
             html += `<div class="my-4 p-4 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/50 rounded-r-lg text-amber-800 dark:text-amber-200">${blockContent}</div>`;
             continue;
        }

        // Unordered List
        if (line.startsWith('- ') || line.startsWith('* ')) {
            if (inOrderedList) closeLists();
            if (!inUnorderedList) { html += '<ul class="list-disc space-y-1 pl-6">'; inUnorderedList = true; }
            html += `<li>${processInline(line.substring(2))}</li>`;
            continue;
        }

        // Ordered List
        if (/^\d+\.\s/.test(line)) {
            if (inUnorderedList) closeLists();
            if (!inOrderedList) { html += '<ol class="list-decimal space-y-1 pl-6">'; inOrderedList = true; }
            html += `<li>${processInline(line.replace(/^\d+\.\s/, ''))}</li>`;
            continue;
        }
        
        closeLists();

        // Horizontal Rule
        if (line.trim() === '---') {
            html += '<hr class="my-6 border-slate-200 dark:border-slate-700"/>';
            continue;
        }
        
        // Paragraphs
        if (line.trim() !== '') {
            html += `<p>${processInline(line)}</p>`;
        } else {
             html += '<br/>'; // Preserve empty lines as breaks
        }
    }
    
    // Close any open tags at the end of the document
    closeLists();
    if (inTable) html += '</tbody></table></div>';
    
    // A simple fix to avoid large gaps from multiple <br/> tags.
    return html.replace(/(<br\s*\/?>\s*){3,}/g, '<br/><br/>');
};


export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    const htmlContent = useMemo(() => parseMarkdown(content), [content]);

    return (
        <div
            className="prose prose-slate dark:prose-invert max-w-none prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-700 prose-h3:mt-5 prose-h3:mb-2 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
    );
};
