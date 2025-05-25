import axios from 'axios';
import { getEnvVar } from '../utils/getEnv';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Llama al modelo GPT con instrucciones y contexto, incluyendo fecha actual
 */
export async function callOpenAI(prompt: string, context: string): Promise<string> {
  // 1. Calcula la fecha actual en español (Colombia)
  const now = new Date();
  const fechaCol = now.toLocaleDateString('es-CO', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric'
  });
  
  // 2. Construye los mensajes, inyectando la fecha en el primer system message
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${prompt}\n\n--\nNota: la fecha actual es ${fechaCol}.`
    },
    { role: 'user', content: context }
  ];

  const openaiKey = getEnvVar('OPENAI_KEY');

  const response = await axios.post(OPENAI_URL, {
    model: 'gpt-4.1-2025-04-14',
    messages,
    temperature: 0.2,
    max_tokens: 2000
  }, {
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content.trim();
}
