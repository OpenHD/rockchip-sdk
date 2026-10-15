import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import qrcode from 'qrcode-generator';
import AppRegistry from '../components/AppRegistry';
import { useAgentState, type MdmApp, type MdmState } from './agentState';

/**
 * Interfaz del TV box gestionado. Muestra solo lo que nex-agent publica:
 * espera, vinculación, bloqueo o el home con las apps habilitadas por la empresa.
 * El bloqueo real lo aplican el agente y las políticas de Chromium; esta capa es la cara visible.
 */

/** Apps internas que pueden mostrarse en modo TV. Terminal, navegador libre, NEX Code, ajustes, etc. nunca. */
const TV_SAFE_INTERNAL = new Set([
  'nexreproductor',
  'spotify',
  'mediaplayer',
  'media-player',
  'photos',
  'image-viewer',
  'calculator',
  'clock',
  'calendar',
  'tetris',
  'nex-tetris',
  'games',
  'nex-games',
]);

const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack']);

function Brand({ state, size = 'lg' }: { state: MdmState; size?: 'lg' | 'sm' }) {
  // Se recuerda qué logo falló: si la empresa sube otro, se vuelve a intentar.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const height = size === 'lg' ? 'h-24' : 'h-10';

  if (state.logo && state.logo !== brokenSrc) {
    return (
      <img
        src={state.logo}
        alt={state.companyName ?? 'Logo'}
        className={`${height} max-w-[60vw] object-contain`}
        onError={() => setBrokenSrc(state.logo)}
      />
    );
  }
  return (
    <div className={`${size === 'lg' ? 'text-5xl' : 'text-xl'} font-bold tracking-widest`}>
      {state.companyName ?? 'NEX OS'}
    </div>
  );
}

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="w-screen h-screen bg-[#05070c] text-white flex flex-col items-center justify-center gap-10 p-12 text-center select-none">
      {children}
    </div>
  );
}

function StartingScreen({ state }: { state: MdmState }) {
  return (
    <FullScreen>
      <Brand state={state} />
      <div className="h-10 w-10 rounded-full border-4 border-white/15 border-t-white animate-spin" />
      <p className="text-white/60 text-lg">Iniciando el equipo…</p>
    </FullScreen>
  );
}

