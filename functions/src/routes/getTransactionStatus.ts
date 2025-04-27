// functions/src/routes/getTransactionStatus.ts
import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import axios from 'axios';
import { db } from '../firebase';
import { getDownloadUrl } from '../services/storageService';
import { getPaymentOption } from '../services/paymentOptionService';
import { checkAndRegisterDownload } from '../services/downloadService';
import { logger } from 'firebase-functions';

const corsHandler = cors({ origin: true });

export const getTransactionStatus = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // 1) Obtener ref_payco de query o body
    const refPayco =
      (req.method === 'GET' ? req.query.ref_payco : req.body?.ref_payco) as
        | string
        | undefined;

    if (!refPayco) {
      return res
        .status(400)
        .json({ error: 'Falta el parámetro ref_payco.' });
    }

    try {
      // 2) Validar en ePayco para obtener el invoice (token)
      //    Endpoint público: no requiere llaves en la petición :contentReference[oaicite:0]{index=0}
      const validationUrl = `https://secure.epayco.co/validation/v1/reference/${refPayco}`;
      const { data: epaycoResp } = await axios.get(validationUrl);

      const invoice = epaycoResp.data?.x_id_invoice as string | undefined;
      if (!invoice) {
        logger.warn(
          '[getTransactionStatus] ⚠️ No vino invoice en respuesta ePayco:',
          epaycoResp
        );
        return res
          .status(400)
          .json({ error: 'No se pudo obtener invoice de ePayco.' });
      }

      // 3) Buscar transacción en Firestore usando el invoice como token
      const txDoc = await db.collection('transactions').doc(invoice).get();
      if (!txDoc.exists) {
        return res
          .status(404)
          .json({ error: 'Transacción no encontrada.' });
      }

      const transaction = txDoc.data() as any;
      const { status, ...details } = transaction;

      // 4) Si el estado interno es 'success', generar URL de descarga
      if (status === 'success') {
        const { canDownload } = await checkAndRegisterDownload(invoice);
        if (!canDownload) {
          return res.status(403).json({
            status: 'expired',
            details,
            message:
              'El archivo ya fue descargado o ha expirado por seguridad.',
          });
        }

        const option = await getPaymentOption(invoice);
        const filename =
          option === 'pdf-word'
            ? 'LexaGen_Documentos.zip'
            : 'documento.pdf';
        const downloadUrl = await getDownloadUrl(invoice, filename);

        return res.status(200).json({ status, details, downloadUrl });
      }

      // 5) Si no está completo, devolver solo estado y detalles almacenados
      return res.status(200).json({ status, details });
    } catch (error: any) {
      logger.error(
        '[getTransactionStatus] ❌ Error:',
        error?.response?.data || error.message || error
      );
      return res
        .status(500)
        .json({ error: 'Error al verificar la transacción.' });
    }
  });
});
