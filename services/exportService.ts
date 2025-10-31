import { jsPDF } from 'jspdf';
// FIX: Use the functional `autoTable` import instead of a side-effect import.
// This resolves a module augmentation error with 'jspdf' by using a more direct and explicit approach.
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, convertInchesToTwip } from 'docx';


const exportAsMarkdown = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportAsMermaid = (content: string, filename: string): void => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const exportAsSvg = (svgContent: string, filename: string): void => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};


const parseMarkdownTable = (markdown: string): { head: string[][]; body: string[][] } => {
    const lines = markdown.trim().split('\n');
    if (lines.length < 2) return { head: [], body: [] };

    const headerLine = lines[0];
    const separatorLine = lines[1];

    if (!headerLine.includes('|') || !separatorLine.includes('---')) {
        console.error("Not a valid markdown table for parsing");
        return { head: [], body: [] };
    }

    const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);
    const head = [headers];

    const body = lines.slice(2).map(line => {
        // Ensure we handle the start and end pipes correctly
        const cells = line.split('|');
        // Remove the first and last empty strings if they exist, then trim
        return cells.slice(1, cells.length -1).map(cell => cell.trim());
    }).filter(row => row.length > 0 && row.some(cell => cell));
    
    return { head, body };
};


const exportAsPdf = (content: string, filename: string, isTable: boolean): void => {
  // Note: Default jsPDF fonts have limited character support (e.g., for Turkish).
  // For full Unicode support, a custom font would need to be embedded.
  const doc = new jsPDF({
    orientation: isTable ? 'landscape' : 'portrait'
  });

  if (isTable) {
    const { head, body } = parseMarkdownTable(content);
    if (head.length > 0 && body.length > 0) {
        // The table content might contain HTML line breaks `<br>`. Replace them with newlines for jspdf-autotable.
        const cleanedBody = body.map(row => row.map(cell => cell.replace(/<br\s*\/?>/gi, '\n')));
        // FIX: Changed from `doc.autoTable(...)` to the functional call `autoTable(doc, ...)`.
        autoTable(doc, { 
            head, 
            body: cleanedBody,
            styles: {
                font: 'helvetica', // Using a standard font
                fontSize: 8,
            },
            headStyles: {
                fillColor: [30, 41, 59], // slate-800
                textColor: [248, 250, 252] // slate-50
            },
            alternateRowStyles: {
                fillColor: [241, 245, 249] // slate-100
            }
        });
    } else {
        // Fallback for malformed tables
        doc.text("Test senaryoları tablosu ayrıştırılamadı.", 10, 10);
        doc.text(content, 10, 20);
    }
  } else {
    const lines = content.split('\n');
    let y = 15;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = doc.internal.pageSize.width - margin * 2;

    lines.forEach(line => {
        if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }

        let processedLine = line.trim();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        let x = 10;
        
        if (processedLine.startsWith('## ')) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            processedLine = processedLine.substring(3);
            y += 7; // Add extra space before main headers
        } else if (processedLine.startsWith('### ')) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            processedLine = processedLine.substring(4);
            y += 5; // Add extra space before sub-headers
        } else if (processedLine.startsWith('- ') || processedLine.startsWith('* ')) {
            processedLine = `• ${processedLine.substring(2)}`;
            x = 15;
        } else if (/^\d+\.\s/.test(processedLine)) {
            x = 15;
        } else if (processedLine === '') {
            y += 5; // Add space for empty lines (paragraphs)
            return;
        }

        // Handle bold text with a simple regex
        const boldRegex = /\*\*(.*?)\*\*/g;
        let parts = [];
        let lastIndex = 0;
        let match;
        while ((match = boldRegex.exec(processedLine)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ text: processedLine.substring(lastIndex, match.index), bold: false });
            }
            parts.push({ text: match[1], bold: true });
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < processedLine.length) {
            parts.push({ text: processedLine.substring(lastIndex), bold: false });
        }
        
        let currentX = x;
        parts.forEach(part => {
            doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
            doc.text(part.text, currentX, y, {
                maxWidth: contentWidth - (currentX - margin),
            });
            // Approximate text width to position the next part
            currentX += doc.getStringUnitWidth(part.text) * doc.getFontSize() / doc.internal.scaleFactor;
        });

        const splitText = doc.splitTextToSize(processedLine, contentWidth);
        y += (splitText.length * 6) + 2; // Adjust y position based on number of wrapped lines
    });
  }
  doc.save(`${filename}.pdf`);
};

// New function to export as .docx
const exportAsDocx = (content: string, filename: string): void => {
    const lines = content.split('\n');
    const children: (Paragraph | Table)[] = [];
    let inTable = false;
    let tableRows: TableRow[] = [];

    const createParagraph = (line: string) => {
        const runs: TextRun[] = [];
        const parts = line.split(/(\*\*.*?\*\*)/g); // Split by bold tags
        parts.forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
                runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
            } else if (part) {
                runs.push(new TextRun(part.replace(/<br\s*\/?>/gi, '\n')));
            }
        });
        return new Paragraph({ children: runs });
    };

    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        const isTableLine = trimmedLine.startsWith('|') && trimmedLine.endsWith('|');

        if (inTable && !isTableLine) {
            // End of table
            if (tableRows.length > 0) {
                 children.push(new Table({
                    rows: tableRows,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                 }));
            }
            inTable = false;
            tableRows = [];
        }

        if (isTableLine) {
            const cells = trimmedLine.split('|').slice(1, -1).map(cell => new TableCell({
                children: [createParagraph(cell.trim())],
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                },
            }));
            
            if (!inTable) { // This is the header row
                inTable = true;
                tableRows.push(new TableRow({ children: cells, isHeader: true }));
            } else if (!trimmedLine.includes('---')) { // This is a body row
                tableRows.push(new TableRow({ children: cells }));
            }
            // Skip the separator line
            return;
        }

        if (trimmedLine.startsWith('## ')) {
            children.push(new Paragraph({ text: trimmedLine.substring(3), heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
        } else if (trimmedLine.startsWith('### ')) {
            children.push(new Paragraph({ text: trimmedLine.substring(4), heading: HeadingLevel.HEADING_2, spacing: { before: 150, after: 80 } }));
        } else if (trimmedLine.startsWith('• ')) {
            children.push(new Paragraph({ text: trimmedLine.substring(2), bullet: { level: 0 } }));
        } else if (trimmedLine === '---') {
             children.push(new Paragraph({ text: '', border: { bottom: { color: "auto", space: 1, style: "single", size: 6 } }, spacing: { after: 200, before: 200 } }));
        }
         else if (trimmedLine) {
            children.push(createParagraph(trimmedLine));
        } else {
            children.push(new Paragraph('')); // Empty line
        }
    });

    // Add any remaining table
    if (inTable && tableRows.length > 0) {
        children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });

    Packer.toBlob(doc).then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });
};


export const exportService = { exportAsMarkdown, exportAsPdf, exportAsMermaid, exportAsSvg, exportAsDocx };