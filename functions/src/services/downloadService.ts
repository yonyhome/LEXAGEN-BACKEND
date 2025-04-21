// functions/src/services/downloadService.ts

import { db, admin } from '../firebase'; // ✅ Importamos también `admin` para acceder a FieldValue y Timestamp

const EXPIRATION_MINUTES = 30;

/**
 * Verifica si el archivo con el token ya fue descargado o si expiró.
 * Si no ha sido descargado y no ha expirado, lo marca como descargado.
 */
export async function checkAndRegisterDownload(token: string): Promise<{ canDownload: boolean }> {
  const ref = db.collection('downloads').doc(token);
  const doc = await ref.get();

  const now = Date.now();

  if (doc.exists) {
    const data = doc.data();
    const descargado = data?.descargado;
    const timestamp: admin.firestore.Timestamp | undefined = data?.timestamp;

    if (descargado) return { canDownload: false };

    if (timestamp) {
      const elapsed = (now - timestamp.toDate().getTime()) / 1000 / 60;
      if (elapsed > EXPIRATION_MINUTES) return { canDownload: false };
    }

    await ref.update({ descargado: true });
    return { canDownload: true };
  }

  // Crear nuevo si no existe
  await ref.set({
    descargado: true,
    timestamp: admin.firestore.FieldValue.serverTimestamp(), // ✅ Correcto uso de FieldValue
  });

  return { canDownload: true };
}
