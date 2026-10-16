import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyRound, Lock, Phone, Wifi } from 'lucide-react';
import { useAgentState, type MdmApp, type MdmPayment, type MdmState, type MdmUpdate } from './agentState';
import { FOCUSABLE_ANY, useDpad } from './dpad';
import { launchUrl, localQr } from './launch';
import { tvButton } from './styles';
import { isTvApp, TvApp } from './tvApps';
import UnlockCodeScreen from './UnlockCodeScreen';
import WifiScreen from './WifiScreen';

/**
 * Interfaz del TV box gestionado. Muestra solo lo que nex-agent publica:
 * espera, vinculación, bloqueo, restringido (home con las apps deshabilitadas) o el home.
 * El bloqueo real lo aplican el agente y las políticas de Chromium; esta capa es la cara visible.
 */

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
    <div ref={rootRef} className="w-screen h-screen bg-[#05070c] text-white flex flex-col items-center justify-center gap-10 tv-safe text-center select-none">
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
  return localQr(url.href);
}

/** Cómo pagar: vencimiento, teléfono y QR del link de pago (los define el ISP). */
function PaymentInfo({ payment, compact = false }: { payment: MdmPayment; compact?: boolean }) {
  const qr = useMemo(() => (payment.url ? localQr(payment.url, compact ? 5 : 7) : null), [payment.url, compact]);
  if (!payment.due && !payment.phone && !qr) return null;
  return (
    <div className={`flex items-center gap-8 text-left ${compact ? '' : 'rounded-2xl bg-white/5 border border-white/10 px-8 py-6'}`}>
      {qr && (
        <img
          src={qr}
          alt="QR para pagar"
          className={`${compact ? 'h-28 w-28' : 'h-44 w-44'} rounded-xl bg-white p-2 [image-rendering:pixelated]`}
        />
      )}
      <div className="flex flex-col gap-2 text-xl">
        {payment.due && <p>Vencimiento: <span className="font-semibold">{formatDue(payment.due)}</span></p>}
        {payment.phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-5 w-5" aria-hidden /> <span className="font-semibold tabular-nums">{payment.phone}</span>
          </p>
        )}
        {qr && <p className="text-white/60 text-base">Escaneá el QR con el celular para pagar.</p>}
      </div>
    </div>
  );
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
          <p className="text-white/60">
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
        {detail && <p className="text-lg text-white/60">{detail}</p>}
      </div>
      {state.payment && (state.lockKind === 'payment' || state.lockKind === 'manual') && <PaymentInfo payment={state.payment} />}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {canUseCode && (
          <button autoFocus className={tvButton} onClick={() => setCodeOpen(true)}>
            <KeyRound className="h-6 w-6" aria-hidden /> Tengo un código de desbloqueo
          </button>
        )}
        <WifiButton onClick={onWifi} autoFocus={!canUseCode} />
      </div>
      {state.deviceName && <p className="text-white/60 text-base">Equipo: {state.deviceName}</p>}
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

