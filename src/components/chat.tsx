'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PROVIDER_LIST, PROVIDERS, resolveProvider, type ProviderId } from '@/lib/providers';
import type { ChatMessage } from '@/lib/types';
import { Markdown } from '@/components/markdown';
import {
  clearConversation,
  conversationToMarkdown,
  loadConversation,
  saveConversation,
} from '@/lib/storage';

const SUGGESTIONS = [
  'Explain React Server Components in three sentences',
  'Write a TypeScript debounce with cancellation',
  'What is the difference between SSR and SSG?',
  'Draft a polite follow-up email to a client',
];

export function Chat() {
  const [providerId, setProviderId] = useState<ProviderId>('ollama');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(PROVIDERS.ollama.baseUrl);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PROVIDERS.ollama.defaultModel);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const provider = resolveProvider(providerId);

  // Restore a previous conversation on first paint.
  useEffect(() => {
    const stored = loadConversation();
    if (stored) setMessages(stored.messages);
  }, []);

  // Persist on every change so a refresh keeps the thread.
  useEffect(() => {
    saveConversation(messages);
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const copyTranscript = useCallback(async () => {
    if (messages.length === 0) return;
    try {
      await navigator.clipboard.writeText(conversationToMarkdown(messages));
      setNotice('Transcript copied as markdown');
    } catch {
      setNotice('Could not access the clipboard');
    }
  }, [messages]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const chooseProvider = useCallback((id: ProviderId) => {
    const preset = PROVIDERS[id];
    setProviderId(id);
    if (preset.baseUrl) setBaseUrl(preset.baseUrl);
    if (preset.defaultModel) setModel(preset.defaultModel);
    setApiKey('');
    setError(null);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      setError(null);
      setInput('');
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      };
      const assistantId = crypto.randomUUID();
      const history = [...messages, userMessage];

      setMessages([...history, { id: assistantId, role: 'assistant', content: '' }]);
      setStreaming(true);

      const append = (delta: string) =>
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + delta }
              : message,
          ),
        );

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
            baseUrl,
            apiKey: apiKey || undefined,
            model,
          }),
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary: number;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            if (!frame.startsWith('data:')) continue;

            const payload = frame.slice(5).trim();
            let parsed: { delta?: string; error?: string };
            try {
              parsed = JSON.parse(payload);
            } catch {
              continue;
            }
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.delta) append(parsed.delta);
          }
        }
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : 'Something went wrong';
        setError(message);
        setMessages((current) => current.filter((m) => m.id !== assistantId));
      } finally {
        setStreaming(false);
        textareaRef.current?.focus();
      }
    },
    [apiKey, baseUrl, messages, model, streaming],
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center gap-3 border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          P
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-semibold leading-tight">Prism Chat</h1>
          <p className="text-xs text-black/50 dark:text-white/50">
            {provider.label} · {model || 'no model'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            clearConversation();
          }}
          className="rounded-lg px-3 py-1.5 text-xs text-black/60 transition hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
        >
          New chat
        </button>
        {!isEmpty && (
          <button
            type="button"
            onClick={() => void copyTranscript()}
            className="rounded-lg px-3 py-1.5 text-xs text-black/60 transition hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            Copy
          </button>
        )}
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-expanded={settingsOpen}
          className="rounded-lg px-3 py-1.5 text-xs text-black/60 transition hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
        >
          Settings
        </button>
      </header>

      {settingsOpen && (
        <section className="border-b border-black/5 bg-black/[0.02] px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {PROVIDER_LIST.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => chooseProvider(preset.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    preset.id === providerId
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-black/10 text-black/70 hover:border-black/30 dark:border-white/15 dark:text-white/70'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-black/50 dark:text-white/50">{provider.hint}</p>
            <label className="flex flex-col gap-1 text-xs">
              Base URL
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
                className="rounded-lg border border-black/10 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 dark:border-white/15"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Model
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4o-mini"
                className="rounded-lg border border-black/10 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 dark:border-white/15"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              API key
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={provider.requiresApiKey ? 'Required for this provider' : 'Not needed'}
                className="rounded-lg border border-black/10 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 dark:border-white/15"
              />
            </label>
            <p className="text-[11px] text-black/40 dark:text-white/40">
              The key is sent to this app&apos;s server route and forwarded to the provider — it is
              never stored.
            </p>
          </div>
        </section>
      )}

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          {isEmpty ? (
            <div className="flex flex-col items-center gap-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-2xl">
                ✦
              </div>
              <div>
                <h2 className="text-xl font-semibold">How can I help?</h2>
                <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                  Streaming answers, rendered as markdown.
                </p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-xl border border-black/10 px-4 py-3 text-left text-sm text-black/70 transition hover:border-blue-500 hover:text-black dark:border-white/15 dark:text-white/70 dark:hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={
                      message.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-sm text-white'
                        : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-black/[0.04] px-4 py-2.5 text-sm dark:bg-white/[0.06]'
                    }
                  >
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : message.content ? (
                      <Markdown content={message.content} />
                    ) : (
                      <ThinkingDots />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {error && (
        <div className="mx-auto w-full max-w-2xl px-4">
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      {notice && (
        <div className="mx-auto w-full max-w-2xl px-4">
          <p className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
            {notice}
          </p>
        </div>
      )}

      <footer className="border-t border-black/5 px-4 py-3 dark:border-white/10">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            placeholder="Message…"
            className="max-h-40 flex-1 resize-none rounded-2xl border border-black/10 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-white/15"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition disabled:opacity-40"
            aria-label="Send message"
          >
            ↑
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-black/35 dark:text-white/35">
          Runs against Ollama locally by default — no API key required.
        </p>
      </footer>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex gap-1 py-0.5" aria-label="Assistant is typing">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 dark:bg-white/40"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  );
}
