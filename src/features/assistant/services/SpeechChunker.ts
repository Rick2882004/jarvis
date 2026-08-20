/**
 * Converts raw streaming text tokens into natural, speakable sentence units.
 */
export class SpeechChunker {
  private buffer: string = '';
  private readonly maxBufferLength: number = 50;

  /**
   * Appends incoming text chunk and returns any completed natural speech segments.
   */
  public addChunk(chunkText: string): string[] {
    if (!chunkText) return [];

    this.buffer += chunkText;
    const completedSegments: string[] = [];

    let match: RegExpExecArray | null;
    // Regex matches sentences or clauses ending with '.', '?', '!', ';', ':', or ',' (if buffer > 35 chars)
    const sentenceRegex = /([^.?!;:\n,]+[.?!;:\n,]+(?:\s+|$))/g;

    let lastIndex = 0;
    while ((match = sentenceRegex.exec(this.buffer)) !== null) {
      const segment = match[1].trim();
      const delimiter = match[0].slice(-1);

      // If matched on comma, only split if we have accumulated at least 25 characters
      if (delimiter === ',' && segment.length < 25 && this.buffer.length < this.maxBufferLength) {
        continue;
      }

      if (segment.length > 0) {
        completedSegments.push(segment);
      }
      lastIndex = sentenceRegex.lastIndex;
    }

    if (lastIndex > 0) {
      this.buffer = this.buffer.slice(lastIndex);
    }

    // Low-latency fallback: If buffer exceeds maxBufferLength without punctuation, split at last space
    if (this.buffer.length >= this.maxBufferLength) {
      const lastSpaceIndex = this.buffer.lastIndexOf(' ');
      if (lastSpaceIndex > 15) {
        const forcedSegment = this.buffer.slice(0, lastSpaceIndex).trim();
        this.buffer = this.buffer.slice(lastSpaceIndex + 1);
        if (forcedSegment.length > 0) {
          completedSegments.push(forcedSegment);
        }
      }
    }

    return completedSegments;
  }

  /**
   * Flushes and returns any remaining accumulated text as a final speech segment.
   */
  public flush(): string[] {
    const remaining = this.buffer.trim();
    this.buffer = '';
    if (remaining.length > 0) {
      return [remaining];
    }
    return [];
  }

  /**
   * Resets the internal buffer.
   */
  public reset(): void {
    this.buffer = '';
  }
}