function TvHome({ state, onWifi }: { state: MdmState; onWifi: () => void }) {
  const clock = useClock();
  const restricted = state.mode === 'restricted';
  const [codeOpen, setCodeOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedApp, setOpenApp] = useState<MdmApp | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const apps = useMemo(
    () => state.apps.filter((a) => a.kind === 'web' || isTvApp(a.id)),
    [state.apps],
  );

  // Si la empresa desactiva la app abierta, se cierra.
  const openApp = selectedApp && apps.some((a) => a.id === selectedApp.id) ? selectedApp : null;

  useEffect(() => {
    if (!openApp) gridRef.current?.querySelector<HTMLButtonElement>('button[data-index="0"]')?.focus();
  }, [openApp, apps]);

  // Al abrir una app el foco va a "Volver": con el control siempre hay algo seleccionado.
  useEffect(() => {
    if (openApp) backRef.current?.focus();
  }, [openApp]);

  const attestation = state.attestation;
  const launch = useCallback((app: MdmApp) => {
    if (app.disabled) {
      setNotice(`${app.name} no está disponible: tu servicio está restringido por falta de pago.`);
      return;
    }
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
  // (rootRef queda en null).
  useDpad(rootRef);
  // Dentro de una app: atrás/inicio vuelven al home; las flechas son primero de la app
  // (un juego) y si no las usa, mueven el foco entre sus controles.
  const closeApp = useCallback(() => setOpenApp(null), []);
  useDpad(appRef, { onBack: closeApp, onHome: closeApp, selector: FOCUSABLE_ANY, yieldArrows: true });

  if (codeOpen && restricted) return <UnlockCodeScreen unlock={state.unlock} onClose={() => setCodeOpen(false)} />;

  if (openApp) {
    return (
      <div ref={appRef} className="w-screen h-screen bg-black text-white flex flex-col">
        <div className="h-16 flex items-center justify-between px-[5vw] bg-white/5 text-xl">
          <span>{openApp.name}</span>
          <button
            ref={backRef}
            className="px-6 py-2 rounded-xl bg-white/10 outline-none transition focus:bg-white focus:text-black focus:ring-4 focus:ring-sky-400/70"
            onClick={closeApp}
          >
            ← Volver
          </button>
        </div>
        {/* Margen de overscan también abajo y a los costados: la app no se recorta. */}
        <div className="flex-1 min-h-0 px-[5vw] pb-[5vh]">
          <TvApp appId={openApp.id} />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="w-screen h-screen bg-gradient-to-b from-[#0b1020] to-[#05070c] text-white flex flex-col tv-safe select-none">
      <header className="flex items-center justify-between">
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

      {restricted ? (
        <div className="mt-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-6 py-5 text-rose-50 flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-2xl">
            <p className="text-2xl font-semibold flex items-center gap-3">
              <Lock className="h-6 w-6" aria-hidden /> Servicio restringido
            </p>
            <p className="text-lg text-rose-50/80">
              {state.lockReason ?? state.payment?.message ?? 'Tu servicio tiene un pago pendiente. Las aplicaciones vuelven a funcionar cuando se registre el pago.'}
            </p>
            {notice && <p role="status" className="text-base text-amber-200">{notice}</p>}
            <button className={`${tvButton} self-start mt-2`} onClick={() => setCodeOpen(true)}>
              <KeyRound className="h-6 w-6" aria-hidden /> Tengo un código de desbloqueo
            </button>
          </div>
          {state.payment && <PaymentInfo payment={state.payment} compact />}
        </div>
      ) : (
        (state.serviceWarning || state.paymentDue) && (
          <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 px-6 py-4 text-amber-100 text-lg flex flex-wrap items-center justify-between gap-6">
            <p>
              {state.payment?.due || state.paymentDue
                ? `Tu pago vence el ${formatDue((state.payment?.due ?? state.paymentDue) as string)}. `
                : 'Tu servicio tiene un pago pendiente. '}
              Regularizalo para evitar la restricción del equipo.
            </p>
            {state.payment && <PaymentInfo payment={state.payment} compact />}
          </div>
        )
      )}

      <main className="flex-1 min-h-0 flex items-center justify-center">
        {apps.length === 0 ? (
          <p className="text-white/60 text-xl">Tu proveedor todavía no habilitó aplicaciones en este equipo.</p>
        ) : (
          <div ref={gridRef} className="grid grid-cols-4 gap-8 w-full max-w-6xl">
            {apps.map((app, i) => (
              <button
                key={app.id}
                data-index={i}
                onClick={() => launch(app)}
                aria-disabled={app.disabled || undefined}
                className={`aspect-video rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3 text-2xl font-semibold outline-none transition-transform focus:scale-105 focus:bg-white/15 focus:border-white/60 hover:bg-white/10 ${
                  app.disabled ? 'opacity-40 grayscale' : ''
                }`}
              >
                <span className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center text-3xl" aria-hidden>
                  {app.disabled ? <Lock className="h-7 w-7" /> : app.name.charAt(0).toUpperCase()}
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

/** Fondo opaco, sin backdrop-blur: en la Mali-450 el desenfoque en vivo es caro. */
function UpdateBadge({ update }: { update: MdmUpdate }) {
  const failed = update.state === 'failed';
  return (
    <div
      role="status"
      className={`fixed bottom-[5vh] right-[5vw] z-50 flex items-center gap-3 rounded-full px-6 py-3 text-lg shadow-xl pointer-events-none ${
        failed ? 'bg-rose-950 text-rose-100' : 'bg-[#1a1d26] text-white/90'
      }`}
    >
      {!failed && <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" aria-hidden />}
      {UPDATE_TEXT[update.state]}
      {update.version && <span className="text-white/60">v{update.version}</span>}
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
    case 'restricted':
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
