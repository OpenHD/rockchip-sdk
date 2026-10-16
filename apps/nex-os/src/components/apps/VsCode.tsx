import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import NexMonacoEditor, { type NexMonacoHandle, langFromPath } from './nexcode/NexMonacoEditor';
import GitScmPanel from './nexcode/GitScmPanel';
import {
  buildFileTree,
  languageForPath,
  loadWorkspace,
  saveWorkspace,
  searchWorkspace,
  type SearchHit,
} from './nexcode/workspace';
import { useNexFs } from '../../context/FileSystemContext';
import { joinPath } from '../../runtime/fs/paths';

/** Project root on the OS VFS — shared with Terminal git/npm. */
const VFS_PROJECT_ROOT = 'C:\\Documentos\\Proyectos\\nex-app';

/* =====================================================================
   NEX CODE — editor tipo VS Code con Monaco + IA (Groq) + temas
   ===================================================================== */

/* ---------- TEMAS (paletas reales recreadas) ---------- */
const BUILTIN_THEMES: Record<string, Record<string, string>> = {
  'NEX Dark+ (default)': {
    bg: '#1e1e1e', bgAlt: '#181818', sidebar: '#252526', activitybar: '#333333', titlebar: '#3c3c3c',
    border: '#2b2b2b', text: '#cccccc', textDim: '#858585', accent: '#0e639c', accentHover: '#1177bb',
    accentText: '#ffffff', selection: 'rgba(38,79,120,0.6)', lineHL: 'rgba(255,255,255,0.04)',
    statusbar: '#007acc', tabActiveBorder: '#007acc', scrollbar: 'rgba(121,121,121,0.4)',
    kw: '#569cd6', str: '#ce9178', com: '#6a9955', fn: '#dcdcaa', num: '#b5cea8',
    type: '#4ec9b0', prop: '#9cdcfe', tag: '#569cd6', bracket: '#ffd700',
  },
  'Dracula Official': {
    bg: '#282a36', bgAlt: '#21222c', sidebar: '#21222c', activitybar: '#1e1f29', titlebar: '#21222c',
    border: '#191a21', text: '#f8f8f2', textDim: '#6272a4', accent: '#bd93f9', accentHover: '#caa9fa',
    accentText: '#282a36', selection: 'rgba(99,102,170,0.4)', lineHL: 'rgba(255,255,255,0.04)',
    statusbar: '#191a21', tabActiveBorder: '#bd93f9', scrollbar: 'rgba(98,114,164,0.4)',
    kw: '#ff79c6', str: '#f1fa8c', com: '#6272a4', fn: '#50fa7b', num: '#bd93f9',
    type: '#8be9fd', prop: '#66d9ef', tag: '#ff79c6', bracket: '#f1fa8c',
  },
  'One Dark Pro': {
    bg: '#282c34', bgAlt: '#21252b', sidebar: '#21252b', activitybar: '#181a1f', titlebar: '#282c34',
    border: '#181a1f', text: '#abb2bf', textDim: '#5c6370', accent: '#528bff', accentHover: '#6e9fff',
    accentText: '#ffffff', selection: 'rgba(82,139,255,0.2)', lineHL: 'rgba(255,255,255,0.03)',
    statusbar: '#23272e', tabActiveBorder: '#528bff', scrollbar: 'rgba(92,99,112,0.4)',
    kw: '#c678dd', str: '#98c379', com: '#5c6370', fn: '#61afef', num: '#d19a66',
    type: '#e5c07b', prop: '#e06c75', tag: '#e06c75', bracket: '#abb2bf',
  },
  'Monokai Pro': {
    bg: '#272822', bgAlt: '#1e1f1c', sidebar: '#1e1f1c', activitybar: '#171814', titlebar: '#272822',
    border: '#171814', text: '#f8f8f2', textDim: '#75715e', accent: '#fd971f', accentHover: '#ffae47',
    accentText: '#272822', selection: 'rgba(253,151,31,0.2)', lineHL: 'rgba(255,255,255,0.03)',
    statusbar: '#171814', tabActiveBorder: '#fd971f', scrollbar: 'rgba(117,113,94,0.4)',
    kw: '#f92672', str: '#e6db74', com: '#75715e', fn: '#a6e22e', num: '#ae81ff',
    type: '#66d9ef', prop: '#a6e22e', tag: '#f92672', bracket: '#f8f8f2',
  },
  'Nord': {
    bg: '#2e3440', bgAlt: '#272c36', sidebar: '#272c36', activitybar: '#1f242d', titlebar: '#2e3440',
    border: '#1f242d', text: '#d8dee9', textDim: '#616e88', accent: '#88c0d0', accentHover: '#9bcedc',
    accentText: '#2e3440', selection: 'rgba(136,192,208,0.18)', lineHL: 'rgba(255,255,255,0.03)',
    statusbar: '#3b4252', tabActiveBorder: '#88c0d0', scrollbar: 'rgba(97,110,136,0.4)',
    kw: '#81a1c1', str: '#a3be8c', com: '#616e88', fn: '#88c0d0', num: '#b48ead',
    type: '#8fbcbb', prop: '#d8dee9', tag: '#81a1c1', bracket: '#ebcb8b',
  },
  'Tokyo Night': {
    bg: '#1a1b26', bgAlt: '#16161e', sidebar: '#16161e', activitybar: '#101014', titlebar: '#1a1b26',
    border: '#101014', text: '#a9b1d6', textDim: '#565f89', accent: '#7aa2f7', accentHover: '#90b5ff',
    accentText: '#1a1b26', selection: 'rgba(122,162,247,0.18)', lineHL: 'rgba(255,255,255,0.03)',
    statusbar: '#16161e', tabActiveBorder: '#7aa2f7', scrollbar: 'rgba(86,95,137,0.4)',
    kw: '#bb9af7', str: '#9ece6a', com: '#565f89', fn: '#7aa2f7', num: '#ff9e64',
    type: '#2ac3de', prop: '#c0caf5', tag: '#f7768e', bracket: '#e0af68',
  },
  'GitHub Dark Default': {
    bg: '#0d1117', bgAlt: '#010409', sidebar: '#010409', activitybar: '#010409', titlebar: '#161b22',
    border: '#21262d', text: '#c9d1d9', textDim: '#6e7681', accent: '#1f6feb', accentHover: '#388bfd',
    accentText: '#ffffff', selection: 'rgba(56,139,253,0.2)', lineHL: 'rgba(255,255,255,0.03)',
    statusbar: '#0d1117', tabActiveBorder: '#1f6feb', scrollbar: 'rgba(110,118,129,0.4)',
    kw: '#ff7b72', str: '#a5d6ff', com: '#8b949e', fn: '#d2a8ff', num: '#79c0ff',
    type: '#ffa657', prop: '#79c0ff', tag: '#7ee787', bracket: '#c9d1d9',
  },
  'Solarized Light': {
    bg: '#fdf6e3', bgAlt: '#eee8d5', sidebar: '#eee8d5', activitybar: '#e4dcc4', titlebar: '#eee8d5',
    border: '#d8d0b8', text: '#586e75', textDim: '#93a1a1', accent: '#268bd2', accentHover: '#3a9bdb',
    accentText: '#ffffff', selection: 'rgba(38,139,210,0.15)', lineHL: 'rgba(0,0,0,0.03)',
    statusbar: '#268bd2', tabActiveBorder: '#268bd2', scrollbar: 'rgba(101,123,131,0.3)',
    kw: '#859900', str: '#2aa198', com: '#93a1a1', fn: '#b58900', num: '#cb4b16',
    type: '#268bd2', prop: '#cb4b16', tag: '#268bd2', bracket: '#586e75',
  },
};

function hexToRgba(hex: string, a: number): string {
  if (!hex || hex[0] !== '#') return `rgba(0,122,204,${a})`;
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function parseVscodeThemeJson(raw: any): any {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const c: Record<string, string> = data.colors || {};
    const tcs: any[] = data.tokenColors || [];
    const find = (...scopes: string[]) => {
      for (const t of tcs) {
        const sc: string[] = Array.isArray(t.scope) ? t.scope : [t.scope];
        if (sc.some((s: string) => s && scopes.some(target => s.includes(target))) && t.settings?.foreground) return t.settings.foreground;
      }
      return null;
    };
    const bg = c['editor.background'] || '#1e1e1e';
    const accent = c['focusBorder'] || c['activityBarBadge.background'] || '#007acc';
    return {
      bg, bgAlt: c['sideBar.background'] || bg, sidebar: c['sideBar.background'] || bg,
      activitybar: c['activityBar.background'] || bg, titlebar: c['titleBar.activeBackground'] || bg,
      border: c['sideBar.border'] || c['panel.border'] || '#2b2b2b',
      text: c['editor.foreground'] || '#cccccc', textDim: c['editorLineNumber.foreground'] || '#858585',
      accent, accentHover: accent, accentText: '#ffffff',
      selection: hexToRgba((c['editor.selectionBackground'] || accent).slice(0, 7), 0.3),
      lineHL: 'rgba(255,255,255,0.04)', statusbar: c['statusBar.background'] || accent,
      tabActiveBorder: accent, scrollbar: 'rgba(121,121,121,0.4)',
      kw: find('keyword', 'storage') || '#569cd6', str: find('string') || '#ce9178',
      com: find('comment') || '#6a9955', fn: find('entity.name.function', 'support.function') || '#dcdcaa',
      num: find('constant.numeric') || '#b5cea8', type: find('entity.name.type', 'support.class') || '#4ec9b0',
      prop: find('variable.parameter', 'variable') || '#9cdcfe', tag: find('entity.name.tag') || '#569cd6',
      bracket: c['editorBracketHighlight.foreground1'] || '#ffd700',
    };
  } catch { return null; }
}

