# Prism Chat

An open-source, streaming AI chat app for the web. Responses render as live markdown with syntax-highlighted code blocks.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript) ![License](https://img.shields.io/badge/License-MIT-green)

Works with **Ollama** (free, local), **OpenAI**, **Groq**, **DeepSeek** and any OpenAI-compatible endpoint.

## Features

- **True streaming** — tokens render as they arrive via Server-Sent Events
- **Markdown + syntax highlighting** — headings, lists, tables, fenced code blocks
- **Provider switching in-app** — Ollama / OpenAI / Groq / DeepSeek / custom endpoint
- **Keys stay server-side** — the browser posts to an internal API route that forwards to the provider; nothing is stored
- **Typing indicator, auto-scroll, keyboard send** (Enter sends, Shift+Enter newlines)
- **Dark mode** via `prefers-color-scheme`

## Getting started

```bash
git clone https://github.com/awaisdev5765/prism-web.git
cd prism-web
npm install
npm run dev
```

Open http://localhost:3000 and start chatting. It defaults to **Ollama on `localhost:11434`**, so no API key is needed:

```bash
ollama pull llama3
ollama serve
```

### Using a cloud provider

Open **Settings** in the app, pick a provider, and paste an API key. The key is forwarded by the server route to the provider and is never persisted.

## How it works

```
Browser (src/components/chat.tsx)
   │  POST /api/chat  { messages, baseUrl, model, apiKey }
   ▼
Next.js route (src/app/api/chat/route.ts)
   │  forwards to  {baseUrl}/chat/completions  with stream: true
   ▼
Provider SSE  ──►  incremental parse  ──►  normalized { delta } frames
   ▼
Browser renders each delta into a markdown block as it arrives
```

- `src/lib/sse.ts` — chunk-safe incremental SSE parser (handles `\n`, `\r\n`, multi-line `data:`)
- `src/lib/providers.ts` — provider presets (base URL, default model, key requirements)
- `src/app/api/chat/route.ts` — streaming proxy that keeps credentials off the client

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |

## Deploying

Deploys to Vercel with no configuration:

```bash
npx vercel
```

Local Ollama only works when the server can reach it — for a hosted deployment choose a cloud provider in Settings.

Part of the [Prism](https://github.com/awaisdev5765) family of open-source packages.

## License

MIT
