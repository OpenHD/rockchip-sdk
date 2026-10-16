import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, RefreshCw, Wifi, WifiHigh, WifiLow, WifiOff, WifiZero, type LucideIcon } from 'lucide-react';
import type { MdmWifi, MdmWifiNetwork } from './agentState';
import { useDpad } from './dpad';
import { OnScreenKeyboard } from './OnScreenKeyboard';
import { isValidPsk, relayErrorText, sendRelay } from './relay';
import { tvButton } from './styles';

/**
 * Configuración de Wi-Fi desde el control remoto. Disponible aunque el equipo esté
 * bloqueado: un equipo bloqueado por falta de conexión necesita poder volver a conectarse.
 * La contraseña solo vive en el estado de la pantalla mientras se escribe; al enviarla se borra.
 */

const STATE_LABELS: Record<string, string> = {
  connected: 'Conectado',
  completed: 'Conectado',
  connecting: 'Conectando…',
  associating: 'Conectando…',
  authenticating: 'Conectando…',
  obtaining_ip: 'Obteniendo dirección IP…',
  scanning: 'Buscando redes…',
  disconnected: 'Desconectado',
  inactive: 'Desconectado',
  failed: 'No se pudo conectar',
  wrong_password: 'Contraseña incorrecta',
  no_iface: 'Sin placa Wi-Fi',
  disabled: 'Wi-Fi apagado',
};

const SCAN_TIMEOUT_MS = 20_000;
const CONNECT_TIMEOUT_MS = 60_000;

function isConnected(wifi: MdmWifi | null): boolean {
  return !!wifi && (wifi.state === 'connected' || wifi.state === 'completed');
}

function signalIcon(dbm: number): LucideIcon {
  if (dbm >= -55) return Wifi;
  if (dbm >= -67) return WifiHigh;
  if (dbm >= -75) return WifiLow;
  return WifiZero;
}

/** Una entrada por SSID (la de mejor señal), ordenadas de mejor a peor. */
function networks(scan: MdmWifiNetwork[]): MdmWifiNetwork[] {
  const best = new Map<string, MdmWifiNetwork>();
  for (const n of scan) {
    const prev = best.get(n.ssid);
    if (!prev || n.signal > prev.signal) best.set(n.ssid, n);
  }
  return [...best.values()].sort((a, b) => b.signal - a.signal);
}

type Notice = { tone: 'info' | 'ok' | 'error'; text: string } | null;

