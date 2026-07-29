/**
 * Extracts a self-contained, previewable HTML document from an AI message
 * that contains code blocks. Returns null if no previewable content is found.
 */
export function extractPreview(content: string): string | null {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: { lang: string; code: string }[] = [];

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      lang: (match[1] ?? '').toLowerCase().trim(),
      code: match[2] ?? '',
    });
  }

  if (blocks.length === 0) return null;

  const htmlBlock = blocks.find(b => b.lang === 'html');
  const cssBlock = blocks.find(b => b.lang === 'css');
  const jsBlock = blocks.find(b => ['javascript', 'js'].includes(b.lang));
  const jsxBlock = blocks.find(b => ['jsx', 'tsx'].includes(b.lang));

  if (htmlBlock) {
    const trimmed = htmlBlock.code.trim();
    // Full HTML document — inject any separate CSS/JS blocks if not already present
    if (trimmed.startsWith('<!') || trimmed.toLowerCase().startsWith('<html')) {
      let html = htmlBlock.code;
      if (cssBlock && !html.includes('<style')) {
        html = html.replace('</head>', `<style>\n${cssBlock.code}\n</style>\n</head>`);
      }
      if (jsBlock && !html.includes('<script')) {
        html = html.replace('</body>', `<script>\n${jsBlock.code}\n</script>\n</body>`);
      }
      return html;
    }
    // Partial HTML snippet — wrap in a full document
    return wrapHtml(htmlBlock.code, cssBlock?.code, jsBlock?.code);
  }

  if (jsxBlock) {
    return buildReactPreview(jsxBlock.code);
  }

  if (cssBlock || jsBlock) {
    return wrapHtml('', cssBlock?.code, jsBlock?.code);
  }

  return null;
}

function wrapHtml(body: string, css?: string, js?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  ${css ?? ''}
</style>
</head>
<body>
${body}
${js ? `<script>\n${js}\n</script>` : ''}
</body>
</html>`;
}

function buildReactPreview(code: string): string {
  // Strip ES module syntax — CDN builds use globals
  const cleaned = code
    .replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^export\s+default\s+/m, 'const __DefaultExport = ')
    .replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/^export\s+/gm, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 1rem; font-family: system-ui, -apple-system, sans-serif; }
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
${cleaned}

// Try common export names to find a renderable component
const __candidates = ['__DefaultExport', 'App', 'Component', 'Main', 'Page'];
let __Root = null;
for (const __name of __candidates) {
  try {
    const __val = eval(__name);
    if (typeof __val === 'function') { __Root = __val; break; }
  } catch (_) {}
}
if (__Root) {
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(__Root));
} else {
  document.getElementById('root').innerHTML =
    '<p style="color:red;padding:1rem">Could not find a React component to render.</p>';
}
</script>
</body>
</html>`;
}
