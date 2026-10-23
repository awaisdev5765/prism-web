'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Renders assistant output as markdown with syntax-highlighted code blocks.
 */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? '');
            const text = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || text.includes('\n');

            if (!isBlock) {
              return (
                <code
                  className="rounded-[5px] px-1.5 py-0.5 font-mono text-[0.85em]"
                  style={{ background: "var(--surface-muted)", color: "var(--text)" }}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <SyntaxHighlighter
                language={match?.[1] ?? 'text'}
                style={oneDark}
                customStyle={{
                  margin: '0.875rem 0',
                  borderRadius: '10px',
                  fontSize: '0.8125rem',
                  padding: '0.9rem 1rem',
                  background: '#1c1c1b',
                  border: '1px solid var(--border)',
                }}
              >
                {text}
              </SyntaxHighlighter>
            );
          },
          p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          h1: ({ children }) => <h1 className="mb-2.5 mt-5 text-[1.0625rem] font-semibold tracking-[-0.01em] first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-5 text-base font-semibold tracking-[-0.01em] first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1.5 mt-4 text-[0.9375rem] font-semibold first:mt-0">{children}</h3>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 pl-3.5 italic" style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-2.5 py-1.5 text-left font-semibold" style={{ border: "1px solid var(--border)", background: "var(--surface-muted)" }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2.5 py-1.5" style={{ border: "1px solid var(--border)" }}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
