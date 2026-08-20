import { AIMessage } from '../types/ai';

export interface StreamResponseOptions {
  endpoint: string;
  messages: AIMessage[];
  signal?: AbortSignal;
  onChunk?: (chunkText: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export class StreamController {
  public static async streamResponse(options: StreamResponseOptions): Promise<string> {
    const { endpoint, messages, signal, onChunk, onComplete, onError } = options;

    let accumulatedText = '';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
        signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson?.error || `Server HTTP error (${response.status})`;
        throw new Error(msg);
      }

      if (!response.body) {
        throw new Error('Readable stream not supported or empty response body received.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (signal?.aborted) {
          reader.cancel().catch(() => {});
          throw new Error('Stream cancelled by user abort signal.');
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (!dataStr) continue;

          let event: any = null;
          try {
            event = JSON.parse(dataStr);
          } catch {
            // Ignore incomplete line JSON parse error
            continue;
          }

          if (event) {
            if (event.type === 'chunk' && typeof event.text === 'string') {
              accumulatedText += event.text;
              if (onChunk) {
                onChunk(event.text);
              }
            } else if (event.type === 'error' && typeof event.error === 'string') {
              throw new Error(event.error);
            }
          }
        }
      }

      // Check leftover buffer
      if (buffer.trim().startsWith('data:')) {
        const dataStr = buffer.trim().slice(5).trim();
        let event: any = null;
        try {
          event = JSON.parse(dataStr);
        } catch {
          // Ignore
        }
        if (event) {
          if (event.type === 'chunk' && typeof event.text === 'string') {
            accumulatedText += event.text;
            if (onChunk) {
              onChunk(event.text);
            }
          } else if (event.type === 'error' && typeof event.error === 'string') {
            throw new Error(event.error);
          }
        }
      }

      if (onComplete) {
        onComplete(accumulatedText);
      }

      return accumulatedText;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error('Unknown streaming error.');
      if (onError) {
        onError(errorObj);
      }
      throw errorObj;
    }
  }
}
