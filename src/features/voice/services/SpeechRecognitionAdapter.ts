import {
  IVoiceInputService,
  ISpeechRecognition,
  ISpeechRecognitionConstructor,
  ISpeechRecognitionEvent,
  ISpeechRecognitionErrorEvent,
  IWindowWithSpeechRecognition,
} from '../types/voice';

export class SpeechRecognitionAdapter implements IVoiceInputService {
  private activeRecognition: ISpeechRecognition | null = null;
  private listening: boolean = false;

  private startCallback: (() => void) | null = null;
  private resultCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;
  private endCallback: (() => void) | null = null;

  private getConstructor(): ISpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') return null;
    const win = window as unknown as IWindowWithSpeechRecognition;
    return win.SpeechRecognition || win.webkitSpeechRecognition || null;
  }

  public isSupported(): boolean {
    return !!this.getConstructor();
  }

  public isListening(): boolean {
    return this.listening;
  }

  public startListening(): void {
    const SpeechRecognitionClass = this.getConstructor();

    if (!SpeechRecognitionClass) {
      if (this.errorCallback) {
        this.errorCallback('Speech recognition is not supported in this browser.');
      }
      return;
    }

    // Clean up any stale active recognition session
    if (this.activeRecognition) {
      try {
        this.activeRecognition.abort();
      } catch {
        // Ignore abort cleanup errors
      }
      this.activeRecognition = null;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      this.activeRecognition = recognition;

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        this.listening = true;
        if (this.startCallback) {
          this.startCallback();
        }
      };

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcriptPiece = result[0]?.transcript || '';
          if (result.isFinal) {
            finalTranscript += transcriptPiece;
          } else {
            interimTranscript += transcriptPiece;
          }
        }

        if (finalTranscript && this.resultCallback) {
          this.resultCallback(finalTranscript.trim(), true);
        } else if (interimTranscript && this.resultCallback) {
          this.resultCallback(interimTranscript.trim(), false);
        }
      };

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        const error = event.error;

        // Gracefully ignore expected non-critical operational events
        if (error === 'no-speech' || error === 'aborted') {
          return;
        }

        this.listening = false;

        if (error === 'not-allowed' || error === 'service-not-allowed') {
          if (this.errorCallback) {
            this.errorCallback('Microphone access denied. Please grant microphone permission in your browser settings.');
          }
        } else {
          if (this.errorCallback) {
            this.errorCallback(`Speech recognition error: ${error}`);
          }
        }
      };

      recognition.onend = () => {
        this.listening = false;
        this.activeRecognition = null;
        if (this.endCallback) {
          this.endCallback();
        }
      };

      recognition.start();
    } catch (err: unknown) {
      this.listening = false;
      this.activeRecognition = null;
      const message = err instanceof Error ? err.message : 'Failed to start speech recognition.';
      if (this.errorCallback) {
        this.errorCallback(message);
      }
    }
  }

  public stopListening(): void {
    this.listening = false;
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch {
        // Ignore stop error
      }
      this.activeRecognition = null;
    }
  }

  public onStart(callback: () => void): void {
    this.startCallback = callback;
  }

  public onResult(callback: (transcript: string, isFinal: boolean) => void): void {
    this.resultCallback = callback;
  }

  public onError(callback: (error: string) => void): void {
    this.errorCallback = callback;
  }

  public onEnd(callback: () => void): void {
    this.endCallback = callback;
  }

  public destroy(): void {
    this.stopListening();
    this.startCallback = null;
    this.resultCallback = null;
    this.errorCallback = null;
    this.endCallback = null;
  }
}
