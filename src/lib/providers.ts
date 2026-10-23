/**
 * Provider presets for OpenAI-compatible endpoints.
 *
 * Every supported backend speaks the same /chat/completions protocol,
 * so one streaming implementation covers all of them.
 */
export type ProviderId = 'ollama' | 'openai' | 'groq' | 'deepseek' | 'custom';

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
  hint: string;
}

export const PROVIDERS: Record<ProviderId, ProviderPreset> = {
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    requiresApiKey: false,
    hint: 'Free and private — runs on your machine.',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    hint: 'Requires an OpenAI API key.',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresApiKey: true,
    hint: 'Very fast inference, generous free tier.',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    requiresApiKey: true,
    hint: 'Low-cost reasoning and chat models.',
  },
  custom: {
    id: 'custom',
    label: 'Custom endpoint',
    baseUrl: '',
    defaultModel: '',
    requiresApiKey: true,
    hint: 'Any server implementing the OpenAI chat API.',
  },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

/** Looks up a preset by id, falling back to Ollama. */
export function resolveProvider(id: string | null | undefined): ProviderPreset {
  if (!id) return PROVIDERS.ollama;
  return PROVIDERS[id as ProviderId] ?? PROVIDERS.ollama;
}
