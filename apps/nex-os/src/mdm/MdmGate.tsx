import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import WifiScreen from './WifiScreen';
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
  'mediaplayer',
  'media-player',
  'photos',
  'image-viewer',
  'calculator',
  'clock',
  'calendar',
]);

const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack']);

/** Íconos de línea, estilo NEX (minimalistas, un solo trazo). Se eligen por id de app, paquete Android o nombre. */
const ICON_PATHS: Record<string, string> = {
  music: 'M9 18V5l12-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  image: 'M3 5h18v14H3z M3 15l5-5 4 4 3-3 6 6 M8.5 9.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z',
  clock: 'M12 7v5l3 2 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  calendar: 'M3 6h18v15H3z M3 10h18 M8 3v4 M16 3v4',
  calc: 'M5 3h14v18H5z M8 7h8 M8 12h2 M14 12h2 M8 16h2 M14 16h2',
  game: 'M7 10h4 M9 8v4 M15.5 10.5h.01 M17.5 12.5h.01 M4 15l1.5-6A3 3 0 0 1 8.4 7h7.2a3 3 0 0 1 2.9 2L20 15a2.5 2.5 0 0 1-4.6 1.3L14 14H10l-1.4 2.3A2.5 2.5 0 0 1 4 15z',
  play: 'M6 4l14 8-14 8z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4 12H2 M22 12h-2 M5.6 5.6l1.4 1.4 M17 17l1.4 1.4 M18.4 5.6L17 7 M7 17l-1.4 1.4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z',
  store: 'M5 8h14l-1 12H6z M9 8a3 3 0 0 1 6 0 M9 12v0 M15 12v0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
};

function iconKey(app: { id: string; name: string }): string | null {
  const id = app.id.replace(/^android:/, '').toLowerCase();
  const n = app.name.toLowerCase();
  const has = (s: string) => id.includes(s) || n.includes(s);
  if (has('vending') || has('play store') || has('appstore') || has('store') || has('tienda')) return 'store';
  if (has('nexreproductor') || has('spotify') || has('music') || has('audio') || has('reproductor')) return 'music';
  if (has('photo') || has('foto') || has('image') || has('galer')) return 'image';
  if (has('clock') || has('reloj')) return 'clock';
  if (has('calendar') || has('calendario')) return 'calendar';
  if (has('calcul')) return 'calc';
  if (has('game') || has('juego') || has('tetris')) return 'game';
  if (has('youtube') || has('netflix') || has('disney') || has('prime') || has('video') || has('tv') || has('cine')) return 'play';
  if (has('wiki') || has('browser') || has('web') || has('navegad')) return 'globe';
  if (has('ajuste') || has('setting') || has('config')) return 'gear';
  return null;
}

const ICON_SIZE = { sm: 'h-7 w-7', md: 'h-10 w-10', lg: 'h-20 w-20' } as const;
const LETTER_SIZE = { sm: 'text-3xl', md: 'text-4xl', lg: 'text-7xl' } as const;

function AppIcon({ app, size = 'md' }: { app: { id: string; name: string }; size?: keyof typeof ICON_SIZE }) {
  const key = iconKey(app);
  if (!key) {
    return <span className={LETTER_SIZE[size]}>{app.name.charAt(0).toUpperCase()}</span>;
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={ICON_SIZE[size]} aria-hidden>
      {ICON_PATHS[key].split(' M').map((seg, i) => (
        <path key={i} d={(i === 0 ? '' : 'M') + seg} />
      ))}
    </svg>
  );
}

/**
 * Clima mostrado en el inicio. Datos de demostración: la fuente real (API + ciudad del equipo)
 * y el permiso de dominio en modo cerrado quedan pendientes de definir.
 */
const WEATHER = { temp: '18°', cond: 'Parcial nublado' };

function WeatherChip() {
  return (
    <div className="flex items-center space-x-3">
      <svg viewBox="0 0 24 24" fill="none" stroke="#ffd27a" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9" aria-hidden>
        {ICON_PATHS.sun.split(' M').map((seg, i) => (
          <path key={i} d={(i === 0 ? '' : 'M') + seg} />
        ))}
      </svg>
      <span className="text-4xl font-semibold tabular-nums">{WEATHER.temp}</span>
      <span className="text-white/55 text-xl">{WEATHER.cond}</span>
    </div>
  );
}

/** Saludo según la hora del equipo. */
function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

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
      {state.companyName ?? 'NEX TV'}
    </div>
  );
}

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="w-screen h-screen bg-[#05070c] text-white flex flex-col items-center justify-center space-y-10 p-12 text-center select-none">
      {children}
    </div>
  );
}