/* ---------- ARCHIVOS INICIALES ---------- */
const INITIAL_FILES = {
  'src/App.tsx': {
    language: 'tsx', content: `import React, { useState } from 'react';
import './index.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>Hello, NEX CODE</h1>
      <p>Editor profesional con autocompletado e IA integrada (Groq).</p>
      <button onClick={() => setCount((c) => c + 1)}>
        Count: {count}
      </button>
    </div>
  );
}

export default App;
` },
  'src/index.tsx': {
    language: 'tsx', content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
` },
  'src/index.css': {
    language: 'css', content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', sans-serif;
  background: #ffffff;
  color: #1e1e1e;
}

.app {
  max-width: 760px;
  margin: 0 auto;
  padding: 64px 24px;
  text-align: center;
}

h1 {
  color: #0078d4;
  font-size: 28px;
}

button {
  padding: 10px 24px;
  background: #0078d4;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 24px;
  font-size: 14px;
}

button:hover {
  background: #005a9e;
}
` },
  'package.json': {
    language: 'json', content: `{
  "name": "nex-code-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2"
  }
}
` },
  'tsconfig.json': {
    language: 'json', content: `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
` },
  'README.md': {
    language: 'markdown', content: `# NEX CODE

Editor moderno con **Monaco** (motor de VS Code), IA (Groq) y temas.

## Atajos
- **Ctrl+Shift+P** — Paleta de comandos
- **Ctrl+P** — Abrir archivo rápido
- **Ctrl+K** — Editar selección con NEX AI
- **Ctrl+F** — Buscar en el archivo
- **Ctrl+\`** — Terminal
- **Tab** — Aceptar sugerencia inline de NEX AI
` },
};

const LANG_META: Record<string, { c: string; label: string }> = {
  tsx: { c: '#3178c6', label: 'TSX' }, ts: { c: '#3178c6', label: 'TS' }, typescript: { c: '#3178c6', label: 'TypeScript' },
  json: { c: '#cbcb41', label: 'JSON' }, css: { c: '#264de4', label: 'CSS' }, markdown: { c: '#519aba', label: 'Markdown' }, md: { c: '#519aba', label: 'Markdown' },
};

function FileIcon({ ext, size = 14 }: { ext: string; size?: number }) {
  const m = LANG_META[ext];
  if (ext === 'tsx' || ext === 'jsx') return (
    <svg viewBox="-11.5 -10.23 23 20.46" width={size} height={size}><circle r="2.05" fill="#61dafb" /><g stroke="#61dafb" strokeWidth="1" fill="none"><ellipse rx="11" ry="4.2" /><ellipse rx="11" ry="4.2" transform="rotate(60)" /><ellipse rx="11" ry="4.2" transform="rotate(120)" /></g></svg>
  );
  if (ext === 'ts' || ext === 'typescript') return (
    <svg viewBox="0 0 256 256" width={size} height={size}><rect width="256" height="256" rx="28" fill="#3178C6" /><path d="M114.28 152.09l-34.93-1.07-1.1-28.79 73.1 1.05-.75 29.58-20.76 1.06-1.55 64.91-13.88.19 1.12-65.7zM189.9 220.35c-43.07 1.4-56.98-20.58-57.92-41.67l31.13-2c1.78 12.33 6.64 20.25 24.16 19.33 13.91-.73 20.08-8.22 19.8-15.53-.45-12.03-12.19-14.73-30.84-21.75-25.61-9.64-39.73-24.36-39.06-46.06.91-23.75 19.87-41.49 48.06-42.3 35.8-1.03 52.82 17.5 54.34 38.08l-30.33 4.25c-1.35-10.46-7.85-18.06-22.18-17.55-12.28.44-18.52 6.83-18.52 14.53.37 10.36 10.02 12.02 26.68 18.26 25.13 9.42 43.68 20.55 42.66 47.16-1.22 31.74-23.86 46.04-48.25 46.8" fill="#fff" /></svg>
  );
  if (ext === 'json') return <span style={{ color: '#cbcb41', fontSize: size - 3, fontWeight: 700, fontFamily: 'monospace' }}>{'{ }'}</span>;
  if (ext === 'css') return <span style={{ color: '#519aba', fontSize: size - 2, fontWeight: 700 }}>#</span>;
  if (ext === 'md' || ext === 'markdown') return <span style={{ color: '#519aba', fontSize: size - 2, fontWeight: 700 }}>M↓</span>;
  return <span style={{ color: m?.c || '#cccccc' }}>●</span>;
}

function isErrorLine(line: string): boolean {
  return /error/i.test(line) || /no se reconoce/i.test(line) || /no se encuentra/i.test(line) || line.includes('❌');
}

/* ---------- Fuzzy matching para la paleta de comandos / quick open ----------
   Coincidencia de subsecuencia (igual que VS Code): las letras del query
   tienen que aparecer en orden dentro del texto, no necesariamente juntas.
   Devuelve un score (más bajo = mejor) y los índices que coincidieron, para
   poder resaltarlos en negrita en el render. */
function fuzzyMatch(query: string, text: string): { score: number; indices: number[] } | null {
  if (!query) return { score: 0, indices: [] };
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const indices: number[] = [];
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { indices.push(ti); qi++; }
  }
  if (qi < q.length) return null;
  // Premia coincidencias consecutivas y que empiecen temprano en el texto.
  const span = indices[indices.length - 1] - indices[0];
  let gaps = 0;
  for (let k = 1; k < indices.length; k++) if (indices[k] - indices[k - 1] > 1) gaps++;
  const score = span + gaps * 2 + indices[0] * 0.5;
  return { score, indices };
}

function HighlightedLabel({ text, indices, accent }: { text: string; indices: number[]; accent: string }) {
  if (!indices || indices.length === 0) return <>{text}</>;
  const set = new Set(indices);
  return (
    <>
      {text.split('').map((ch, i) => set.has(i)
        ? <b key={i} style={{ color: accent, fontWeight: 700 }}>{ch}</b>
        : <React.Fragment key={i}>{ch}</React.Fragment>)}
    </>
  );
}

/* ---------- Cliente del backend NEX AI (Vercel Serverless Functions en /api) ----------
   Antes esta función llamaba directo a https://api.groq.com desde el navegador,
   lo que exponía la API key en el cliente. Ahora habla con funciones serverless
   propias (api/chat.js, api/health.js), que son las únicas que conocen la key
   (vía variable de entorno en Vercel). Al desplegar frontend y /api juntos en el
   mismo proyecto de Vercel, las rutas son relativas al mismo dominio, por eso
   el default es '' (string vacío). Para apuntar a otra URL (otro deploy, otro
   dominio) se puede sobreescribir con VITE_API_BASE. */
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '';

async function callNexAI(messages: any[], { model = 'llama-3.3-70b-versatile', maxTokens = 700 }: { model?: string; maxTokens?: number } = {}) {
  const res = await fetch(`${API_BASE}/api/groq/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, maxTokens }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status} del backend`);
  return data.content ?? '';
}

