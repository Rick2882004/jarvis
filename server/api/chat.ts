import { JARVIS_SYSTEM_PROMPT } from '../prompt';
import fs from 'fs';
import path from 'path';

export interface ChatApiRequestMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ChatApiResponse {
  message?: {
    id: string;
    role: 'assistant';
    content: string;
    timestamp: number;
  };
  error?: string;
}

/**
  Helper to load OPENAI_API_KEY from process.env or .env.local file
 */
export function getOpenAIApiKey(): string | null {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    return process.env.OPENAI_API_KEY;
  }

  // Fallback to manual .env.local parsing if env var wasn't injected into process
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^OPENAI_API_KEY=(.*)$/m);
      if (match && match[1]) {
        const key = match[1].trim();
        if (key && key !== 'your_openai_api_key_here') {
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
  Sanitizes error string to guarantee no API key is leaked
 */
function sanitizeErrorMessage(rawError: string, apiKey: string | null): string {
  let clean = rawError;
  if (apiKey) {
    clean = clean.replace(new RegExp(apiKey, 'g'), '[REDACTED_API_KEY]');
  }
  // Remove any sk- bearer tokens
  clean = clean.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');
  return clean;
}

export async function handleChatApiRequest(messages: ChatApiRequestMessage[]): Promise<{ status: number; body: ChatApiResponse }> {
  const apiKey = getOpenAIApiKey();

  if (!apiKey) {
    return {
      status: 401,
      body: {
        error: 'OpenAI API key is missing or not configured on the server. Please set OPENAI_API_KEY in .env.local.',
      },
    };
  }

  try {
    // Format conversation context messages (omit ids / non-standard fields)
    const apiMessages = [
      { role: 'system', content: JARVIS_SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!openAiResponse.ok) {
      const errorJson: any = await openAiResponse.json().catch(() => ({}));
      const rawMsg = errorJson?.error?.message || `OpenAI returned status ${openAiResponse.status}`;
      const cleanMsg = sanitizeErrorMessage(rawMsg, apiKey);

      if (openAiResponse.status === 401) {
        return {
          status: 401,
          body: { error: 'Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env.local.' },
        };
      }

      if (openAiResponse.status === 429) {
        return {
          status: 429,
          body: { error: 'OpenAI API rate limit or quota exceeded. Please check your account quota.' },
        };
      }

      return {
        status: openAiResponse.status,
        body: { error: `OpenAI API Error: ${cleanMsg}` },
      };
    }

    const data: any = await openAiResponse.json();
    const assistantContent = data?.choices?.[0]?.message?.content?.trim();

    if (!assistantContent) {
      return {
        status: 500,
        body: { error: 'OpenAI returned an empty response.' },
      };
    }

    return {
      status: 200,
      body: {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
        },
      },
    };
  } catch (err: unknown) {
    const rawErrorMsg = err instanceof Error ? err.message : 'Unknown server network error.';
    const cleanMsg = sanitizeErrorMessage(rawErrorMsg, apiKey);

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 504,
        body: { error: 'OpenAI request timed out after 20 seconds.' },
      };
    }

    return {
      status: 500,
      body: { error: `Server network error: ${cleanMsg}` },
    };
  }
}