function WifiEntry({ state, label = 'Configurar Wi-Fi' }: { state: MdmState; label?: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); button.current?.focus(); }, []);
  useEffect(() => { if (label === 'Configurar Wi-Fi') button.current?.focus(); }, [label]);
  return <>
    <button ref={button} data-index="4" onClick={() => setOpen(true)} className="text-xl rounded-xl px-5 py-3 mt-4 border border-white/20 outline-none focus:bg-white/20 focus:ring-2 focus:ring-sky-300">{label}</button>
    {open && <WifiScreen token={state.wifiToken} onClose={close} />}
  </>;
}

/** Activación de NEX con root (sin ADB): PIN de técnico y luego `dpm` en el equipo. */
function RootSetup({ state }: { state: MdmState }) {
  const button = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<'idle' | 'pin' | 'busy'>('idle');
  const [message, setMessage] = useState('');
  const cancel = useCallback(() => { setStep('idle'); window.setTimeout(() => button.current?.focus(), 0); }, []);
  const activate = useCallback(async () => {
    setStep('busy');
    setMessage('Activando… si aparece un cartel de root, aceptalo.');
    try {
      const res = await fetch(`/agent/setup/root?token=${encodeURIComponent(state.wifiToken ?? '')}`, { cache: 'no-store' });
      const data = await res.json();
      // Si sale bien, NEX TV se reabre solo en modo protegido.
      setMessage(data.ok ? 'NEX activado. Reiniciando la pantalla…' : data.error || 'No se pudo activar NEX.');
    } catch {
      setMessage('No se pudo activar NEX.');
    }
    setStep('idle');
    window.setTimeout(() => button.current?.focus(), 0);
  }, [state.wifiToken]);

  if (step === 'pin') {
    return <div className="fixed inset-0 z-50"><TechPin onOk={() => void activate()} onCancel={cancel} /></div>;
  }
  return <>
    <button ref={button} disabled={step === 'busy'} onClick={() => { setMessage(''); setStep('pin'); }} className="text-xl rounded-xl px-5 py-3 border border-amber-300/40 text-amber-100 outline-none focus:bg-white/20 focus:ring-2 focus:ring-sky-300">
      Activar NEX (técnico)
    </button>
    {message && <p role="status" className="text-lg text-amber-100">{message}</p>}
  </>;
}

/** Acciones de las pantallas sin escritorio: activar NEX (si falta) y Wi-Fi, con flechas arriba/abajo. */
function SetupActions({ state }: { state: MdmState }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const btns = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)') ?? []);
    const cur = btns.findIndex((b) => b === document.activeElement);
    if (cur < 0) return;
    e.preventDefault();
    btns[Math.min(Math.max(cur + (e.key === 'ArrowDown' ? 1 : -1), 0), btns.length - 1)]?.focus();
  };
  return (
    <div ref={ref} onKeyDown={move} className="flex flex-col items-center space-y-3">
      {!state.owner && <p className="text-white/50">Instalación incompleta: NEX todavía no protege este equipo.</p>}
      {!state.owner && state.root && <RootSetup state={state} />}
      <WifiEntry state={state} />
    </div>
  );
}

function StartingScreen({ state }: { state: MdmState }) {
  return (
    <FullScreen>
      <Brand state={state} />
      <div className="h-10 w-10 rounded-full border-4 border-white/15 border-t-white animate-spin" />
      <p className="text-white/60 text-lg">Iniciando el equipo…</p>
      <SetupActions state={state} />
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
      <div className="flex flex-col items-center space-y-4">
        <p className="text-2xl text-white/80">Vinculá este equipo desde el panel de tu empresa</p>
        <div className="flex items-center space-x-10">
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
      <SetupActions state={state} />
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
      <div className="flex flex-col items-center space-y-4 max-w-3xl">
        <div className="text-6xl" aria-hidden>🔒</div>
        <h1 className="text-4xl font-semibold">{title}</h1>
        {message && <p className="text-2xl text-white/80 leading-relaxed">{message}</p>}
        {detail && <p className="text-lg text-white/50">{detail}</p>}
      </div>
      {state.deviceName && <p className="text-white/30 text-sm">Equipo: {state.deviceName}</p>}
      <WifiEntry state={state} />
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

/** Versión de NEX TV mostrada en Ajustes (se define al compilar la imagen). */
const NEX_VERSION = (import.meta.env.VITE_NEX_VERSION as string | undefined) ?? '0.1';

/** PIN del acceso técnico (se define al compilar; por defecto, solo para demo). */
const TECH_PIN = (import.meta.env.VITE_NEX_TECH_PIN as string | undefined) ?? '2468';

type Appearance = { dimWallpaper: boolean; bigTiles: boolean };
const APPEARANCE_KEY = 'nex.tv.appearance';

/** Preferencias visuales por equipo. localStorage es solo una conveniencia: si falla, usa los valores por defecto. */
function useAppearance(): [Appearance, (p: Partial<Appearance>) => void] {
  const [pref, setPref] = useState<Appearance>(() => {
    try {
      return { dimWallpaper: false, bigTiles: false, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}') };
    } catch {
      return { dimWallpaper: false, bigTiles: false };
    }
  });
  const update = useCallback((p: Partial<Appearance>) => {
    setPref((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
      } catch {
        // Sin almacenamiento: el cambio vale solo para esta sesión.
      }
      return next;
    });
  }, []);
  return [pref, update];
}

function SettingsRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/10">
      <span className="text-white/60 text-xl">{label}</span>
      <span className="text-xl">{value}</span>
    </div>
  );
}

