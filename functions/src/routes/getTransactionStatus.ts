import * as functions from 'firebase-functions/v2';
import cors from 'cors';
import { getDownloadUrl } from '../services/storageService';
import { checkAndRegisterDownload } from '../services/downloadService';
import { getPaymentOption } from '../services/paymentOptionService';
import axios from 'axios';

const corsHandler = cors({ origin: true });

export const getTransactionStatus = functions
  .https.onRequest({ secrets: ['EPAYCO_PRIVATE'] }, (req, res) => {
    corsHandler(req, res, async () => {
      const token =
        req.method === 'GET'
          ? (req.query.ref_payco || req.query.token)
          : req.body?.token;

      if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'Falta el token o no es válido.' });
        return;
      }

      try {
        const response = await axios.get(
          `https://api.secure.payco.co/validation/v1/reference/${token}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.EPAYCO_PRIVATE}`,
            },
          }
        );

        const { success, data: transaction } = response.data;

        if (!success || !transaction) {
          res.status(404).json({ error: 'Transacción no encontrada.' });
          return;
        }

        const statusRaw = transaction.x_response;
        const status =
          statusRaw === 'Aceptada'
            ? 'success'
            : statusRaw === 'Rechazada'
              ? 'rejected'
              : statusRaw === 'Cancelada'
                ? 'canceled'
                : 'pending';

        const details = {
          transactionId: transaction.x_ref_payco,
          fecha: transaction.x_transaction_date,
          tipoDocumento: transaction.x_description || 'Documento Legal',
          valor: parseFloat(transaction.x_amount),
          metodoPago: 'ePayco',
          reason: transaction.x_response_reason_text,
        };

        if (status === 'success') {
          const { canDownload } = await checkAndRegisterDownload(token);
          if (!canDownload) {
            res.status(403).json({
              status: 'expired',
              details,
              message: 'El archivo ya fue descargado o ha expirado por seguridad.',
            });
            return;
          }

          // 🔍 Determinar el archivo correcto según la opción de pago
          const option = await getPaymentOption(token);
          const filename =
            option === 'pdf-word' ? 'LexaGen_Documentos.zip'
            : option === 'pdf' ? 'documento.pdf'
            : 'documento.pdf'; // fallback

          if (!option) {
            console.warn(`[getTransactionStatus] No se encontró opción para el token: ${token}. Usando archivo por defecto.`);
          }

          const downloadUrl = await getDownloadUrl(token, filename);

          res.status(200).json({
            status,
            details,
            downloadUrl,
          });
          return;
        }

        res.status(200).json({ status, details });

      } catch (error: any) {
        console.error('[getTransactionStatus] Error:', error?.message || error);
        res.status(500).json({ error: 'No se pudo verificar la transacción.' });
      }
    });
  });
