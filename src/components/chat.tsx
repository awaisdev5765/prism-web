'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROVIDER_LIST, PROVIDERS, resolveProvider, type ProviderId } from '@/lib/providers';
import type { ChatMessage } from '@/lib/types';
import { Markdown } from '@/components/markdown';
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  PlusIcon,
  SendIcon,
  SlidersIcon,
  SparkIcon,
  StopIcon,
} from '@/components/icons';
import {
  clearConversation,
  conversationToMarkdown,
  loadConversation,
  saveConversation,
} from '@/lib/storage';

const SUGGESTIONS = [
  { title: 'Explain a concept', prompt: 'Explain React Server Components in three sentences.' },
  { title: 'Write some code', prompt: 'Write a TypeScript debounce function with cancellation.' },
  { title: 'Compare approaches', prompt: 'What is the practical difference between SSR and SSG?' },
  { title: 'Draft a message', prompt: 'Draft a polite follow-up email to a client who went quiet.' },
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
  const [hydrated, setHydrated] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pinnedToBottom = useRef(true);

  const provider = resolveProvider(providerId);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    const stored = loadConversation();
    if (stored) setMessages(stored.messages);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveConversation(messages);
  }, [messages, hydrated]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  // Only follow the stream when the reader is already at the bottom,
  // so scrolling up to re-read is never interrupted.
  useEffect(() => {
    if (!pinnedToBottom.current) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    pinnedToBottom.current = distance < 80;
  }, []);

  const autoGrow = useCallback(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
  }, []);

  const chooseProvider = useCallback((id: ProviderId) => {
    const preset = PROVIDERS[id];
    setProviderId(id);
    if (preset.baseUrl) setBaseUrl(preset.baseUrl);
    if (preset.defaultModel) setModel(preset.defaultModel);
    setApiKey('');
    setError(null);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      setError(null);
      setInput('');
      requestAnimationFrame(autoGrow);
      pinnedToBottom.current = true;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      };
      const assistantId = crypto.randomUUID();
      const history = [...messages, userMessage];

      setMessages([...history, { id: assistantId, role: 'assistant', content: '' }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

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
          signal: controller.signal,
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

            let parsed: { delta?: string; error?: string };
            try {
              parsed = JSON.parse(frame.slice(5).trim());
            } catch {
              continue;
            }
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.delta) append(parsed.delta);
          }
        }
      } catch (caught: unknown) {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          setNotice('Generation stopped');
        } else {
          const message = caught instanceof Error ? caught.message : 'Something went wrong';
          setError(message);
          setMessages((current) =>
            current.filter((m) => m.id !== assistantId || m.content.length > 0),
          );
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
        textareaRef.current?.focus();
      }
    },
    [apiKey, autoGrow, baseUrl, messages, model, streaming],
  );

  const copyTranscript = useCallback(async () => {
    if (isEmpty) return;
    try {
      await navigator.clipboard.writeText(conversationToMarkdown(messages));
      setNotice('Transcript copied as markdown');
    } catch {
      setNotice('Clipboard unavailable');
    }
  }, [isEmpty, messages]);

  const newChat = useCallback(() => {
    stop();
    setMessages([]);
    clearConversation();
    setError(null);
    pinnedToBottom.current = true;
  }, [stop]);

  const canSend = input.trim().length > 0 && !streaming;

  return (
    <div className="flex h-dvh flex-col" style={{ background: 'var(--bg)' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 backdrop-blur-xl"
        style={{
          background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-sm)' }}
        >
          <SparkIcon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[0.9375rem] font-semibold leading-tight tracking-[-0.01em]">
            Prism Chat
          </h1>
          <p
            className="flex items-center gap-1.5 truncate text-xs leading-tight"
            style={{ color: 'var(--text-subtle)' }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: streaming ? 'var(--accent)' : '#3fa46a' }}
            />
            {streaming ? 'Generating…' : provider.label}
            {model ? ` · ${model}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!isEmpty && (
            <HeaderButton onClick={() => void copyTranscript()} label="Copy transcript">
              <CopyIcon />
              <span className="hidden sm:inline">Copy</span>
            </HeaderButton>
          )}
          <HeaderButton onClick={newChat} label="New chat">
            <PlusIcon />
            <span className="hidden sm:inline">New</span>
          </HeaderButton>
          <HeaderButton
            onClick={() => setSettingsOpen((open) => !open)}
            label="Settings"
            active={settingsOpen}
          >
            <SlidersIcon />
            <span className="hidden sm:inline">Settings</span>
          </HeaderButton>
        </div>
      </header>

      {/* ── Settings panel ─────────────────────────────────────── */}
      {settingsOpen && (
        <section
          className="animate-rise"
          style={{
            background: 'var(--surface-muted)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5">
            <div className="flex flex-wrap gap-2">
              {PROVIDER_LIST.map((preset) => {
                const selected = preset.id === providerId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => chooseProvider(preset.id)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition"
                    style={{
                      background: selected ? 'var(--accent)' : 'var(--surface)',
                      color: selected ? '#fff' : 'var(--text-muted)',
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      boxShadow: selected ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {selected && <CheckIcon size={13} />}
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {provider.hint}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Base URL">
                <input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://api.openai.com/v1"
                  spellCheck={false}
                  className="w-full rounded-[10px] px-3 py-2 font-mono text-xs outline-none transition"
                  style={inputStyle}
                />
              </Field>
              <Field label="Model">
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="gpt-4o-mini"
                  spellCheck={false}
                  className="w-full rounded-[10px] px-3 py-2 font-mono text-xs outline-none transition"
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="API key">
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={provider.requiresApiKey ? 'Required for this provider' : 'Not needed'}
                autoComplete="off"
                className="w-full rounded-[10px] px-3 py-2 font-mono text-xs outline-none transition"
                style={inputStyle}
              />
            </Field>

            <p
              className="flex items-start gap-1.5 text-[11px] leading-relaxed"
              style={{ color: 'var(--text-subtle)' }}
            >
              <AlertIcon size={13} className="mt-px shrink-0" />
              The key is forwarded by this app&apos;s server route to the provider and is never
              stored.
            </p>
          </div>
        </section>
      )}

      {/* ── Conversation ───────────────────────────────────────── */}
      <main ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-8">
          {!hydrated ? null : isEmpty ? (
            <EmptyState onPick={(prompt) => void send(prompt)} />
          ) : (
            <ul className="flex flex-col gap-6">
              {messages.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* ── Status banners ─────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-2xl px-4 empty:hidden">
        {error && <Banner tone="danger" text={error} />}
        {notice && !error && <Banner tone="accent" text={notice} />}
      </div>

      {/* ── Composer ───────────────────────────────────────────── */}
      <footer className="px-4 pb-4 pt-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="mx-auto flex max-w-2xl items-end gap-2 rounded-[18px] p-2 transition"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={(event) => {
              setInput(event.target.value);
              autoGrow();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask anything…"
            aria-label="Message"
            className="max-h-42 flex-1 resize-none bg-transparent px-2.5 py-2 text-[0.9375rem] leading-relaxed outline-none placeholder:opacity-50"
            style={{ color: 'var(--text)', maxHeight: '10.5rem' }}
          />

          {streaming ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop generating"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
              style={{
                background: 'var(--surface-muted)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              <StopIcon size={15} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed"
              style={{
                background: canSend ? 'var(--accent)' : 'var(--surface-muted)',
                color: canSend ? '#fff' : 'var(--text-subtle)',
                boxShadow: canSend ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <SendIcon size={17} />
            </button>
          )}
        </form>

        <p
          className="mx-auto mt-2 max-w-2xl text-center text-[11px]"
          style={{ color: 'var(--text-subtle)' }}
        >
          Enter to send · Shift+Enter for a new line
        </p>
      </footer>
    </div>
  );
}

/* ── Primitives ─────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function HeaderButton({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
      style={{
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        background: active ? 'var(--accent-soft)' : 'transparent',
      }}
      onMouseEnter={(event) => {
        if (!active) event.currentTarget.style.background = 'var(--surface-muted)';
      }}
      onMouseLeave={(event) => {
        if (!active) event.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function Banner({ tone, text }: { tone: 'danger' | 'accent'; text: string }) {
  const danger = tone === 'danger';
  return (
    <p
      className="animate-rise mt-2 flex items-start gap-2 rounded-[10px] px-3 py-2 text-xs leading-relaxed"
      style={{
        background: danger ? 'var(--danger-soft)' : 'var(--accent-soft)',
        color: danger ? 'var(--danger)' : 'var(--accent)',
      }}
      role={danger ? 'alert' : 'status'}
    >
      {danger && <AlertIcon size={14} className="mt-px shrink-0" />}
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-[18px]"
        style={{
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
        }}
      >
        <SparkIcon size={26} />
      </div>

      <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em]">How can I help?</h2>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
        Ask a question, or start from one of these.
      </p>

      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onPick(item.prompt)}
            className="group flex flex-col items-start gap-1 rounded-[14px] px-4 py-3.5 text-left transition"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = 'var(--accent)';
              event.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = 'var(--border)';
              event.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <span className="text-[0.8125rem] font-semibold">{item.title}</span>
            <span className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
              {item.prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <li className={`animate-rise flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={isUser ? 'max-w-[85%]' : 'w-full'}>
        <div
          className="mb-1.5 text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--text-subtle)', textAlign: isUser ? 'right' : 'left' }}
        >
          {isUser ? 'You' : 'Assistant'}
        </div>
        <div
          className={isUser ? 'rounded-[16px] rounded-br-[6px] px-4 py-3' : 'px-0.5'}
          style={
            isUser
              ? { background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-sm)' }
              : undefined
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{message.content}</p>
          ) : message.content ? (
            <Markdown content={message.content} />
          ) : (
            <ThinkingDots />
          )}
        </div>
      </div>
    </li>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="dot-pulse inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--text-subtle)', animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  );
}
