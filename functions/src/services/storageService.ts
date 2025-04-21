// functions/src/services/storageService.ts
import { bucket } from '../firebase'; // Usa la instancia centralizada del bucket

/**
 * Sube el archivo PDF generado a Firebase Storage
 * Ruta: documents/{token}/documento.pdf
 */
export async function uploadDocumentToStorage(token: string, buffer: Uint8Array): Promise<void> {
  const filePath = `documents/${token}/documento.pdf`;
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
export async function uploadZipToStorage(token: string, buffer: Buffer): Promise<void> {
  const filePath = `documents/${token}/LexaGen_Documentos.zip`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
    metadata: {
      contentType: 'application/zip',
    },
  });
}

/**
 * Devuelve una URL de vista previa del PDF válida por 5 minutos
 */
export async function getPreviewUrl(token: string): Promise<string> {
  const file = bucket.file(`documents/${token}/documento.pdf`);

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000 // 5 minutos
  });

  return url;
}

/**
 * Devuelve un URL temporal (firmado) del .zip de descarga válido por 5 minutos
 */
export async function getDownloadUrl(token: string, filename = 'documento.pdf'): Promise<string> {
  const file = bucket.file(`documents/${token}/${filename}`);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  });
  return url;
}
