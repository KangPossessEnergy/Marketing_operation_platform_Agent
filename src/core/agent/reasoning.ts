export const REASONING_START_MARKER = '\u001eagent-reasoning-start\u001e';
export const REASONING_END_MARKER = '\u001eagent-reasoning-end\u001e';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const encodedReasoningPattern = new RegExp(
  `${escapeRegExp(REASONING_START_MARKER)}[\\s\\S]*?${escapeRegExp(REASONING_END_MARKER)}`,
  'g',
);

export function encodeReasoningDelta(reasoning: string, text = ''): string {
  return `${REASONING_START_MARKER}${reasoning}${REASONING_END_MARKER}${text}`;
}

export function stripEncodedReasoning<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(encodedReasoningPattern, '') as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => stripEncodedReasoning(item)) as T;
  }

  if (value != null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = stripEncodedReasoning(item);
    }
    return result as T;
  }

  return value;
}

export class ReasoningMarkerParser {
  private buffer = '';
  private inReasoning = false;

  constructor(
    private readonly onReasoning: (delta: string) => void,
    private readonly onText: (delta: string) => void,
  ) {}

  push(delta: string): void {
    this.buffer += delta;
    this.drain();
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    if (this.inReasoning) {
      this.onReasoning(this.buffer);
    } else {
      this.onText(this.buffer);
    }
    this.buffer = '';
  }

  private drain(): void {
    while (this.buffer.length > 0) {
      if (this.inReasoning) {
        const endIndex = this.buffer.indexOf(REASONING_END_MARKER);
        if (endIndex === -1) {
          const safeLength = Math.max(
            0,
            this.buffer.length - REASONING_END_MARKER.length + 1,
          );
          if (safeLength > 0) {
            this.onReasoning(this.buffer.slice(0, safeLength));
            this.buffer = this.buffer.slice(safeLength);
          }
          return;
        }

        if (endIndex > 0) {
          this.onReasoning(this.buffer.slice(0, endIndex));
        }
        this.buffer = this.buffer.slice(
          endIndex + REASONING_END_MARKER.length,
        );
        this.inReasoning = false;
        continue;
      }

      const startIndex = this.buffer.indexOf(REASONING_START_MARKER);
      if (startIndex !== -1) {
        if (startIndex > 0) {
          this.onText(this.buffer.slice(0, startIndex));
        }
        this.buffer = this.buffer.slice(
          startIndex + REASONING_START_MARKER.length,
        );
        this.inReasoning = true;
        continue;
      }

      const markerStart = this.buffer.lastIndexOf('\u001e');
      if (markerStart === -1) {
        this.onText(this.buffer);
        this.buffer = '';
        return;
      }

      const safeLength = markerStart;
      if (safeLength > 0) {
        this.onText(this.buffer.slice(0, safeLength));
        this.buffer = this.buffer.slice(safeLength);
      }
      return;
    }
  }
}
