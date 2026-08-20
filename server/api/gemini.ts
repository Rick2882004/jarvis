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

export async function handleGeminiStreamApiRequest(
  messages: GeminiApiRequestMessage[],
  res: any
): Promise<void> {
  console.log('[Gemini Stream] request started');
  console.log(`[Gemini Stream] model: ${GEMINI_MODEL}`);

  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.error('[Gemini Stream] API key missing or not configured on server.');
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Gemini API key is missing or not configured on the server. Please set GEMINI_API_KEY in .env.local.' }));
    return;
  }

  // Set SSE response headers
  res.statusCode = 200;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const startTime = Date.now();
  let firstChunkLogged = false;

  try {
    const recentMessages = messages.slice(-8);
    const contents = recentMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    if (contents.length === 0) {
      console.error('[Gemini Stream] No valid user/assistant messages provided.');
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'No user messages provided.' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
      return;
    }

    const payload = {
      system_instruction: {
        parts: [{ text: JARVIS_SYSTEM_PROMPT }],
      },
      contents: contents,
      generationConfig: {
        thinking_config: {
          thinking_level: 'minimal',
        },
        maxOutputTokens: 300,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // If client disconnects, abort upstream request
    res.on('close', () => {
      controller.abort();
    });

    console.log('[Gemini] sending Gemini request');
    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`[Gemini] Gemini response status: ${upstreamRes.status}`);

    if (!upstreamRes.ok) {
      const errorJson: any = await upstreamRes.json().catch(() => ({}));
      const rawMsg = errorJson?.error?.message || `Gemini API returned HTTP ${upstreamRes.status}`;
      const cleanMsg = sanitizeErrorMessage(rawMsg, apiKey);
      console.error(`[Gemini Stream] upstream error: ${cleanMsg}`);

      res.write(`data: ${JSON.stringify({ type: 'error', error: cleanMsg })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
      return;
    }

    if (!upstreamRes.body) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'No body received from Gemini stream.' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
      return;
    }

    console.log('[Gemini] forwarding SSE stream');
    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || ''; // Keep remainder in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.slice(5).trim();
        if (!dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr);
          const chunkText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof chunkText === 'string' && chunkText.length > 0) {
            if (!firstChunkLogged) {
              console.log(`[Gemini] first chunk: ${Date.now() - startTime}ms`);
              firstChunkLogged = true;
            }
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
          }
        } catch {
          // Ignore SSE JSON parse error on non-data frames
        }
      }
    }

    // Process leftover buffer line if any
    if (lineBuffer.trim().startsWith('data:')) {
      try {
        const dataStr = lineBuffer.trim().slice(5).trim();
        const parsed = JSON.parse(dataStr);
        const chunkText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof chunkText === 'string' && chunkText.length > 0) {
          if (!firstChunkLogged) {
            console.log(`[Gemini] first chunk: ${Date.now() - startTime}ms`);
            firstChunkLogged = true;
          }
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
        }
      } catch {
        // Ignore
      }
    }

    console.log(`[Gemini] stream complete: ${Date.now() - startTime}ms`);
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const rawErrorMsg = err instanceof Error ? err.message : 'Unknown server network error.';
    const cleanMsg = sanitizeErrorMessage(rawErrorMsg, apiKey);

    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[Gemini Stream] request aborted or timed out');
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Gemini request timed out or was cancelled.' })}\n\n`);
    } else {
      console.error(`[Gemini Stream] exception: ${cleanMsg}`);
      res.write(`data: ${JSON.stringify({ type: 'error', error: `Server network error: ${cleanMsg}` })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    res.end();
  }
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
