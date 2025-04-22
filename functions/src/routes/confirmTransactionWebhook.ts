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

      // ePayco devuelve tu invoice aquí:
      const invoice = (data.x_id_factura || data.x_id_invoice) as string;
      const refPayco = data.x_ref_payco as string;
      const transactionId = data.x_transaction_id as string;

      if (!invoice || !refPayco || !transactionId) {
        return res.status(400).json({ error: 'Faltan datos requeridos en el webhook.' });
      }

      const statusMap: Record<string, string> = {
        '1': 'success',
        '2': 'rejected',
        '3': 'canceled'
      };
      const status = statusMap[data.x_cod_response] || 'unknown';

      const transaction = {
        invoice,
        refPayco,
        transactionId,
        status,
        valor: parseFloat(data.x_amount ?? '0'),
        metodoPago: 'ePayco',
        descripcion: data.x_description ?? 'Documento Legal',
        fecha: data.x_transaction_date ?? new Date().toISOString(),
        raw: data
      };

      // Usamos `invoice` como ID de documento
      await db.collection('transactions')
              .doc(invoice)
              .set(transaction, { merge: true });

      logger.log('[Webhook] 🧾 Transacción registrada:', invoice, status);
      return res.status(200).json({ success: true });

    } catch (error: any) {
      logger.error('[Webhook] ❌ Error procesando webhook', error.message || error);
      return res.status(500).json({ error: 'Error interno procesando webhook.' });
    }
  });
});
