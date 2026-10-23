<div align="center">

# Prism Chat

**Streaming AI chat for the web — open source, bring your own model.**

[**▶ Try it live**](https://prism-web-blue.vercel.app) · [Report an issue](https://github.com/awaisdev5765/prism-web/issues)

![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-3fa46a)

</div>

---

A complete AI chat app in ~700 lines. Tokens stream in and render as live
markdown with syntax-highlighted code. Runs against **Ollama locally with no
API key**, or any hosted OpenAI-compatible provider.

## Highlights

| | |
|---|---|
| **Real streaming** | Server-Sent Events; text appears token by token, not all at once |
| **Markdown + code highlighting** | Headings, lists, tables, blockquotes, fenced code blocks |
| **Five providers, switchable in-app** | Ollama · OpenAI · Groq · DeepSeek · any custom endpoint |
| **Keys never reach the browser bundle** | The client posts to an internal route that forwards server-side; nothing is persisted |
| **Conversations survive refresh** | Stored in `localStorage` — no account, nothing leaves your machine |
| **Export a thread** | One click copies the whole conversation as markdown |
| **Stop mid-generation** | Abort a running response without losing what already streamed |
| **Smart auto-scroll** | Follows the stream, but stops if you scroll up to re-read |
| **Dark mode** | Follows `prefers-color-scheme`, no toggle needed |

## Try it

```bash
git clone https://github.com/awaisdev5765/prism-web.git
cd prism-web
npm install
npm run dev
```

Open <http://localhost:3000>. It defaults to **Ollama on `localhost:11434`**:

```bash
ollama pull llama3
ollama serve
```

Using a cloud provider instead? Open **Settings** in the app, pick a provider, paste a key.

## Architecture

```
Browser  (src/components/chat.tsx)
   │  POST /api/chat   { messages, baseUrl, model, apiKey }
   ▼
Next.js route  (src/app/api/chat/route.ts)
   │  forwards to {baseUrl}/chat/completions   with stream: true
   ▼
Provider SSE
   │  incremental frame parsing
   ▼
Normalised `{ delta }` frames  ──►  rendered into markdown as they arrive
```

| File | Responsibility |
|---|---|
| `src/lib/sse.ts` | Chunk-safe incremental SSE parser (`\n`, `\r\n`, multi-line `data:`, comments) |
| `src/lib/providers.ts` | Provider presets — base URL, default model, key requirements |
| `src/lib/storage.ts` | Conversation persistence and markdown transcript export |
| `src/app/api/chat/route.ts` | Streaming proxy; keeps credentials off the client |
| `src/components/chat.tsx` | Conversation UI, composer, settings panel |
| `src/components/markdown.tsx` | Markdown rendering with syntax highlighting |
| `src/app/globals.css` | Design tokens (colour, radius, shadow, motion) |

The API route is provider-agnostic: anything that speaks the OpenAI
`/chat/completions` protocol works without code changes.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | SSE parser tests (`node:test`) |

## Deploying

Deploys to Vercel with no configuration:

```bash
npx vercel --prod
```

> **Note** — a hosted deployment cannot reach `localhost`, so pick a cloud
> provider in Settings. Running the app locally is the only way to use Ollama.

## Roadmap

- [ ] Multiple saved conversations with a sidebar
- [ ] Model picker populated from the provider's `/models` endpoint
- [ ] Editable system prompt
- [ ] Regenerate the last response

## Contributing

Issues and pull requests are welcome.

```bash
npm install
npm test        # parser tests
npm run lint    # ESLint
npm run build   # type-check + production build
```

Please run all three before opening a PR.

## License

MIT
