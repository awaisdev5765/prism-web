import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prism Chat — streaming AI chat for the web',
  description:
    'An open-source AI chat app. Streaming responses rendered as markdown, works with Ollama, OpenAI, Groq and DeepSeek.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
