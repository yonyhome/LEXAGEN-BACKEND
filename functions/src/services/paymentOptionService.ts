import { db, admin } from '../firebase';
import { logger } from 'firebase-functions';

const MAX_TOKEN_LENGTH = 1500;
const VALID_OPTIONS = ['pdf', 'pdf-word'] as const;
const COLLECTION_NAME = 'paymentOptions';

type PaymentOption = typeof VALID_OPTIONS[number];

export async function savePaymentOption(
  token: string,
  option: PaymentOption,
  email?: string,
  tipoDocumento?: string
): Promise<void> {
  const validationError = validateInputs(token, option);
  if (validationError) throw new Error(validationError);

  const trimmedToken = token.trim();
  const documentData: Record<string, any> = {
    token: trimmedToken,
    option,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (email) documentData.email = email;
  if (tipoDocumento) documentData.tipoDocumento = tipoDocumento;

  try {
    logger.info('[savePaymentOption] Guardando opción de pago', {
      tokenPrefix: trimmedToken.substring(0, 5),
      tokenLength: trimmedToken.length,
      option
    });

    const writeResult = await db
      .collection(COLLECTION_NAME)
      .doc(trimmedToken)
      .set(documentData, { merge: true });

    logger.info('[savePaymentOption] Guardado exitoso', {
      documentId: trimmedToken,
      writeTime: writeResult.writeTime.toDate().toISOString()
    });

  } catch (error: any) {
    const firestoreError = handleFirestoreError(error, trimmedToken);

    logger.error('[savePaymentOption] Error al guardar en Firestore', {
      ...firestoreError.logDetails,
      stack: error.stack,
      raw: error
    });

    throw new Error(firestoreError.userMessage);
  }
}

export async function getPaymentOption(token: string): Promise<PaymentOption | null> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    logger.warn('[getPaymentOption] Token inválido recibido');
    return null;
  }

  const trimmedToken = token.trim();

  try {
    const doc = await db
      .collection(COLLECTION_NAME)
      .doc(trimmedToken)
      .get();

    if (!doc.exists) {
      logger.warn('[getPaymentOption] Documento no encontrado', { tokenLength: trimmedToken.length });
      return null;
    }

    return validateDocumentData(doc.data(), trimmedToken);

  } catch (error: any) {
    logger.error('[getPaymentOption] Error al obtener documento', {
      message: error.message,
      code: error.code || 'unknown',
      stack: error.stack,
      tokenLength: trimmedToken.length
    });
    return null;
  }
}

// ==========================
// 🔒 Funciones auxiliares
// ==========================

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
  logDetails: Record<string, any>;
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
      tokenLength: token.length
    }
  };
}

function validateDocumentData(data: any, token: string): PaymentOption | null {
  if (!data || typeof data !== 'object') {
    logger.error('[getPaymentOption] Datos inválidos en documento', { documentId: token });
    return null;
  }

  const option = data.option;
  if (VALID_OPTIONS.includes(option)) {
    return option;
  }

  logger.error('[getPaymentOption] Opción inválida en documento', {
    documentId: token,
    receivedOption: option,
    validOptions: VALID_OPTIONS
  });

  return null;
}
