import { Plugin } from 'vite';
import { handleChatApiRequest } from './api/chat';
import { handleGeminiStreamApiRequest } from './api/gemini';
import type { IncomingMessage, ServerResponse } from 'http';

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function setupApiEndpoint(
  server: any,
  route: string,
  handler: (messages: any[]) => Promise<{ status: number; body: any }>
) {
  server.middlewares.use(route, async (req: IncomingMessage, res: ServerResponse) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
      return;
    }

    let bodyRaw = '';
    req.on('data', (chunk) => {
      bodyRaw += chunk;
    });

    req.on('end', async () => {
      try {
        const bodyParsed = bodyRaw ? JSON.parse(bodyRaw) : {};
        const messages = bodyParsed.messages || [];

        const result = await handler(messages);

        res.statusCode = result.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result.body));
      } catch (err: unknown) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        const msg = err instanceof Error ? err.message : 'Internal Server Error';
        res.end(JSON.stringify({ error: msg }));
      }
    });
  });
}

function setupStreamApiEndpoint(
  server: any,
  route: string,
  handler: (messages: any[], res: ServerResponse) => Promise<void>
) {
  server.middlewares.use(route, async (req: IncomingMessage, res: ServerResponse) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
      return;
    }

    console.log('[Gemini] stream request received');
    console.log('[Gemini] stream handler started');

    let bodyRaw = '';
    req.on('data', (chunk) => {
      bodyRaw += chunk;
    });

    req.on('end', async () => {
      try {
        const bodyParsed = bodyRaw ? JSON.parse(bodyRaw) : {};
        const messages = bodyParsed.messages || [];

        await handler(messages, res);
      } catch (err: unknown) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          const msg = err instanceof Error ? err.message : 'Internal Server Error';
          res.end(JSON.stringify({ error: msg }));
        }
      }
    });
  });
}

export function viteApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-jarvis-api',
    configureServer(server) {
      // OpenAI Chat API
      setupApiEndpoint(server, '/api/chat', handleChatApiRequest);

      // Gemini Streaming API
      setupStreamApiEndpoint(server, '/api/gemini', handleGeminiStreamApiRequest);
    },
  };
}
