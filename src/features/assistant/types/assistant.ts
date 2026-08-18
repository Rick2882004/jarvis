import { AIMessage } from '../../ai/types/ai';

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface SessionContext {
  messages: AIMessage[];
  activeTranscript: string;
  latestResponse: string;
  errorMessage: string | null;
  audioFeedbackEnabled: boolean;
  selectedVoiceId: string | null;
}

export type AssistantStateListener = (state: AssistantState) => void;
