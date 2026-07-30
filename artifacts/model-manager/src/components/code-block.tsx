import { useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, Play, ChevronDown, ChevronUp, FileCode2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CodeBlockProps {
  language: string;
  code: string;
  onOpenPreview?: (code: string, lang: string) => void;
}

const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  html: 'HTML',
  css: 'CSS',
  python: 'Python',
  py: 'Python',
  json: 'JSON',
  bash: 'Bash',
  sh: 'Shell',
  sql: 'SQL',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  ruby: 'Ruby',
  php: 'PHP',
  yaml: 'YAML',
  yml: 'YAML',
  markdown: 'Markdown',
  md: 'Markdown',
  xml: 'XML',
  swift: 'Swift',
  kotlin: 'Kotlin',
  dart: 'Dart',
  scss: 'SCSS',
  sass: 'SASS',
  less: 'LESS',
};

const PREVIEWABLE = new Set(['html', 'css', 'javascript', 'js', 'jsx', 'tsx']);

const COLLAPSE_THRESHOLD = 25;

// Custom theme based on oneDark but with tweaks for our UI
const customTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#090c0a',
    margin: 0,
    padding: '1rem',
    fontSize: '13px',
    lineHeight: '1.6',
    borderRadius: 0,
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontSize: '13px',
    lineHeight: '1.6',
  },
};

export function CodeBlock({ language, code, onOpenPreview }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const lang = language.toLowerCase().trim();
  const lineCount = code.split('\n').length;
  const isLong = lineCount > COLLAPSE_THRESHOLD;
  const isPreviewable = PREVIEWABLE.has(lang);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [code]);

  const displayCode = isLong && collapsed
    ? code.split('\n').slice(0, COLLAPSE_THRESHOLD).join('\n')
    : code;

  return (
    <div className="group relative rounded-xl border border-emerald-950/60 overflow-hidden my-3 shadow-md bg-[#090c0a]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050706] border-b border-emerald-950/60">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-3.5 w-3.5 text-emerald-400/80" />
          <span className="text-[11px] font-mono font-medium text-emerald-400/90 uppercase tracking-wider">
            {LANG_LABELS[lang] || lang || 'Code'}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isPreviewable && onOpenPreview && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground/70 hover:text-emerald-400 transition-colors"
              onClick={() => onOpenPreview(code, lang)}
              title="Open in Preview"
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground/70 hover:text-foreground transition-colors"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Code content */}
      <div className="relative overflow-x-auto">
        <SyntaxHighlighter
          language={lang || 'text'}
          style={customTheme}
          showLineNumbers
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: '#4a4a5a',
            fontSize: '11px',
            userSelect: 'none',
          }}
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            background: '#090c0a',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {displayCode}
        </SyntaxHighlighter>

        {/* Collapse/expand gradient + button */}
        {isLong && (
          <>
            {collapsed && (
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#090c0a] to-transparent pointer-events-none" />
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-muted-foreground/80 hover:text-emerald-400 bg-[#050706] border-t border-emerald-950/60 transition-colors cursor-pointer"
            >
              {collapsed ? (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show all {lineCount} lines
                </>
              ) : (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Collapse
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
