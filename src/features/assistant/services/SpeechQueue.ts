import { IVoiceOutputService, SpeechOutputOptions } from '../../voice/types/voice';

export class SpeechQueue {
  private queue: string[] = [];
  private isProcessing: boolean = false;
  private voiceOutputService: IVoiceOutputService;
  private selectedOptions?: SpeechOutputOptions;

  private onStartCb?: () => void;
  private onEndCb?: () => void;
  private onEmptyCb?: () => void;

  constructor(voiceOutputService: IVoiceOutputService) {
    this.voiceOutputService = voiceOutputService;
  }

  public setOptions(options?: SpeechOutputOptions): void {
    this.selectedOptions = options;
  }

  public enqueue(text: string | string[]): void {
    const items = Array.isArray(text) ? text : [text];
    for (const item of items) {
      const trimmed = item.trim();
      if (trimmed.length > 0) {
        this.queue.push(trimmed);
      }
    }
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      if (this.onEmptyCb) {
        this.onEmptyCb();
      }
      return;
    }

    this.isProcessing = true;
    const nextSegment = this.queue.shift()!;

    if (this.onStartCb && !this.voiceOutputService.isSpeaking()) {
      this.onStartCb();
    }

    try {
      await this.voiceOutputService.speak(nextSegment, this.selectedOptions);
    } catch {
      // Continue next item even if speech synthesis fails for one segment
    }

    if (this.queue.length > 0) {
      await this.processNext();
    } else {
      this.isProcessing = false;
      if (this.onEndCb) {
        this.onEndCb();
      }
      if (this.onEmptyCb) {
        this.onEmptyCb();
      }
    }
  }

  public cancel(): void {
    this.queue = [];
    this.isProcessing = false;
    this.voiceOutputService.stop();
  }

  public isBusy(): boolean {
    return this.isProcessing || this.queue.length > 0 || this.voiceOutputService.isSpeaking();
  }

  public onStart(cb: () => void): void {
    this.onStartCb = cb;
  }

  public onEnd(cb: () => void): void {
    this.onEndCb = cb;
  }

  public onEmpty(cb: () => void): void {
    this.onEmptyCb = cb;
  }
}
