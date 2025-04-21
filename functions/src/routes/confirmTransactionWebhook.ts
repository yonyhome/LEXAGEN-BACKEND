// functions/src/routes/confirmTransactionWebhook.ts
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import cors from 'cors';
import { db } from '../firebase';

const corsHandler = cors({ origin: true });

export const confirmTransactionWebhook = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
      }

      const data = req.body;

      const refPayco = data?.x_ref_payco;
      const transactionId = data?.x_transaction_id;
      const token = data?.x_extra1;

      if (!refPayco || !transactionId || !token) {
        return res.status(400).json({ error: 'Faltan datos requeridos en el webhook' });
      }

      const statusMap: Record<string, string> = {
        '1': 'success',
        '2': 'rejected',
        '3': 'canceled'
      };
      const status = statusMap[data.x_cod_response] || 'unknown';

      const transaction = {
        refPayco,
        transactionId,
        token,
        status,
        valor: parseFloat(data?.x_amount || '0'),
        metodoPago: 'ePayco',
        descripcion: data?.x_description || 'Documento Legal',
        fecha: data?.x_transaction_date || new Date().toISOString(),
        raw: data
      };

      await db.collection('transactions').doc(token).set(transaction, { merge: true });

      logger.log('[Webhook] 🧾 Transacción registrada:', { token, status });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('[Webhook] ❌ Error procesando webhook', error?.message || error);
      return res.status(500).json({ error: 'Error interno procesando webhook' });
    }
  });
});
