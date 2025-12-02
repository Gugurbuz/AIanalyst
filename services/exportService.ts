import { jsPDF } from 'jspdf';
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

const exportAsPng = (svgContent: string, filename: string): void => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
        // Add some padding for better aesthetics
        const padding = 20;
        canvas.width = img.width + padding * 2;
        canvas.height = img.height + padding * 2;

        if (ctx) {
            // Fill background
            ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff'; // slate-900 or white
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw the image with padding
            ctx.drawImage(img, padding, padding);

            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    img.onerror = (e) => {
        console.error("Error loading SVG image for PNG conversion:", e);
        alert("Diyagram PNG'ye dönüştürülürken bir hata oluştu.");
    };

    // Use a base64 data URI to handle SVG content more reliably.
    // The trick `unescape(encodeURIComponent(svgContent))` is to handle multi-byte characters correctly before base64 encoding.
    const dataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
    img.src = dataUri;
};

const exportBpmnAsHtml = (bpmnXml: string, filename: string): void => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${filename}</title>
    <link rel="stylesheet" href="https://unpkg.com/bpmn-js@17.0.2/dist/assets/diagram-js.css">
    <link rel="stylesheet" href="https://unpkg.com/bpmn-js@17.0.2/dist/assets/bpmn-font/css/bpmn.css">
    <style>
        html, body, #container {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #ffffff;
        }
        @media (prefers-color-scheme: dark) {
            body { background-color: #0f172a; }
        }
        /* Hide the bpmn.io logo */
        .bjs-powered-by { display: none !important; }
    </style>
</head>
<body>
    <div id="container"></div>
    <script src="https://unpkg.com/bpmn-js@17.0.2/dist/bpmn-viewer.development.js"></script>
    <script>
        const bpmnXML = \`${bpmnXml.replace(/`/g, '\\`')}\`;
        const viewer = new BpmnJS({ container: '#container' });
        async function openDiagram() {
          try {
            await viewer.importXML(bpmnXML);
            viewer.get('canvas').zoom('fit-viewport');
          } catch (err) {
            console.error('Could not import BPMN 2.0 diagram', err);
            const container = document.getElementById('container');
            container.innerHTML = '<div style="color: red; text-align: center;"><h2>Error rendering BPMN</h2><pre>' + err.message + '</pre></div>';
          }
        }
        openDiagram();
    </script>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.html`;
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
        const cells = line.split('|');
        return cells.slice(1, cells.length -1).map(cell => cell.trim());
    }).filter(row => row.length > 0 && row.some(cell => cell));
    
    return { head, body };
};


const exportAsPdf = (content: string, filename: string, isTable: boolean): void => {
  const doc = new jsPDF({
    orientation: isTable ? 'landscape' : 'portrait'
  });

  if (isTable) {
    const { head, body } = parseMarkdownTable(content);
    if (head.length > 0 && body.length > 0) {
        const cleanedBody = body.map(row => row.map(cell => cell.replace(/<br\s*\/?>/gi, '\n')));
        autoTable(doc, { 
            head, 
            body: cleanedBody,
            styles: {
                font: 'helvetica',
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
        doc.text("Tablo ayrıştırılamadı.", 10, 10);
        doc.text(content, 10, 20);
    }
  } else {
    // Basic text export for non-table content
    doc.text(content, 10, 10);
  }
  doc.save(`${filename}.pdf`);
};

const exportAsDocx = (content: string, filename: string): void => {
    const lines = content.split('\n');
    const children: (Paragraph | Table)[] = [];
    let inTable = false;
    let tableRows: TableRow[] = [];

    const createParagraph = (line: string) => {
        const runs: TextRun[] = [];
        const parts = line.split(/(\*\*.*?\*\*)/g);
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
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" }, left: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" }, right: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" } },
            }));
            
            if (!inTable) { 
                inTable = true;
                tableRows.push(new TableRow({ children: cells, tableHeader: true }));
            } else if (!trimmedLine.includes('---')) {
                tableRows.push(new TableRow({ children: cells }));
            }
            return;
        }

        if (trimmedLine.startsWith('# ')) {
            children.push(new Paragraph({ text: trimmedLine.substring(2), heading: HeadingLevel.TITLE, spacing: { after: 200 } }));
        } else if (trimmedLine.startsWith('## ')) {
            children.push(new Paragraph({ text: trimmedLine.substring(3), heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
        } else if (trimmedLine.startsWith('### ')) {
            children.push(new Paragraph({ text: trimmedLine.substring(4), heading: HeadingLevel.HEADING_2, spacing: { before: 150, after: 80 } }));
        } else if (trimmedLine.startsWith('• ') || trimmedLine.startsWith('- ')) {
            const text = trimmedLine.startsWith('• ') ? trimmedLine.substring(2) : trimmedLine.substring(2);
            children.push(new Paragraph({ text: text, bullet: { level: 0 } }));
        } else if (trimmedLine === '---') {
             children.push(new Paragraph({ text: '', border: { bottom: { color: "auto", space: 1, style: "single", size: 6 } }, spacing: { after: 200, before: 200 } }));
        }
         else if (trimmedLine) {
            children.push(createParagraph(trimmedLine));
        } else {
            children.push(new Paragraph(''));
        }
    });

    if (inTable && tableRows.length > 0) {
        children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    }

    const doc = new Document({
        sections: [{ properties: {}, children: children }],
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


export const exportService = { exportAsMarkdown, exportAsPdf, exportAsSvg, exportAsPng, exportAsDocx, exportBpmnAsHtml };