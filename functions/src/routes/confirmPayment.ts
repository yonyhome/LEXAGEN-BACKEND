import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { Request, Response } from 'express';
import axios from 'axios';

const corsHandler = cors({ origin: true });

export const confirmPayment = onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    try {
      const { ref_payco } = req.query;
      if (!ref_payco || typeof ref_payco !== 'string') {
        res.status(400).json({ error: 'Parámetro "ref_payco" requerido' });
        return;
      }

      const epaycoUrl = `https://secure.epayco.co/validation/v1/reference/${ref_payco}`;
      const response = await axios.get(epaycoUrl);

      const data = response.data?.data;
      if (!data) {
        res.status(500).json({ error: 'No se recibió información válida de ePayco' });
        return;
      }

      const { x_cod_response, x_response, x_transaction_id, x_extra1 } = data;

      let status: 'success' | 'rejected' | 'canceled' = 'rejected';
      if (x_cod_response === '1') status = 'success';
      else if (x_cod_response === '2') status = 'rejected';
      else if (x_cod_response === '3') status = 'canceled';

      res.status(200).json({
        status,
        details: {
          refPayco: ref_payco,
          response: x_response,
          transactionId: x_transaction_id,
          token: x_extra1 || null,
        },
      });
    } catch (err: any) {
      console.error('[confirmPayment] Error interno:', err.message || err);
      res.status(500).json({ error: 'Error interno del servidor al validar el pago' });
    }
  });
});
