import axios from 'axios';
import { getEnvVar } from '../utils/getEnv';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Llama al modelo GPT con instrucciones y contexto
 */
export async function callOpenAI(prompt: string, context: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: prompt },
    { role: 'user', content: context }
  ];

  const openaiKey = getEnvVar('OPENAI_KEY');

  const response = await axios.post(OPENAI_URL, {
    model: 'gpt-4o-mini-2024-07-18',
    messages,
    temperature: 0.1,
    max_tokens: 1200
  }, {
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content.trim();
}
