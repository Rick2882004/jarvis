import { IAIProvider, AIMessage, AIResponse, AIStreamOptions } from '../types/ai';

export class MockAIProvider implements IAIProvider {
  public readonly name = 'Jarvis Mock Neural Core';

  private responses: Array<{ keywords: string[]; response: string }> = [
    {
      keywords: ['hello', 'hi', 'hey', 'jarvis', 'wake up'],
      response: 'Online and standing by. How can I assist you today, boss?',
    },
    {
      keywords: ['who are you', 'what are you', 'your name'],
      response: 'I am Jarvis, your voice-first personal AI computer companion.',
    },
    {
      keywords: ['time', 'date', 'clock', 'day'],
      response: `The current local time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
    },
    {
      keywords: ['status', 'system', 'diagnostics', 'health'],
      response: 'All core systems are functioning within normal parameters. Speech recognition, synthesis, and neural links are active.',
    },
    {
      keywords: ['capability', 'what can you do', 'help', 'features'],
      response: 'Currently operating in Phase 1 Core mode. I can process your voice input, analyze requests, and respond via speech.',
    },
    {
      keywords: ['weather', 'temperature', 'forecast'],
      response: 'Atmospheric conditions appear optimal. I am currently running locally on your workstation.',
    },
    {
      keywords: ['thank', 'thanks', 'good job'],
      response: 'Always at your service.',
    },
    {
      keywords: ['shutdown', 'sleep', 'bye', 'exit', 'goodnight'],
      response: 'Entering standby mode. Activated upon your command.',
    },
  ];

  public async sendMessage(
    messages: AIMessage[],
    options?: AIStreamOptions
  ): Promise<AIResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const query = lastUserMessage ? lastUserMessage.content.toLowerCase().trim() : '';

    // Simulated thinking delay (700-1100ms)
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

    let replyContent = '';

    const matched = this.responses.find((r) =>
      r.keywords.some((kw) => query.includes(kw))
    );

    if (matched) {
      replyContent = matched.response;
    } else if (query.length > 0) {
      replyContent = `Understood. I processed your request: "${lastUserMessage?.content}". Phase 1 voice systems are fully operational.`;
    } else {
      replyContent = 'I am listening. Please state your command.';
    }

    // Simulate streaming if handler provided
    if (options?.onChunk) {
      const words = replyContent.split(' ');
      for (let i = 0; i < words.length; i++) {
        options.onChunk((i === 0 ? '' : ' ') + words[i]);
        await new Promise((res) => setTimeout(res, 40));
      }
    }

    const responseMessage: AIMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: replyContent,
      timestamp: Date.now(),
    };

    return {
      message: responseMessage,
    };
  }
}