export default function NexCode() {
  const nexFs = useNexFs();
  const [scmRefresh, setScmRefresh] = useState(0);

  const initialWs = useMemo(
    () =>
      loadWorkspace({
        files: INITIAL_FILES,
        openFiles: ['src/App.tsx', 'src/index.tsx', 'src/index.css', 'package.json'],
        activeFile: 'src/App.tsx',
        themeName: 'NEX Dark+ (default)',
        dirty: {},
      }),
    [],
  );

  const [files, setFiles] = useState<Record<string, { language: string; content: string }>>(initialWs.files);
  const [dirty, setDirty] = useState<Record<string, boolean>>(initialWs.dirty || {});
  const [activeFile, setActiveFile] = useState(initialWs.activeFile);
  const [openFiles, setOpenFiles] = useState(initialWs.openFiles);
  const [activityView, setActivityView] = useState('explorer');
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalTab, setTerminalTab] = useState('terminal');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [maximized] = useState(true);
  const [explorerOpenFolders, setExplorerOpenFolders] = useState<Record<string, boolean>>({ src: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [revealTarget, setRevealTarget] = useState<{
    line: number; column: number; endLine?: number; endColumn?: number; nonce: number;
  } | null>(null);

  const [terminalLines, setTerminalLines] = useState<string[]>([
    'Microsoft Windows [Version 10.0.22631.4317]',
    '(c) Microsoft Corporation. Todos los derechos reservados.', '',
    'NEX CODE · Monaco Editor listo. Ctrl+Shift+P = comandos · Ctrl+P = archivos · Ctrl+K = editar con IA.',
  ]);
  const [termInput, setTermInput] = useState('');
  const termRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<NexMonacoHandle>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Temas
  const [themeName, setThemeName] = useState(initialWs.themeName);
  const [customThemes, setCustomThemes] = useState<Record<string, any>>({});
  const allThemes: Record<string, any> = { ...BUILTIN_THEMES, ...customThemes };
  const p = allThemes[themeName] || BUILTIN_THEMES['NEX Dark+ (default)'];
  const statusbarIsLight = (() => {
    const hex = (p.statusbar || '#007acc').replace('#', '');
    if (hex.length < 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160;
  })();
  const statusFg = statusbarIsLight ? '#1e1e1e' : '#ffffff';
  const statusItemClass = statusbarIsLight ? 'nex-statusbar-item nex-statusbar-item-dark' : 'nex-statusbar-item';
  const themeNames = useMemo(() => Object.keys(allThemes), [allThemes]);

  const cycleTheme = (dir: 1 | -1) => {
    const idx = themeNames.indexOf(themeName);
    const next = (idx + dir + themeNames.length) % themeNames.length;
    setThemeName(themeNames[next]);
  };

  // Command palette / theme picker / quick open
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState('commands'); // commands | themes | files | themeImport | groqStatus | groqModel
  const [paletteQuery, setPaletteQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const [themeJsonInput, setThemeJsonInput] = useState('');
  const [themeImportError, setThemeImportError] = useState('');
  const [themeImportMode, setThemeImportMode] = useState<'json' | 'ai'>('json');
  const [themeGenPrompt, setThemeGenPrompt] = useState('');
  const [themeGenLoading, setThemeGenLoading] = useState(false);
  const [themeGenError, setThemeGenError] = useState('');
  const [themeGenPreviewName, setThemeGenPreviewName] = useState<string | null>(null);
  const themeBeforeGenRef = useRef<string>('NEX Dark+ (default)');
  const [settingsTabOpen, setSettingsTabOpen] = useState(false);
  const paletteListRef = useRef<HTMLDivElement>(null);

  // Edición inline con IA (estilo Cmd+K): seleccionás código, escribís una
  // instrucción y NEX AI reescribe ese fragmento ahí mismo, con preview
  // antes de aplicar.
  const [inlineEdit, setInlineEdit] = useState<{
    open: boolean; instruction: string; loading: boolean; error: string;
    original: string; result: string; selStart: number; selEnd: number;
  }>({ open: false, instruction: '', loading: false, error: '', original: '', result: '', selStart: 0, selEnd: 0 });

  const openPalette = (mode: string, query = '') => {
    setPaletteMode(mode); setPaletteQuery(query); setSelectedIndex(0); setPaletteOpen(true);
  };

  // Backend NEX AI (Vercel Serverless Functions en /api) — ya no se pide ni se guarda la API key en el cliente.
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [backendStatus, setBackendStatus] = useState({ checked: false, online: false, groqConfigured: false });
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hola, soy NEX AI. Estoy conectado a las funciones serverless de Vercel en /api. Si no respondo, fijate que GROQ_API_KEY esté configurada en Vercel → Settings → Environment Variables.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  // Autocompletado ghost (Monaco inline suggest + Groq)
  const [ghostLoading, setGhostLoading] = useState(false);

  const file = files[activeFile];

  useEffect(() => {
    saveWorkspace({ files, openFiles, activeFile, themeName, dirty });
  }, [files, openFiles, activeFile, themeName, dirty]);

  /* ---- chequeo de salud del backend al montar ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/groq/health`);
        const data = await res.json();
        if (!cancelled) setBackendStatus({ checked: true, online: true, groqConfigured: Boolean(data.groqConfigured) });
      } catch {
        if (!cancelled) setBackendStatus({ checked: true, online: false, groqConfigured: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- atajos de teclado globales ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault(); openPalette('commands');
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault(); openPalette('files');
      } else if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      } else if (e.ctrlKey && e.key.toLowerCase() === '`') {
        e.preventDefault(); setTerminalOpen(t => !t);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [terminalLines]);
  useEffect(() => { if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }, [chatMessages, chatLoading]);

  const openFile = (name: string, reveal?: Omit<SearchHit, 'path' | 'preview'>) => {
    if (!files[name]) return;
    if (!openFiles.includes(name)) setOpenFiles(o => [...o, name]);
    setActiveFile(name);
    if (reveal) {
      setRevealTarget({
        line: reveal.line,
        column: reveal.column,
        endLine: reveal.line,
        endColumn: reveal.endColumn,
        nonce: Date.now(),
      });
    }
  };
  const closeFile = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = openFiles.filter(f => f !== name);
    setOpenFiles(next);
    if (activeFile === name) setActiveFile(next[next.length - 1] || '');
  };

  const handleEditorChange = useCallback((v: string) => {
    setFiles(prev => {
      const cur = prev[activeFile];
      if (!cur) return prev;
      return { ...prev, [activeFile]: { ...cur, content: v } };
    });
    setDirty(d => ({ ...d, [activeFile]: true }));
  }, [activeFile]);

  const requestInlineCompletion = useCallback(async ({ language, before, after, signal }: {
    language: string; before: string; after: string; signal: AbortSignal;
  }) => {
    if (!backendStatus.online || !backendStatus.groqConfigured) return null;
    setGhostLoading(true);
    try {
      const completion = await callNexAI([
        { role: 'system', content: 'Sos un motor de autocompletado tipo Copilot. Te dan el código antes y después del cursor. Respondé SOLO con la continuación natural desde el cursor (sin repetir nada anterior, sin explicaciones, sin markdown, máx 3 líneas).' },
        { role: 'user', content: `LENGUAJE: ${language}\n--- ANTES ---\n${before}\n--- DESPUÉS ---\n${after}\n--- Continuá: ---` },
      ], { model: groqModel, maxTokens: 80 });
      if (signal.aborted) return null;
      return completion.replace(/```[\w]*\n?|```/g, '');
    } catch {
      return null;
    } finally {
      if (!signal.aborted) setGhostLoading(false);
    }
  }, [backendStatus.online, backendStatus.groqConfigured, groqModel]);

  const createFile = () => {
    const raw = window.prompt('Ruta del archivo nuevo (ej: src/utils/helpers.ts)', 'src/nuevo.ts');
    if (!raw) return;
    const path = raw.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!path || files[path]) {
      pushTerm([`No se pudo crear: ${path || '(vacío)'} (ya existe o inválido)`]);
      return;
    }
    setFiles(prev => ({
      ...prev,
      [path]: { language: languageForPath(path), content: '' },
    }));
    setDirty(d => ({ ...d, [path]: true }));
    openFile(path);
    const folder = path.includes('/') ? path.split('/')[0] : '';
    if (folder) setExplorerOpenFolders(o => ({ ...o, [folder]: true }));
    pushTerm([`Creado: ${path}`]);
  };

  const renameFile = (oldPath: string) => {
    const raw = window.prompt('Nueva ruta', oldPath);
    if (!raw || raw === oldPath) return;
    const path = raw.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!path || files[path]) {
      pushTerm([`No se pudo renombrar a ${path}`]);
      return;
    }
    setFiles(prev => {
      const next = { ...prev };
      const entry = next[oldPath];
      if (!entry) return prev;
      delete next[oldPath];
      next[path] = { ...entry, language: languageForPath(path) };
      return next;
    });
    setDirty(d => {
      const next = { ...d };
      if (next[oldPath]) { next[path] = true; delete next[oldPath]; }
      return next;
    });
    setOpenFiles(o => o.map(f => (f === oldPath ? path : f)));
    if (activeFile === oldPath) setActiveFile(path);
    pushTerm([`Renombrado: ${oldPath} → ${path}`]);
  };

  const deleteFile = (path: string) => {
    if (!files[path]) return;
    if (!window.confirm(`¿Borrar ${path}?`)) return;
    setFiles(prev => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    setDirty(d => {
      const next = { ...d };
      delete next[path];
      return next;
    });
    const nextOpen = openFiles.filter(f => f !== path);
    setOpenFiles(nextOpen);
    if (activeFile === path) setActiveFile(nextOpen[nextOpen.length - 1] || Object.keys(files).find(f => f !== path) || '');
    pushTerm([`Eliminado: ${path}`]);
  };

  const runSearch = (q: string) => {
    setSearchQuery(q);
    setSearchHits(searchWorkspace(files, q));
  };

  const pushTerm = (lines: string[]) => setTerminalLines(prev => [...prev, ...lines]);
  const clearTerminal = () => { setTerminalLines([]); };

  const syncFileToVfs = useCallback(
    async (relPath: string, content: string) => {
      const winRel = relPath.replace(/\//g, '\\');
      const abs = joinPath(VFS_PROJECT_ROOT, winRel);
      try {
        await nexFs.writeFile(abs, content);
      } catch (e) {
        pushTerm([`VFS sync error: ${e instanceof Error ? e.message : String(e)}`]);
      }
    },
    [nexFs],
  );

  // Seed workspace files onto NexFs so Terminal git/npm see the same tree
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await nexFs.mkdir(VFS_PROJECT_ROOT);
        for (const [rel, entry] of Object.entries(files)) {
          if (cancelled) return;
          const abs = joinPath(VFS_PROJECT_ROOT, rel.replace(/\//g, '\\'));
          if (!nexFs.exists(abs)) {
            await nexFs.writeFile(abs, entry.content);
          }
        }
      } catch {
        /* ignore seed errors */
      }
    })();
    return () => {
      cancelled = true;
    };
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveFile = () => {
    setDirty((d) => ({ ...d, [activeFile]: false }));
    const entry = files[activeFile];
    if (entry) void syncFileToVfs(activeFile, entry.content);
    setScmRefresh((n) => n + 1);
    pushTerm([`Guardado: ${activeFile} → ${VFS_PROJECT_ROOT}`]);
  };
  useEffect(() => {
    const onSave = (e: KeyboardEvent) => { if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); } };
    window.addEventListener('keydown', onSave);
    return () => window.removeEventListener('keydown', onSave);
  }, [activeFile]);

  const getPreviewHtml = () => {
    const appFile = files['src/App.tsx'];
    if (!appFile) return '<html><body style="background:#fff;color:#333;font-family:sans-serif;padding:40px"><h3>No App.tsx</h3></body></html>';
    const code = appFile.content.replace(/import .*? from ['"].*?['"];?/g, '').replace(/export default function/g, 'function').replace(/export default \w+;?/g, '');
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>body{font-family:'Segoe UI',sans-serif;background:#fff;color:#1e1e1e;padding:0;margin:0}.app{max-width:760px;margin:0 auto;padding:64px 24px;text-align:center}h1{color:#0078d4;font-size:28px}button{padding:10px 24px;background:#0078d4;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-top:24px;font-size:14px}button:hover{background:#005a9e}</style>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script></head>
    <body><div id="root"></div><script type="text/babel">
      const { useState, useEffect, useRef, useMemo, useCallback } = React;
      try {
        ${code}
        const match = \`${code.replace(/`/g, '\\`')}\`.match(/function\\s+([A-Z]\\w*)/);
        const C = match ? match[1] : 'App';
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(eval(C)));
      } catch(e) {
        document.getElementById('root').innerHTML = '<div style="color:#d13438;font-family:monospace;white-space:pre-wrap;padding:20px">Error: ' + e.message + '</div>';
      }
    </script></body></html>`;
  };

  const handleTermInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const cmd = termInput.trim();
    pushTerm([`PS C:\\nex-code-app> ${cmd}`]);
    setTermInput('');
    if (!cmd) return;
    if (cmd.includes('run dev') || cmd === 'npm start') {
      pushTerm(['', '> vite', '', '  VITE v5.4.2  ready in 287 ms', '', '  ➜  Local:   http://localhost:5173/']);
      setTimeout(() => setPreviewOpen(true), 500);
    } else if (cmd.includes('install')) {
      pushTerm(['']);
      setTimeout(() => pushTerm(['added 142 packages in 2.1s', '', 'found 0 vulnerabilities']), 900);
    } else if (cmd === 'cls' || cmd === 'clear') {
      clearTerminal();
    } else if (cmd === 'dir' || cmd === 'ls') {
      pushTerm(Object.keys(files).map(f => `    ${f}`));
    } else if (cmd.startsWith('cat ') || cmd.startsWith('type ')) {
      const target = cmd.split(' ').slice(1).join(' ').trim();
      const full = Object.keys(files).find(f => f.toLowerCase().includes(target.toLowerCase()));
      pushTerm(full ? files[full].content.split('\n') : [`No se encuentra: ${target}`]);
    } else {
      pushTerm([`'${cmd.split(' ')[0]}' no se reconoce como un comando interno o externo.`]);
    }
  };

  const sendChatMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!backendStatus.online) {
      setChatMessages(p2 => [...p2, { role: 'user', content: trimmed }, { role: 'assistant', content: '⚠️ No puedo conectarme a las funciones serverless (/api). Si estás en local corré "vercel dev"; si está desplegado, revisá los logs de la función en el dashboard de Vercel.' }]);
      return;
    }
    if (!backendStatus.groqConfigured) {
      setChatMessages(p2 => [...p2, { role: 'user', content: trimmed }, { role: 'assistant', content: '⚠️ Las funciones están arriba pero falta GROQ_API_KEY en las variables de entorno de Vercel.' }]);
      return;
    }
    const newMsgs = [...chatMessages, { role: 'user', content: trimmed }];
    setChatMessages(newMsgs); setChatLoading(true);
    try {
      const sysMsg = { role: 'system', content: `Sos NEX AI, asistente integrado de NEX CODE. Archivo activo: "${activeFile}" (${file?.language}).\n\n${file?.content?.slice(0, 4000)}\n\nRespondé en español, conciso, con bloques de código si corresponde.` };
      const reply = await callNexAI([sysMsg, ...newMsgs.slice(-10)], { model: groqModel, maxTokens: 800 });
      setChatMessages(p2 => [...p2, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setChatMessages(p2 => [...p2, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    } finally { setChatLoading(false); }
  };

  const sendChat = () => {
    const text = chatInput;
    setChatInput('');
    sendChatMessage(text);
  };

  /* ---- "Preguntale a NEX AI" desde la paleta de comandos (fallback cuando no hay match) ---- */
  const askNexAIFromPalette = (text: string) => {
    setAiPanelOpen(true);
    setPaletteOpen(false);
    sendChatMessage(text);
  };

  /* ---- Explicar un error de la terminal con un click ---- */
  const explainTerminalError = (line: string) => {
    setAiPanelOpen(true);
    sendChatMessage(`Explicá este error de la terminal y sugerí cómo solucionarlo. Archivo activo: "${activeFile}".\n\n${line}`);
  };

  /* ---- Edición inline con IA (estilo Cmd+K) ---- */
  const openInlineEdit = () => {
    if (!file) return;
    const { start, end, text } = monacoRef.current?.getSelectionOffsets() || {
      start: 0,
      end: file.content.length,
      text: file.content,
    };
    setInlineEdit({
      open: true,
      instruction: '',
      loading: false,
      error: '',
      original: text,
      result: '',
      selStart: start,
      selEnd: end,
    });
  };

  const submitInlineEdit = async () => {
    if (!inlineEdit.instruction.trim() || inlineEdit.loading) return;
    if (!backendStatus.online || !backendStatus.groqConfigured) {
      setInlineEdit(s => ({ ...s, error: 'El backend de NEX AI no está disponible (revisá /api en Vercel y GROQ_API_KEY).' }));
      return;
    }
    setInlineEdit(s => ({ ...s, loading: true, error: '' }));
    try {
      const reply = await callNexAI([
        { role: 'system', content: 'Sos un editor de código integrado en NEX CODE. Te dan un fragmento de código y una instrucción en español. Devolvé SOLO el fragmento completo reescrito según la instrucción, sin explicaciones, sin comentarios extra, sin marcas de markdown ni comillas de bloque.' },
        { role: 'user', content: `LENGUAJE: ${file?.language}\nINSTRUCCIÓN: ${inlineEdit.instruction}\n--- CÓDIGO ---\n${inlineEdit.original}` },
      ], { model: groqModel, maxTokens: 1200 });
      setInlineEdit(s => ({ ...s, loading: false, result: reply.replace(/```[\w]*\n?|```/g, '').trim() }));
    } catch (err: any) {
      setInlineEdit(s => ({ ...s, loading: false, error: err.message }));
    }
  };

  const acceptInlineEdit = () => {
    if (!inlineEdit.result || !file) return;
    monacoRef.current?.replaceRange(inlineEdit.selStart, inlineEdit.selEnd, inlineEdit.result);
    const newContent =
      file.content.slice(0, inlineEdit.selStart) + inlineEdit.result + file.content.slice(inlineEdit.selEnd);
    setFiles(prev => ({ ...prev, [activeFile]: { ...prev[activeFile], content: newContent } }));
    setDirty(d => ({ ...d, [activeFile]: true }));
    setInlineEdit({ open: false, instruction: '', loading: false, error: '', original: '', result: '', selStart: 0, selEnd: 0 });
  };

  const discardInlineEdit = () => {
    setInlineEdit({ open: false, instruction: '', loading: false, error: '', original: '', result: '', selStart: 0, selEnd: 0 });
  };

  /* ---- Generar un tema completo a partir de una descripción en lenguaje natural ---- */
  const generateThemeFromPrompt = async () => {
    if (!themeGenPrompt.trim() || themeGenLoading) return;
    if (!backendStatus.online || !backendStatus.groqConfigured) {
      setThemeGenError('El backend de NEX AI no está disponible (revisá /api en Vercel y GROQ_API_KEY).');
      return;
    }
    setThemeGenLoading(true); setThemeGenError('');
    if (!themeGenPreviewName) themeBeforeGenRef.current = themeName;
    const keys = 'bg,bgAlt,sidebar,activitybar,titlebar,border,text,textDim,accent,accentHover,accentText,selection,lineHL,statusbar,tabActiveBorder,scrollbar,kw,str,com,fn,num,type,prop,tag,bracket';
    try {
      const reply = await callNexAI([
        { role: 'system', content: `Sos un generador de paletas de colores para un editor de código tipo VS Code. Respondé SOLO con un objeto JSON plano (sin texto adicional, sin markdown) con exactamente estas claves: ${keys}. Todas deben ser colores hexadecimales "#rrggbb", excepto selection, lineHL y scrollbar que deben ser "rgba(r,g,b,a)" con alpha bajo (0.15 a 0.5). El tema tiene que tener buen contraste entre bg y text, y estar inspirado fielmente en la descripción que te da el usuario.` },
        { role: 'user', content: themeGenPrompt },
      ], { model: groqModel, maxTokens: 700 });
      const cleaned = reply.replace(/```json\n?|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const baseName = themeGenPreviewName || `IA: ${themeGenPrompt.slice(0, 28)}${themeGenPrompt.length > 28 ? '…' : ''}`;
      setCustomThemes(t => {
        const next = { ...t };
        if (themeGenPreviewName && themeGenPreviewName !== baseName) delete next[themeGenPreviewName];
        next[baseName] = { ...BUILTIN_THEMES['NEX Dark+ (default)'], ...parsed };
        return next;
      });
      setThemeName(baseName);
      setThemeGenPreviewName(baseName);
    } catch {
      setThemeGenError('No se pudo generar el tema. Probá describirlo de otra forma o con menos detalle.');
    } finally { setThemeGenLoading(false); }
  };

  const discardGeneratedTheme = () => {
    if (themeGenPreviewName) {
      setThemeName(themeBeforeGenRef.current);
      setCustomThemes(t => { const c = { ...t }; delete c[themeGenPreviewName]; return c; });
      setThemeGenPreviewName(null);
    }
    setThemeGenError(''); setThemeGenPrompt('');
  };

  const explainSelection = async () => {
    if (!file) return;
    const sel = monacoRef.current?.getSelectionText() || file.content;
    setAiPanelOpen(true);
    setChatMessages(p2 => [...p2, { role: 'user', content: `Explicá/Refactorizá:\n\n\`\`\`${file.language}\n${sel}\n\`\`\`` }]);
    if (!backendStatus.online || !backendStatus.groqConfigured) {
      setChatMessages(p2 => [...p2, { role: 'assistant', content: '⚠️ Las funciones de /api no están disponibles o le falta GROQ_API_KEY en Vercel.' }]);
      return;
    }
    setChatLoading(true);
    try {
      const reply = await callNexAI([
        { role: 'system', content: 'Sos NEX AI. Explicá brevemente el código y sugerí mejoras si aplica. Español.' },
        { role: 'user', content: sel },
      ], { model: groqModel, maxTokens: 700 });
      setChatMessages(p2 => [...p2, { role: 'assistant', content: reply }]);
    } catch (err: any) { setChatMessages(p2 => [...p2, { role: 'assistant', content: `❌ Error: ${err.message}` }]); }
    finally { setChatLoading(false); }
  };

  const importTheme = () => {
    setThemeImportError('');
    const parsed = parseVscodeThemeJson(themeJsonInput);
    if (!parsed) { setThemeImportError('JSON inválido. Pegá el tema completo (botón "Get theme" en vscodethemes.com).'); return; }
    let name = `Importado ${Object.keys(customThemes).length + 1}`;
    try { name = JSON.parse(themeJsonInput).name || name; } catch { }
    setCustomThemes(t => ({ ...t, [name]: parsed }));
    setThemeName(name); setThemeJsonInput(''); setPaletteOpen(false);
  };

  /* ---- comandos de la paleta ---- */
  const commands = useMemo(() => ([
    { id: 'quick-open', label: 'Archivo: Abrir rápido', keybind: 'Ctrl+P', action: () => openPalette('files') },
    { id: 'theme', label: 'Preferencias: Cambiar tema de color', keybind: '', action: () => openPalette('themes') },
    { id: 'theme-next', label: 'Preferencias: Tema siguiente', keybind: '', action: () => cycleTheme(1) },
    { id: 'theme-prev', label: 'Preferencias: Tema anterior', keybind: '', action: () => cycleTheme(-1) },
    { id: 'theme-import', label: 'NEX CODE: Importar tema desde vscodethemes.com', keybind: '', action: () => { setThemeImportMode('json'); openPalette('themeImport'); } },
    { id: 'theme-generate-ai', label: 'NEX AI: Generar tema a partir de una descripción', keybind: '', action: () => { setThemeImportMode('ai'); openPalette('themeImport'); } },
    { id: 'groq-status', label: 'NEX AI: Ver estado de las funciones (/api en Vercel)', keybind: '', action: () => openPalette('groqStatus') },
    { id: 'groq-model', label: 'NEX AI: Elegir modelo de Groq', keybind: '', action: () => openPalette('groqModel') },
    { id: 'toggle-terminal', label: 'Ver: Alternar terminal integrada', keybind: 'Ctrl+`', action: () => setTerminalOpen(t => !t) },
    { id: 'clear-terminal', label: 'Terminal: Limpiar', keybind: '', action: clearTerminal },
    { id: 'toggle-ai', label: 'Ver: Alternar panel NEX AI', keybind: '', action: () => setAiPanelOpen(o => !o) },
    { id: 'toggle-preview', label: 'NEX CODE: Alternar vista previa', keybind: '', action: () => setPreviewOpen(v => !v) },
    { id: 'save', label: 'Archivo: Guardar', keybind: 'Ctrl+S', action: saveFile },
    { id: 'new-file', label: 'Archivo: Nuevo archivo…', keybind: '', action: createFile },
    { id: 'explorer-view', label: 'Ver: Mostrar explorador', keybind: '', action: () => setActivityView('explorer') },
    { id: 'search-view', label: 'Ver: Mostrar búsqueda', keybind: 'Ctrl+Shift+F', action: () => setActivityView('search') },
    { id: 'inline-edit', label: 'NEX AI: Editar selección (Ctrl+K)', keybind: 'Ctrl+K', action: openInlineEdit },
    { id: 'git-view', label: 'Ver: Mostrar control de código', keybind: '', action: () => setActivityView('git') },
    { id: 'settings', label: 'Preferencias: Abrir configuración', keybind: '', action: () => { setSettingsTabOpen(true); setPaletteOpen(false); } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [themeNames, themeName]);

  const ext = activeFile.split('.').pop() || '';

  /* ---------- render del árbol de explorador ---------- */
  const tree = useMemo(() => buildFileTree(Object.keys(files)), [files]);
  const renderTree = (items: ReturnType<typeof buildFileTree>, level = 0): React.ReactNode => items.map((item, idx) => {
    if (item.type === 'folder') {
      const open = explorerOpenFolders[item.name] !== false;
      return (
        <div key={`${item.name}-${idx}`}>
          <div
            className="nex-tree-row"
            onClick={() => setExplorerOpenFolders(o => ({ ...o, [item.name]: !(o[item.name] !== false) }))}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: `2px 8px 2px ${6 + level * 12}px`,
              fontSize: 13, cursor: 'pointer', userSelect: 'none', height: 22, color: p.text,
            }}
          >
            <span style={{ fontSize: 9, color: p.textDim, transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', width: 10, transition: 'transform 0.1s' }}>▶</span>
            <svg viewBox="0 0 16 16" width="14" height="14" style={{ flexShrink: 0 }}>
              <path d="M1.5 1A1.5 1.5 0 0 0 0 2.5v11A1.5 1.5 0 0 0 1.5 15h13a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H8L6.5 3H1.5z" fill={open ? '#dcb67a' : '#c09553'} />
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
          </div>
          {open && renderTree(item.children, level + 1)}
        </div>
      );
    }
    const fext = item.path.split('.').pop() || '';
    const active = activeFile === item.path;
    return (
      <div
        key={item.path}
        className="nex-tree-row"
        onClick={() => openFile(item.path)}
        onContextMenu={(e) => {
          e.preventDefault();
          const choice = window.prompt('Acción: rename | delete', 'rename');
          if (choice === 'rename') renameFile(item.path);
          else if (choice === 'delete') deleteFile(item.path);
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: `2px 8px 2px ${20 + level * 12}px`,
          fontSize: 13, cursor: 'pointer', height: 22,
          background: active ? p.selection : 'transparent',
          color: active ? p.text : p.text,
          userSelect: 'none',
          borderLeft: active ? `2px solid ${p.accent}` : '2px solid transparent',
        }}
      >
        <FileIcon ext={fext} size={15} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
        {dirty[item.path] && <span style={{ marginRight: 2, width: 7, height: 7, borderRadius: '50%', background: p.text, opacity: 0.75, flexShrink: 0 }} />}
      </div>
    );
  });

  /* ---------- listas filtradas con fuzzy match para la paleta ---------- */
  const commandsFiltered = useMemo(() => {
    const ranked = commands
      .map(c => ({ c, m: fuzzyMatch(paletteQuery, c.label) }))
      .filter(x => x.m) as { c: typeof commands[number]; m: { score: number; indices: number[] } }[];
    if (!paletteQuery) {
      // sin query: comandos recientes primero, después el resto en orden original
      ranked.sort((a, b) => {
        const ra = recentCommandIds.indexOf(a.c.id), rb = recentCommandIds.indexOf(b.c.id);
        if (ra === -1 && rb === -1) return 0;
        if (ra === -1) return 1;
        if (rb === -1) return -1;
        return ra - rb;
      });
    } else {
      ranked.sort((a, b) => a.m.score - b.m.score);
    }
    return ranked;
  }, [commands, paletteQuery, recentCommandIds]);

  const themesFiltered = useMemo(() => {
    return Object.keys(allThemes)
      .map(name => ({ name, m: fuzzyMatch(paletteQuery, name) }))
      .filter(x => x.m)
      .sort((a, b) => (a.m as any).score - (b.m as any).score) as { name: string; m: { score: number; indices: number[] } }[];
  }, [allThemes, paletteQuery]);

  const filesFiltered = useMemo(() => {
    return Object.keys(files)
      .map(path => ({ path, m: fuzzyMatch(paletteQuery, path) }))
      .filter(x => x.m)
      .sort((a, b) => (a.m as any).score - (b.m as any).score) as { path: string; m: { score: number; indices: number[] } }[];
  }, [files, paletteQuery]);

  // Cantidad de filas de la lista activa, para acotar la navegación con flechas.
  const activeListLength = paletteMode === 'commands' ? commandsFiltered.length
    : paletteMode === 'themes' ? themesFiltered.length
    : paletteMode === 'files' ? filesFiltered.length : 0;

  useEffect(() => { setSelectedIndex(0); }, [paletteQuery, paletteMode]);

  useEffect(() => {
    if (!paletteListRef.current) return;
    const row = paletteListRef.current.querySelector<HTMLElement>(`[data-row-index="${selectedIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, paletteMode, paletteQuery]);

  const runCommand = (c: typeof commands[number]) => {
    setRecentCommandIds(r => [c.id, ...r.filter(id => id !== c.id)].slice(0, 6));
    c.action();
    if (!['theme', 'groq-status', 'groq-model', 'theme-import', 'quick-open'].includes(c.id)) setPaletteOpen(false);
  };

  const selectTheme = (name: string) => { setThemeName(name); setPaletteOpen(false); };
  const selectFile = (path: string) => { openFile(path); setPaletteOpen(false); };

  const confirmSelection = () => {
    if (paletteMode === 'commands' && commandsFiltered[selectedIndex]) runCommand(commandsFiltered[selectedIndex].c);
    else if (paletteMode === 'themes' && themesFiltered[selectedIndex]) selectTheme(themesFiltered[selectedIndex].name);
    else if (paletteMode === 'files' && filesFiltered[selectedIndex]) selectFile(filesFiltered[selectedIndex].path);
  };

  const onPaletteInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, Math.max(activeListLength - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); confirmSelection(); }
    else if (e.key === 'Escape') { e.preventDefault(); setPaletteOpen(false); }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', background: p.bg, color: p.text,
      fontFamily: "'Segoe UI',system-ui,sans-serif", overflow: 'hidden', position: 'relative',
      border: maximized ? 'none' : `1px solid ${p.border}`,
    }}>
      <style>{`
        .nex-scroll::-webkit-scrollbar { width: 14px; height: 14px; }
        .nex-scroll::-webkit-scrollbar-thumb { background: ${p.scrollbar}; border: 3px solid transparent; background-clip: content-box; border-radius: 7px; }
        .nex-scroll::-webkit-scrollbar-track { background: transparent; }
        .nex-input::placeholder { color: ${p.textDim}; }
        @keyframes nexBlink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        .nex-tree-row:hover { background: ${p.lineHL} !important; }
        .nex-tab .nex-tab-close { opacity: 0; }
        .nex-tab:hover .nex-tab-close { opacity: 1; }
        .nex-tab.dirty .nex-tab-close { opacity: 0; }
        .nex-tab.dirty:hover .nex-tab-dirty { display: none; }
        .nex-tab.dirty:hover .nex-tab-close { opacity: 1; }
        .nex-statusbar-item:hover { background: rgba(255,255,255,0.12); }
        .nex-statusbar-item-dark:hover { background: rgba(0,0,0,0.08); }
      `}</style>

      {/* ---------- Title bar ---------- */}
      <div style={{ height: 22, background: p.titlebar, display: 'flex', alignItems: 'center', flexShrink: 0, fontSize: 11, color: p.text, WebkitAppRegion: 'drag' } as any}>
        <div style={{ flex: 1, textAlign: 'center', color: p.textDim, letterSpacing: 0.2 }}>
          {activeFile
            ? `${activeFile.split('/').pop()}${dirty[activeFile] ? ' ●' : ''} — NEX-CODE-APP`
            : 'NEX-CODE-APP — NEX CODE'}
        </div>
      </div>

      {/* Menubar */}
      <div style={{ height: 24, background: p.titlebar, display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: 12, flexShrink: 0, borderBottom: `1px solid ${p.border}`, gap: 0 }}>
        <svg viewBox="0 0 100 100" width="14" height="14" style={{ marginRight: 6, marginLeft: 4, flexShrink: 0 }}>
          <path d="M74.9 10.4L50 35.3l-11-11L10 42.8v14.4l11-8.2 11 11 28-28.9V74l-11-8-11 11 28.9 13L90 79V21z" fill={p.accent} />
        </svg>
        {['Archivo', 'Editar', 'Selección', 'Ver', 'Ir', 'Ejecutar', 'Terminal', 'Ayuda'].map(item => (
          <div key={item} style={{ padding: '2px 7px', color: p.text, cursor: 'pointer', borderRadius: 3, lineHeight: '18px' }}
            onMouseEnter={e => e.currentTarget.style.background = p.selection}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => {
              if (item === 'Ver' || item === 'Ayuda') openPalette('commands');
              else if (item === 'Archivo' || item === 'Ir') openPalette('files');
              else if (item === 'Terminal') setTerminalOpen(true);
            }}
          >{item}</div>
        ))}
        <div style={{ flex: 1 }} />
        <div onClick={() => openPalette('commands')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: p.bg,
            border: `1px solid ${p.border}`, borderRadius: 5, padding: '1px 10px', margin: '0 8px',
            fontSize: 11, color: p.textDim, cursor: 'pointer', minWidth: 260, maxWidth: 420, height: 18,
            justifyContent: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
          }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.7 }}><path d="M15.7 14.3l-3.8-3.8A5.5 5.5 0 1 0 10.5 11.9l3.8 3.8a1 1 0 0 0 1.4-1.4zM7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" /></svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>NEX-CODE-APP</span>
          <span style={{ marginLeft: 8, opacity: 0.55, fontSize: 10 }}>Ctrl+Shift+P</span>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ---------- Activity bar ---------- */}
        <div style={{ width: 48, background: p.activitybar, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', flexShrink: 0, borderRight: `1px solid ${p.border}` }}>
          {[
            {
              id: 'explorer',
              title: 'Explorador',
              icon: (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M17.5 0h-9L7 1.5V6H2.5L1 7.5v15.07L2.5 24h12.07L16 22.57V18h4.7l1.3-1.43V4.5L17.5 0zm0 2.12l2.38 2.38H17.5V2.12zm-3 20.38h-12v-15H7v9.07L8.5 18h6v4.5zm6-6h-12v-15H16V6h4.5v10.5z" />
                </svg>
              ),
            },
            {
              id: 'search',
              title: 'Buscar',
              icon: (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M15.25 0a8.25 8.25 0 0 0-6.18 13.58L0 22.65 1.35 24l9.07-9.07A8.25 8.25 0 1 0 15.25 0zm0 15a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5z" />
                </svg>
              ),
            },
            {
              id: 'git',
              title: 'Control de código fuente',
              icon: (
                <svg viewBox="0 0 16 16" width="24" height="24" fill="currentColor">
                  <path fillRule="evenodd" d="M11.5 4.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM9 6.95v2.1a2.5 2.5 0 0 1-1.5 2.29V14.5a.5.5 0 0 1-1 0v-3.16A2.5 2.5 0 0 1 5 9.05V6.95a2.5 2.5 0 1 1 1 0v2.1a1.5 1.5 0 0 0 2 0V6.95a2.5 2.5 0 0 1 1 0zM4.5 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM2.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
                </svg>
              ),
            },
            {
              id: 'nexai',
              title: 'NEX AI',
              icon: (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 2l1.8 5.4L19 9.2l-5.2 1.8L12 16.5l-1.8-5.5L5 9.2l5.2-1.8L12 2zm7 11l.9 2.7L23 16.5l-3.1.9L19 20l-.9-2.6-3.1-.9 3.1-.9.9-2.6zM5 14l.7 2.1L8 16.8l-2.3.7L5 19.5l-.7-2-.2.1-2.1-.7 2.3-.7L5 14z" />
                </svg>
              ),
            },
          ].map(item => {
            const isActive = item.id === 'nexai' ? aiPanelOpen : activityView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => (item.id === 'nexai' ? setAiPanelOpen(o => !o) : setActivityView(item.id))}
                title={item.title}
                style={{
                  width: 48, height: 48, background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
                  color: isActive ? p.text : p.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                {isActive && (
                  <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, borderRadius: 1, background: p.accent }} />
                )}
                {item.icon}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => openPalette('groqStatus')}
            title="Administrar NEX AI"
            style={{
              width: 48, height: 48, background: 'transparent', border: 'none', cursor: 'pointer',
              color: backendStatus.online && backendStatus.groqConfigured ? p.accent : p.textDim,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.2 7.2 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.55-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.77 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.89 14.5a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.39 1.04.71 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.55 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
            </svg>
          </button>
        </div>

        {/* ---------- Sidebar ---------- */}
        {activityView === 'explorer' && (
          <div style={{ width: 260, background: p.sidebar, borderRight: `1px solid ${p.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: 0 }}>
            <div style={{
              fontSize: 11, padding: '10px 12px 8px', textTransform: 'uppercase', fontWeight: 600,
              letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 8, color: p.text,
              position: 'sticky', top: 0, background: p.sidebar, zIndex: 1,
            }}>
              <span style={{ flex: 1 }}>Explorador</span>
              <button type="button" onClick={createFile} title="Nuevo archivo" style={{ background: 'transparent', border: 'none', color: p.textDim, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}>＋</button>
            </div>
            <div className="nex-scroll" style={{ flex: 1, overflowY: 'auto' }}>
              <div
                className="nex-tree-row"
                style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 8px', textTransform: 'uppercase',
                  color: p.text, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: 0.4, height: 22,
                }}
              >
                <span style={{ fontSize: 9, transform: 'rotate(90deg)', display: 'inline-block', color: p.textDim }}>▶</span>
                NEX-CODE-APP
              </div>
              {renderTree(tree)}
            </div>
            <div style={{ padding: '8px 12px', fontSize: 10, color: p.textDim, borderTop: `1px solid ${p.border}` }}>
              Clic derecho: rename / delete
            </div>
          </div>
        )}
        {activityView === 'search' && (
          <div style={{ width: 280, background: p.sidebar, borderRight: `1px solid ${p.border}`, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.8,
              padding: '10px 12px 8px', color: p.text,
            }}>
              Buscar
            </div>
            <div style={{ padding: '0 10px 8px' }}>
              <input
                className="nex-input"
                value={searchQuery}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="Buscar"
                style={{
                  width: '100%', background: p.bg, border: `1px solid ${p.border}`, color: p.text,
                  padding: '5px 8px', borderRadius: 2, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div className="nex-scroll" style={{ flex: 1, overflowY: 'auto', fontSize: 12 }}>
              {!searchQuery.trim() && (
                <div style={{ padding: 12, color: p.textDim, lineHeight: 1.5 }}>Escribí para buscar en todos los archivos del workspace.</div>
              )}
              {searchQuery.trim() && searchHits.length === 0 && (
                <div style={{ padding: 12, color: p.textDim }}>Sin resultados.</div>
              )}
              {searchHits.map((hit, i) => (
                <button
                  key={`${hit.path}-${hit.line}-${i}`}
                  type="button"
                  className="nex-tree-row"
                  onClick={() => openFile(hit.path, hit)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    color: p.text, cursor: 'pointer', padding: '6px 12px',
                  }}
                >
                  <div style={{ fontSize: 11, color: p.accent, marginBottom: 2 }}>{hit.path}:{hit.line}</div>
                  <div style={{ color: p.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hit.preview}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {activityView === 'git' && (
          <GitScmPanel repoPath={VFS_PROJECT_ROOT} palette={p} refreshKey={scmRefresh} />
        )}

        {/* ---------- Main ---------- */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Editor column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Tabs */}
              <div style={{ display: 'flex', background: p.bgAlt, borderBottom: `1px solid ${p.border}`, minHeight: 35, alignItems: 'stretch' }}>
                <div className="nex-scroll" style={{ display: 'flex', flex: 1, overflowX: 'auto' }}>
                  {openFiles.map(fname => {
                    const fext = fname.split('.').pop() ?? '';
                    const fn = fname.split('/').pop();
                    const isActive = activeFile === fname;
                    const isDirty = Boolean(dirty[fname]);
                    return (
                      <div
                        key={fname}
                        className={`nex-tab${isDirty ? ' dirty' : ''}${isActive ? ' active' : ''}`}
                        onClick={() => openFile(fname)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 0 12px', fontSize: 13,
                          minWidth: 120, maxWidth: 200,
                          background: isActive ? p.bg : 'transparent',
                          color: isActive ? p.text : p.textDim,
                          borderTop: isActive ? `2px solid ${p.tabActiveBorder}` : '2px solid transparent',
                          borderRight: `1px solid ${p.border}`,
                          cursor: 'pointer', height: 35, position: 'relative',
                        }}
                      >
                        <FileIcon ext={fext} size={15} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fn}</span>
                        <span className="nex-tab-dirty" style={{
                          display: isDirty ? 'inline-block' : 'none',
                          width: 8, height: 8, borderRadius: '50%', background: p.text, opacity: 0.75, marginRight: 6, flexShrink: 0,
                        }} />
                        <button
                          type="button"
                          className="nex-tab-close"
                          onClick={e => closeFile(fname, e)}
                          title="Cerrar"
                          style={{
                            marginRight: 4, background: 'transparent', border: 'none', color: p.textDim,
                            cursor: 'pointer', fontSize: 12, width: 20, height: 20, borderRadius: 3,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = p.selection; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >✕</button>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={explainSelection} title="Explicar selección con NEX AI"
                  style={{ background: 'transparent', border: 'none', color: p.textDim, cursor: 'pointer', fontSize: 11, padding: '0 10px', borderLeft: `1px solid ${p.border}`, whiteSpace: 'nowrap' }}>
                  NEX AI
                </button>
                <button type="button" onClick={() => setPreviewOpen(v => !v)} title="Vista previa"
                  style={{ background: 'transparent', border: 'none', color: p.textDim, cursor: 'pointer', fontSize: 11, padding: '0 10px', borderLeft: `1px solid ${p.border}`, whiteSpace: 'nowrap' }}>
                  Run
                </button>
              </div>

              {/* Breadcrumb */}
              {file && (
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '1px 12px', fontSize: 12,
                  color: p.textDim, borderBottom: `1px solid ${p.border}`, gap: 2, minHeight: 22, background: p.bg,
                }}>
                  {activeFile.split('/').map((part, i, arr) => (
                    <React.Fragment key={i}>
                      <span style={{ color: i === arr.length - 1 ? p.text : p.textDim, padding: '0 2px' }}>{part}</span>
                      {i < arr.length - 1 && <span style={{ opacity: 0.45, fontSize: 11, padding: '0 1px' }}>›</span>}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Editor (Monaco) */}
              {file ? (
                <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
                  <NexMonacoEditor
                    ref={monacoRef}
                    path={activeFile}
                    language={file.language || langFromPath(activeFile)}
                    value={file.content}
                    palette={p}
                    themeName={themeName}
                    onChange={handleEditorChange}
                    onCursorChange={(line, col) => setCursorPos({ line, col })}
                    onInlineEditRequest={openInlineEdit}
                    requestInlineCompletion={requestInlineCompletion}
                    reveal={revealTarget}
                  />
                  {ghostLoading && (
                    <div style={{ position: 'absolute', bottom: 10, right: 18, fontSize: 11, color: p.textDim, zIndex: 3, pointerEvents: 'none' }}>
                      NEX AI sugiriendo…
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: p.textDim, gap: 28, background: p.bg, userSelect: 'none',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <svg viewBox="0 0 100 100" width="64" height="64" style={{ opacity: 0.35, marginBottom: 12 }}>
                      <path d="M74.9 10.4L50 35.3l-11-11L10 42.8v14.4l11-8.2 11 11 28-28.9V74l-11-8-11 11 28.9 13L90 79V21z" fill={p.accent} />
                    </svg>
                    <div style={{ fontSize: 20, color: p.text, fontWeight: 300, letterSpacing: 0.5 }}>NEX CODE</div>
                    <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>Editor · Monaco · NEX AI</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 280 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, color: p.textDim }}>Start</div>
                    {[
                      { label: 'Abrir archivo…', hint: 'Ctrl+P', action: () => openPalette('files') },
                      { label: 'Mostrar todos los comandos', hint: 'Ctrl+Shift+P', action: () => openPalette('commands') },
                      { label: 'Nuevo archivo', hint: '', action: createFile },
                      { label: 'Abrir terminal', hint: 'Ctrl+`', action: () => setTerminalOpen(true) },
                    ].map(row => (
                      <button
                        key={row.label}
                        type="button"
                        onClick={row.action}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'transparent', border: 'none', color: p.accent, cursor: 'pointer',
                          fontSize: 13, padding: '4px 0', textAlign: 'left',
                        }}
                      >
                        <span>{row.label}</span>
                        {row.hint && <span style={{ color: p.textDim, fontSize: 11 }}>{row.hint}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Preview */}
            {previewOpen && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderLeft: `1px solid ${p.border}`, background: '#fff' }}>
                <div style={{ height: 35, background: p.sidebar, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: `1px solid ${p.border}`, fontSize: 12, color: p.text, gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#28c840' }} />
                  <span style={{ color: p.textDim }}>http://localhost:5173/</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setPreviewOpen(false)} style={{ background: 'transparent', border: 'none', color: p.text, cursor: 'pointer' }}>✕</button>
                </div>
                <iframe srcDoc={getPreviewHtml()} style={{ flex: 1, border: 'none', background: '#fff' }} sandbox="allow-scripts allow-same-origin" />
              </div>
            )}

            {/* NEX AI panel */}
            {aiPanelOpen && (
              <div style={{ width: 330, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${p.border}`, background: p.sidebar, flexShrink: 0 }}>
                <div style={{ height: 35, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: `1px solid ${p.border}`, fontSize: 12, fontWeight: 700, gap: 6 }}>
                  <span>✨ NEX AI</span>
                  {backendStatus.online && backendStatus.groqConfigured
                    ? <span style={{ color: '#4ec9b0', fontSize: 10 }}>● {groqModel}</span>
                    : backendStatus.online
                      ? <span style={{ color: '#e5c07b', fontSize: 10 }}>● falta GROQ_API_KEY</span>
                      : <span style={{ color: '#f44747', fontSize: 10 }}>● backend desconectado</span>}
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setAiPanelOpen(false)} style={{ background: 'transparent', border: 'none', color: p.text, cursor: 'pointer' }}>✕</button>
                </div>
                <div ref={chatBoxRef} className="nex-scroll" style={{ flex: 1, overflowY: 'auto', padding: 10, fontSize: 12.5 }}>
                  {chatMessages.map((m, i) => (
                    <div key={i} style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap', background: m.role === 'user' ? p.selection : p.bgAlt }}>
                      <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: p.textDim }}>{m.role === 'user' ? 'Vos' : 'NEX AI'}</div>
                      {m.content}
                    </div>
                  ))}
                  {chatLoading && <div style={{ color: p.textDim, fontSize: 12 }}>NEX AI escribiendo…</div>}
                </div>
                <div style={{ borderTop: `1px solid ${p.border}`, padding: 8, display: 'flex', gap: 6 }}>
                  <input className="nex-input" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
                    placeholder="Preguntale a NEX AI..." style={{ flex: 1, background: p.bgAlt, border: `1px solid ${p.border}`, color: p.text, padding: '6px 8px', borderRadius: 4, fontSize: 12, outline: 'none' }} />
                  <button onClick={sendChat} style={{ background: p.accent, color: p.accentText, border: 'none', borderRadius: 4, padding: '0 12px', cursor: 'pointer' }}>➤</button>
                </div>
              </div>
            )}
          </div>

          {/* Terminal */}
          {terminalOpen && (
            <div style={{ height: 210, borderTop: `1px solid ${p.border}`, background: p.bg, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 12px', background: p.sidebar, borderBottom: `1px solid ${p.border}`, gap: 16 }}>
                {[['terminal', 'TERMINAL'], ['problems', 'PROBLEMAS'], ['output', 'SALIDA']].map(([id, label]) => (
                  <span key={id} onClick={() => setTerminalTab(id)} style={{ fontSize: 11, letterSpacing: 0.4, cursor: 'pointer', color: terminalTab === id ? p.text : p.textDim, borderBottom: terminalTab === id ? `1px solid ${p.text}` : 'none', paddingBottom: 8 }}>{label}</span>
                ))}
                <div style={{ flex: 1 }} />
                <button type="button" onClick={clearTerminal} style={{ background: 'transparent', border: 'none', color: p.textDim, cursor: 'pointer', fontSize: 12, padding: '0 6px' }} title="Limpiar">Clear</button>
                <button onClick={() => setTerminalOpen(false)} style={{ background: 'transparent', border: 'none', color: p.textDim, cursor: 'pointer' }}>✕</button>
              </div>
              {terminalTab === 'terminal' ? (
                <div ref={termRef} className="nex-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', fontSize: 13, fontFamily: "'Cascadia Code',Consolas,monospace", lineHeight: 1.5 }}>
                  {terminalLines.map((l, i) => {
                    const isErr = isErrorLine(l);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ flex: 1, whiteSpace: 'pre-wrap', color: l.includes('vulnerabilit') ? '#4ec9b0' : (isErr ? '#f44747' : p.text) }}>{l}</span>
                        {isErr && (
                          <button onClick={() => explainTerminalError(l)} title="Explicar con NEX AI"
                            style={{ background: 'transparent', border: `1px solid ${p.border}`, borderRadius: 3, color: p.accent, cursor: 'pointer', fontSize: 11, padding: '0 6px', flexShrink: 0, whiteSpace: 'nowrap' }}>✨ Explicar</button>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: p.accent }}>PS C:\nex-code-app&gt;</span>
                    <input value={termInput} onChange={e => setTermInput(e.target.value)} onKeyDown={handleTermInput}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: p.text, outline: 'none', marginLeft: 8, fontFamily: "'Cascadia Code',Consolas,monospace", fontSize: 13 }} />
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, padding: 14, color: p.textDim, fontSize: 12.5 }}>Sin {terminalTab === 'problems' ? 'problemas' : 'salida'} por el momento.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        height: 22, background: p.statusbar, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 2px', fontSize: 12, color: statusFg, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
          <span className={statusItemClass} style={{ display: 'flex', alignItems: 'center', padding: '0 8px', cursor: 'default' }}>
            main*
          </span>
          <span className={statusItemClass} style={{ display: 'flex', alignItems: 'center', padding: '0 8px', cursor: 'default', gap: 6 }}>
            <span>0</span><span style={{ opacity: 0.7 }}>⚠ 0</span>
          </span>
          <span
            className={statusItemClass}
            onClick={() => setTerminalOpen(t => !t)}
            style={{ display: 'flex', alignItems: 'center', padding: '0 8px', cursor: 'pointer' }}
          >
            Terminal
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
          <span className={statusItemClass} style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className={statusItemClass} style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>Espacios: 2</span>
          <span className={statusItemClass} style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>UTF-8</span>
          <span className={statusItemClass} style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            {LANG_META[ext]?.label || 'Plain Text'}
          </span>
          <span
            className={statusItemClass}
            onClick={() => openPalette('themes')}
            style={{ display: 'flex', alignItems: 'center', padding: '0 8px', cursor: 'pointer', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={themeName}
          >
            {themeName}
          </span>
          <span
            className={statusItemClass}
            onClick={() => openPalette('groqStatus')}
            style={{ display: 'flex', alignItems: 'center', padding: '0 8px', cursor: 'pointer' }}
          >
            {backendStatus.online && backendStatus.groqConfigured
              ? `NEX AI · ${groqModel}`
              : backendStatus.online
                ? 'NEX AI · sin key'
                : 'NEX AI · offline'}
          </span>
        </div>
      </div>

      {/* ---------- Command palette / Quick Open / Theme picker ---------- */}
      {paletteOpen && (
        <div onClick={() => setPaletteOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'center', paddingTop: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 560, maxHeight: 420, background: p.sidebar, border: `1px solid ${p.border}`, borderRadius: 6, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {(paletteMode === 'commands' || paletteMode === 'themes' || paletteMode === 'files') && (
              <>
                <input
                  autoFocus
                  value={paletteQuery}
                  onChange={e => setPaletteQuery(e.target.value)}
                  onKeyDown={onPaletteInputKeyDown}
                  placeholder={paletteMode === 'commands' ? '> Escribí un comando...' : paletteMode === 'files' ? 'Escribí el nombre de un archivo...' : 'Seleccioná un tema...'}
                  style={{ padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${p.border}`, color: p.text, fontSize: 14, outline: 'none' }} />
                <div ref={paletteListRef} className="nex-scroll" style={{ overflowY: 'auto', maxHeight: 340 }}>
                  {paletteMode === 'commands' && commandsFiltered.length === 0 && (
                    <div style={{ padding: '14px', fontSize: 12.5, color: p.textDim }}>Ningún comando coincide.</div>
                  )}
                  {paletteMode === 'commands' && commandsFiltered.map(({ c, m }, i) => (
                    <div key={c.id} data-row-index={i}
                      onClick={() => runCommand(c)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      style={{
                        padding: '8px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                        background: i === selectedIndex ? p.selection : 'transparent',
                      }}>
                      <span style={{ flex: 1, color: p.text }}>
                        <HighlightedLabel text={c.label} indices={m.indices} accent={p.accent} />
                      </span>
                      {!paletteQuery && recentCommandIds.includes(c.id) && (
                        <span style={{ fontSize: 10, color: p.textDim, border: `1px solid ${p.border}`, borderRadius: 3, padding: '1px 5px' }}>reciente</span>
                      )}
                      {c.keybind && <span style={{ fontSize: 11, color: p.textDim }}>{c.keybind}</span>}
                    </div>
                  ))}
                  {paletteMode === 'themes' && themesFiltered.length === 0 && (
                    <div style={{ padding: '14px', fontSize: 12.5, color: p.textDim }}>Ningún tema coincide.</div>
                  )}
                  {paletteMode === 'themes' && themesFiltered.map(({ name, m }, i) => (
                    <div key={name} data-row-index={i}
                      onClick={() => selectTheme(name)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: i === selectedIndex ? p.selection : (themeName === name ? p.lineHL : 'transparent') }}>
                      <span style={{ width: 14, height: 14, borderRadius: 3, background: allThemes[name].accent, border: `1px solid ${p.border}`, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}><HighlightedLabel text={name} indices={m.indices} accent={p.accent} /></span>
                      {themeName === name && <span style={{ fontSize: 11, color: p.textDim }}>✓ actual</span>}
                    </div>
                  ))}
                  {paletteMode === 'files' && filesFiltered.length === 0 && (
                    <div style={{ padding: '14px', fontSize: 12.5, color: p.textDim }}>Ningún archivo coincide.</div>
                  )}
                  {paletteMode === 'files' && filesFiltered.map(({ path, m }, i) => {
                    const fext = path.split('.').pop() || '';
                    const fname = path.split('/').pop() || path;
                    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
                    return (
                      <div key={path} data-row-index={i}
                        onClick={() => selectFile(path)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: i === selectedIndex ? p.selection : 'transparent' }}>
                        <FileIcon ext={fext} />
                        <span style={{ flex: 1 }}>
                          <HighlightedLabel text={fname} indices={m.indices.filter(ix => ix >= path.length - fname.length).map(ix => ix - (path.length - fname.length))} accent={p.accent} />
                          {dir && <span style={{ color: p.textDim, marginLeft: 8, fontSize: 11.5 }}>{dir}</span>}
                        </span>
                        {dirty[path] && <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.text, opacity: 0.7 }} />}
                        {openFiles.includes(path) && <span style={{ fontSize: 10, color: p.textDim, border: `1px solid ${p.border}`, borderRadius: 3, padding: '1px 5px' }}>abierto</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderTop: `1px solid ${p.border}`, padding: '6px 14px', fontSize: 11, color: p.textDim, display: 'flex', gap: 14 }}>
                  <span>↑↓ navegar</span><span>Enter abrir/ejecutar</span><span>Esc cerrar</span>
                </div>
              </>
            )}
            {paletteMode === 'themeImport' && (
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Importar tema desde vscodethemes.com</div>
                <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8, lineHeight: 1.5 }}>
                  Abrí <a href="https://vscodethemes.com/" target="_blank" rel="noreferrer" style={{ color: p.accent }}>vscodethemes.com</a>, elegí un tema, tocá "Get theme" / copiar JSON, y pegalo abajo:
                </div>
                <textarea value={themeJsonInput} onChange={e => setThemeJsonInput(e.target.value)} placeholder='{ "name": "...", "colors": {...}, "tokenColors": [...] }'
                  style={{ width: '100%', height: 130, background: p.bgAlt, border: `1px solid ${p.border}`, color: p.text, fontSize: 12, padding: 8, borderRadius: 4, fontFamily: 'monospace', outline: 'none', resize: 'vertical' }} />
                {themeImportError && <div style={{ color: '#f44747', fontSize: 12, marginTop: 6 }}>{themeImportError}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={importTheme} style={{ background: p.accent, color: p.accentText, border: 'none', padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Importar</button>
                  <button onClick={() => setPaletteOpen(false)} style={{ background: 'transparent', border: `1px solid ${p.border}`, color: p.text, padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Cerrar</button>
                </div>
              </div>
            )}
            {paletteMode === 'groqStatus' && (
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Estado de las funciones NEX AI (/api en Vercel)</div>
                <div style={{ fontSize: 12, color: p.textDim, lineHeight: 1.6 }}>
                  <div>Funciones: {backendStatus.online ? <span style={{ color: '#4ec9b0' }}>responden{API_BASE ? ` en ${API_BASE}` : ' (mismo dominio)'}</span> : <span style={{ color: '#f44747' }}>no responden</span>}</div>
                  <div>GROQ_API_KEY: {backendStatus.groqConfigured ? <span style={{ color: '#4ec9b0' }}>configurada</span> : <span style={{ color: '#e5c07b' }}>falta en Vercel</span>}</div>
                  <div style={{ marginTop: 8 }}>
                    La API key de Groq vive solo en el servidor (variable de entorno en Vercel) — el navegador nunca la ve.
                    Local: <code>vercel dev</code> (lee .env.local). Producción: Project → Settings → Environment Variables.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/api/groq/health`);
                      const data = await res.json();
                      setBackendStatus({ checked: true, online: true, groqConfigured: Boolean(data.groqConfigured) });
                    } catch { setBackendStatus({ checked: true, online: false, groqConfigured: false }); }
                  }} style={{ background: p.accent, color: p.accentText, border: 'none', padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Reintentar</button>
                  <button onClick={() => setPaletteOpen(false)} style={{ background: 'transparent', border: `1px solid ${p.border}`, color: p.text, padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Cerrar</button>
                </div>
              </div>
            )}
            {paletteMode === 'groqModel' && (
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Modelo de Groq</div>
                {['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'].map(m => (
                  <div key={m} onClick={() => { setGroqModel(m); setPaletteOpen(false); }}
                    style={{ padding: '8px 10px', fontSize: 13, cursor: 'pointer', borderRadius: 4, background: groqModel === m ? p.selection : 'transparent' }}>
                    {m}{groqModel === m ? ' ✓' : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}