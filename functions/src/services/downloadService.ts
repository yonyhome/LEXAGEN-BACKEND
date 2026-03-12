// functions/src/services/downloadService.ts
import { db, admin } from '../firebase';

const EXPIRATION_HOURS = 24;
const MAX_DOWNLOADS = 3;

/**
 * Verifica si el archivo con el token puede descargarse.
 * Permite hasta MAX_DOWNLOADS descargas dentro de EXPIRATION_HOURS horas.
 * Si puede descargar, registra el intento.
 */
export async function checkAndRegisterDownload(token: string): Promise<{ canDownload: boolean; downloadsRemaining: number }> {
  const ref = db.collection('downloads').doc(token);
  const doc = await ref.get();
  const now = Date.now();

  if (doc.exists) {
    const data = doc.data()!;
    const downloadCount: number = data.downloadCount || 0;
    const timestamp: admin.firestore.Timestamp | undefined = data.timestamp;

    // Verificar expiración
    if (timestamp) {
      const elapsedHours = (now - timestamp.toDate().getTime()) / 1000 / 3600;
      if (elapsedHours > EXPIRATION_HOURS) {
        return { canDownload: false, downloadsRemaining: 0 };
      }
    }

    // Verificar límite de descargas
    if (downloadCount >= MAX_DOWNLOADS) {
      return { canDownload: false, downloadsRemaining: 0 };
    }

    // Incrementar contador
    await ref.update({ downloadCount: downloadCount + 1 });
    return { canDownload: true, downloadsRemaining: MAX_DOWNLOADS - downloadCount - 1 };
  }

  // Primera descarga
  await ref.set({
    downloadCount: 1,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { canDownload: true, downloadsRemaining: MAX_DOWNLOADS - 1 };
}
