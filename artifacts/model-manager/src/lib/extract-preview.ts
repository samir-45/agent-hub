/**
 * Script injected into every preview to prevent in-iframe navigation
 * that would blank the srcdoc iframe.
 */
const NAVIGATION_GUARD = `<script>
// Intercept link clicks — open in new tab instead of navigating iframe
document.addEventListener('click', function(e) {
  var a = e.target.closest ? e.target.closest('a') : null;
  if (a && a.href && !a.href.startsWith('javascript:')) {
    e.preventDefault();
    window.open(a.href, '_blank', 'noopener');
  }
}, true);
// Intercept form submissions
document.addEventListener('submit', function(e) {
  e.preventDefault();
}, true);
</script>`;

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
      // Inject navigation guard before </body>
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${NAVIGATION_GUARD}\n</body>`);
      } else {
        html += NAVIGATION_GUARD;
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
${NAVIGATION_GUARD}
</body>
</html>`;
}

function buildReactPreview(code: string): string {
  // Extract icon imports before stripping
  const iconImports: string[] = [];
  const lucideMatch = code.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
  if (lucideMatch && lucideMatch[1]) {
    iconImports.push(...lucideMatch[1].split(',').map(s => s.trim()).filter(Boolean));
  }

  // Clean code — strip module imports/exports & directives
  const cleaned = code
    .replace(/^\s*['"]use client['"];?\s*$/gm, '')
    .replace(/^\s*['"]use server['"];?\s*$/gm, '')
    .replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^export\s+default\s+function\s+([A-Za-z0-9_]+)/m, 'function $1')
    .replace(/^export\s+default\s+class\s+([A-Za-z0-9_]+)/m, 'class $1')
    .replace(/^export\s+default\s+/m, 'const __DefaultExport = ')
    .replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/^export\s+/gm, '');

  const iconDeclarations = Array.from(new Set([...iconImports, 'ChevronLeft', 'ChevronRight', 'ChevronUp', 'ChevronDown', 'Calendar', 'Clock', 'Check', 'X', 'Plus', 'Minus', 'Trash', 'Trash2', 'Search', 'RefreshCw', 'Eye', 'EyeOff', 'User', 'Settings', 'ArrowLeft', 'ExternalLink', 'Copy', 'Play', 'Loader2', 'Globe', 'Lock', 'Unlock', 'Star', 'Heart', 'Share', 'Download', 'Upload', 'Edit', 'Filter', 'Sun', 'Moon', 'Calculator']))
    .map(name => `const ${name} = typeof window.${name} !== 'undefined' ? window.${name} : createIcon('${name}');`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 1rem; font-family: system-ui, -apple-system, sans-serif; background-color: #0d1117; color: #c9d1d9; }
</style>
</head>
<body>
<div id="root"></div>
<div id="error-display" style="display:none; padding:1.25rem; background:#180b0b; color:#f87171; font-family:monospace; border:1px solid #7f1d1d; border-radius:0.75rem; margin:1rem; font-size:13px; line-height:1.6;"></div>

<script>
window.onerror = function(msg, url, lineNo, columnNo, error) {
  var errDiv = document.getElementById('error-display');
  if (errDiv) {
    errDiv.style.display = 'block';
    errDiv.innerHTML = '<strong style="color:#ef4444;">Preview Error:</strong> ' + (msg || error) + (lineNo ? ' (Line ' + lineNo + ')' : '');
  }
  return false;
};
</script>

<script type="text/babel">
// De-structure standard React hooks into local scope
const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useReducer,
  useContext,
  createContext,
  Fragment
} = React;

// SVG Icon Generator for Lucide Icon compatibility
function createIcon(name) {
  return function Icon(props) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={props && props.className ? props.className : "inline-block"}
        {...props}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  };
}

${iconDeclarations}

// Injected component code
${cleaned}

// Auto-detect root component
const __candidates = ['Calculator', 'Calendar', 'App', '__DefaultExport', 'Component', 'Main', 'Page', 'Dashboard'];
let __Root = null;

for (const __name of __candidates) {
  try {
    const __val = eval(__name);
    if (typeof __val === 'function') { __Root = __val; break; }
  } catch (_) {}
}

if (!__Root) {
  // Try evaluating the last defined function in scope
  const __funcs = Object.keys(window).filter(k => typeof window[k] === 'function' && k[0] === k[0].toUpperCase());
  if (__funcs.length > 0) {
    __Root = window[__funcs[__funcs.length - 1]];
  }
}

if (__Root) {
  try {
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(__Root));
  } catch (renderErr) {
    const errDiv = document.getElementById('error-display');
    if (errDiv) {
      errDiv.style.display = 'block';
      errDiv.innerHTML = '<strong style="color:#ef4444;">Render Error:</strong> ' + renderErr.message;
    }
  }
} else {
  document.getElementById('root').innerHTML =
    '<div style="padding:1.5rem;color:#f87171;background:#180b0b;border:1px solid #7f1d1d;border-radius:0.5rem;font-family:sans-serif;">' +
    '<h4 style="margin:0 0 0.5rem 0;font-weight:bold;">Component Preview Notice</h4>' +
    '<p style="margin:0;font-size:13px;">Could not automatically detect a default React component function. Ensure code contains an App, Calculator, or exported component.</p>' +
    '</div>';
}
</script>
${NAVIGATION_GUARD}
</body>
</html>`;
}
