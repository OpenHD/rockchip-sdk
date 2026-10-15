import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import qrcode from 'qrcode-generator';
import { KeyRound, Wifi } from 'lucide-react';
import AppRegistry from '../components/AppRegistry';
import { useAgentState, type MdmApp, type MdmState, type MdmUpdate } from './agentState';
import { BACK_KEYS, useDpad } from './dpad';
import { tvButton } from './styles';
import UnlockCodeScreen from './UnlockCodeScreen';
import WifiScreen from './WifiScreen';

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

/** Pantalla completa navegable con el control remoto (flechas entre sus botones). */
function FullScreen({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useDpad(rootRef);
  return (
    <div ref={rootRef} className="w-screen h-screen bg-[#05070c] text-white flex flex-col items-center justify-center gap-10 p-12 text-center select-none">
      {children}
    </div>
  );
}

function WifiButton({ onClick, autoFocus, label = 'Configurar Wi-Fi' }: { onClick: () => void; autoFocus?: boolean; label?: string }) {
  return (
    <button autoFocus={autoFocus} className={tvButton} onClick={onClick}>
      <Wifi className="h-6 w-6" aria-hidden /> {label}
    </button>
  );
}

function StartingScreen({ state, onWifi }: { state: MdmState; onWifi: () => void }) {
  return (
    <FullScreen>
      <Brand state={state} />
      <div className="h-10 w-10 rounded-full border-4 border-white/15 border-t-white animate-spin" />
      <p className="text-white/60 text-lg">Iniciando el equipo…</p>
      <WifiButton onClick={onWifi} autoFocus />
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

function PairingScreen({ state, onWifi }: { state: MdmState; onWifi: () => void }) {
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
      <WifiButton onClick={onWifi} autoFocus />
    </FullScreen>
  );
}

const LOCK_TITLES: Record<string, string> = {
  manual: 'Equipo bloqueado',
  payment: 'Pago vencido',
  clock: 'Hora del equipo inválida',
  offline: 'Equipo sin conexión',
};

function LockScreen({ state, onWifi }: { state: MdmState; onWifi: () => void }) {
  const [codeOpen, setCodeOpen] = useState(false);
  // Con el reloj inválido el código (atado al día) no se puede verificar: no se ofrece.
  const canUseCode = state.lockKind !== 'clock';
  if (codeOpen && canUseCode) return <UnlockCodeScreen unlock={state.unlock} onClose={() => setCodeOpen(false)} />;
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
      <div className="flex flex-wrap items-center justify-center gap-4">
        {canUseCode && (
          <button autoFocus className={tvButton} onClick={() => setCodeOpen(true)}>
            <KeyRound className="h-6 w-6" aria-hidden /> Tengo un código de desbloqueo
          </button>
        )}
        <WifiButton onClick={onWifi} autoFocus={!canUseCode} />
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

/** URL de lanzamiento: con atestación si la app la pide y el agente tiene una vigente. */
function launchUrl(app: MdmApp, attestation: string | null): string | null {
  if (!app.launch_url) return null;
  if (!app.pass_attestation || !attestation) return app.launch_url;
  // Va en el fragmento: no viaja en la petición HTTP ni queda en logs del servidor.
  const sep = app.launch_url.includes('#') ? '&' : '#';
  return `${app.launch_url}${sep}nex_attestation=${encodeURIComponent(attestation)}`;
}

function TvHome({ state, onWifi }: { state: MdmState; onWifi: () => void }) {
  const clock = useClock();
  const [selectedApp, setOpenApp] = useState<MdmApp | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const apps = useMemo(
    () => state.apps.filter((a) => a.kind === 'web' || TV_SAFE_INTERNAL.has(a.id)),
    [state.apps],
  );

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

  const attestation = state.attestation;
  const launch = useCallback((app: MdmApp) => {
    const url = app.kind === 'web' ? launchUrl(app, attestation) : null;
    if (url) {
      // Navegación de nivel superior: los servicios de streaming no se dejan embeber.
      // Para volver, el botón "atrás" del control remoto. Chromium filtra los dominios.
      window.location.assign(url);
    } else {
      setOpenApp(app);
    }
  }, [attestation]);

  // Flechas entre la grilla y el botón de Wi-Fi. Dentro de una app el home no está montado
  // (rootRef queda en null) y las flechas son de la app.
  useDpad(rootRef);

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
    <div ref={rootRef} className="w-screen h-screen bg-gradient-to-b from-[#0b1020] to-[#05070c] text-white flex flex-col select-none">
      <header className="flex items-center justify-between px-16 pt-10">
        <Brand state={state} size="sm" />
        <div className="flex items-center gap-6">
          <button
            onClick={onWifi}
            aria-label="Wi-Fi"
            className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center outline-none transition focus:bg-white focus:text-black focus:ring-4 focus:ring-sky-400/70"
          >
            <Wifi className="h-6 w-6" aria-hidden />
          </button>
          <span className="text-3xl font-light tabular-nums">{clock}</span>
        </div>
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
          <div ref={gridRef} className="grid grid-cols-4 gap-8 w-full max-w-6xl">
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

const UPDATE_TEXT: Record<MdmUpdate['state'], string> = {
  downloading: 'Descargando actualización del sistema…',
  verifying: 'Verificando actualización del sistema…',
  installing: 'Instalando actualización del sistema… No apagues el equipo.',
  failed: 'No se pudo actualizar el sistema. Se va a reintentar.',
};

function UpdateBadge({ update }: { update: MdmUpdate }) {
  const failed = update.state === 'failed';
  return (
    <div
      role="status"
      className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 rounded-full px-6 py-3 text-lg shadow-xl backdrop-blur pointer-events-none ${
        failed ? 'bg-rose-500/20 text-rose-100' : 'bg-white/10 text-white/90'
      }`}
    >
      {!failed && <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" aria-hidden />}
      {UPDATE_TEXT[update.state]}
      {update.version && <span className="text-white/50">v{update.version}</span>}
    </div>
  );
}

function Screen({ state, onWifi }: { state: MdmState; onWifi: () => void }) {
  switch (state.mode) {
    case 'unpaired':
      return <PairingScreen state={state} onWifi={onWifi} />;
    case 'locked':
      return <LockScreen state={state} onWifi={onWifi} />;
    case 'active':
      return <TvHome state={state} onWifi={onWifi} />;
    default:
      return <StartingScreen state={state} onWifi={onWifi} />;
  }
}

const MdmGate: React.FC = () => {
  const state = useAgentState();
  const [wifiOpen, setWifiOpen] = useState(false);
  const openWifi = useCallback(() => setWifiOpen(true), []);

  return (
    <>
      {wifiOpen ? <WifiScreen wifi={state.wifi} onClose={() => setWifiOpen(false)} /> : <Screen state={state} onWifi={openWifi} />}
      {state.update && <UpdateBadge update={state.update} />}
    </>
  );
};

export default MdmGate;
