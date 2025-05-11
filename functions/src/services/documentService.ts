import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';
import htmlDocx from 'html-docx-js';
import PdfPrinter from 'pdfmake';
import htmlToPdfmake from 'html-to-pdfmake';
import { JSDOM } from 'jsdom';

// Ruta al directorio de fuentes empaquetadas
const fontsDir = path.join(__dirname, '../fonts/Roboto/static');

// Carga de los archivos .ttf como Buffers
const robotoRegular      = fs.readFileSync(path.join(fontsDir, 'Roboto-Regular.ttf'));
const robotoMedium       = fs.readFileSync(path.join(fontsDir, 'Roboto-Medium.ttf'));
const robotoItalic       = fs.readFileSync(path.join(fontsDir, 'Roboto-Italic.ttf'));
const robotoMediumItalic = fs.readFileSync(path.join(fontsDir, 'Roboto-MediumItalic.ttf'));

// Configuración de PdfPrinter usando buffers de fuentes
const fontsConfig = {
  Roboto: {
    normal:      robotoRegular,
    bold:        robotoMedium,
    italics:     robotoItalic,
    bolditalics: robotoMediumItalic,
  }
};

const printer = new PdfPrinter(fontsConfig);

export interface AllDocuments {
  pdfBuffer: Uint8Array;
  previewPdfBuffer: Uint8Array;
  docxBuffer: Buffer;
}

export async function generateAllDocuments(htmlFromLLM: string): Promise<AllDocuments> {
  // 1) Convertir HTML a contenido para pdfmake
  const { window } = new JSDOM('');
  let pdfMakeContent;
  try {
    pdfMakeContent = htmlToPdfmake(htmlFromLLM, { window: window as any });
  } catch (err: any) {
    console.error('[generateAllDocuments] Fallo al convertir HTML a pdfMakeContent:', err);
    throw new Error(`Fallo al convertir HTML a formato PDF: ${err.message}`);
  }

  // Definición del documento PDF
  const docDefinition: any = {
    content: pdfMakeContent,
    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.4 },
    fonts: fontsConfig,
    styles: {
      h1: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
      h2: { fontSize: 18, bold: true, margin: [0, 10, 0, 8] },
      h3: { fontSize: 16, bold: true, margin: [0, 8, 0, 6] },
      h4: { fontSize: 14, bold: true, margin: [0, 6, 0, 4] },
      p:  { margin: [0, 0, 0, 10] },
      blockquote: { italics: true, color: '#555555', margin: [0, 5, 0, 10] },
      ul: { margin: [0, 5, 0, 10] },
      ol: { margin: [0, 5, 0, 10] },
      strong: { bold: true },
      em:     { italics: true },
    },
    pageMargins: [40, 40, 40, 40],
  };

  // 2) Generar PDF completo
  const pdfDocGenerator = printer.createPdfKitDocument(docDefinition);
  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    pdfDocGenerator.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    pdfDocGenerator.on('end', () => resolve());
    pdfDocGenerator.on('error', (err) => reject(new Error(`Error generando PDF: ${err.message}`)));
    pdfDocGenerator.end();
  });
  if (chunks.length === 0) throw new Error('El stream de PDF no generó datos.');
  const pdfBuffer = new Uint8Array(Buffer.concat(chunks));

  // 3) Crear PDF de preview con líneas tachadas
  const pdfDocInstance = await PDFDocument.load(pdfBuffer);
  const { width, height } = pdfDocInstance.getPage(0).getSize();
  const yStart = height / 2;
  const xMargin = width * 0.05;
  const usableWidth = width - 2 * xMargin;
  const strokes = 7;
  const spacing = (height / 2) / strokes;
  for (const page of pdfDocInstance.getPages()) {
    for (let i = 0; i < strokes; i++) {
      const y = yStart - i * spacing + (Math.random() * spacing * 0.3 - spacing * 0.15);
      const wobble = Math.random() * 15 - 7.5;
      const thickness = 18 + Math.random() * 12;
      page.drawLine({
        start:  { x: xMargin, y: y + (Math.random() * 6 - 3) },
        end:    { x: xMargin + usableWidth + wobble, y: y + (Math.random() * 6 - 3) },
        color:  rgb(0.15, 0.15, 0.15),
        thickness,
        opacity: 0.75,
      });
    }
  }
  const previewPdfBuffer = new Uint8Array(await pdfDocInstance.save());

  // 4) Generar DOCX desde HTML
  const styledHtmlForDocx = `
<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Calibri, 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 1in; }
    h1 { font-size: 16pt; font-weight: bold; margin-top: 1.5em; margin-bottom: 0.5em; color: #2F5496; }
    h2 { font-size: 14pt; font-weight: bold; margin-top: 1.2em; margin-bottom: 0.4em; color: #2F5496; }
    h3 { font-size: 12pt; font-weight: bold; margin-top: 1em; margin-bottom: 0.3em; color: #4A86E8; }
    p { margin-bottom: 0.5em; text-align: justify; }
    ul, ol { margin-left: 0.25in; margin-bottom: 0.5em; padding-left: 0.25in; }
    li { margin-bottom: 0.2em; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    blockquote { margin: 1em 0.5in; padding-left: 0.5em; border-left: 3px solid #CCCCCC; font-style: italic; color: #555555; }
  </style>
</head><body>
  ${htmlFromLLM}
</body></html>`;

  // html-docx-js: devuelve Buffer en Node o Blob en browser
  const docxOut = htmlDocx.asBlob(styledHtmlForDocx);
  const docxBuffer: Buffer = Buffer.isBuffer(docxOut)
    ? docxOut as Buffer
    : Buffer.from(await (docxOut as Blob).arrayBuffer());

  return { pdfBuffer, previewPdfBuffer, docxBuffer };
}
