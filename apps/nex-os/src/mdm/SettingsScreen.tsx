import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import WifiScreen from './WifiScreen';
import type { MdmState } from './agentState';
import { networkSummary, versionLabel, type Appearance, type NetworkSummary } from './settings';
import { ActionRow, Card, Icon, IconBadge, InfoRow, OkHint, SectionLabel, Shell, SignalBars, StatusDot } from './TvUi';
import { BACK_KEYS, ICON, ROW, TONE, noticeOpen } from './tvStyle';
import { parseWifiStatus, type WifiStatus } from './wifi';

/**
 * Ajustes de NEX TV y acceso técnico. Pantallas para ver a 3 metros y manejar con el control remoto:
 * a la izquierda, lo que se puede cambiar (filas grandes, ▲▼ y OK); a la derecha, la ficha del equipo.
 */

/** Versión de la interfaz, por si el agente no informa la del equipo (se define al compilar la imagen). */
const NEX_VERSION = (import.meta.env.VITE_NEX_VERSION as string | undefined) ?? '0.1';

/** PIN del acceso técnico (se define al compilar; por defecto, solo para demo). */
const TECH_PIN = (import.meta.env.VITE_NEX_TECH_PIN as string | undefined) ?? '2468';

const WIFI_STATUS_URL = '/agent/wifi/status';
const NETWORK_POLL_MS = 5000;

/** Conexión del equipo mientras la pantalla está abierta: red, señal e IP según el agente; si no, el navegador. */
function useNetwork(): NetworkSummary {
  const [status, setStatus] = useState<WifiStatus | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      let next: WifiStatus | null = null;
      try {
        const res = await fetch(WIFI_STATUS_URL, { cache: 'no-store' });
        if (res.ok) next = parseWifiStatus(await res.json());
      } catch {
        // Sin agente de Wi-Fi (o lectura fallida): queda lo que dice el navegador.
      }
      if (!alive) return;
      const value = next;
      setStatus((prev) => (JSON.stringify(prev) === JSON.stringify(value) ? prev : value));
      setOnline(navigator.onLine);
      timer = setTimeout(poll, NETWORK_POLL_MS);
    };
    void poll();
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return networkSummary(status, online);
}

function ToggleRow({ navKey, icon, title, detail, on, onToggle }: {
  navKey: string;
  icon: string;
  title: string;
  detail: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button data-nav data-key={navKey} role="switch" aria-checked={on} onClick={onToggle} className={`${ROW} py-7 border-white/10 bg-white/5`}>
      <IconBadge icon={icon} tone={on ? 'sky' : 'muted'} />
      <span className="flex-1 min-w-0 flex flex-col mr-6">
        <span className="text-3xl font-semibold truncate">{title}</span>
        <span className="text-2xl text-white/60 truncate">{detail}</span>
      </span>
      <span className={`flex-none text-2xl mr-5 ${on ? 'text-sky-200' : 'text-white/45'}`}>{on ? 'Activado' : 'Desactivado'}</span>
      <span className={`flex-none h-10 w-20 rounded-full flex items-center px-1 ${on ? 'bg-sky-400' : 'bg-white/20'}`} aria-hidden>
        <span className={`h-8 w-8 rounded-full bg-white transition-transform ${on ? 'translate-x-10' : ''}`} />
      </span>
    </button>
  );
}

/** Ficha del equipo: solo informa, no se enfoca. */
function DeviceCard({ state, network, children }: { state: MdmState; network: NetworkSummary; children?: ReactNode }) {
  const online = network.kind !== 'offline';
  return (
    <Card>
      <SectionLabel>Este equipo</SectionLabel>
      <div className="flex items-center pt-2 pb-8">
        <span className="flex-none h-20 w-20 rounded-full flex items-center justify-center mr-6 bg-[radial-gradient(circle_at_35%_30%,rgba(139,92,255,.6),rgba(71,191,255,.22))]">
          <Icon d={ICON.tv} className="h-10 w-10" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-4xl font-semibold truncate">{state.deviceName ?? 'Sin nombre'}</div>
          <div className="mt-2 inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-1 text-xl text-emerald-200">
            <StatusDot ok />
            Vinculado
          </div>
        </div>
      </div>
      <InfoRow icon={ICON.globe} label="Proveedor">{state.companyName ?? 'NEX'}</InfoRow>
      <InfoRow icon={ICON.pulse} label="Conexión">
        <span className={online ? 'text-emerald-300' : 'text-amber-300'}>
          <StatusDot ok={online} />
          {online ? 'En línea' : 'Sin conexión'}
        </span>
      </InfoRow>
      {network.network && <InfoRow icon={network.kind === 'ethernet' ? ICON.cable : ICON.wifi} label="Red">{network.network}</InfoRow>}
      {network.ip && <InfoRow icon={ICON.pin} label="Dirección IP"><span className="tabular-nums">{network.ip}</span></InfoRow>}
      {children}
      <InfoRow icon={ICON.info} label="NEX TV">
        <span className="tabular-nums">{versionLabel(state.version, state.build, NEX_VERSION)}</span>
      </InfoRow>
    </Card>
  );
}

