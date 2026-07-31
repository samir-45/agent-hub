import { useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, Play, ChevronDown, ChevronUp, FileCode2, Download, WrapText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CodeBlockProps {
  language: string;
  code: string;
  fullMessageContent?: string;
  isPrimaryEntry?: boolean;
  onOpenPreview?: (code: string, lang: string) => void;
}

const LANG_EXTENSIONS: Record<string, string> = {
  js: 'js',
  javascript: 'js',
  ts: 'ts',
  typescript: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',
  html: 'html',
  css: 'css',
  python: 'py',
  py: 'py',
  json: 'json',
  bash: 'sh',
  sh: 'sh',
  sql: 'sql',
  go: 'go',
  rust: 'rs',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  ruby: 'rb',
  php: 'php',
  yaml: 'yaml',
  yml: 'yaml',
  markdown: 'md',
  md: 'md',
  xml: 'xml',
  swift: 'swift',
  kotlin: 'kt',
  dart: 'dart',
};

const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  jsx: 'React JSX',
  tsx: 'React TSX',
  html: 'HTML5',
  css: 'CSS3',
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
};

const PREVIEWABLE = new Set(['html', 'css', 'javascript', 'js', 'jsx', 'tsx']);

const COLLAPSE_THRESHOLD = 30;

const customTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#070908',
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

export function CodeBlock({ language, code, fullMessageContent, isPrimaryEntry, onOpenPreview }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);

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

  const handleDownload = useCallback(() => {
    const ext = LANG_EXTENSIONS[lang] || 'txt';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code_snippet.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [code, lang]);

  const displayCode = isLong && collapsed
    ? code.split('\n').slice(0, COLLAPSE_THRESHOLD).join('\n')
    : code;

  return (
    <div className="group relative rounded-xl border border-emerald-950/60 overflow-hidden my-3 shadow-md bg-[#070908] transition-all hover:border-emerald-800/40">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050706] border-b border-emerald-950/60 select-none">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[11px] font-mono font-semibold text-emerald-400/90 uppercase tracking-wider">
            {LANG_LABELS[lang] || lang || 'Code'}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Line Wrap Toggle */}
          <Button
            size="icon"
            variant="ghost"
            className={`h-6 w-6 transition-colors ${wrapLines ? 'text-emerald-400 bg-emerald-950/30' : 'text-muted-foreground/70 hover:text-foreground'}`}
            onClick={() => setWrapLines(w => !w)}
            title={wrapLines ? 'Disable line wrap' : 'Enable line wrap'}
          >
            <WrapText className="h-3 w-3" />
          </Button>

          {/* Download snippet */}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground/70 hover:text-emerald-400 transition-colors"
            onClick={handleDownload}
            title="Download code file"
          >
            <Download className="h-3 w-3" />
          </Button>

          {/* Live Preview Button — only show on primary entry point block */}
          {isPreviewable && onOpenPreview && isPrimaryEntry && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2.5 text-[11px] font-semibold border-emerald-700/80 text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 transition-colors gap-1.5 shadow-sm"
              onClick={() => onOpenPreview(fullMessageContent || code, lang)}
              title="Run Project Live Preview"
            >
              <Play className="h-3 w-3 fill-emerald-400 text-emerald-400" />
              Run Project Live
            </Button>
          )}

          {/* Copy Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground/70 hover:text-foreground transition-colors"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400 animate-in zoom-in-50 duration-200" />
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
          wrapLongLines={wrapLines}
          customStyle={{
            margin: 0,
            background: '#070908',
            wordBreak: wrapLines ? 'break-word' : 'normal',
            whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
          }}
        >
          {displayCode}
        </SyntaxHighlighter>

        {/* Collapse/expand gradient + button */}
        {isLong && (
          <>
            {collapsed && (
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#070908] to-transparent pointer-events-none" />
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-muted-foreground/80 hover:text-emerald-400 bg-[#050706] border-t border-emerald-950/60 transition-colors cursor-pointer"
            >
              {collapsed ? (
                <>
                  <ChevronDown className="h-3 w-3 text-emerald-400" />
                  Show all {lineCount} lines
                </>
              ) : (
                <>
                  <ChevronUp className="h-3 w-3 text-emerald-400" />
                  Collapse code
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
