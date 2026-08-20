import { IVoiceOutputService, SpeechOutputOptions, SpeechVoiceOption } from '../types/voice';

export class SpeechSynthesisAdapter implements IVoiceOutputService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speaking: boolean = false;
  private selectedVoiceId: string | null = null;

  private startCallback: (() => void) | null = null;
  private endCallback: (() => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public isSupported(): boolean {
    return !!this.synth;
  }

  public isSpeaking(): boolean {
    return this.speaking || (this.synth ? this.synth.speaking : false);
  }

  public async getAvailableVoices(): Promise<SpeechVoiceOption[]> {
    if (!this.synth) return [];

    return new Promise((resolve) => {
      let voices = this.synth!.getVoices();
      if (voices.length > 0) {
        resolve(this.formatVoices(voices));
        return;
      }

      // Chrome loads voices asynchronously
      const onVoicesChanged = () => {
        voices = this.synth!.getVoices();
        if (this.synth) {
          this.synth.onvoiceschanged = null;
        }
        resolve(this.formatVoices(voices));
      };

      this.synth.onvoiceschanged = onVoicesChanged;

      // Timeout fallback
      setTimeout(() => {
        voices = this.synth ? this.synth.getVoices() : [];
        resolve(this.formatVoices(voices));
      }, 500);
    });
  }

  private formatVoices(voices: SpeechSynthesisVoice[]): SpeechVoiceOption[] {
    return voices.map((v) => ({
      id: v.voiceURI || v.name,
      name: v.name,
      lang: v.lang,
      default: v.default,
    }));
  }

  public setVoice(voiceId: string): void {
    this.selectedVoiceId = voiceId;
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.speaking = false;
    this.currentUtterance = null;
  }

  public async speak(text: string, options?: SpeechOutputOptions): Promise<void> {
    if (!this.synth) {
      if (this.errorCallback) this.errorCallback('Speech synthesis is not supported.');
      return;
    }

    // Only cancel active/pending speech (interruption guarantee) without redundant IPC delay
    if (this.isSpeaking()) {
      this.stop();
    }

    if (!text.trim()) return;

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      // Pitch & Rate tuning for calm Jarvis voice
      utterance.pitch = options?.pitch ?? 0.95;
      utterance.rate = options?.rate ?? 1.0;
      utterance.volume = options?.volume ?? 1.0;

      // Voice resolution
      const voices = this.synth!.getVoices();
      const targetVoiceId = options?.voiceId || this.selectedVoiceId;

      if (targetVoiceId) {
        const matched = voices.find((v) => (v.voiceURI || v.name) === targetVoiceId);
        if (matched) utterance.voice = matched;
      }

      if (!utterance.voice && voices.length > 0) {
        // Preferred voice matching heuristics for natural english
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google') ||
              v.name.includes('Natural') ||
              v.name.includes('Daniel') ||
              v.name.includes('Samantha') ||
              v.name.includes('Alex') ||
              v.name.includes('Arthur'))
        ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];

        utterance.voice = preferred;
      }

      utterance.onstart = () => {
        this.speaking = true;
        if (this.startCallback) this.startCallback();
      };

      utterance.onend = () => {
        this.speaking = false;
        this.currentUtterance = null;
        if (this.endCallback) this.endCallback();
        resolve();
      };

      utterance.onerror = (event: any) => {
        this.speaking = false;
        this.currentUtterance = null;
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          if (this.errorCallback) this.errorCallback(`Speech output error: ${event.error}`);
        }
        resolve();
      };

      this.synth.speak(utterance);
    });
  }

  public onStart(callback: () => void): void {
    this.startCallback = callback;
  }

  public onEnd(callback: () => void): void {
    this.endCallback = callback;
  }

  public onError(callback: (error: string) => void): void {
    this.errorCallback = callback;
  }

  public destroy(): void {
    this.stop();
    this.startCallback = null;
    this.endCallback = null;
    this.errorCallback = null;
  }
}
