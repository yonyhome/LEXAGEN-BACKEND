import { mdToPdf } from 'md-to-pdf';
import { PDFDocument, rgb } from 'pdf-lib';

/**
 * Genera un PDF a partir de un string Markdown.
 */
export async function generatePDF(markdown: string): Promise<Uint8Array> {
  const pdfResult = await mdToPdf(
    { content: markdown },
    {
      pdf_options: {
        format: 'A4',
        margin: { top: 40, right: 40, bottom: 40, left: 40 },
      },
    }
  );
  const pdfBuffer = pdfResult.content;
  return pdfBuffer;
}

/**
 * Genera un PDF de preview donde la mitad inferior
 * está "tachada" con trazos tipo marcador.
 */
export async function generatePreviewPDF(fullPdfBuffer: Uint8Array): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(fullPdfBuffer);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const yStart = height / 2;
    const xMargin = width * 0.05;
    const usableWidth = width - 2 * xMargin;
    const strokes = 6;
    const spacing = (height / 2) / strokes;

    for (let i = 0; i < strokes; i++) {
      const y = yStart - i * spacing + (Math.random() * spacing * 0.2 - spacing * 0.1);
      const wobble = Math.random() * 10 - 5;
      const thickness = 20 + Math.random() * 10;

      page.drawLine({
        start: { x: xMargin, y },
        end:   { x: xMargin + usableWidth + wobble, y: y + (Math.random() * 4 - 2) },
        color: rgb(0, 0, 0),
        thickness,
        opacity: 0.85,
      });
    }
  }

  return await pdfDoc.save();
}