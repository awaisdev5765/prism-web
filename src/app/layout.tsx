import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Prism Chat — streaming AI chat for the web',
  description:
    'Open-source streaming AI chat. Markdown rendering, works with Ollama, OpenAI, Groq and DeepSeek. Bring your own key or run models locally.',
  applicationName: 'Prism Chat',
  keywords: ['AI chat', 'Next.js', 'Ollama', 'OpenAI', 'streaming', 'markdown'],
  openGraph: {
    title: 'Prism Chat — streaming AI chat for the web',
    description:
      'Open-source streaming AI chat with markdown rendering. Ollama, OpenAI, Groq, DeepSeek.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfa' },
    { media: '(prefers-color-scheme: dark)', color: '#131312' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
