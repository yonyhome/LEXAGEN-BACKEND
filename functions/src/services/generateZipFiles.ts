import JSZip from 'jszip';

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