export default function WifiScreen({ wifi, onClose }: { wifi: MdmWifi | null; onClose: () => void }) {
  const [entry, setEntry] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [scanSince, setScanSince] = useState<number | null>(null);
  const [connecting, setConnecting] = useState<{ ssid: string; since: number } | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);
  const scannedAt = wifi?.scannedAt ?? null;

  const scan = async () => {
    const since = Math.floor(Date.now() / 1000);
    setScanSince(since);
    const res = await sendRelay({ action: 'wifi_scan' });
    if (!res.ok) {
      setScanSince(null);
      setNotice({ tone: 'error', text: relayErrorText(res.error) });
    }
  };

  // Al abrir, busca redes una vez.
  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current();
  }, []);

  // La búsqueda termina cuando llega un escaneo más nuevo o se vence la espera.
  const scanning = scanSince !== null && !(scannedAt !== null && scannedAt >= scanSince - 1);
  useEffect(() => {
    if (scanSince === null) return;
    const t = setTimeout(() => setScanSince(null), SCAN_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [scanSince]);

  // Resultado de la conexión, según lo que publica el agente.
  const connectedSsid = isConnected(wifi) ? wifi?.ssid : null;
  const wifiError = wifi?.error ?? null;
  const connectDone = !!connecting && connectedSsid === connecting.ssid;
  useEffect(() => {
    if (!connecting || connectDone) return;
    const t = setTimeout(() => {
      setNotice({ tone: 'error', text: wifiError ?? `No se pudo conectar a ${connecting.ssid}. Revisá la contraseña.` });
      setConnecting(null);
    }, Math.max(0, connecting.since + CONNECT_TIMEOUT_MS - Date.now()));
    return () => clearTimeout(t);
  }, [connecting, connectDone, wifiError]);

  const shownNotice: Notice = connecting
    ? connectDone
      ? { tone: 'ok', text: `Conectado a ${connecting.ssid}` }
      : { tone: 'info', text: `Conectando a ${connecting.ssid}…` }
    : notice;

  const connect = async (ssid: string, psk: string) => {
    setEntry(null);
    setConnecting(null);
    setNotice({ tone: 'info', text: `Conectando a ${ssid}…` });
    const res = await sendRelay({ action: 'wifi_connect', ssid, psk });
    if (res.ok) setConnecting({ ssid, since: Date.now() });
    else setNotice({ tone: 'error', text: relayErrorText(res.error) });
  };

  const forget = async () => {
    if (!confirmForget) {
      setConfirmForget(true);
      return;
    }
    setConfirmForget(false);
    setConnecting(null);
    const res = await sendRelay({ action: 'wifi_forget' });
    setNotice(res.ok ? { tone: 'info', text: 'Red olvidada. Elegí otra para conectarte.' } : { tone: 'error', text: relayErrorText(res.error) });
  };

  const pick = (n: MdmWifiNetwork) => {
    setConfirmForget(false);
    if (n.secure) setEntry(n.ssid);
    else connect(n.ssid, '');
  };

  if (entry !== null) {
    return <PasswordEntry ssid={entry} onCancel={() => setEntry(null)} onSubmit={(psk) => connect(entry, psk)} />;
  }
  return (
    <NetworkList
      wifi={wifi}
      notice={shownNotice}
      scanning={scanning}
      confirmForget={confirmForget}
      onScan={scan}
      onForget={forget}
      onPick={pick}
      onClose={onClose}
    />
  );
}

function NetworkList({
  wifi,
  notice,
  scanning,
  confirmForget,
  onScan,
  onForget,
  onPick,
  onClose,
}: {
  wifi: MdmWifi | null;
  notice: Notice;
  scanning: boolean;
  confirmForget: boolean;
  onScan: () => void;
  onForget: () => void;
  onPick: (n: MdmWifiNetwork) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useDpad(rootRef, { onBack: onClose });
  const list = useMemo(() => networks(wifi?.scan ?? []), [wifi?.scan]);
  const connected = isConnected(wifi);
  const stateLabel = wifi?.state ? STATE_LABELS[wifi.state] ?? wifi.state : 'Sin datos';

  return (
    <div ref={rootRef} className="w-screen h-screen bg-[#05070c] text-white flex flex-col gap-8 tv-safe select-none">
      <header className="flex items-center gap-6">
        <button autoFocus className={tvButton} onClick={onClose}>
          <ArrowLeft className="h-6 w-6" aria-hidden /> Volver
        </button>
        <h1 className="text-4xl font-semibold">Wi-Fi</h1>
      </header>

      <div className="flex flex-1 min-h-0 gap-10">
        <section className="w-[28rem] shrink-0 flex flex-col gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-3 text-lg">
            <div className="flex items-center gap-3 text-2xl">
              {connected ? <Wifi className="h-7 w-7 text-emerald-400" aria-hidden /> : <WifiOff className="h-7 w-7 text-white/50" aria-hidden />}
              {stateLabel}
            </div>
            <div className="text-white/70">Red: <span className="text-white">{wifi?.ssid ?? '—'}</span></div>
            <div className="text-white/70">IP: <span className="text-white font-mono">{wifi?.ip ?? '—'}</span></div>
            {wifi?.error && <div className="text-rose-300">{wifi.error}</div>}
          </div>
          {notice && (
            <p
              role="status"
              className={`rounded-xl px-5 py-4 text-lg ${
                notice.tone === 'error' ? 'bg-rose-500/15 text-rose-200' : notice.tone === 'ok' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-sky-500/15 text-sky-100'
              }`}
            >
              {notice.text}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <button className={tvButton} onClick={onScan}>
              <RefreshCw className={`h-6 w-6 ${scanning ? 'animate-spin' : ''}`} aria-hidden />
              {scanning ? 'Buscando redes…' : 'Buscar redes'}
            </button>
            {wifi?.ssid && (
              <button className={`${tvButton} ${confirmForget ? 'bg-rose-500/40' : ''}`} onClick={onForget}>
                {confirmForget ? `¿Olvidar ${wifi.ssid}? Apretá OK de nuevo` : 'Olvidar esta red'}
              </button>
            )}
          </div>
        </section>

        <section className="flex-1 min-w-0 flex flex-col gap-3">
          <h2 className="text-xl text-white/60">Redes disponibles</h2>
          {list.length === 0 ? (
            <p className="text-white/60 text-lg">{scanning ? 'Buscando redes…' : 'No se encontraron redes. Probá buscar de nuevo.'}</p>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 p-2">
              {list.map((n) => {
                const Icon = signalIcon(n.signal);
                const current = connected && wifi?.ssid === n.ssid;
                return (
                  <button
                    key={n.ssid}
                    onClick={() => onPick(n)}
                    className="flex items-center gap-5 rounded-2xl bg-white/5 border border-white/10 px-6 py-4 text-left text-xl outline-none transition focus:bg-white focus:text-black focus:ring-4 focus:ring-sky-400/70"
                  >
                    <Icon className="h-7 w-7 shrink-0" aria-label={`Señal ${n.signal} dBm`} />
                    <span className="flex-1 truncate">{n.ssid}</span>
                    {current && <span className="text-base text-emerald-500">Conectada</span>}
                    {n.secure && <Lock className="h-5 w-5 shrink-0 opacity-70" aria-label="Protegida con contraseña" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const MAX_PSK = 63;

function PasswordEntry({ ssid, onCancel, onSubmit }: { ssid: string; onCancel: () => void; onSubmit: (psk: string) => void }) {
  const [psk, setPsk] = useState('');
  const [show, setShow] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const valid = psk.length > 0 && isValidPsk(psk);

  const add = (c: string) => {
    setHint(null);
    setPsk((p) => (p.length < MAX_PSK ? p + c : p));
  };
  const submit = () => {
    if (!valid) {
      setHint('La contraseña tiene que tener entre 8 y 63 caracteres.');
      return;
    }
    const value = psk;
    setPsk('');
    onSubmit(value);
  };

  useDpad(rootRef, {
    onBack: onCancel,
    // Teclado físico o números del control: escriben directo.
    onKey: (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return false;
      if (e.key === 'Backspace' && psk.length > 0) {
        setPsk((p) => p.slice(0, -1));
        return true;
      }
      if (e.key.length === 1 && e.key >= ' ' && e.key <= '~') {
        add(e.key);
        return true;
      }
      return false;
    },
  });

  return (
    <div ref={rootRef} className="w-screen h-screen bg-[#05070c] text-white flex flex-col items-center justify-center gap-8 tv-safe select-none">
      <div className="text-center">
        <p className="text-xl text-white/60">Contraseña de la red</p>
        <h1 className="text-4xl font-semibold mt-1">{ssid}</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-[40rem] min-h-16 rounded-2xl border-2 border-sky-400/60 bg-white/5 px-6 py-4 font-mono text-3xl tracking-wider break-all">
          {psk.length === 0 ? <span className="text-white/50">Escribí la contraseña</span> : show ? psk : '•'.repeat(psk.length)}
          <span className="ml-1 inline-block w-0.5 h-8 align-middle bg-sky-400 animate-pulse" aria-hidden />
        </div>
        <button className={tvButton} onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="h-6 w-6" aria-hidden /> : <Eye className="h-6 w-6" aria-hidden />}
          {show ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <p className={`text-lg ${hint ? 'text-rose-300' : 'text-white/60'}`}>
        {hint ?? `${psk.length} caracteres · mínimo 8`}
      </p>
      <OnScreenKeyboard
        onChar={add}
        onBackspace={() => setPsk((p) => p.slice(0, -1))}
        onSubmit={submit}
        canSubmit={valid}
        submitLabel="Conectar"
      />
      <button className={tvButton} onClick={onCancel}>Cancelar</button>
    </div>
  );
}
