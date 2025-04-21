// functions/src/utils/getEnv.ts
import * as dotenv from 'dotenv';

// Solo carga .env en modo desarrollo/emulador
if (process.env.FUNCTIONS_EMULATOR) {
  dotenv.config();
}

/**
 * Obtiene una variable de entorno desde process.env.
 * Si no se encuentra, devuelve el fallback si se proporciona.
 */
export function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key];

  if (value !== undefined) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`❌ Variable de entorno "${key}" no encontrada`);
}