function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** URL del panel para el QR de vinculación (definida al compilar la imagen). */
const ADMIN_URL = (() => {
  try {
    const url = new URL(import.meta.env.VITE_NEX_ADMIN_URL ?? '');
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
})();

/** QR generado en el equipo: el código de vinculación no pasa por ningún servicio externo. */
function claimQr(code: string): string | null {
  if (!ADMIN_URL) return null;
  const url = new URL(ADMIN_URL);
  url.searchParams.set('claim', code);
  const qr = qrcode(0, 'M');
  qr.addData(url.href);
  qr.make();
  return qr.createDataURL(8, 2);
}

function PairingScreen({ state }: { state: MdmState }) {
  const expires = state.pairingExpiresAt ? new Date(state.pairingExpiresAt) : null;
  const qr = useMemo(() => (state.pairingCode ? claimQr(state.pairingCode) : null), [state.pairingCode]);
  return (
    <FullScreen>
      <Brand state={state} />
      <div className="flex flex-col items-center gap-4">
        <p className="text-2xl text-white/80">Vinculá este equipo desde el panel de tu empresa</p>
        <div className="flex items-center gap-10">
          {qr && <img src={qr} alt="QR de vinculación" className="h-56 w-56 rounded-xl bg-white p-2 [image-rendering:pixelated]" />}
          <div className="font-mono text-7xl tracking-[0.2em] bg-white/5 border border-white/15 rounded-2xl px-12 py-8">
            {state.pairingCode ? formatCode(state.pairingCode) : '········'}
          </div>
        </div>
        {qr && <p className="text-white/60">Escaneá el QR con el celular (con el panel abierto) o ingresá el código.</p>}
        {expires && !Number.isNaN(expires.getTime()) && (
          <p className="text-white/50">
            El código se renueva solo · vence a las{' '}
            {expires.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </FullScreen>
  );
}

const LOCK_TITLES: Record<string, string> = {
  manual: 'Equipo bloqueado',
  payment: 'Pago vencido',
  clock: 'Hora del equipo inválida',
  offline: 'Equipo sin conexión',
};

function LockScreen({ state }: { state: MdmState }) {
  const title = LOCK_TITLES[state.lockKind ?? 'manual'];
  // Bloqueo manual: mensaje de la empresa + motivo. El resto trae su propio mensaje.
  const message = state.lockKind === 'manual' ? state.lockMessage : state.lockReason;
  const detail = state.lockKind === 'manual' ? state.lockReason : null;
  return (
    <FullScreen>
      <Brand state={state} />
      <div className="flex flex-col items-center gap-4 max-w-3xl">
        <div className="text-6xl" aria-hidden>🔒</div>
        <h1 className="text-4xl font-semibold">{title}</h1>
        {message && <p className="text-2xl text-white/80 leading-relaxed">{message}</p>}
        {detail && <p className="text-lg text-white/50">{detail}</p>}
      </div>
      {state.deviceName && <p className="text-white/30 text-sm">Equipo: {state.deviceName}</p>}
    </FullScreen>
  );
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatDue(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

function TvHome({ state }: { state: MdmState }) {
  const clock = useClock();
  const [selectedApp, setOpenApp] = useState<MdmApp | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const apps = useMemo(
    () => state.apps.filter((a) => a.kind === 'web' || TV_SAFE_INTERNAL.has(a.id)),
    [state.apps],
  );
  const columns = 4;

  // Si la empresa desactiva la app abierta, se cierra.
  const openApp = selectedApp && apps.some((a) => a.id === selectedApp.id) ? selectedApp : null;

  useEffect(() => {
    if (!openApp) gridRef.current?.querySelector<HTMLButtonElement>('button[data-index="0"]')?.focus();
  }, [openApp, apps]);

  useEffect(() => {
    if (!openApp) return;
    const onKey = (e: KeyboardEvent) => {
      if (BACK_KEYS.has(e.key)) {
        e.preventDefault();
        setOpenApp(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openApp]);

  const launch = useCallback((app: MdmApp) => {
    if (app.kind === 'web' && app.launch_url) {
      // Navegación de nivel superior: los servicios de streaming no se dejan embeber.
      // Para volver, el botón "atrás" del control remoto. Chromium filtra los dominios.
      window.location.assign(app.launch_url);
    } else {
      setOpenApp(app);
    }
  }, []);

  const onGridKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = Number((document.activeElement as HTMLElement | null)?.dataset.index ?? -1);
    if (current < 0) return;
    const delta: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    const step = delta[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = Math.min(Math.max(current + step, 0), apps.length - 1);
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-index="${next}"]`)?.focus();
  };

  if (openApp) {
    return (
      <div className="w-screen h-screen bg-black text-white flex flex-col">
        <div className="h-12 flex items-center justify-between px-6 bg-white/5 text-sm">
          <span>{openApp.name}</span>
          <button className="px-4 py-1 rounded bg-white/10 focus:bg-white/25 outline-none" onClick={() => setOpenApp(null)}>
            ← Volver
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <AppRegistry appId={openApp.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-[#0b1020] to-[#05070c] text-white flex flex-col select-none">
      <header className="flex items-center justify-between px-16 pt-10">
        <Brand state={state} size="sm" />
        <span className="text-3xl font-light tabular-nums">{clock}</span>
      </header>

      {state.paymentDue && (
        <div className="mx-16 mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 px-6 py-4 text-amber-100 text-lg">
          Tu pago vence el {formatDue(state.paymentDue)}. Regularizalo para evitar el bloqueo del equipo.
        </div>
      )}

      <main className="flex-1 flex items-center justify-center px-16">
        {apps.length === 0 ? (
          <p className="text-white/50 text-xl">Tu proveedor todavía no habilitó aplicaciones en este equipo.</p>
        ) : (
          <div ref={gridRef} onKeyDown={onGridKey} className="grid grid-cols-4 gap-8 w-full max-w-6xl">
            {apps.map((app, i) => (
              <button
                key={app.id}
                data-index={i}
                onClick={() => launch(app)}
                className="aspect-video rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3 text-2xl font-semibold outline-none transition-transform focus:scale-105 focus:bg-white/15 focus:border-white/60 hover:bg-white/10"
              >
                <span className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center text-3xl" aria-hidden>
                  {app.name.charAt(0).toUpperCase()}
                </span>
                {app.name}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const MdmGate: React.FC = () => {
  const state = useAgentState();

  switch (state.mode) {
    case 'unpaired':
      return <PairingScreen state={state} />;
    case 'locked':
      return <LockScreen state={state} />;
    case 'active':
      return <TvHome state={state} />;
    default:
      return <StartingScreen state={state} />;
  }
};

export default MdmGate;
