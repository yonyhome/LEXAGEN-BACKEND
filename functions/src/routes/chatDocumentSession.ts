// functions/src/routes/chatDocumentSession.ts
import { onRequest, HttpsFunction } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import cors from 'cors';
import { callOpenAI } from '../services/openaiService';
import { buildChatMessages, parseChatResponse } from '../utils/chatPrompts';

const corsHandler = cors({ origin: true });

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const chatDocumentSession: HttpsFunction = onRequest(
  {
    secrets: ['OPENAI_KEY'],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (req: Request, res: Response) => {
    corsHandler(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
      }

      try {
        const { messages } = req.body as { messages?: ChatMessage[] };

        if (!Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ error: 'Se requiere el campo "messages" (array no vacío).' });
        }

        // Limitar historial a los últimos 20 mensajes para controlar tokens
        const trimmedMessages = messages.slice(-20);

        // Construir mensajes con system prompt
        const chatMessages = buildChatMessages(trimmedMessages);

        // Llamar al LLM — usamos el system prompt + historial
        // callOpenAI recibe (prompt, context) pero aquí necesitamos pasar mensajes directamente
        // Modificamos la llamada para usar los mensajes completos
        const rawResponse = await callOpenAIChat(chatMessages);

        // Parsear la respuesta estructurada
        const parsed = parseChatResponse(rawResponse);

        return res.status(200).json({
          reply: parsed.reply,
          extractedData: parsed.extractedData,
          isReady: parsed.isReady,
          missingFields: parsed.missingFields,
          progress: parsed.progress,
        });

      } catch (error: any) {
        console.error('[chatDocumentSession] Error:', error?.message || error);
        return res.status(500).json({
          error: 'Error al procesar el mensaje.',
          reply: 'Lo siento, tuve un problema al procesar tu mensaje. Por favor intenta nuevamente.',
        });
      }
    });
  }
);

/**
 * Llama directamente a la API de OpenAI con un array de mensajes completo.
 * A diferencia de callOpenAI() que recibe (prompt, context), esta función
 * acepta el array de mensajes ya construido con el system prompt.
 */
async function callOpenAIChat(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const axios = (await import('axios')).default;
  const { getEnvVar } = await import('../utils/getEnv');

  const openaiKey = getEnvVar('OPENAI_KEY');

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4.1-2025-04-14',
      messages,
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.choices[0].message.content.trim();
}
