import { mdToPdf } from 'md-to-pdf';
import { PDFDocument, rgb, RotationTypes } from 'pdf-lib';
import { logger } from 'firebase-functions/v2';

/**
 * Genera un PDF a partir de un string Markdown con manejo de errores mejorado.
 */
export async function generatePDF(markdown: string): Promise<Uint8Array> {
  try {
    logger.debug('[generatePDF] Iniciando conversión de markdown a PDF');
    
    // Verificar que markdown sea válido
    if (!markdown || typeof markdown !== 'string') {
      throw new Error('Markdown inválido o vacío');
    }
    
    logger.debug('[generatePDF] Longitud del markdown:', markdown.length);
    
    // Configuración para md-to-pdf
    const pdfResult = await mdToPdf(
      { content: markdown },
      {
        pdf_options: {
          format: 'A4',
          margin: { top: 40, right: 40, bottom: 40, left: 40 },
        },
        launch_options: {
          // Opciones para Puppeteer en entorno serverless
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          // Aumentar el tiempo de espera por si acaso
          timeout: 30000
        }
      }
    );
    
    if (!pdfResult || !pdfResult.content) {
      throw new Error('La conversión de PDF retornó un resultado vacío');
    }
    
    const pdfBuffer = pdfResult.content;
    logger.debug('[generatePDF] PDF generado exitosamente, tamaño:', pdfBuffer.byteLength);
    
    return pdfBuffer;
  } catch (error: any) {
    logger.error('[generatePDF] Error al generar PDF:', {
      message: error.message,
      stack: error.stack,
      markdownLength: markdown?.length || 0
    });
    
    // Re-lanzar el error para manejo superior
    throw new Error(`Error al generar PDF: ${error.message}`);
  }
}

/**
 * Implementación alternativa usando pdf-lib directamente.
 * Usar si md-to-pdf presenta problemas en entorno serverless.
 */
export async function generateSimplePDF(markdown: string): Promise<Uint8Array> {
  try {
    logger.debug('[generateSimplePDF] Creando PDF básico');
    
    // Crear documento PDF desde cero
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size in points
    
    // Agregar texto simple (no hay conversión Markdown completa)
    const { width, height } = page.getSize();
    
    // Dividir por párrafos
    const paragraphs = markdown.split('\n\n');
    
    let y = height - 50; // Starting position
    
    for (const paragraph of paragraphs) {
      // Texto simple, sin formateo de Markdown
      if (y > 50) { // Evitar escribir fuera de la página
        page.drawText(paragraph.substring(0, 100) + (paragraph.length > 100 ? '...' : ''), {
          x: 50,
          y,
          size: 12,
        });
        y -= 30; // Move down for next paragraph
      }
    }
    
    // Agregar pie de página
    page.drawText('Documento generado como respaldo básico - Formato simplificado', {
      x: 50,
      y: 30,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    const pdfBytes = await pdfDoc.save();
    logger.debug('[generateSimplePDF] PDF básico generado exitosamente');
    
    return pdfBytes;
  } catch (error: any) {
    logger.error('[generateSimplePDF] Error al generar PDF básico:', error);
    throw new Error(`Error al generar PDF básico: ${error.message}`);
  }
}

/**
 * Genera un PDF de preview donde la mitad inferior
 * está "tachada" con trazos tipo marcador.
 */
export async function generatePreviewPDF(fullPdfBuffer: Uint8Array): Promise<Uint8Array> {
  try {
    logger.debug('[generatePreviewPDF] Iniciando generación de preview');
    
    const pdfDoc = await PDFDocument.load(fullPdfBuffer);
    const pages = pdfDoc.getPages();
    
    logger.debug('[generatePreviewPDF] Modificando', pages.length, 'páginas');

    for (const page of pages) {
      const { width, height } = page.getSize();
      const yStart = height / 2;
      const xMargin = width * 0.05;
      const usableWidth = width - 2 * xMargin;
      const strokes = 6;
      const spacing = (height / 2) / strokes;

      // Dibujar marca de agua "PREVIEW"
      page.drawText('PREVIEW', {
        x: width / 2 - 100,
        y: height / 2 + 50,
        size: 60,
        color: rgb(0.8, 0.8, 0.8),
        opacity: 0.3,
        rotate: {
          type: RotationTypes.Radians,
          angle: -45,
        },
      });

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

    logger.debug('[generatePreviewPDF] Guardando PDF modificado');
    return await pdfDoc.save();
  } catch (error: any) {
    logger.error('[generatePreviewPDF] Error al generar preview:', error);
    throw new Error(`Error al generar vista previa: ${error.message}`);
  }
}