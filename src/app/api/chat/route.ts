import { SseParser, isDoneSentinel } from '@/lib/sse';

/**
 * Streaming chat completions proxy.
 *
 * Keeps the provider API key on the server: the browser never sees it.
 * Normalises any OpenAI-compatible backend into a plain text/event-stream
 * of `{"delta": "..."}` frames.
 */
interface IncomingBody {
  messages: Array<{ role: string; content: string }>;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export async function POST(request: Request) {
  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const baseUrl = (body.baseUrl || '').trim().replace(/\/+$/, '');
  const model = (body.model || '').trim();

  if (!baseUrl) {
    return Response.json({ error: 'Missing baseUrl' }, { status: 400 });
  }
  if (!model) {
    return Response.json({ error: 'Missing model' }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: 'Missing messages' }, { status: 400 });
  }

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: body.messages,
      stream: true,
    }),
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Network error';
    return new Response(JSON.stringify({ error: `Could not reach provider: ${message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return Response.json(
      {
        error: `Provider returned ${upstream.status}`,
        detail: detail.slice(0, 500),
      },
      { status: upstream.status || 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          if (isDoneSentinel(event.data)) continue;

          let delta = '';
          try {
            const json = JSON.parse(event.data);
            delta = json?.choices?.[0]?.delta?.content ?? '';
          } catch {
            continue; // keep-alive or non-JSON frame
          }
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Stream error';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
        );
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
