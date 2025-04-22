import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import { db } from '../firebase';

// Crear app de Express
const app = express();

// Middleware para CORS y parsing del body tipo x-www-form-urlencoded
app.use(cors({ origin: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Por si alguna vez llega en JSON

app.post('/', async (req, res) => {
  try {
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
      '3': 'canceled',
      '4': 'failed',
      '6': 'reversed',
      '7': 'held',
      '9': 'expired',
      '10': 'abandoned',
      '11': 'canceled',
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
      raw: data,
    };

    await db.collection('transactions').doc(token).set(transaction, { merge: true });

    logger.log('[Webhook] 🧾 Transacción registrada:', { token, status });

    return res.status(200).send('OK');
  } catch (error: any) {
    logger.error('[Webhook] ❌ Error procesando webhook', error?.message || error);
    return res.status(500).send('Internal Server Error');
  }
});

// Exportar como cloud function
export const confirmTransactionWebhook = onRequest({ cors: true }, app);
