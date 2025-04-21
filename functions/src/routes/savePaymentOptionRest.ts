import { https, logger } from 'firebase-functions/v2';
import cors from 'cors';
import { savePaymentOption } from '../services/paymentOptionService';

const corsHandler = cors({
  origin: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
});

export const savePaymentOptionRest = https.onRequest((req, res) => {
  if (req.method === 'OPTIONS') {
    return corsHandler(req, res, () => res.status(204).send(''));
  }

  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        logger.warn('[savePaymentOptionRest] Método no permitido', { method: req.method });
        return res.status(405).json({ error: 'Método no permitido', allowed: ['POST'] });
      }

      if (!req.is('application/json')) {
        logger.warn('[savePaymentOptionRest] Content-Type inválido', { received: req.get('Content-Type') });
        return res.status(415).json({ error: 'Content-Type no soportado', required: 'application/json' });
      }

      const { token, option } = req.body || {};

      logger.info('[savePaymentOptionRest] Payload recibido', { token, option });

      const validationErrors = validateInput(token, option);
      if (validationErrors) {
        logger.warn('[savePaymentOptionRest] Validación fallida', validationErrors);
        return res.status(400).json({ error: 'Datos inválidos', details: validationErrors });
      }

      const startTime = Date.now();
      await savePaymentOption(token.trim(), option as 'pdf' | 'pdf-word');
      const duration = Date.now() - startTime;

      logger.info('[savePaymentOptionRest] Opción guardada correctamente', {
        tokenLength: token.length,
        option,
        durationMs: duration
      });

      return res.status(200).json({
        success: true,
        message: 'Opción guardada con éxito',
        metadata: {
          processingTime: `${duration}ms`,
          timestamp: new Date().toISOString()
        }
      });

    } catch (err: any) {
      logger.error('[savePaymentOptionRest] ❌ Error al guardar en Firestore', {
        message: err.message,
        code: err.code || 'unknown',
        stack: err.stack,
        raw: err
      });

      return res.status(500).json({
        error: 'Error al procesar la solicitud',
        details: {
          message: err.message || 'Error inesperado',
          code: err.code || 'internal-error',
          timestamp: new Date().toISOString()
        }
      });
    }
  });
});

function validateInput(token: unknown, option: unknown): Record<string, string> | null {
  const errors: Record<string, string> = {};

  if (!token || typeof token !== 'string' || token.trim() === '') {
    errors.token = 'Token inválido: debe ser un string no vacío';
  } else if (token.length > 1500) {
    errors.token = 'Token excede longitud máxima (1500 caracteres)';
  } else if (/[\/\.\s#$\[\]]/.test(token)) {
    errors.token = 'Token contiene caracteres inválidos (/ . espacios # $ [ ])';
  }

  if (!option || !['pdf', 'pdf-word'].includes(option as string)) {
    errors.option = 'Opción inválida. Valores permitidos: pdf, pdf-word';
  }

  return Object.keys(errors).length ? errors : null;
}
