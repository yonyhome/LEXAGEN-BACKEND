import { db, admin } from '../firebase';
import * as functions from 'firebase-functions';

// Constantes de configuración
const MAX_TOKEN_LENGTH = 1500;
const VALID_OPTIONS = ['pdf', 'pdf-word'] as const;
const COLLECTION_NAME = 'paymentOptions';

type PaymentOption = typeof VALID_OPTIONS[number];

export async function savePaymentOption(token: string, option: PaymentOption): Promise<void> {
  // Validación mejorada con mensajes claros
  const validationError = validateInputs(token, option);
  if (validationError) throw new Error(validationError);

  const trimmedToken = token.trim();
  const documentData = {
    token: trimmedToken,
    option,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    functions.logger.log('Guardando opción de pago', {
      tokenPrefix: trimmedToken.substring(0, 5),
      tokenLength: trimmedToken.length,
      option
    });

    const writeResult = await db.collection(COLLECTION_NAME)
      .doc(trimmedToken)
      .set(documentData, { merge: true });

    functions.logger.log('Opción guardada exitosamente', {
      documentId: trimmedToken,
      writeTime: writeResult.writeTime.toDate().toISOString()
    });

  } catch (error: any) {
    const firestoreError = handleFirestoreError(error, trimmedToken);
    functions.logger.error('Error en Firestore', firestoreError.logDetails);
    throw new Error(firestoreError.userMessage);
  }
}

export async function getPaymentOption(token: string): Promise<PaymentOption | null> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    functions.logger.warn('Token inválido recibido');
    return null;
  }

  const trimmedToken = token.trim();

  try {
    const doc = await db.collection(COLLECTION_NAME)
      .doc(trimmedToken)
      .get();

    if (!doc.exists) {
      functions.logger.warn('Documento no encontrado', { 
        tokenLength: trimmedToken.length 
      });
      return null;
    }

    return validateDocumentData(doc.data(), trimmedToken);

  } catch (error: any) {
    functions.logger.error('Error al obtener opción', {
      error: error.message,
      code: error.code,
      tokenLength: trimmedToken.length
    });
    return null;
  }
}

// Funciones auxiliares (privadas)
function validateInputs(token: string, option: string): string | null {
  if (!token || typeof token !== 'string') return 'Token inválido: debe ser un string';
  if (token.trim().length === 0) return 'Token no puede estar vacío';
  if (token.length > MAX_TOKEN_LENGTH) return `Token excede longitud máxima (${MAX_TOKEN_LENGTH} caracteres)`;
  if (/[\/\.\s#$\[\]]/.test(token)) return 'Token contiene caracteres inválidos (/ . espacios # $ [ ])';
  if (!VALID_OPTIONS.includes(option as PaymentOption)) return `Opción inválida: ${option}`;
  return null;
}

function handleFirestoreError(error: any, token: string): { 
  userMessage: string; 
  logDetails: Record<string, any> 
} {
  const errorMap: Record<string, string> = {
    'resource-exhausted': 'Límite de cuota excedido',
    'permission-denied': 'Permisos insuficientes',
    'invalid-argument': 'Datos inválidos para Firestore',
    'aborted': 'Operación conflictiva',
    'already-exists': 'Documento ya existe',
    'not-found': 'Colección no encontrada'
  };

  return {
    userMessage: errorMap[error.code] || 'Error en base de datos',
    logDetails: {
      code: error.code || 'unknown',
      message: error.message,
      tokenLength: token.length,
      firestoreError: JSON.stringify(error)
    }
  };
}

function validateDocumentData(data: any, token: string): PaymentOption | null {
  if (!data || typeof data !== 'object') {
    functions.logger.error('Datos del documento inválidos', { 
      documentId: token 
    });
    return null;
  }

  const option = data.option;
  if (VALID_OPTIONS.includes(option)) {
    return option;
  }

  functions.logger.error('Opción inválida en documento', {
    documentId: token,
    receivedOption: option,
    validOptions: VALID_OPTIONS
  });

  return null;
}