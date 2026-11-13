import React, { useState } from 'react';
import type { NexAppProps } from '@nex-os/sdk';
import { useOpenApp, useSettings } from '../sdk/host';

type SectionId = 'intro' | 'quick' | 'manifest' | 'api' | 'host' | 'recipes';

const SECTIONS: { id: SectionId; label: string; kicker: string }[] = [
  { id: 'intro', label: 'Intro', kicker: 'Qué es' },
  { id: 'quick', label: 'Quick start', kicker: '2 min' },
  { id: 'manifest', label: 'Manifest', kicker: 'Campos' },
  { id: 'api', label: 'API', kicker: 'Registro' },
  { id: 'host', label: 'Host hooks', kicker: 'Shell' },
  { id: 'recipes', label: 'Recetas', kicker: 'Patterns' },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="sdk-code">
      <code>{children}</code>
    </pre>
  );
}

export default function SdkDocsApp(_props: NexAppProps) {
  const [section, setSection] = useState<SectionId>('intro');
  const openApp = useOpenApp();
  const { accentColor, addNotification } = useSettings();

  const accent = accentColor || '#3dd6c6';

  const openHello = () => {
    openApp('hello');
  };

  const ping = () => {
    addNotification('NEX SDK', 'Hooks del host OK — tu app puede hablar con el shell.');
  };

  let body: React.ReactNode = null;
  if (section === 'intro') {
    body = (
      <>
        <p className="sdk-lead">
          <strong>@nex-os/sdk</strong> es la API oficial para crear apps que viven dentro de NEX OS:
          ventana, taskbar, Start y Buscar — sin tocar el núcleo.
        </p>
        <div className="sdk-cards">
          <article>
            <span className="sdk-card-kicker">01</span>
            <h3>defineApp</h3>
            <p>Registrás un manifest. El registry lo expone al shell en runtime.</p>
          </article>
          <article>
            <span className="sdk-card-kicker">02</span>
            <h3>Host bridge</h3>
            <p>Hooks reales: ventanas, settings, FS, escritorios.</p>
          </article>
          <article>
            <span className="sdk-card-kicker">03</span>
            <h3>Community folder</h3>
            <p>
              Todo vive en <code>src/community-apps/</code>. Importá y listo.
            </p>
          </article>
        </div>
        <div className="sdk-actions">
          <button type="button" className="sdk-btn primary" onClick={openHello}>
            Abrir Hello NEX
          </button>
          <button type="button" className="sdk-btn" onClick={ping}>
            Probar notificación
          </button>
        </div>
        <p className="sdk-footnote">
          Guía markdown: <code>docs/SDK.md</code> · Package: <code>packages/nex-os-sdk</code> · v0.2.0
        </p>
      </>
    );
  } else if (section === 'quick') {
    body = (
      <>
        <ol className="sdk-steps">
          <li>
            Creá <code>src/community-apps/MiApp.tsx</code> con <code>defineApp</code>
          </li>
          <li>
            Importalo en <code>src/community-apps/index.ts</code>
          </li>
          <li>
            <code>npm run dev</code> → Buscar → tu título
          </li>
        </ol>
        <Code>{`import { defineApp } from '@nex-os/sdk';

type Props = { mode?: string };

function MiApp({ mode = 'demo' }: Props) {
  return (
    <div style={{ height: '100%', padding: 24, color: '#fff' }}>
      <h1>Mi App — {mode}</h1>
    </div>
  );
}

export default defineApp<Props>({
  id: 'mi-app',
  appId: 'mi-app',
  title: 'Mi App',
  icon: <span>⚡</span>,
  component: MiApp,
  pinToTaskbar: true,
  category: 'tools',
  permissions: ['windows', 'settings'],
  defaultProps: { mode: 'demo' },
});`}</Code>
      </>
    );
  } else if (section === 'manifest') {
    body = (
      <>
        <p className="sdk-lead">Campos del manifest. Obligatorios marcados.</p>
        <table className="sdk-table">
          <thead>
            <tr>
              <th>Campo</th>
              <th>Req</th>
              <th>Para qué</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['id', '✓', 'Id de ventana'],
              ['appId', '✓', 'Clave AppRegistry'],
              ['title', '✓', 'Chrome / taskbar'],
              ['icon', '✓', 'ReactNode'],
              ['component', '✓', 'UI raíz 100% alto'],
              ['aliases', '', 'Alias (Run / Buscar)'],
              ['pinToTaskbar', '', 'Dock permanente'],
              ['category', '', 'tools | media | games | dev | social | other'],
              ['permissions', '', 'windows | settings | fs | music | …'],
              ['defaultProps', '', 'Props al abrir (tipadas)'],
            ].map(([field, req, desc]) => (
              <tr key={field}>
                <td>
                  <code>{field}</code>
                </td>
                <td>{req}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  } else if (section === 'api') {
    body = (
      <>
        <Code>{`import {
  defineApp,
  resolveRegisteredApp,
  createOpenApp,
  getAppsByCategory,
  listRegisteredApps,
  subscribeRegistry,
} from '@nex-os/sdk';`}</Code>
        <ul className="sdk-list">
          <li>
            <code>defineApp&lt;TProps&gt;</code> — registra con props tipadas
          </li>
          <li>
            <code>resolveRegisteredApp</code> — id / alias / título
          </li>
          <li>
            <code>createOpenApp</code> — helper puro para abrir desde el registry
          </li>
          <li>
            <code>getAppsByCategory</code> — filtro por categoría
          </li>
        </ul>
      </>
    );
  } else if (section === 'host') {
    body = (
      <>
        <Code>{`import {
  useOpenApp,
  useWindowManager,
  useSettings,
  useMusicPlayer,
} from '../sdk/host';

const openApp = useOpenApp();
openApp('hello'); // alias → Hello NEX
const { accentColor, addNotification } = useSettings();`}</Code>
        <p className="sdk-lead">
          Acento actual del SO: <span style={{ color: accent }}>{accent}</span>
        </p>
        <ul className="sdk-list">
          <li>
            <code>useOpenApp</code> — abrir community app por id/alias
          </li>
          <li>
            <code>useWindowManager</code> — open / close / minimize / focus / snap
          </li>
          <li>
            <code>useSettings</code> · <code>useMusicPlayer</code> · <code>useFileSystem</code>
          </li>
        </ul>
      </>
    );
  } else if (section === 'recipes') {
    body = (
      <>
        <h3 className="sdk-h3">Abrir community app</h3>
        <Code>{`const openApp = useOpenApp();
openApp('hello');
openApp('mi-app', { mode: 'pro' });`}</Code>
        <h3 className="sdk-h3">Run dialog</h3>
        <Code>{`Ctrl+Alt+R → hello | sdk | sdk-demo`}</Code>
        <h3 className="sdk-h3">Notificación</h3>
        <Code>{`addNotification('Mi App', 'Listo.');`}</Code>
        <div className="sdk-actions">
          <button type="button" className="sdk-btn primary" onClick={openHello}>
            Probar Hello NEX
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="sdk-docs" style={{ ['--sdk-accent' as string]: accent }}>
      <aside className="sdk-rail">
        <div className="sdk-brand">
          <div className="sdk-mark">NEX</div>
          <div>
            <div className="sdk-brand-title">SDK</div>
            <div className="sdk-brand-sub">@nex-os/sdk · 0.2.0</div>
          </div>
        </div>
        <nav className="sdk-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={section === s.id ? 'active' : ''}
              onClick={() => setSection(s.id)}
            >
              <span className="sdk-nav-kicker">{s.kicker}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        <a
          className="sdk-rail-link"
          href="https://github.com/shadownrx/windows/blob/main/docs/SDK.md"
          target="_blank"
          rel="noreferrer"
        >
          docs/SDK.md ↗
        </a>
      </aside>

      <main className="sdk-main">
        <header className="sdk-hero">
          <p className="sdk-eyebrow">NEX OS · Creators</p>
          <h1>{SECTIONS.find((s) => s.id === section)?.label}</h1>
          <p className="sdk-hero-sub">Creá apps. Registralas. Corren en el escritorio.</p>
        </header>
        <div className="sdk-body" key={section}>
          {body}
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .sdk-docs {
          --sdk-bg: #071018;
          --sdk-panel: #0c1824;
          --sdk-line: rgba(180, 220, 255, 0.1);
          --sdk-text: #e7f2ff;
          --sdk-muted: rgba(200, 220, 240, 0.62);
          display: flex;
          height: 100%;
          background:
            radial-gradient(ellipse 80% 50% at 100% -10%, color-mix(in srgb, var(--sdk-accent) 28%, transparent), transparent 55%),
            radial-gradient(ellipse 60% 40% at 0% 100%, rgba(20, 80, 90, 0.35), transparent 50%),
            var(--sdk-bg);
          color: var(--sdk-text);
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          overflow: hidden;
        }

        .sdk-rail {
          width: 240px;
          flex-shrink: 0;
          padding: 28px 18px;
          border-right: 1px solid var(--sdk-line);
          background: color-mix(in srgb, var(--sdk-panel) 88%, black);
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .sdk-brand { display: flex; align-items: center; gap: 12px; padding: 0 8px; }
        .sdk-mark {
          font-family: Syne, sans-serif;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: 0.08em;
          padding: 10px 11px;
          border: 1px solid color-mix(in srgb, var(--sdk-accent) 55%, white);
          color: var(--sdk-accent);
          background: color-mix(in srgb, var(--sdk-accent) 12%, transparent);
        }
        .sdk-brand-title {
          font-family: Syne, sans-serif;
          font-weight: 700;
          font-size: 22px;
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .sdk-brand-sub { font-size: 11px; color: var(--sdk-muted); margin-top: 4px; }

        .sdk-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .sdk-nav button {
          display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
          padding: 10px 12px; border: none; border-radius: 8px;
          background: transparent; color: var(--sdk-muted);
          cursor: pointer; text-align: left; transition: 0.18s ease;
          font-family: inherit; font-size: 14px; font-weight: 500;
        }
        .sdk-nav button:hover { background: rgba(255,255,255,0.04); color: var(--sdk-text); }
        .sdk-nav button.active {
          background: color-mix(in srgb, var(--sdk-accent) 14%, transparent);
          color: var(--sdk-text);
          box-shadow: inset 3px 0 0 var(--sdk-accent);
        }
        .sdk-nav-kicker {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em;
          opacity: 0.55; font-weight: 600;
        }

        .sdk-rail-link {
          font-size: 12px; color: var(--sdk-accent); text-decoration: none;
          padding: 8px; opacity: 0.85;
        }
        .sdk-rail-link:hover { opacity: 1; }

        .sdk-main {
          flex: 1; overflow-y: auto; padding: 40px 48px 56px;
        }

        .sdk-hero { margin-bottom: 28px; max-width: 640px; }
        .sdk-eyebrow {
          margin: 0 0 10px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--sdk-accent);
        }
        .sdk-hero h1 {
          margin: 0;
          font-family: Syne, sans-serif;
          font-weight: 800;
          font-size: clamp(32px, 4vw, 44px);
          letter-spacing: -0.04em;
          line-height: 1.05;
        }
        .sdk-hero-sub { margin: 10px 0 0; color: var(--sdk-muted); font-size: 15px; }

        .sdk-body {
          max-width: 720px;
          animation: sdkIn 0.35s ease both;
        }
        @keyframes sdkIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }

        .sdk-lead { font-size: 16px; line-height: 1.55; color: var(--sdk-muted); margin: 0 0 22px; }
        .sdk-lead strong { color: var(--sdk-text); font-weight: 600; }
        .sdk-h3 {
          font-family: Syne, sans-serif; font-size: 15px; margin: 22px 0 8px;
          letter-spacing: -0.02em;
        }
        .sdk-footnote { margin-top: 28px; font-size: 12px; color: var(--sdk-muted); }

        .sdk-cards {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
          margin-bottom: 22px;
        }
        .sdk-cards article {
          padding: 16px;
          border: 1px solid var(--sdk-line);
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
        }
        .sdk-card-kicker {
          display: block; font-size: 10px; letter-spacing: 0.14em;
          color: var(--sdk-accent); margin-bottom: 10px; font-weight: 600;
        }
        .sdk-cards h3 {
          margin: 0 0 6px; font-family: Syne, sans-serif;
          font-size: 15px; letter-spacing: -0.02em;
        }
        .sdk-cards p { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--sdk-muted); }

        .sdk-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 4px; }
        .sdk-btn {
          border: 1px solid var(--sdk-line);
          background: rgba(255,255,255,0.03);
          color: var(--sdk-text);
          padding: 10px 16px; border-radius: 8px;
          font-family: inherit; font-size: 13px; font-weight: 500;
          cursor: pointer; transition: 0.15s ease;
        }
        .sdk-btn:hover { border-color: color-mix(in srgb, var(--sdk-accent) 50%, white); }
        .sdk-btn.primary {
          background: color-mix(in srgb, var(--sdk-accent) 22%, transparent);
          border-color: color-mix(in srgb, var(--sdk-accent) 55%, white);
          color: #f0fffc;
        }

        .sdk-code {
          margin: 0 0 16px;
          padding: 16px 18px;
          overflow-x: auto;
          background: #050b12;
          border: 1px solid var(--sdk-line);
          border-radius: 10px;
          font-family: 'IBM Plex Mono', Consolas, monospace;
          font-size: 12px;
          line-height: 1.55;
          color: #c8e6ff;
        }
        .sdk-docs code {
          font-family: 'IBM Plex Mono', Consolas, monospace;
          font-size: 0.92em;
          background: rgba(255,255,255,0.06);
          padding: 1px 5px; border-radius: 4px;
        }
        .sdk-code code { background: none; padding: 0; }

        .sdk-steps {
          margin: 0 0 18px; padding-left: 18px;
          color: var(--sdk-muted); line-height: 1.7; font-size: 14px;
        }
        .sdk-list {
          margin: 0; padding-left: 18px;
          color: var(--sdk-muted); line-height: 1.75; font-size: 14px;
        }

        .sdk-table {
          width: 100%; border-collapse: collapse; font-size: 13px;
        }
        .sdk-table th, .sdk-table td {
          text-align: left; padding: 10px 12px;
          border-bottom: 1px solid var(--sdk-line);
        }
        .sdk-table th { color: var(--sdk-muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
        .sdk-table td:nth-child(2) { width: 40px; color: var(--sdk-accent); }

        @media (max-width: 820px) {
          .sdk-docs { flex-direction: column; }
          .sdk-rail { width: 100%; border-right: none; border-bottom: 1px solid var(--sdk-line); }
          .sdk-nav { flex-direction: row; flex-wrap: wrap; }
          .sdk-cards { grid-template-columns: 1fr; }
          .sdk-main { padding: 28px 22px 40px; }
        }
      `}</style>
    </div>
  );
}
