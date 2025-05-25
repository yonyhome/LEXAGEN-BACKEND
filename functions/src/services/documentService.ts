import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import PdfPrinter from 'pdfmake';
import htmlToPdfmake from 'html-to-pdfmake';
import { JSDOM } from 'jsdom';

// Ruta al directorio de fuentes empaquetadas
const fontsDir = path.join(__dirname, '../fonts/Roboto/static');

// Carga de los archivos .ttf como Buffers
const robotoRegular = fs.readFileSync(path.join(fontsDir, 'Roboto-Regular.ttf'));
const robotoMedium = fs.readFileSync(path.join(fontsDir, 'Roboto-Medium.ttf'));
const robotoItalic = fs.readFileSync(path.join(fontsDir, 'Roboto-Italic.ttf'));
const robotoMediumItalic = fs.readFileSync(path.join(fontsDir, 'Roboto-MediumItalic.ttf'));

// Configuración de fuentes para PDF profesional
const fontsConfig = {
  Roboto: {
    normal: robotoRegular,
    bold: robotoMedium,
    italics: robotoItalic,
    bolditalics: robotoMediumItalic,
  }
};

const printer = new PdfPrinter(fontsConfig);

// Configuración principal del PDF profesional y compacto
const getProfessionalDocDefinition = (pdfMakeContent) => ({
  content: pdfMakeContent,
  defaultStyle: { 
    font: 'Roboto', 
    fontSize: 11,
    lineHeight: 1,  // Más compacto
    color: '#2c3e50'
  },
  fonts: fontsConfig,
  styles: {
    // Título principal del documento
    documentTitle: {
      fontSize: 14,
      bold: true,
      color: '#1a365d',
      alignment: 'center',
      margin: [0, 0, 0, 6]
    },
    
    // Encabezado con fecha y ciudad - más pegado arriba
    documentHeader: {
      fontSize: 11,
      color: '#4a5568',
      alignment: 'right',
      margin: [0, 0, 0, 6]  // Reducido de 15
    },
    
    // Destinatario
    recipient: {
      fontSize: 11,
      bold: true,
      color: '#2d3748',
      margin: [0, 0, 0, 6]  // Reducido de 12 a la mitad
    },
    
    // Asunto
    subject: {
      fontSize: 11,
      bold: true,
      color: '#1a365d',
      margin: [0, 2, 0, 2]  // Reducido de 12 a la mitad
    },
    
    // Secciones principales - SIN fondo azul
    sectionTitle: {
      fontSize: 12,
      bold: true,
      color: '#1a365d',
      margin: [0, 12, 0, 6],  // Mucho menos espacio
      decoration: 'underline',
      decorationStyle: 'solid'
    },
    
    // Párrafos normales muy compactos
    paragraph: {
      fontSize: 11,
      lineHeight: 1,
      margin: [0, 0, 0, 4],  // Casi sin espacio
      alignment: 'justify',
      color: '#2c3e50'
    },
    
    // Listas muy compactas
    listItem: {
      fontSize: 11,
      lineHeight: 1,
      margin: [0, 1, 0, 2],  // Mínimo espacio
      color: '#2c3e50'
    },
    
    // Texto de identificación personal
    identification: {
      fontSize: 11,
      lineHeight: 1,
      margin: [0, 0, 0, 6],  // Muy poco espacio
      alignment: 'justify',
      color: '#4a5568'
    },
    
    // Fundamentos jurídicos compactos
    legalText: {
      fontSize: 10,
      italics: true,
      color: '#718096',
      margin: [5, 2, 5, 6],  // Muy poco espacio
      lineHeight: 1.3
    },
    
    // Firma compacta
    signature: {
      fontSize: 11,
      bold: true,
      margin: [0, 10, 0, 2],  // Solo 2pt después de "Atentamente,"
      color: '#2d3748'
    },
    
    // Datos del firmante pegados
    signerData: {
      fontSize: 10,
      color: '#4a5568',
      margin: [0, 0, 0, 0]  // Casi pegado
    }
  },
  
  // Configuración de página compacta
  pageSize: 'LETTER',
  pageMargins: [50, 55, 50, 55],
  
  // Header mínimo
  header: function(currentPage, pageCount) {
    if (currentPage === 1) return null;
    return {
      text: '',
      margin: [50, 15]
    };
  },
  
  // Footer compacto
  footer: function(currentPage, pageCount) {
    return {
      columns: [
        {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 9,
          color: '#a0aec0',
          margin: [0, 12, 0, 0]
        }
      ]
    };
  }
});

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
    pdfMakeContent = htmlToPdfmake(htmlFromLLM, { window: window });
  } catch (err) {
    console.error('[generateAllDocuments] Error al convertir HTML:', err);
    throw new Error(`Error al procesar HTML: ${err.message}`);
  }

  // 2) Generar PDF profesional completo
  const docDefinition = getProfessionalDocDefinition(pdfMakeContent);
  const pdfBuffer = await generateProfessionalPDF(docDefinition);

  // 3) Crear preview con gradiente moderno
  const previewPdfBuffer = await generateCleanPreview(pdfBuffer);

  // 4) DOCX básico (para los que lo necesiten)
  const docxBuffer = await generateBasicDocx(htmlFromLLM);

  return { 
    pdfBuffer, 
    previewPdfBuffer, 
    docxBuffer 
  };
}

