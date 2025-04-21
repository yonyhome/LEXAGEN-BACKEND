// functions/src/routes/getTransactionStatus.ts
import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { db } from '../firebase';
import { getDownloadUrl } from '../services/storageService';
import { getPaymentOption } from '../services/paymentOptionService';
import { checkAndRegisterDownload } from '../services/downloadService';
import { logger } from 'firebase-functions';

const corsHandler = cors({ origin: true });

export const getTransactionStatus = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const token =
      req.method === 'GET'
        ? (req.query.token || req.query.ref_payco)
        : req.body?.token;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Falta el token o no es válido.' });
    }

    try {
      const doc = await db.collection('transactions').doc(token).get();

      if (!doc.exists) {
        return res.status(404).json({ error: 'Transacción no encontrada.' });
      }

      const transaction = doc.data();
      const { status, ...details } = transaction as any;

      if (status === 'success') {
        const { canDownload } = await checkAndRegisterDownload(token);
        if (!canDownload) {
          return res.status(403).json({
            status: 'expired',
            details,
            message: 'El archivo ya fue descargado o ha expirado por seguridad.'
          });
        }

        const option = await getPaymentOption(token);
        const filename =
          option === 'pdf-word' ? 'LexaGen_Documentos.zip'
          : option === 'pdf' ? 'documento.pdf'
          : 'documento.pdf';

        const downloadUrl = await getDownloadUrl(token, filename);

        return res.status(200).json({ status, details, downloadUrl });
      }

      return res.status(200).json({ status, details });
    } catch (error: any) {
      logger.error('[getTransactionStatus] ❌ Error:', error?.message || error);
      res.status(500).json({ error: 'Error al verificar la transacción' });
    }
  });
});
