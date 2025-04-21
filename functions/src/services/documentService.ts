// functions/src/services/documentService.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';

/**
 * Genera un PDF simple a partir del texto legal
 */
export async function generatePDF(text: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const { height } = page.getSize();
  const fontSize = 12;

  const lines = splitTextIntoLines(text, 90);

  let y = height - 40;
  for (const line of lines) {
    page.drawText(line, { x: 40, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= fontSize + 4;
  }

  return await pdfDoc.save();
}

/**
 * Crea un archivo ZIP con el PDF y opcionalmente el DOCX
 */
export async function generateZipFiles(options: {
  pdfBuffer: Uint8Array;
  docxBuffer?: Buffer;
  includeWord: boolean;
}): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('documento.pdf', options.pdfBuffer);
  if (options.includeWord && options.docxBuffer) {
    zip.file('documento.docx', options.docxBuffer);
  }

  zip.file('README.txt', 'Guarda estos documentos en un lugar seguro. No se almacenan en el servidor.');

  return await zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * Utilidad para cortar el texto en líneas legibles
 */
function splitTextIntoLines(text: string, maxCharsPerLine = 90): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length < maxCharsPerLine) {
      currentLine += word + ' ';
    } else {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines;
}