/** Teclado numérico para el acceso técnico. El PIN no viaja a ningún lado; es una barrera local. */
export function TechPin({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState('');
  const [err, setErr] = useState(false);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✕'];

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[data-index="0"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (BACK_KEYS.has(e.key) && !noticeOpen()) {
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

  const onKeyNav = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // OK mantenido apretado no repite el dígito.
    if (e.key === 'Enter' && e.repeat) e.preventDefault();
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
    <div
      className="w-screen h-screen text-white flex flex-col items-center justify-center select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,.14), rgba(5,7,12,0) 60%), #05070c' }}
    >
      <span className={`h-20 w-20 rounded-full border flex items-center justify-center ${TONE.sky}`}>
        <Icon d={ICON.wrench} className="h-10 w-10" />
      </span>
      <div className="text-center mt-5">
        <div className="text-sky-300 text-lg uppercase tracking-[0.3em]">Acceso técnico</div>
        <div className="text-4xl font-semibold mt-2">Ingresá el PIN del instalador</div>
      </div>
      <div className={`flex mt-8 ${err ? 'animate-pulse' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-7 w-7 mx-3 rounded-full border-2 ${err ? 'border-red-400' : 'border-white/40'} ${i < val.length ? (err ? 'bg-red-400' : 'bg-white') : ''}`}
          />
        ))}
      </div>
      <p role="status" className={`h-8 mt-4 text-2xl ${err ? 'text-red-300' : 'text-transparent'}`}>
        {err ? 'PIN incorrecto. Probá de nuevo.' : ' '}
      </p>
      <div ref={ref} onKeyDown={onKeyNav} className="grid grid-cols-3 gap-4 mt-4">
        {keys.map((k, i) => (
          <button
            key={k}
            data-index={i}
            aria-label={k === '⌫' ? 'Borrar' : k === '✕' ? 'Cancelar' : k}
            onClick={() => press(k)}
            className="h-24 w-24 rounded-2xl bg-white/5 border border-white/10 text-4xl font-light outline-none transition-transform focus:scale-110 focus:bg-white focus:text-[#05070c] focus:border-white focus:ring-4 focus:ring-sky-300/40 hover:bg-white/10"
          >
            {k}
          </button>
        ))}
      </div>
      <p className="mt-8 text-xl text-white/50">Atrás para cancelar</p>
    </div>
  );
}

