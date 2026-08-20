import { IAIProvider, AIMessage, AIResponse, AIStreamOptions } from '../types/ai';
import { StreamController } from './StreamController';

export class GeminiProvider implements IAIProvider {
  public readonly name = 'Gemini 3.6 Flash Brain';

  public async sendMessage(
    messages: AIMessage[],
    options?: AIStreamOptions
  ): Promise<AIResponse> {
    try {
      const fullContent = await StreamController.streamResponse({
        endpoint: '/api/gemini',
        messages,
        signal: options?.signal,
        onChunk: options?.onChunk,
      });

      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
        },
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to communicate with secure Gemini server endpoint.');
    }
  }
}
