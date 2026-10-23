// Standalone parser test — run with: node --test src/lib/sse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

// The parser is TypeScript; mirror the essential logic here so the test can
// run without a bundler. Kept in sync with src/lib/sse.ts.
function parseFrames(input) {
  const normalised = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const frames = normalised.split('\n\n');
  const rest = frames.pop();
  const events = [];
  for (const frame of frames) {
    if (!frame.trim()) continue;
    const dataLines = [];
    let event;
    let id;
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
    if (dataLines.length) events.push({ data: dataLines.join('\n'), event, id });
  }
  return { events, rest };
}

test('parses a single complete frame', () => {
  const { events, rest } = parseFrames('data: hello\n\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].data, 'hello');
  assert.equal(rest, '');
});

test('keeps an incomplete frame buffered', () => {
  const { events, rest } = parseFrames('data: partial');
  assert.equal(events.length, 0);
  assert.equal(rest, 'data: partial');
});

test('handles CRLF line endings', () => {
  const { events } = parseFrames('data: crlf\r\n\r\n');
  assert.equal(events[0].data, 'crlf');
});

test('joins multiple data lines with a newline', () => {
  const { events } = parseFrames('data: line1\ndata: line2\n\n');
  assert.equal(events[0].data, 'line1\nline2');
});

test('ignores comment/keep-alive lines and captures event + id', () => {
  const { events } = parseFrames(': ping\nevent: message\nid: 7\ndata: payload\n\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'message');
  assert.equal(events[0].id, '7');
  assert.equal(events[0].data, 'payload');
});

test('parses two frames in one chunk', () => {
  const { events } = parseFrames('data: a\n\ndata: b\n\n');
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.data), ['a', 'b']);
});
