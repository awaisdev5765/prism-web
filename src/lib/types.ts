/** Chat roles supported by the OpenAI-compatible protocol. */
export type Role = 'system' | 'user' | 'assistant';

/** A single message in the conversation. */
export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

/** Request body accepted by the streaming API route. */
export interface ChatRequest {
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>;
  baseUrl: string;
  apiKey?: string;
  model: string;
}

/** Provider-reported token usage. */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
}