/** Panel técnico (tras el PIN): diagnóstico del equipo y acciones de servicio. */
function TechPanel({ state, dim, onClose }: { state: MdmState; dim: boolean; onClose: () => void }) {
  const network = useNetwork();
  const [message, setMessage] = useState('');
  // Sin Device Owner, Guard devuelve al inicio cualquier app no permitida: esto le da al técnico unos minutos.
  const openAndroidSettings = useCallback(async () => {
    try {
      const res = await fetch(`/agent/setup/settings?token=${encodeURIComponent(state.wifiToken ?? '')}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) setMessage('No se pudieron abrir los Ajustes de Android.');
    } catch {
      setMessage('No se pudieron abrir los Ajustes de Android.');
    }
  }, [state.wifiToken]);

  return (
    <Shell
      eyebrow="Modo técnico"
      title="Diagnóstico del equipo"
      backLabel="Volver a Ajustes"
      focusKey="reload"
      dim={dim}
      onBack={onClose}
      aside={
        <DeviceCard state={state} network={network}>
          <InfoRow icon={ICON.shield} label="Modo"><span className="text-emerald-300">Activo</span></InfoRow>
        </DeviceCard>
      }
    >
      <SectionLabel>Servicio</SectionLabel>
      <div className="flex flex-col space-y-4">
        <ActionRow
          navKey="reload"
          index={0}
          icon={ICON.refresh}
          title="Reiniciar la interfaz"
          detail="Vuelve a cargar NEX TV. No reinicia el equipo."
          idle="Reiniciar"
          action="Reiniciar"
          onSelect={() => window.location.reload()}
        />
        {!state.owner && (
          <ActionRow
            navKey="android"
            icon={ICON.sliders}
            title="Abrir Ajustes de Android"
            detail="Quedan disponibles 10 minutos."
            idle="Abrir"
            action="Abrir"
            onSelect={() => void openAndroidSettings()}
          />
        )}
      </div>
      {message && <p role="status" className="mt-5 text-2xl text-amber-200">{message}</p>}
      <p className="mt-8 max-w-[60rem] text-2xl leading-relaxed text-white/45">
        Desvincular el equipo o reiniciar el sistema se hacen desde el panel de tu empresa. El soporte de NEX también
        puede ayudarte de forma remota.
      </p>
    </Shell>
  );
}

type View = 'main' | 'wifi' | 'pin' | 'panel';

export function SettingsScreen({ state, appearance, setAppearance, brand, clock, onClose }: {
  state: MdmState;
  appearance: Appearance;
  setAppearance: (p: Partial<Appearance>) => void;
  /** Logo o nombre de la empresa, como en el inicio. */
  brand: ReactNode;
  clock: string;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>('main');
  // Fila que recupera el foco al volver de una pantalla secundaria.
  const [focusKey, setFocusKey] = useState('wifi');
  const backToMain = useCallback(() => setView('main'), []);

  if (view === 'wifi') return <WifiScreen token={state.wifiToken} dim={appearance.dimWallpaper} onClose={backToMain} />;
  if (view === 'pin') return <TechPin onOk={() => setView('panel')} onCancel={backToMain} />;
  if (view === 'panel') return <TechPanel state={state} dim={appearance.dimWallpaper} onClose={backToMain} />;

  const open = (next: View, key: string) => {
    setFocusKey(key);
    setView(next);
  };

  return (
    <SettingsMain
      state={state}
      appearance={appearance}
      setAppearance={setAppearance}
      brand={brand}
      clock={clock}
      focusKey={focusKey}
      onWifi={() => open('wifi', 'wifi')}
      onTech={() => open('pin', 'tech')}
      onClose={onClose}
    />
  );
}

function SettingsMain({ state, appearance, setAppearance, brand, clock, focusKey, onWifi, onTech, onClose }: {
  state: MdmState;
  appearance: Appearance;
  setAppearance: (p: Partial<Appearance>) => void;
  brand: ReactNode;
  clock: string;
  focusKey: string;
  onWifi: () => void;
  onTech: () => void;
  onClose: () => void;
}) {
  const network = useNetwork();
  const offline = network.kind === 'offline';

  return (
    <Shell
      title="Ajustes"
      backLabel="Volver al inicio"
      focusKey={focusKey}
      dim={appearance.dimWallpaper}
      brand={brand}
      clock={clock}
      onBack={onClose}
      aside={<DeviceCard state={state} network={network} />}
    >
      <SectionLabel>Red</SectionLabel>
      <ActionRow
        navKey="wifi"
        index={0}
        icon={offline ? ICON.wifiOff : network.kind === 'ethernet' ? ICON.cable : ICON.wifi}
        tone={offline ? 'amber' : 'sky'}
        title="Red Wi-Fi"
        detail={offline ? 'Sin conexión. Elegí una red para conectarte.' : network.label}
        idle={offline ? 'Conectar' : 'Cambiar'}
        action={offline ? 'Conectar' : 'Cambiar red'}
        onSelect={onWifi}
      >
        {network.level !== null && <SignalBars level={network.level} />}
      </ActionRow>

      <div className="mt-12">
        <SectionLabel>Apariencia</SectionLabel>
        <div className="flex flex-col space-y-4">
          <ToggleRow
            navKey="dim"
            icon={ICON.moon}
            title="Atenuar el fondo"
            detail="Fondo más oscuro, ideal para ver de noche."
            on={appearance.dimWallpaper}
            onToggle={() => setAppearance({ dimWallpaper: !appearance.dimWallpaper })}
          />
          <ToggleRow
            navKey="tiles"
            icon={ICON.grid}
            title="Mosaicos más grandes"
            detail="Agranda los íconos de las apps en el inicio."
            on={appearance.bigTiles}
            onToggle={() => setAppearance({ bigTiles: !appearance.bigTiles })}
          />
        </div>
      </div>

      <div className="mt-12">
        <SectionLabel muted>Soporte</SectionLabel>
        <button data-nav data-key="tech" onClick={onTech} className={`${ROW} py-5 border-white/10 bg-transparent`}>
          <IconBadge icon={ICON.wrench} tone="muted" small />
          <span className="flex-1 min-w-0 flex flex-col mr-6">
            <span className="text-2xl font-semibold text-white/75 truncate group-focus:text-white">Acceso técnico</span>
            <span className="text-xl text-white/45 truncate group-focus:text-white/70">Solo para el instalador. Pide un PIN.</span>
          </span>
          <OkHint idle="" action="Ingresar" />
        </button>
      </div>
    </Shell>
  );
}
