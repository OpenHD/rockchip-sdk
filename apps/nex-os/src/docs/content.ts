/**
 * NEX OS Docs — structured content for the documentation site.
 * Nav shape mirrors vercel.com/docs: sections → pages.
 */

export type DocBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string; id: string }
  | { type: 'h3'; text: string; id: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; lang?: string; code: string }
  | { type: 'callout'; tone: 'tip' | 'warn' | 'info'; title: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hero'; eyebrow: string; title: string; lead: string }
  | {
      type: 'cards';
      items: { kicker: string; title: string; description: string; slug: string }[];
    };

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  blocks: DocBlock[];
};

export type DocSection = {
  id: string;
  title: string;
  pages: DocPage[];
};

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'start',
    title: 'Empezar',
    pages: [
      {
        slug: 'introduction',
        title: 'Introducción',
        description: 'Qué es NEX OS y cómo encaja el ecosistema.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'NEX OS',
            title: 'El sistema operativo en el navegador',
            lead: 'Desktop completo, apps nativas, NEX Music, NEX DJ, Nex Code y un SDK para que la comunidad cree ventanas nuevas sin tocar el shell.',
          },
          {
            type: 'p',
            text: 'NEX OS es un ecosistema web construido con React 19, TypeScript, Web Audio, Three.js y WASM. No es solo un clon visual: tiene WindowManager, filesystem virtual, temas neon, PWA y backends en Vercel + un music server con yt-dlp.',
          },
          {
            type: 'callout',
            tone: 'tip',
            title: 'Demos',
            text: 'Desktop: windows-seven-rose.vercel.app · Sitio: nexos-coral.vercel.app · Music: anex-os.vercel.app/nex-music',
          },
          {
            type: 'h2',
            id: 'explore',
            text: 'Explorá la plataforma',
          },
          {
            type: 'cards',
            items: [
              {
                kicker: 'Setup',
                title: 'Quick start',
                description: 'Vite + vercel dev + music server en minutos.',
                slug: 'quickstart',
              },
              {
                kicker: 'SDK',
                title: '@nex-os/sdk',
                description: 'defineApp, registry y hooks del host.',
                slug: 'sdk',
              },
              {
                kicker: 'Music',
                title: 'NEX Music',
                description: 'PWA social, salas y DSP real.',
                slug: 'nex-music',
              },
              {
                kicker: 'Booth',
                title: 'NEX DJ',
                description: 'Consola dual platter y Web Audio.',
                slug: 'nex-dj',
              },
              {
                kicker: 'Editor',
                title: 'Nex Code',
                description: 'Monaco + Groq dentro del OS.',
                slug: 'nex-code',
              },
              {
                kicker: 'Agent',
                title: 'Hermes Agent',
                description: 'Dashboard AI local embebido en el desktop.',
                slug: 'hermes',
              },
              {
                kicker: 'Ops',
                title: 'Music server',
                description: 'yt-dlp, cookies y Railway.',
                slug: 'music-server',
              },
            ],
          },
          {
            type: 'h2',
            id: 'products',
            text: 'Productos del monorepo',
          },
          {
            type: 'table',
            headers: ['Producto', 'Entrada', 'Qué es'],
            rows: [
              ['NEX OS Desktop', '/ · index.html', 'Shell con ventanas, taskbar, Start, boot/login'],
              ['NEX Music', '/nex-music', 'PWA social · YouTube + Spotify · salas en vivo'],
              ['NEX DJ', 'App Virtual DJ', 'Consola dual platter · Web Audio · streams'],
              ['Nex Code', 'App VsCode', 'IDE Monaco + AI (Groq)'],
              ['Hermes Agent', 'App hermes', 'Dashboard AI local en iframe · puerto 9119'],
              ['@nex-os/sdk', 'packages/nex-os-sdk', 'Registro de community apps'],
              ['Music server', 'server/', 'yt-dlp + Socket.io · DSP real'],
            ],
          },
          {
            type: 'h2',
            id: 'stack',
            text: 'Stack',
          },
          {
            type: 'ul',
            items: [
              'Frontend: React 19 · Vite 8 · TypeScript · Tailwind · Framer Motion',
              'APIs: Vercel Serverless (`api/`) · Socket.io · Redis opcional',
              'Datos: Supabase (auth, playlists, perfiles, verified)',
              'Audio: Web Audio · yt-dlp proxy · Piped fallback',
              'WASM: AssemblyScript (Task Manager) · Rust engine (telemetría)',
            ],
          },
        ],
      },
      {
        slug: 'quickstart',
        title: 'Quick start',
        description: 'Levantá desktop, APIs y music server en minutos.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Setup',
            title: 'Quick start',
            lead: 'Tres procesos locales: Vite (UI), vercel dev (APIs) y el music server (streams DSP).',
          },
          {
            type: 'h2',
            id: 'install',
            text: 'Instalar',
          },
          {
            type: 'code',
            lang: 'bash',
            code: `git clone https://github.com/shadownrx/windows.git
cd windows
npm install`,
          },
          {
            type: 'h2',
            id: 'env',
            text: 'Variables locales',
          },
          {
            type: 'p',
            text: 'Creá `.env.local` en la raíz (está gitignored):',
          },
          {
            type: 'code',
            lang: 'env',
            code: `VITE_MUSIC_SERVER_URL=http://localhost:4000
YOUTUBE_API_KEY=tu_key_google   # opcional pero recomendada
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_PUBLISHABLE_KEY=...`,
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'vercel dev + Development env',
            text: 'Las funciones en /api leen env de Vercel Development. Agregá YOUTUBE_API_KEY también ahí (Preview/Production no alcanzan para vercel dev).',
          },
          {
            type: 'h2',
            id: 'run',
            text: 'Correr',
          },
          {
            type: 'ol',
            items: [
              'Terminal A: `vercel dev` → http://localhost:3000 (UI + /api)',
              'Terminal B: `npm run music:server` → http://localhost:4000 (yt-dlp + Socket.io)',
              'Opcional: `hermes dashboard --no-open` → :9119 (Hermes Agent)',
              'Abrí NEX OS, `/nex-music` o `/docs`',
            ],
          },
          {
            type: 'code',
            lang: 'bash',
            code: `vercel dev
npm run music:server`,
          },
          {
            type: 'h2',
            id: 'cookies',
            text: 'Si yt-dlp dice “not a bot”',
          },
          {
            type: 'p',
            text: 'Exportá cookies de YouTube (extensión Get cookies.txt LOCALLY), guardá `server/youtube-cookies.txt` y en `.env.local`:',
          },
          {
            type: 'code',
            lang: 'env',
            code: `YT_DLP_COOKIES=server/youtube-cookies.txt`,
          },
          {
            type: 'p',
            text: 'Reiniciá el music server. Detalle en la página Music Server.',
          },
        ],
      },
      {
        slug: 'architecture',
        title: 'Arquitectura',
        description: 'Providers, WindowManager y límites del monorepo.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Sistema',
            title: 'Arquitectura',
            lead: 'Un árbol de contexts orquesta el shell; cada app es una ventana lazy-loaded o community via SDK.',
          },
          {
            type: 'code',
            lang: 'text',
            code: `App.tsx
├── SettingsProvider
├── FileSystemProvider
├── DesktopProvider
├── UIProvider
└── WindowManagerProvider
    └── Desktop / NexDesktop
        ├── Background3D
        ├── Window × N  → AppRegistry
        ├── Taskbar / StartMenu / Search
        └── Overlays`,
          },
          {
            type: 'h2',
            id: 'registry',
            text: 'Resolución de apps',
          },
          {
            type: 'ol',
            items: [
              'Community: `getRegisteredApp(appId)` desde `@nex-os/sdk`',
              'Built-in: mapa `React.lazy` en `AppRegistry.tsx`',
              'Launcher: `constants/apps.tsx` + `useLauncherApps` mergea community',
            ],
          },
          {
            type: 'h2',
            id: 'boundaries',
            text: 'Límites de deploy',
          },
          {
            type: 'ul',
            items: [
              'Vercel: frontend estático + serverless `api/*` (timeouts, sin yt-dlp largo)',
              'Railway / VPS: `server/` — proxy de audio, Socket.io rooms, cookies yt-dlp',
              'Supabase: auth y datos sociales de NEX Music',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'products',
    title: 'Productos',
    pages: [
      {
        slug: 'desktop',
        title: 'NEX OS Desktop',
        description: 'Shell, temas, ciclo de vida y apps built-in.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Desktop',
            title: 'NEX OS Desktop',
            lead: 'UEFI → boot → login → escritorio. Snap layouts, escritorios virtuales, temas neon y 18+ apps.',
          },
          {
            type: 'h2',
            id: 'lifecycle',
            text: 'Ciclo de vida',
          },
          {
            type: 'ul',
            items: [
              'Off / UEFI / Boot / WindowsBoot / Login',
              'Desktop (Windows-like) o NexDesktop (shell cyber)',
              'Suspender, apagar, reiniciar',
            ],
          },
          {
            type: 'h2',
            id: 'themes',
            text: 'Temas',
          },
          {
            type: 'p',
            text: 'Acento configurable (`--win-accent`) y modos neon: Cyberpunk, Matrix, Synthwave con fondos 3D (Three.js).',
          },
          {
            type: 'h2',
            id: 'apps',
            text: 'Apps built-in (selección)',
          },
          {
            type: 'table',
            headers: ['App', 'Notas'],
            rows: [
              ['File Explorer', 'FS virtual, .nex'],
              ['NexBrowser', 'Pestañas, YouTube, privado'],
              ['Nex Code', 'Monaco + Groq'],
              ['NEX Music / NexReproductor', 'También como ventana'],
              ['Virtual DJ', 'Consola dual deck'],
              ['Task Manager', 'WASM'],
              ['Hermes Agent', 'Iframe + proxy /hermes'],
              ['Terminal / CMD', 'NEX Runtime npm/.nex'],
            ],
          },
        ],
      },
      {
        slug: 'nex-music',
        title: 'NEX Music',
        description: 'PWA social, salas, playlists y DSP.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'PWA',
            title: 'NEX Music',
            lead: 'Reproductor social: YouTube + Spotify, salas en vivo, playlists globales, perfiles Supabase y Sonido Potencia (DSP).',
          },
          {
            type: 'p',
            text: 'Entrada: `nex-music.html` → `/nex-music`. También corre embebido como app del desktop.',
          },
          {
            type: 'h2',
            id: 'features',
            text: 'Capas',
          },
          {
            type: 'ul',
            items: [
              'Búsqueda YouTube (`/api/youtube/search`) y Spotify OAuth',
              'Salas Socket.io (music server) · party mode · DJ vote',
              'Cloud library / global playlists (Supabase)',
              'Verified badges · staff verify',
              'DSP real vía music server; sin server cae a iframe YouTube',
            ],
          },
          {
            type: 'h2',
            id: 'share',
            text: 'Share / OG',
          },
          {
            type: 'p',
            text: '`/share` y `/p/:p` reescriben a `/api/og-nex-music` para previews sociales.',
          },
        ],
      },
      {
        slug: 'nex-dj',
        title: 'NEX DJ',
        description: 'Consola Virtual DJ con platters y Web Audio.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Booth',
            title: 'NEX DJ (Virtual DJ)',
            lead: 'Dual platter circular, mixer de canales, waveform, hot cues, loops y pitch — todo sobre streams YouTube.',
          },
          {
            type: 'h2',
            id: 'pipeline',
            text: 'Pipeline de audio',
          },
          {
            type: 'code',
            lang: 'text',
            code: `Library search → resolveYoutubeStream
  1) Music server (yt-dlp)
  2) Piped (cliente)
  3) /api/youtube/search?stream=`,
          },
          {
            type: 'h2',
            id: 'ux',
            text: 'UX de consola',
          },
          {
            type: 'ul',
            items: [
              'Deck A (naranja) · Mixer · Deck B (teal)',
              'Platters que giran al play; anillo de progreso; seek en el disco',
              'EQ HI/MID/LOW + GAIN por canal · crossfader · SYNC',
              'Hot cues 1–4 (click jump, Alt set, Shift clear)',
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Streams',
            text: 'Para DSP estable necesitás music server + cookies yt-dlp si YouTube muestra bot-wall.',
          },
        ],
      },
      {
        slug: 'nex-code',
        title: 'Nex Code',
        description: 'IDE Monaco dentro del OS.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Editor',
            title: 'Nex Code',
            lead: 'IDE estilo VS Code con Monaco, workspace en localStorage y asistente AI vía Groq.',
          },
          {
            type: 'ul',
            items: [
              'Workspace key: `nexCodeWorkspace_v1`',
              'Temas: NEX Dark+, Dracula, One Dark Pro, …',
              'AI: `/api/groq/chat` — requiere `GROQ_API_KEY` en Vercel',
            ],
          },
        ],
      },
      {
        slug: 'hermes',
        title: 'Hermes Agent',
        description: 'Asistente AI local embebido como ventana nativa en NEX OS.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Agent',
            title: 'Hermes Agent',
            lead: 'El dashboard completo de Hermes corre en tu máquina (Python) y NEX OS lo embebe como app de escritorio — sin salir del OS ni abrir otra pestaña.',
          },
          {
            type: 'p',
            text: 'Hermes mantiene su backend independiente. NEX OS solo provee el chrome de ventana y un iframe a `http://127.0.0.1:9119`, para que el panel original se sienta nativo dentro del desktop.',
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'App pinneada',
            text: 'En el launcher: Hermes Agent (`appId: hermes` / alias `hermes-agent`). Componente: `src/components/apps/HermesAgent.tsx`.',
          },
          {
            type: 'h2',
            id: 'architecture',
            text: 'Arquitectura',
          },
          {
            type: 'ol',
            items: [
              'HermesAgent.tsx monta un iframe full-bleed al dashboard local',
              'Vite proxy `/hermes` → `localhost:9119` (API/REST sin CORS en dev)',
              'Sesión, tokens y WebSocket (`/api/pty`) los maneja el propio frontend de Hermes dentro del iframe',
            ],
          },
          {
            type: 'code',
            lang: 'text',
            code: `hermes dashboard --no-open   →  :9119
        │
        ▼
HermesAgent iframe  ──►  WindowManager (ventana NEX OS)
        │
Vite /hermes proxy  ──►  llamadas REST opcionales sin CORS`,
          },
          {
            type: 'h2',
            id: 'run',
            text: 'Cómo ejecutarlo',
          },
          {
            type: 'p',
            text: 'El backend de Hermes debe levantarse fuera de NEX OS (otra terminal del sistema):',
          },
          {
            type: 'code',
            lang: 'bash',
            code: `hermes dashboard --no-open`,
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Flag obligatorio: --no-open',
            text: 'Sin `--no-open`, Hermes abre el navegador del host y rompe la inmersión. Con el flag, solo escucha en 9119 y NEX OS captura la UI.',
          },
          {
            type: 'ol',
            items: [
              'Terminal del sistema: `hermes dashboard --no-open`',
              'Levantá NEX OS (`vercel dev` / `npm run dev`)',
              'Abrí Hermes Agent desde Taskbar / Start / Buscar',
            ],
          },
          {
            type: 'h2',
            id: 'env',
            text: 'URL / puerto',
          },
          {
            type: 'p',
            text: 'Por defecto el iframe apunta a `http://127.0.0.1:9119`. Si Hermes corre en otro puerto, actualizá `HERMES_URL` en `HermesAgent.tsx`. En `.env` podés documentar `VITE_HERMES_URL` para desarrollo futuro.',
          },
          {
            type: 'table',
            headers: ['Pieza', 'Ruta / valor'],
            rows: [
              ['App', 'src/components/apps/HermesAgent.tsx'],
              ['Registry', 'hermes · hermes-agent'],
              ['Dashboard URL', 'http://127.0.0.1:9119'],
              ['Vite proxy', '/hermes → localhost:9119'],
              ['Doc legacy', 'docs/hermes.md'],
            ],
          },
          {
            type: 'h2',
            id: 'modules',
            text: 'Módulos auxiliares',
          },
          {
            type: 'p',
            text: 'Bajo `src/components/apps/hermes/` hay vistas nativas (Chat, Sessions, Models, Config, Logs, Status) pensadas para hablar con la API de Hermes vía `hermes/api`. La app pinneada actual prioriza el dashboard original en iframe; esas vistas sirven para integraciones más profundas o UI propia.',
          },
          {
            type: 'h2',
            id: 'troubleshoot',
            text: 'Troubleshooting',
          },
          {
            type: 'ul',
            items: [
              'Ventana en blanco / loading eterno → verificá que Hermes escuche en :9119',
              'Se abre otra pestaña del navegador → relanzá con `hermes dashboard --no-open`',
              'Error 401 / sesión vencida → cerrá la ventana Hermes en NEX y volvé a abrirla (recarga tokens)',
              'CORS en fetch desde el OS → usá el proxy `/hermes` en lugar del host directo',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sdk',
    title: 'SDK',
    pages: [
      {
        slug: 'sdk',
        title: 'Overview',
        description: '@nex-os/sdk — community apps en el shell.',
        blocks: [
          {
            type: 'hero',
            eyebrow: '@nex-os/sdk · 0.2.0',
            title: 'Creá apps para NEX OS',
            lead: 'defineApp tipado, useOpenApp, aliases en Ctrl+Alt+R, y hooks del host (ventanas, settings, música).',
          },
          {
            type: 'callout',
            tone: 'tip',
            title: 'Demo in-OS',
            text: 'Abrí las apps SDK Docs y Hello NEX dentro del desktop para ver el registry en vivo.',
          },
          {
            type: 'h2',
            id: 'why',
            text: 'Por qué existe',
          },
          {
            type: 'p',
            text: 'Las apps built-in viven en AppRegistry + constants/apps. El SDK abre un registro en runtime para la comunidad.',
          },
          {
            type: 'code',
            lang: 'text',
            code: `defineApp(manifest)
        │
        ▼
  community registry  ──►  AppRegistry / Taskbar / Start / Search`,
          },
          {
            type: 'h2',
            id: 'install-sdk',
            text: 'En este monorepo',
          },
          {
            type: 'p',
            text: 'Ya está linkeado: workspace `"@nex-os/sdk": "*"` y alias Vite → `packages/nex-os-sdk/src`.',
          },
        ],
      },
      {
        slug: 'sdk-quickstart',
        title: 'Quick start',
        description: 'Tu primera community app en ~2 minutos.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'SDK',
            title: 'Quick start',
            lead: 'Un módulo React, un defineApp, un import en community-apps/index.ts.',
          },
          {
            type: 'h2',
            id: 'module',
            text: '1. Creá el módulo',
          },
          {
            type: 'code',
            lang: 'tsx',
            code: `// src/community-apps/MiApp.tsx
import React from 'react';
import { defineApp } from '@nex-os/sdk';

type Props = { mode?: string };

function MiApp({ mode = 'demo' }: Props) {
  return (
    <div style={{ height: '100%', padding: 24, color: '#e8f0ff', background: '#0b1220' }}>
      <h1 style={{ margin: 0 }}>Mi App</h1>
      <p style={{ opacity: 0.7 }}>Modo: {mode}</p>
    </div>
  );
}

export default defineApp<Props>({
  id: 'mi-app',
  appId: 'mi-app',
  title: 'Mi App',
  icon: <span style={{ fontSize: 18 }}>⚡</span>,
  component: MiApp,
  pinToTaskbar: true,
  category: 'tools',
  permissions: ['windows', 'settings'],
  defaultProps: { mode: 'demo' },
  aliases: ['mia'],
});`,
          },
          {
            type: 'h2',
            id: 'boot',
            text: '2. Importalo al boot',
          },
          {
            type: 'code',
            lang: 'ts',
            code: `// src/community-apps/index.ts
import './HelloNex';
import './SdkDocs';
import './MiApp';`,
          },
          {
            type: 'p',
            text: '`main.tsx` ya importa `./community-apps`, así que el side-effect registra la app al arrancar.',
          },
          {
            type: 'h2',
            id: 'run-sdk',
            text: '3. Corré el OS',
          },
          {
            type: 'code',
            lang: 'bash',
            code: `npm run dev
# Buscar → "Mi App" → Enter`,
          },
        ],
      },
      {
        slug: 'sdk-manifest',
        title: 'Manifest',
        description: 'Referencia de NexAppManifest.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'API',
            title: 'NexAppManifest',
            lead: 'Contrato que defineApp / registerApp esperan.',
          },
          {
            type: 'table',
            headers: ['Campo', 'Tipo', 'Req', 'Descripción'],
            rows: [
              ['id', 'string', '✓', 'Id de ventana'],
              ['appId', 'string', '✓', 'Clave AppRegistry'],
              ['title', 'string', '✓', 'Chrome / taskbar / Start'],
              ['icon', 'ReactNode', '✓', 'Fluent, SVG o emoji'],
              ['component', 'ComponentType', '✓', 'UI raíz (height 100%)'],
              ['aliases', 'string[]', '', 'Alias extras'],
              ['description', 'string', '', 'Catálogo'],
              ['author', 'string', '', 'Handle'],
              ['version', 'string', '', 'Semver'],
              ['defaultProps', 'Partial<TProps>', '', 'Props al abrir'],
              ['pinToTaskbar', 'boolean', '', 'Dock aunque cerrada'],
              ['category', 'union', '', 'tools | media | games | dev | social | other'],
              ['permissions', 'NexAppPermission[]', '', 'Contrato (sandbox roadmap)'],
            ],
          },
          {
            type: 'h2',
            id: 'ui-contract',
            text: 'Contrato de UI',
          },
          {
            type: 'ol',
            items: [
              'Ocupá todo el alto — height 100% / flex 1',
              'No dibujés titlebar propia — NEX la provee',
              'Props tipadas con defineApp<TProps>',
              'Evítá trabajo pesado en el top-level del módulo salvo defineApp',
            ],
          },
        ],
      },
      {
        slug: 'sdk-api',
        title: 'API reference',
        description: 'Funciones del package y hooks del host.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Reference · 0.2',
            title: 'API del package',
            lead: 'Registry tipado, resolve/openApp y host bridge.',
          },
          {
            type: 'code',
            lang: 'ts',
            code: `import {
  defineApp,
  resolveRegisteredApp,
  createOpenApp,
  getAppsByCategory,
  listRegisteredApps,
  subscribeRegistry,
} from '@nex-os/sdk';`,
          },
          {
            type: 'table',
            headers: ['Función', 'Qué hace'],
            rows: [
              ['defineApp<T>(m)', 'Registra + devuelve (props tipadas)'],
              ['resolveRegisteredApp(q)', 'id / alias / título'],
              ['createOpenApp(openWindow)', 'Helper puro para abrir'],
              ['getAppsByCategory(cat)', 'Filtro por categoría'],
              ['listRegisteredApps()', 'Manifests únicos'],
              ['subscribeRegistry(fn)', 'Callback altas/bajas → unsubscribe'],
            ],
          },
          {
            type: 'h2',
            id: 'host',
            text: 'Hooks del host',
          },
          {
            type: 'p',
            text: 'Desde `src/community-apps/` importá el bridge del shell:',
          },
          {
            type: 'code',
            lang: 'ts',
            code: `import {
  useOpenApp,
  useWindowManager,
  useSettings,
  useMusicPlayer,
  useDesktop,
  useFileSystem,
  useUI,
} from '../sdk/host';`,
          },
          {
            type: 'h3',
            id: 'open-app',
            text: 'useOpenApp',
          },
          {
            type: 'code',
            lang: 'ts',
            code: `const openApp = useOpenApp();
openApp('hello');
openApp('mi-app', { mode: 'pro' });`,
          },
          {
            type: 'h3',
            id: 'wm',
            text: 'useWindowManager',
          },
          {
            type: 'ul',
            items: [
              'openWindow / closeWindow / minimizeWindow / maximizeWindow / snapWindow / focusWindow',
              'windows · focusedWindowId',
            ],
          },
          {
            type: 'h3',
            id: 'settings',
            text: 'useSettings · useMusicPlayer',
          },
          {
            type: 'ul',
            items: [
              'accentColor / addNotification',
              'useMusicPlayer — playTrack, queue, favorites',
            ],
          },
          {
            type: 'h2',
            id: 'recipes',
            text: 'Recetas',
          },
          {
            type: 'code',
            lang: 'tsx',
            code: `const openApp = useOpenApp();
openApp('sdk-docs');

// Ctrl+Alt+R → hello | sdk | mia

const { addNotification } = useSettings();
addNotification('Mi App', 'Listo.');`,
          },
        ],
      },
    ],
  },
  {
    id: 'platform',
    title: 'Platform',
    pages: [
      {
        slug: 'api',
        title: 'Platform API',
        description: 'Rutas serverless en api/.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Vercel Functions',
            title: 'Platform API',
            lead: 'Endpoints en /api que el desktop y NEX Music consumen. Secretos nunca van al browser.',
          },
          {
            type: 'table',
            headers: ['Ruta', 'Uso'],
            rows: [
              ['/api/youtube/search?q=', 'Búsqueda (Google key o Piped)'],
              ['/api/youtube/search?stream=', 'Resolve audio vía Piped'],
              ['/api/spotify-*', 'OAuth + search + playlists'],
              ['/api/groq/*', 'AI de Nex Code'],
              ['/api/socket', 'Socket.io en Vercel (+ Redis)'],
              ['/api/og-nex-music', 'OG / share'],
              ['/api/playlist-share', 'Shares de playlists'],
            ],
          },
        ],
      },
      {
        slug: 'env',
        title: 'Environment variables',
        description: 'Matriz de env para local y Vercel.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Config',
            title: 'Environment variables',
            lead: 'Separá client (VITE_*) de server (sin prefijo). Development ≠ Preview en Vercel.',
          },
          {
            type: 'table',
            headers: ['Variable', 'Dónde', 'Para'],
            rows: [
              ['VITE_MUSIC_SERVER_URL', 'Client', 'DSP / streams / rooms'],
              ['VITE_SUPABASE_URL', 'Client', 'Auth + cloud'],
              ['VITE_SUPABASE_PUBLISHABLE_KEY', 'Client', 'Supabase anon'],
              ['YOUTUBE_API_KEY', 'Server + Dev', 'Search oficial'],
              ['SPOTIFY_CLIENT_ID/SECRET', 'Server', 'OAuth Spotify'],
              ['GROQ_API_KEY', 'Server', 'Nex Code AI'],
              ['REDIS_URL', 'Server', 'Socket.io adapter'],
              ['YT_DLP_COOKIES', 'Music server', 'Bot-wall YouTube'],
              ['YT_DLP_COOKIES_FROM_BROWSER', 'Music server', 'chrome|edge|…'],
              ['MUSIC_PUBLIC_URL', 'Music server', 'URL pública proxy'],
            ],
          },
        ],
      },
      {
        slug: 'music-server',
        title: 'Music server',
        description: 'yt-dlp, cookies y Railway.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'server/',
            title: 'Music server',
            lead: 'Proceso largo: proxy de audio con CORS/Range, Socket.io rooms y resolve vía yt-dlp (+ Piped fallback).',
          },
          {
            type: 'code',
            lang: 'bash',
            code: `npm run music:server
# → http://localhost:4000/health`,
          },
          {
            type: 'h2',
            id: 'endpoints',
            text: 'Endpoints',
          },
          {
            type: 'ul',
            items: [
              'GET /health — yt-dlp + cookies mode',
              'GET /stream/:videoId — JSON resolve',
              'GET /stream/:videoId/audio — proxy media',
            ],
          },
          {
            type: 'h2',
            id: 'cookies-ms',
            text: 'Cookies yt-dlp',
          },
          {
            type: 'p',
            text: 'Si ves “Sign in to confirm you’re not a bot”, exportá cookies.txt y seteá YT_DLP_COOKIES. En Windows, cookies-from-browser suele fallar si Chrome está abierto (DB lock / DPAPI).',
          },
          {
            type: 'h2',
            id: 'prod',
            text: 'Producción',
          },
          {
            type: 'p',
            text: 'Deploy `server/` en Railway (ver railway.toml). Seteá VITE_MUSIC_SERVER_URL en Vercel y redeploy del frontend.',
          },
        ],
      },
      {
        slug: 'integrations',
        title: 'Integrations',
        description: 'YouTube, Spotify, Supabase, Hermes.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Connect',
            title: 'Integrations',
            lead: 'Servicios externos que potencian Music, DJ y el desktop.',
          },
          {
            type: 'h2',
            id: 'yt',
            text: 'YouTube',
          },
          {
            type: 'p',
            text: 'Search con Data API; stream resolve: music server → Piped → API. Sin key, search cae a Piped.',
          },
          {
            type: 'h2',
            id: 'spotify',
            text: 'Spotify',
          },
          {
            type: 'p',
            text: 'OAuth en `api/spotify-*.js`. Redirect URI debe coincidir con el dashboard de Spotify.',
          },
          {
            type: 'h2',
            id: 'supabase',
            text: 'Supabase',
          },
          {
            type: 'p',
            text: 'Schemas en `supabase/schema*.sql`. Verified users: `supabase/VERIFIED.md`.',
          },
          {
            type: 'h2',
            id: 'hermes',
            text: 'Hermes Agent',
          },
          {
            type: 'p',
            text: 'Dashboard AI local embebido por iframe en :9119. Guía completa: página Hermes Agent (`/docs#/hermes`) y `docs/hermes.md`.',
          },
          {
            type: 'code',
            lang: 'bash',
            code: `hermes dashboard --no-open`,
          },
        ],
      },
    ],
  },
  {
    id: 'more',
    title: 'Más',
    pages: [
      {
        slug: 'contributing',
        title: 'Contributing',
        description: 'Cómo contribuir al monorepo.',
        blocks: [
          {
            type: 'hero',
            eyebrow: 'Community',
            title: 'Contributing',
            lead: 'Fork → branch → PR. Preferí community apps vía SDK antes de hardcodear built-ins.',
          },
          {
            type: 'ul',
            items: [
              'Leé CONTRIBUTING.md y CODE_OF_CONDUCT.md',
              'Changelog: changelog.md',
              'Docs Markdown legacy siguen en /docs/*.md',
            ],
          },
        ],
      },
    ],
  },
];

export function findPage(slug: string): { section: DocSection; page: DocPage } | null {
  for (const section of DOC_SECTIONS) {
    const page = section.pages.find((p) => p.slug === slug);
    if (page) return { section, page };
  }
  return null;
}

export const DEFAULT_SLUG = 'introduction';