function Toggle({ on, index, label, onToggle }: { on: boolean; index: number; label: string; onToggle: () => void }) {
  return (
    <button
      data-index={index}
      onClick={onToggle}
      className="w-full flex items-center justify-between py-4 border-b border-white/10 outline-none rounded-lg px-3 -mx-3 focus:bg-white/10"
    >
      <span className="text-xl">{label}</span>
      <span className={`h-7 w-12 rounded-full flex items-center px-1 transition-colors ${on ? 'bg-sky-400' : 'bg-white/20'}`}>
        <span className={`h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

/** Teclado numérico para el acceso técnico. El PIN no viaja a ningún lado; es una barrera local. */
function TechPin({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState('');
  const [err, setErr] = useState(false);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✕'];

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[data-index="0"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (BACK_KEYS.has(e.key)) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const press = (d: string) => {
    if (d === '✕') return onCancel();
    if (d === '⌫') return setVal((v) => v.slice(0, -1));
    setErr(false);
    const next = (val + d).slice(0, 4);
    setVal(next);
    if (next.length === 4) {
      if (next === TECH_PIN) {
        window.setTimeout(onOk, 150);
      } else {
        setErr(true);
        window.setTimeout(() => setVal(''), 500);
      }
    }
  };

  const onKeyNav = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const cur = Number((document.activeElement as HTMLElement | null)?.dataset.index ?? -1);
    if (cur < 0) return;
    const d: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
    const step = d[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const n = Math.min(Math.max(cur + step, 0), keys.length - 1);
    ref.current?.querySelector<HTMLButtonElement>(`button[data-index="${n}"]`)?.focus();
  };

  return (
    <div className="w-screen h-screen bg-[#05070c] text-white flex flex-col items-center justify-center space-y-8 select-none">
      <div className="text-center">
        <div className="text-sky-300 text-sm uppercase tracking-[0.3em] mb-2">Acceso técnico</div>
        <div className="text-2xl text-white/70">Ingresá el PIN del instalador</div>
      </div>
      <div className={`flex space-x-4 ${err ? 'animate-pulse' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-6 w-6 rounded-full border-2 ${err ? 'border-red-400' : 'border-white/40'} ${i < val.length ? (err ? 'bg-red-400' : 'bg-white') : ''}`}
          />
        ))}
      </div>
      <div ref={ref} onKeyDown={onKeyNav} className="grid grid-cols-3 gap-4">
        {keys.map((k, i) => (
          <button
            key={k}
            data-index={i}
            onClick={() => press(k)}
            className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 text-3xl font-light outline-none focus:bg-white/20 focus:border-white/70 hover:bg-white/10"
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Panel técnico (tras el PIN): diagnóstico del equipo y acciones de servicio. */
function TechPanel({ state, onClose }: { state: MdmState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[data-index="0"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (BACK_KEYS.has(e.key)) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onKeyNav = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const btns = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button[data-index]') ?? []);
    const cur = btns.findIndex((b) => b === document.activeElement);
    btns[Math.min(Math.max(cur + (e.key === 'ArrowDown' ? 1 : -1), 0), btns.length - 1)]?.focus();
  };

  return (
    <div ref={ref} onKeyDown={onKeyNav} className="w-screen h-screen bg-gradient-to-b from-[#0b1020] to-[#05070c] text-white flex flex-col select-none px-16 py-10 overflow-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <div className="text-sky-300 text-sm uppercase tracking-[0.3em]">Modo técnico</div>
          <h1 className="text-4xl font-semibold">Diagnóstico del equipo</h1>
        </div>
        <button data-index="0" onClick={onClose} className="px-5 py-2 rounded-lg bg-white/10 outline-none focus:bg-white/25 text-lg">
          ← Volver
        </button>
      </header>

      <div className="grid grid-cols-2 gap-x-16 gap-y-10 max-w-6xl">
        <section>
          <h2 className="text-sky-300 text-lg uppercase tracking-widest mb-2">Equipo</h2>
          <SettingsRow label="Nombre" value={state.deviceName ?? 'Sin nombre'} />
          <SettingsRow label="Proveedor" value={state.companyName ?? 'NEX'} />
          <SettingsRow label="NEX TV" value={`v${NEX_VERSION}`} />
          <SettingsRow label="Modo" value={<span className="text-emerald-300">Activo</span>} />
          <SettingsRow label="Conexión" value={<span className={navigator.onLine ? 'text-emerald-300' : 'text-amber-300'}>{navigator.onLine ? 'En línea' : 'Sin conexión'}</span>} />
        </section>

        <section className="flex flex-col space-y-4">
          <h2 className="text-sky-300 text-lg uppercase tracking-widest mb-2">Servicio</h2>
          <button data-index="1" onClick={() => window.location.reload()} className="w-full text-left rounded-xl bg-white/5 border border-white/10 px-5 py-4 text-xl outline-none focus:bg-white/15 focus:border-white/60">
            Reiniciar la interfaz
          </button>
          <p className="text-white/40 text-base leading-relaxed">
            Desvincular el equipo o reiniciar el sistema se hacen desde el panel de tu empresa. El soporte de NEX también
            puede ayudarte de forma remota.
          </p>
        </section>
      </div>
    </div>
  );
}

function SettingsScreen({ state, appearance, setAppearance, onClose }: {
  state: MdmState;
  appearance: Appearance;
  setAppearance: (p: Partial<Appearance>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [tech, setTech] = useState<'none' | 'pin' | 'panel'>('none');

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[data-index="0"]')?.focus();
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const btns = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button[data-index]') ?? []);
      const cur = btns.findIndex((b) => b === document.activeElement);
      const next = Math.min(Math.max(cur + (e.key === 'ArrowDown' ? 1 : -1), 0), btns.length - 1);
      btns[next]?.focus();
    }
  };

  if (tech === 'pin') return <TechPin onOk={() => setTech('panel')} onCancel={() => setTech('none')} />;
  if (tech === 'panel') return <TechPanel state={state} onClose={() => setTech('none')} />;

  return (
    <div ref={ref} onKeyDown={onKey} className="w-screen h-screen bg-gradient-to-b from-[#0b1020] to-[#05070c] text-white flex flex-col select-none px-16 py-10 overflow-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-semibold">Ajustes</h1>
        <button data-index="0" onClick={onClose} className="px-5 py-2 rounded-lg bg-white/10 outline-none focus:bg-white/25 text-lg">
          ← Volver
        </button>
      </header>

      <div className="grid grid-cols-2 gap-x-16 gap-y-10 max-w-6xl">
        <section>
          <h2 className="text-sky-300 text-lg uppercase tracking-widest mb-2">Equipo</h2>
          <SettingsRow label="Nombre" value={state.deviceName ?? 'Sin nombre'} />
          <SettingsRow label="Estado" value={<span className="text-emerald-300">Vinculado</span>} />
          <SettingsRow label="Proveedor" value={state.companyName ?? 'NEX'} />
          <SettingsRow label="NEX TV" value={`v${NEX_VERSION}`} />
        </section>

        <section>
          <h2 className="text-sky-300 text-lg uppercase tracking-widest mb-2">Red</h2>
          <SettingsRow
            label="Conexión"
            value={<span className={online ? 'text-emerald-300' : 'text-amber-300'}>{online ? 'Conectado' : 'Sin conexión'}</span>}
          />
          <WifiEntry state={state} label="Cambiar red Wi-Fi" />
        </section>

        <section className="col-span-2">
          <h2 className="text-sky-300 text-lg uppercase tracking-widest mb-2">Apariencia</h2>
          <Toggle index={1} label="Atenuar el fondo" on={appearance.dimWallpaper} onToggle={() => setAppearance({ dimWallpaper: !appearance.dimWallpaper })} />
          <Toggle index={2} label="Mosaicos más grandes" on={appearance.bigTiles} onToggle={() => setAppearance({ bigTiles: !appearance.bigTiles })} />
        </section>
      </div>

      <div className="mt-auto pt-10 flex justify-end">
        <button data-index="3" onClick={() => setTech('pin')} className="text-white/35 text-sm rounded-lg px-3 py-2 outline-none focus:bg-white/10 focus:text-white/80">
          Acceso técnico
        </button>
      </div>
    </div>
  );
}

const SETTINGS_ITEM: MdmApp = { id: 'ajustes', name: 'Ajustes', kind: 'internal', launch_url: null };

function TvHome({ state }: { state: MdmState }) {
  const clock = useClock();
  const [selectedApp, setOpenApp] = useState<MdmApp | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [appearance, setAppearance] = useAppearance();
  const [sel, setSel] = useState(0);
  const dockRef = useRef<HTMLDivElement>(null);
  const apps = useMemo(
    () => state.apps.filter((a) => a.kind === 'web' || TV_SAFE_INTERNAL.has(a.id)),
    [state.apps],
  );
  // El Ajustes va al final del dock, como una app más.
  const dock = useMemo(() => [...apps, SETTINGS_ITEM], [apps]);
  const cur = dock[Math.min(sel, dock.length - 1)];
  const greeting = greetingFor(new Date());
  const name = state.deviceName;

  // Si la empresa desactiva la app abierta, se cierra.
  const openApp = selectedApp && apps.some((a) => a.id === selectedApp.id) ? selectedApp : null;

  useEffect(() => {
    if (!openApp && !showSettings) dockRef.current?.querySelector<HTMLButtonElement>('button[data-index="0"]')?.focus();
  }, [openApp, showSettings, apps]);

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

  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (BACK_KEYS.has(e.key)) {
        e.preventDefault();
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSettings]);

  const activate = useCallback((app: MdmApp) => {
    if (app.id === SETTINGS_ITEM.id) {
      setShowSettings(true);
    } else if (app.kind === 'web' && app.launch_url) {
      // Navegación de nivel superior: los servicios de streaming no se dejan embeber.
      // Para volver, el botón "atrás" del control remoto. Chromium filtra los dominios.
      window.location.assign(app.launch_url);
    } else {
      setOpenApp(app);
    }
  }, []);

  const onDockKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(Math.max(sel + step, 0), dock.length - 1);
    dockRef.current?.querySelector<HTMLButtonElement>(`button[data-index="${next}"]`)?.focus();
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

  if (showSettings) {
    return <SettingsScreen state={state} appearance={appearance} setAppearance={setAppearance} onClose={() => setShowSettings(false)} />;
  }

  return (
    <div className={`w-screen h-screen ${appearance.dimWallpaper ? 'bg-[#05070c]' : 'bg-gradient-to-b from-[#0b1020] to-[#05070c]'} text-white flex flex-col select-none`}>
      <header className="flex items-center justify-between px-16 pt-10">
        <Brand state={state} size="sm" />
        <span className="text-3xl font-light tabular-nums">{clock}</span>
      </header>

      <div className="px-16 mt-3 flex items-end justify-between space-x-6">
        <div>
          {name ? (
            <>
              <div className="text-sky-300 text-lg uppercase tracking-[0.25em]">{greeting}</div>
              <div className="text-5xl font-semibold">Hola, {name}</div>
            </>
          ) : (
            <div className="text-5xl font-semibold">{greeting}</div>
          )}
        </div>
        <WeatherChip />
      </div>

      {state.paymentDue && (
        <div className="mx-16 mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 px-6 py-4 text-amber-100 text-lg">
          Tu pago vence el {formatDue(state.paymentDue)}. Regularizalo para evitar el bloqueo del equipo.
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center space-y-6">
        <div
          className="h-44 w-44 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_35%_30%,rgba(139,92,255,.6),rgba(71,191,255,.22))]"
          aria-hidden
        >
          <AppIcon app={cur} size="lg" />
        </div>
        <div className="text-4xl font-semibold">{cur.name}</div>
      </main>

      <div
        ref={dockRef}
        onKeyDown={onDockKey}
        className="flex items-center justify-center space-x-9 pb-12 px-16 flex-wrap"
        role="menubar"
      >
        {dock.map((app, i) => (
          <button
            key={app.id}
            data-index={i}
            role="menuitem"
            aria-label={app.name}
            onFocus={() => setSel(i)}
            onClick={() => activate(app)}
            className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center outline-none transition-transform focus:scale-110 focus:bg-white/20 focus:border-white/70 hover:bg-white/10"
          >
            <AppIcon app={app} size="sm" />
          </button>
        ))}
      </div>
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
