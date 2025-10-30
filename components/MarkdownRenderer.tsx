import React, { useMemo } from 'react';

interface MarkdownRendererProps {
    content: string;
    highlightedLines?: number[];
    rephrasingText?: string | null;
    highlightedUserSelectionText?: string | null;
}

// Helper to escape regex special characters
const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};


const parseMarkdown = (text: string, highlightedLines: number[], rephrasingText: string | null, highlightedUserSelectionText: string | null): string => {
    if (!text) return '';

    let lines = text.split('\n');
    let html = '';
    let inUnorderedList = false;
    let inOrderedList = false;
    let inTable = false;

    const closeLists = () => {
        if (inUnorderedList) { html += '</ul>'; inUnorderedList = false; }
        if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
    };
    
    const processInline = (line: string) => {
        let processed = line
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>')
            .replace(/<br\s*\/?>/gi, '<br>');
        
        // This handles the loading pulse while waiting for the AI
        if (rephrasingText && processed.includes(rephrasingText)) {
            const regex = new RegExp(escapeRegExp(rephrasingText), 'g');
            processed = processed.replace(regex, `<span class="rephrasing-pulse rounded-md">${rephrasingText}</span>`);
        // This handles keeping the text highlighted for the user
        } else if (highlightedUserSelectionText && processed.includes(highlightedUserSelectionText)) {
            const regex = new RegExp(escapeRegExp(highlightedUserSelectionText), 'g');
            processed = processed.replace(regex, `<span class="user-selection-highlight rounded-md">${highlightedUserSelectionText}</span>`);
        }
        
        return processed;
    };
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const isHighlighted = highlightedLines.includes(i);
        
        const startTag = isHighlighted ? `<div class="highlight-new rounded-md -mx-2 px-2">` : '';
        const endTag = isHighlighted ? `</div>` : '';


        const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');
        const isHeaderSeparator = i + 1 < lines.length && lines[i+1].match(/^\|(?:\s*:?-+:?\s*\|)+$/);

        if (isTableLine && isHeaderSeparator) {
            closeLists();
            if (inTable) html += '</tbody></table></div>'; 
            
            const headers = line.split('|').slice(1, -1).map(h => h.trim());
            html += `${startTag}<div class="overflow-x-auto my-5"><table class="w-full text-sm border-collapse border border-slate-300 dark:border-slate-600">
                        <thead class="bg-slate-100 dark:bg-slate-800">
                            <tr>${headers.map(h => `<th class="p-3 font-semibold text-left border border-slate-300 dark:border-slate-600">${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>${endTag}`;
            inTable = true;
            i++; 
            continue;
        }

        if (inTable) {
            if (isTableLine) {
                const cells = line.split('|').slice(1, -1).map(c => c.trim());
                 html += `${startTag}<tr class="border-t border-slate-200 dark:border-slate-700 even:bg-slate-50 dark:even:bg-slate-800/50">${cells.map(c => `<td class="p-3 border border-slate-300 dark:border-slate-600">${processInline(c)}</td>`).join('')}</tr>${endTag}`;
                continue;
            } else {
                html += '</tbody></table></div>';
                inTable = false;
            }
        }
        
        if (line.startsWith('## ')) {
            closeLists();
            html += `${startTag}<h2>${processInline(line.substring(3))}</h2>${endTag}`;
            continue;
        }
        if (line.startsWith('### ')) {
            closeLists();
            html += `${startTag}<h3>${processInline(line.substring(4))}</h3>${endTag}`;
            continue;
        }
        
        if (line.startsWith('> **İyileştirme Alanı:**')) {
             closeLists();
             let blockContent = `<p class="font-semibold mb-2">${processInline(line.substring(2))}</p><ul class="space-y-1">`;
             while (i + 1 < lines.length && lines[i+1].startsWith('>')) {
                 i++;
                 const blockLine = lines[i].substring(1).trim();
                 if (blockLine.startsWith('- ')) {
                    blockContent += `<li class="text-sm list-disc list-inside">${processInline(blockLine.substring(2))}</li>`;
                 } else {
                    blockContent += `<p class="text-sm">${processInline(blockLine)}</p>`;
                 }
             }
             blockContent += '</ul>';
             html += `${startTag}<div class="my-4 p-4 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/50 rounded-r-lg text-amber-800 dark:text-amber-200">${blockContent}</div>${endTag}`;
             continue;
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
            if (inOrderedList) closeLists();
            if (!inUnorderedList) { html += '<ul class="list-disc space-y-1 pl-6">'; inUnorderedList = true; }
            html += `${startTag}<li>${processInline(line.substring(2))}</li>${endTag}`;
            continue;
        }

        if (/^\d+\.\s/.test(line)) {
            if (inUnorderedList) closeLists();
            if (!inOrderedList) { html += '<ol class="list-decimal space-y-1 pl-6">'; inOrderedList = true; }
            html += `${startTag}<li>${processInline(line.replace(/^\d+\.\s/, ''))}</li>${endTag}`;
            continue;
        }
        
        closeLists();

        if (line.trim() === '---') {
            html += `${startTag}<hr class="my-6 border-slate-200 dark:border-slate-700"/>${endTag}`;
            continue;
        }
        
        if (line.trim() !== '') {
            html += `${startTag}<p>${processInline(line)}</p>${endTag}`;
        } else {
             html += '<br/>';
        }
    }
    
    closeLists();
    if (inTable) html += '</tbody></table></div>';
    
    return html.replace(/(<br\s*\/?>\s*){3,}/g, '<br/><br/>');
};


export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, highlightedLines = [], rephrasingText = null, highlightedUserSelectionText = null }) => {
    const htmlContent = useMemo(() => parseMarkdown(content, highlightedLines, rephrasingText, highlightedUserSelectionText), [content, highlightedLines, rephrasingText, highlightedUserSelectionText]);

    return (
        <div
            className="prose prose-slate dark:prose-invert max-w-none prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-700 prose-h3:mt-5 prose-h3:mb-2 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
    );
};