async function generateProfessionalPDF(docDefinition: any): Promise<Uint8Array> {
  const pdfDocGenerator = printer.createPdfKitDocument(docDefinition);
  const chunks = [];
  
  return new Promise((resolve, reject) => {
    pdfDocGenerator.on('data', (chunk) => chunks.push(chunk));
    pdfDocGenerator.on('end', () => {
      if (chunks.length === 0) {
        reject(new Error('No se generaron datos del PDF'));
        return;
      }
      resolve(new Uint8Array(Buffer.concat(chunks)));
    });
    pdfDocGenerator.on('error', (err) => {
      reject(new Error(`Error generando PDF: ${err.message}`));
    });
    pdfDocGenerator.end();
  });
}

async function generateCleanPreview(pdfBuffer: Uint8Array): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  
  for (const page of pages) {
    const { width, height } = page.getSize();
    const cutoffPoint = height * 0.55; // Mostrar 55% del documento
    
    // Gradiente suave y moderno - sin texto encima
    const gradientLayers = 25;
    for (let i = 0; i < gradientLayers; i++) {
      const progress = i / gradientLayers;
      const opacity = Math.pow(progress, 1.5) * 0.85; // Curva más suave
      const layerHeight = cutoffPoint / gradientLayers;
      
      page.drawRectangle({
        x: 0,
        y: cutoffPoint - (i * layerHeight),
        width: width,
        height: layerHeight * 2.5,
        color: rgb(0.99, 0.99, 0.99),
        opacity: opacity,
      });
    }
    
    // Capa final para asegurar que el contenido esté completamente oculto
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: cutoffPoint * 0.4,
      color: rgb(1, 1, 1),
      opacity: 0.95,
    });
  }
  
  return new Uint8Array(await pdfDoc.save());
}

async function generateBasicDocx(htmlFromLLM: string): Promise<Buffer> {
  // 1) Parseamos el HTML con JSDOM
  const dom = new JSDOM(`<body>${htmlFromLLM}</body>`);
  const body = dom.window.document.body;

  // 2) Convertimos cada bloque directo en un Paragraph
  const children = Array.from(body.children).map(node => {
    // Para encabezados <h1>–<h6> podrías usar estilos distintos si quieres
    const text = node.textContent ?? '';
    return new Paragraph({
      children: [ new TextRun(text) ],
      spacing: { after: 200 },            // equivalente a margin-bottom
      thematicBreak: node.tagName === 'HR', // línea si es <hr>
    });
  });

  // 3) Creamos el documento con una única sección
  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  // 4) Empaquetamos a Buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
