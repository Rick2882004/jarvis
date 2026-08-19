import { IAIProvider, AIMessage, AIResponse, AIStreamOptions } from '../types/ai';

export class GeminiProvider implements IAIProvider {
  public readonly name = 'Gemini 3.6 Flash Brain';

  public async sendMessage(
    messages: AIMessage[],
    options?: AIStreamOptions
  ): Promise<AIResponse> {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
        signal: options?.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorText = data?.error || `Gemini backend error (HTTP ${response.status})`;
        throw new Error(errorText);
      }

      if (!data.message) {
        throw new Error('Received invalid response payload from Gemini backend.');
      }

      if (options?.onChunk && data.message.content) {
        options.onChunk(data.message.content);
      }

      return {
        message: data.message,
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to communicate with secure Gemini server endpoint.');
    }
  }
}
