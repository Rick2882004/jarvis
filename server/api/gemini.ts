import { JARVIS_SYSTEM_PROMPT } from '../prompt';
import fs from 'fs';
import path from 'path';

export const GEMINI_MODEL = 'gemini-3.6-flash';

export interface GeminiApiRequestMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface GeminiApiResponse {
  message?: {
    id: string;
    role: 'assistant';
    content: string;
    timestamp: number;
  };
  error?: string;
}

/**
 * Helper to load GEMINI_API_KEY from process.env or .env.local file
 */
export function getGeminiApiKey(): string | null {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && process.env.GEMINI_API_KEY !== 'your_gemini_key_here') {
    return process.env.GEMINI_API_KEY;
  }

  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^GEMINI_API_KEY=(.*)$/m);
      if (match && match[1]) {
        const key = match[1].trim();
        if (key && key !== 'your_gemini_api_key_here' && key !== 'your_gemini_key_here') {
          return key;
        }
      }
    }
  } catch {
    // Ignore read error
  }

  return null;
}

/**
 * Sanitizes error string to guarantee no API key is leaked
 */
function sanitizeErrorMessage(rawError: string, apiKey: string | null): string {
  let clean = rawError;
  if (apiKey) {
    clean = clean.replace(new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED_API_KEY]');
  }
  clean = clean.replace(/key=[a-zA-Z0-9_-]+/g, 'key=[REDACTED_API_KEY]');
  return clean;
}

export async function handleGeminiApiRequest(messages: GeminiApiRequestMessage[]): Promise<{ status: number; body: GeminiApiResponse }> {
  console.log('[Gemini] request started');
  console.log(`[Gemini] model: ${GEMINI_MODEL}`);

  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.error('[Gemini] API key missing or not configured on server.');
    return {
      status: 401,
      body: {
        error: 'Gemini API key is missing or not configured on the server. Please set GEMINI_API_KEY in .env.local.',
      },
    };
  }

  try {
    // Map session messages to Gemini REST format
    // In Gemini API, assistant role is 'model'
    const contents = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    if (contents.length === 0) {
      console.error('[Gemini] No valid user/assistant messages provided.');
      return {
        status: 400,
        body: { error: 'No user messages provided.' },
      };
    }

    const payload = {
      system_instruction: {
        parts: [{ text: JARVIS_SYSTEM_PROMPT }],
      },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    console.log('[Gemini] sending request');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`[Gemini] response status: ${response.status}`);

    if (!response.ok) {
      const errorJson: any = await response.json().catch(() => ({}));
      const rawMsg = errorJson?.error?.message || `Gemini API returned HTTP ${response.status}`;
      const errStatusStr = errorJson?.error?.status || `HTTP_${response.status}`;
      const cleanMsg = sanitizeErrorMessage(rawMsg, apiKey);

      console.error(`[Gemini] HTTP status: ${response.status}`);
      console.error(`[Gemini] error status: ${errStatusStr}`);
      console.error(`[Gemini] error message: ${cleanMsg}`);

      if (response.status === 429) {
        return {
          status: 429,
          body: { error: 'Gemini API rate limit or quota exceeded. Please check your account quota.' },
        };
      }

      return {
        status: response.status,
        body: { error: `Gemini API Error (${errStatusStr}): ${cleanMsg}` },
      };
    }

    const data: any = await response.json();
    console.log('[Gemini] response received');

    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!candidateText) {
      console.error('[Gemini] Response candidates missing or empty content parts.');
      return {
        status: 500,
        body: { error: 'Gemini API returned an empty or invalid candidate structure.' },
      };
    }

    return {
      status: 200,
      body: {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: candidateText,
          timestamp: Date.now(),
        },
      },
    };
  } catch (err: unknown) {
    const rawErrorMsg = err instanceof Error ? err.message : 'Unknown server network error.';
    const cleanMsg = sanitizeErrorMessage(rawErrorMsg, apiKey);

    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[Gemini] request timed out after 60 seconds');
      return {
        status: 504,
        body: { error: 'Gemini request timed out. Check network connectivity or Gemini API availability.' },
      };
    }

    console.error(`[Gemini] Exception during request: ${cleanMsg}`);
    return {
      status: 500,
      body: { error: `Server network error: ${cleanMsg}` },
    };
  }
}
