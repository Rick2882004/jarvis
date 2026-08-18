export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AIResponse {
  message: AIMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIStreamOptions {
  onChunk?: (chunkText: string) => void;
  signal?: AbortSignal;
}

export interface IAIProvider {
  name: string;
  sendMessage(messages: AIMessage[], options?: AIStreamOptions): Promise<AIResponse>;
}
