/**
 * Incremental Server-Sent Events parser.
 *
 * Chunk-safe: feed it arbitrary string fragments from a fetch body and it
 * returns only the frames that are fully terminated, buffering the rest.
 * Handles \n, \r\n and lone \r line endings plus multi-line data fields.
 */
export interface SseEvent {
  data: string;
  event?: string;
  id?: string;
}

export class SseParser {
  private buffer = '';

  /** Feeds a chunk of text and returns all complete frames. */
  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];

    // A frame ends at a blank line. Normalise CRLF first so we only
    // have to look for \n\n.
    this.buffer = this.buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let index: number;
    while ((index = this.buffer.indexOf('\n\n')) !== -1) {
      const frame = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      const parsed = parseFrame(frame);
      if (parsed) events.push(parsed);
    }
    return events;
  }

  /** Flushes a trailing partial frame at end of stream. */
  flush(): SseEvent[] {
    const remaining = this.buffer.trim();
    this.buffer = '';
    if (!remaining) return [];
    const parsed = parseFrame(remaining);
    return parsed ? [parsed] : [];
  }
}

function parseFrame(frame: string): SseEvent | null {
  if (!frame.trim()) return null;

  let event: string | undefined;
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const rawLine of frame.split('\n')) {
    if (!rawLine || rawLine.startsWith(':')) continue;
    const colon = rawLine.indexOf(':');
    const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
    let value = colon === -1 ? '' : rawLine.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event' && event === undefined) event = value;
    else if (field === 'id' && id === undefined) id = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  return { data: dataLines.join('\n'), event, id };
}

/** True when a frame is the OpenAI `[DONE]` sentinel. */
export function isDoneSentinel(data: string): boolean {
  return data.trim() === '[DONE]';
}
