/**
 * Conversation persistence in localStorage.
 *
 * Chat apps feel broken when a refresh wipes the thread, so conversations
 * are stored locally — no account, no server, nothing leaves the machine.
 */
import type { ChatMessage } from './types';

const STORAGE_KEY = 'prism-web:conversation:v1';

export interface StoredConversation {
  messages: ChatMessage[];
  updatedAt: number;
}

/** Reads the stored conversation, returning null when absent or invalid. */
export function loadConversation(): StoredConversation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConversation;
    if (!Array.isArray(parsed?.messages)) return null;

    const messages = parsed.messages.filter(
      (message): message is ChatMessage =>
        typeof message?.id === 'string' &&
        typeof message?.content === 'string' &&
        (message?.role === 'user' || message?.role === 'assistant' || message?.role === 'system'),
    );
    if (messages.length === 0) return null;
    return { messages, updatedAt: parsed.updatedAt ?? Date.now() };
  } catch {
    return null;
  }
}

/** Persists the conversation, ignoring quota/private-mode failures. */
export function saveConversation(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (messages.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload: StoredConversation = { messages, updatedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable (private mode, quota) — chat still works.
  }
}

/** Clears the stored conversation. */
export function clearConversation(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Renders a conversation as a markdown transcript.
 *
 * Useful for copying a thread out of the app or saving it to a file.
 */
export function conversationToMarkdown(messages: ChatMessage[]): string {
  const header = `# Prism Chat transcript\n\n_Exported ${new Date().toISOString()}_\n`;
  const body = messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => {
      const label = message.role === 'user' ? 'You' : 'Assistant';
      return `## ${label}\n\n${message.content}\n`;
    })
    .join('\n');
  return `${header}\n${body}`;
}
