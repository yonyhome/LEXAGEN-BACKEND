// functions/src/utils/getEnv.ts
import * as functions from 'firebase-functions';
import * as dotenv from 'dotenv';

// Carga variables locales solo si estás en desarrollo
if (process.env.FUNCTIONS_EMULATOR) {
  dotenv.config();
}

export function getEnvVar(key: string, fallback?: string): string {
  // 1. Intenta desde process.env (modo local)
  if (process.env[key]) return process.env[key]!;

  // 2. Intenta desde Firebase config (modo producción)
  const segments = key.toLowerCase().split('_'); // e.g., openai_key → ['openai', 'key']
  if (segments.length === 2) {
    const configSection = (functions.config() as any)[segments[0]];
    if (configSection && configSection[segments[1]]) {
      return configSection[segments[1]];
    }
  }

  // 3. Si no se encuentra, usar fallback o lanzar error
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing environment variable: ${key}`);
}
