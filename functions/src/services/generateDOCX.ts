import { marked } from 'marked';
import htmlDocx from 'html-docx-js';

/**
 * Genera un .docx profesional a partir de Markdown.
 */
export async function generateDOCX(markdown: string): Promise<Buffer> {
  // 1) Convierte Markdown → HTML
  const html = marked(markdown);

  // 2) Embebe un estilo CSS básico para que se vea bien en Word
  const styledHtml = `
    <html>
      <head>
        <style>
          body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.4; }
          h2 { font-size: 14pt; margin-top: 1em; margin-bottom: .5em; }
          ul  { margin-left: 1.2em; }
          blockquote { margin-left: 1em; color: #555; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

  // 3) Genera el Buffer del docx
  const docxBuffer = htmlDocx.asBuffer(styledHtml, {
    orientation: 'portrait',
    margins: { top: 720, right: 720, bottom: 720, left: 720 }
  });

  return docxBuffer;
}
