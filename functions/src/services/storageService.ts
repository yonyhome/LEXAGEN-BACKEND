// functions/src/services/storageService.ts

import { bucket } from '../firebase'; // Instancia centralizada del bucket de Firebase Storage

/**
 * Sube el archivo PDF completo a Firebase Storage
 * Ruta: documents/{token}/documento.pdf
 */
export async function uploadDocumentToStorage(
  token: string,
  buffer: Uint8Array
): Promise<void> {
  const filePath = `documents/${token}/documento.pdf`;
  const file = bucket.file(filePath);

  await file.save(Buffer.from(buffer), {
    metadata: {
      contentType: 'application/pdf',
    },
  });
}

/**
 * Sube el PDF de preview (tachado) a Firebase Storage
 * Ruta: documents/{token}/preview.pdf
 */
export async function uploadPreviewPDFToStorage(
  token: string,
  buffer: Uint8Array
): Promise<void> {
  const filePath = `documents/${token}/preview.pdf`;
  const file = bucket.file(filePath);

  await file.save(Buffer.from(buffer), {
    metadata: {
      contentType: 'application/pdf',
    },
  });
}

/**
 * Sube el archivo ZIP generado a Firebase Storage
 * Ruta: documents/{token}/LexaGen_Documentos.zip
 */
export async function uploadZipToStorage(
  token: string,
  buffer: Buffer
): Promise<void> {
  const filePath = `documents/${token}/LexaGen_Documentos.zip`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
    metadata: {
      contentType: 'application/zip',
    },
  });
}

/**
 * Devuelve una URL de vista previa del PDF de preview válida por 5 minutos
 */
export async function getPreviewUrl(token: string): Promise<string> {
  const file = bucket.file(`documents/${token}/preview.pdf`);

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000, // 5 minutos
  });

  return url;
}

/**
 * Devuelve una URL temporal (firmada) de un archivo válida por 24 horas
 */
export async function getDownloadUrl(
  token: string,
  filename = 'LexaGen_Documentos.zip'
): Promise<string> {
  const file = bucket.file(`documents/${token}/${filename}`);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 24 * 60 * 60 * 1000, // 24 horas
  });
  return url;
}

/**
 * Sube el archivo DOCX a Firebase Storage
 * Ruta: documents/{token}/documento.docx
 */
export async function uploadDocxToStorage(
  token: string,
  buffer: Buffer
): Promise<void> {
  const filePath = `documents/${token}/documento.docx`;
  const file = bucket.file(filePath);
  await file.save(buffer, {
    metadata: {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  });
}

/**
 * Retorna URLs de descarga para todos los formatos disponibles de un token
 */
export async function getAllDownloadUrls(token: string): Promise<{
  pdf: string;
  docx: string;
  zip: string;
}> {
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 horas

  const [pdfUrl] = await bucket.file(`documents/${token}/documento.pdf`).getSignedUrl({ action: 'read', expires: expiry });
  const [docxUrl] = await bucket.file(`documents/${token}/documento.docx`).getSignedUrl({ action: 'read', expires: expiry }).catch(() => ['']);
  const [zipUrl] = await bucket.file(`documents/${token}/LexaGen_Documentos.zip`).getSignedUrl({ action: 'read', expires: expiry }).catch(() => ['']);

  return { pdf: pdfUrl, docx: docxUrl || '', zip: zipUrl || '' };
}
