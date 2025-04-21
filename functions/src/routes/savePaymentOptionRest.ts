import * as functions from 'firebase-functions/v1';
import cors from 'cors';
import { savePaymentOption } from '../services/paymentOptionService';

const corsHandler = cors({ 
  origin: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
});

export const savePaymentOptionRest = functions
  .runWith({
    timeoutSeconds: 10,
    memory: '512MB',
    maxInstances: 3
  })
  .https.onRequest(async (req, res) => {
    // Manejo de CORS preflight
    if (req.method === 'OPTIONS') {
      return corsHandler(req, res, () => res.status(204).send(''));
    }

    corsHandler(req, res, async () => {
      try {
        // 1. Validación de método HTTP
        if (req.method !== 'POST') {
          functions.logger.warn('Método no permitido', { method: req.method });
          return res.status(405).json({ 
            error: 'Método no permitido',
            allowed: ['POST']
          });
        }

        // 2. Validación de content-type
        if (!req.is('application/json')) {
          return res.status(415).json({ 
            error: 'Content-Type no soportado',
            required: 'application/json'
          });
        }

        // 3. Extracción y validación de datos
        const { token, option } = req.body || {};
        const validationErrors = validateInput(token, option);
        
        if (validationErrors) {
          functions.logger.warn('Validación fallida', validationErrors);
          return res.status(400).json({ 
            error: 'Datos inválidos',
            details: validationErrors
          });
        }

        // 4. Procesamiento principal
        const startTime = Date.now();
        await savePaymentOption(token.trim(), option as 'pdf'|'pdf-word');
        const duration = Date.now() - startTime;

        // 5. Logging y respuesta exitosa
        functions.logger.log('Operación exitosa', {
          tokenLength: token.length,
          option,
          durationMs: duration,
          status: 'success'
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
        // 6. Manejo de errores estructurado
        const errorDetails = {
          message: err.message,
          code: err.code || 'internal-error',
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
          timestamp: new Date().toISOString()
        };

        functions.logger.error('Error en el endpoint', errorDetails);

        const response = {
          error: 'Error al procesar la solicitud',
          requestId: res.locals.requestId || 'none',
          ...(process.env.NODE_ENV === 'development' && { details: errorDetails })
        };

        return res.status(500).json(response);
      }
    });
  });

// Función auxiliar para validación
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