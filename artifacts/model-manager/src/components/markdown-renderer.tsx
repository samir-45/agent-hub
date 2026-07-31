import { type ComponentPropsWithoutRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/components/code-block';
import { ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
  onOpenPreview?: (code: string, lang: string) => void;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, streaming, onOpenPreview }: MarkdownRendererProps) {
  // Parse code blocks in content to determine the primary entry point block
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: { index: number; lang: string; code: string }[] = [];
  let match;
  let bIdx = 0;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      index: bIdx++,
      lang: (match[1] ?? '').toLowerCase().trim(),
      code: match[2] ?? '',
    });
  }

  let primaryIndex = -1;
  const previewable = blocks.filter(b => ['html', 'jsx', 'tsx', 'js', 'javascript'].includes(b.lang));

  if (previewable.length > 0) {
    const htmlEntry = previewable.find(b => b.lang === 'html');
    if (htmlEntry) {
      primaryIndex = htmlEntry.index;
    } else {
      const pageEntry = previewable.find(b =>
        /export\s+default\s+function\s+(Home|Page|App|Calculator|Dashboard|Main)/i.test(b.code) ||
        b.code.includes('app/page') ||
        b.code.includes('pages/index')
      );
      if (pageEntry) {
        primaryIndex = pageEntry.index;
      } else {
        const lastJsx = [...previewable].reverse().find(b => ['jsx', 'tsx'].includes(b.lang));
        primaryIndex = lastJsx ? lastJsx.index : previewable[previewable.length - 1].index;
      }
    }
  }

  let renderBlockCounter = 0;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none w-full min-w-0 overflow-hidden prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-0 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks → intelligent CodeBlock component
          code({ className, children, ...props }: ComponentPropsWithoutRef<'code'> & { node?: unknown }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeStr = String(children).replace(/\n$/, '');

            // Inline code
            if (!match) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-muted/80 text-[12px] font-mono font-medium text-foreground border border-border/40"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const currentIdx = renderBlockCounter++;
            const isPrimary = currentIdx === primaryIndex;

            // Fenced code block
            return (
              <CodeBlock
                language={match[1]}
                code={codeStr}
                fullMessageContent={content}
                isPrimaryEntry={isPrimary}
                onOpenPreview={onOpenPreview}
              />
            );
          },

          // Pre → strip default styling so CodeBlock controls it
          pre({ children }) {
            return <>{children}</>;
          },

          // Tables → polished styling
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-muted/50 border-b border-border">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="px-3 py-2 border-t border-border/30">{children}</td>;
          },

          // Links → external icon
          a({ href, children }) {
            const isExternal = href?.startsWith('http');
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-colors inline-flex items-center gap-0.5"
              >
                {children}
                {isExternal && <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />}
              </a>
            );
          },

          // Blockquotes → accent border
          blockquote({ children }) {
            return (
              <blockquote className="border-l-3 border-primary/40 pl-4 my-3 text-muted-foreground italic">
                {children}
              </blockquote>
            );
          },

          // Horizontal rules
          hr() {
            return <hr className="my-4 border-border/50" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-0.5 h-3.5 bg-current animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
});
