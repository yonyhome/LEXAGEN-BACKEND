// functions/src/routes/confirmTransactionWebhook.ts
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import { db } from '../firebase';

const app = express();

// permitir CORS y parsear body urlencoded y JSON
app.use(cors({ origin: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/', async (req, res) => {
  try {
    const data = req.body;

    const invoice =
      (data.invoice as string) ||
      (data.x_id_invoice as string) ||
      (data.x_id_factura as string);

    // ref_payco y transaction_id también vienen en el payload
    const refPayco = (data.ref_payco as string) || (data.x_ref_payco as string);
    const transactionId =
      (data.transactionId as string) || (data.x_transaction_id as string);

    if (!invoice || !refPayco || !transactionId) {
      return res
        .status(400)
        .json({ error: 'Faltan datos requeridos (invoice, ref_payco o transaction_id).' });
    }

    // Mapear el código de respuesta al estado interno
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
    const status = statusMap[(data.x_cod_response as string)] || 'unknown';

    // Construir el objeto de transacción
    const transaction = {
      invoice,           // usamos 'invoice' como token / doc ID
      refPayco,
      transactionId,
      status,
      valor: parseFloat((data.x_amount as string) || '0'),
      metodoPago: data.metodoPago || 'ePayco',
      descripcion: data.descripcion || data.x_description || 'Documento Legal',
      fecha: data.fecha || data.x_transaction_date || new Date().toISOString(),
      raw: data,
    };

    // Guardar (o actualizar) en Firestore bajo el ID = invoice
    await db.collection('transactions').doc(invoice).set(transaction, { merge: true });

    logger.log('[Webhook] 🧾 Transacción registrada:', { invoice, status });
    return res.status(200).send('OK');
  } catch (error: any) {
    logger.error('[Webhook] ❌ Error procesando webhook', error?.message || error);
    return res.status(500).send('Internal Server Error');
  }
});

// Exportar la función
export const confirmTransactionWebhook = onRequest({ cors: true }, app);
