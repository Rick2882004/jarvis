export interface SpeechOutputOptions {
  pitch?: number; // 0.5 to 1.5
  rate?: number;  // 0.5 to 1.5
  volume?: number; // 0 to 1
  voiceId?: string;
}

export interface SpeechVoiceOption {
  id: string;
  name: string;
  lang: string;
  default: boolean;
}

// Strongly typed Web Speech Recognition API definitions
export interface ISpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface ISpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): ISpeechRecognitionAlternative;
  [index: number]: ISpeechRecognitionAlternative;
}

export interface ISpeechRecognitionResultList {
  readonly length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

export interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResultList;
}

export interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode;
  readonly message?: string;
}

export type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported';

export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;

  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;

  start(): void;
  stop(): void;
  abort(): void;
}

export interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

export interface IWindowWithSpeechRecognition extends Window {
  SpeechRecognition?: ISpeechRecognitionConstructor;
  webkitSpeechRecognition?: ISpeechRecognitionConstructor;
}

export interface IVoiceInputService {
  startListening(): void;
  stopListening(): void;
  isListening(): boolean;
  isSupported(): boolean;
  onStart?(callback: () => void): void;
  onResult(callback: (transcript: string, isFinal: boolean) => void): void;
  onError(callback: (error: string) => void): void;
  onEnd(callback: () => void): void;
  destroy(): void;
}

export interface IVoiceOutputService {
  speak(text: string, options?: SpeechOutputOptions): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
  isSupported(): boolean;
  getAvailableVoices(): Promise<SpeechVoiceOption[]>;
  setVoice(voiceId: string): void;
  onStart(callback: () => void): void;
  onEnd(callback: () => void): void;
  onError(callback: (error: string) => void): void;
  destroy(): void;
}
