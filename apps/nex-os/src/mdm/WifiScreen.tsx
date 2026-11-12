import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Card, Icon, IconBadge, InfoRow, OkHint, SectionLabel, Shell, SignalBars, StatusDot, ActionRow } from './TvUi';
import { ICON, ROW, TONE, type Tone } from './tvStyle';
import {
  connectedSsid,
  networkDetail,
  parseWifiScan,
  parseWifiStatus,
  passwordError,
  signalLabel,
  type WifiNetwork,
  type WifiStatus,
} from './wifi';

/**
 * Wi-Fi del equipo: lista de redes, formulario de contraseña (o de "Otra red") y avance de la conexión.
 * "Atrás" deshace un paso: del formulario a la lista y de la lista a la pantalla anterior.
 */

type Feedback = { kind: 'info' | 'error'; text: string };

const CONNECT_TIMEOUT_MS = 25000;
const STATUS_POLL_MS = 1500;
const CONNECT_FAILED = 'No se pudo conectar. Revisá la contraseña.';

async function request(path: string): Promise<unknown> {
  const res = await fetch(`/agent/wifi/${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Wi-Fi no disponible');
  return res.json();
}

function Spinner({ className }: { className: string }) {
  return <span className={`inline-block rounded-full border-4 border-white/15 border-t-sky-300 animate-spin ${className}`} aria-hidden />;
}

/** Lo que está pasando (buscando, error): arriba de la lista o del formulario, donde ya está la vista. */
function FeedbackBar({ feedback }: { feedback: Feedback | null }) {
  const error = feedback?.kind === 'error';
  return (
    <div role="status" aria-live="polite">
      {feedback && (
        <div className={`flex items-center rounded-2xl border px-6 py-4 mb-6 text-2xl ${error ? 'border-red-400/50 bg-red-500/10 text-red-100' : 'border-sky-300/30 bg-sky-400/10 text-sky-100'}`}>
          {error ? <Icon d={ICON.alert} className="flex-none h-8 w-8 mr-4 text-red-300" /> : <Spinner className="flex-none h-7 w-7 mr-4" />}
          <span className="min-w-0">{feedback.text}</span>
        </div>
      )}
    </div>
  );
}

/** Conexión actual del equipo. */
function ConnectionCard({ status }: { status: WifiStatus | null }) {
  const ssid = connectedSsid(status);
  const wired = status?.ethernet === true;
  const online = wired || (status?.connected ?? false);
  const tone: Tone = online ? 'sky' : 'amber';
  return (
    <Card>
      <SectionLabel>Conexión actual</SectionLabel>
      <div className="flex items-center pt-2 pb-8">
        <IconBadge icon={wired ? ICON.cable : online ? ICON.wifi : ICON.wifiOff} tone={tone} />
        <div className="flex-1 min-w-0">
          <div className="text-4xl font-semibold truncate">{wired ? 'Cable de red' : ssid ?? (online ? 'Wi-Fi' : 'Sin conexión')}</div>
          <div className={`mt-2 inline-flex items-center rounded-full border px-4 py-1 text-xl ${online ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200' : 'border-amber-300/40 bg-amber-400/15 text-amber-200'}`}>
            <StatusDot ok={online} />
            {online ? 'Conectado' : 'Elegí una red'}
          </div>
        </div>
      </div>
      {status && status.connected && !wired && (
        <InfoRow icon={ICON.pulse} label="Señal">
          <span className="inline-flex items-center justify-end">
            <SignalBars level={status.level} />
            {signalLabel(status.level)}
          </span>
        </InfoRow>
      )}
      {status?.ip && <InfoRow icon={ICON.pin} label="Dirección IP"><span className="tabular-nums">{status.ip}</span></InfoRow>}
    </Card>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start py-3">
      <span className="flex-none h-9 w-9 rounded-full border border-white/25 flex items-center justify-center text-xl text-white/75 mr-4">{n}</span>
      <span className="text-2xl leading-9 text-white/70">{children}</span>
    </li>
  );
}

/** Cómo se escribe con el control: el teclado en pantalla no es obvio la primera vez. */
function TypingTips() {
  return (
    <div className="mt-6">
      <Card>
        <SectionLabel>Escribir con el control</SectionLabel>
        <ol className="pb-3">
          <Step n={1}>Presioná <b className="text-white">OK</b> sobre un campo para abrir el teclado.</Step>
          <Step n={2}>Al terminar, elegí <b className="text-white">Siguiente</b> o <b className="text-white">Listo</b> en el teclado.</Step>
          <Step n={3}><b className="text-white">Atrás</b> cierra el teclado sin borrar lo escrito.</Step>
        </ol>
      </Card>
    </div>
  );
}

/** Campo de texto grande: ícono, etiqueta y borde que se enciende con el foco. */
function Field({ icon, label, hint, children }: { icon: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex-1 min-w-0 block">
      <span className="block text-2xl text-white/70 mb-2">{label}</span>
      <span className="flex items-center h-20 rounded-2xl border border-white/15 bg-white/5 px-6 focus-within:border-white/70 focus-within:bg-white/10 focus-within:ring-4 focus-within:ring-sky-300/40">
        <Icon d={icon} className="flex-none h-8 w-8 text-white/45 mr-4" />
        {children}
      </span>
      {hint && <span className="block text-xl text-white/45 mt-2">{hint}</span>}
    </label>
  );
}

const INPUT = 'flex-1 min-w-0 h-full bg-transparent text-3xl text-white outline-none select-text placeholder:text-white/30';
const BUTTON =
  'flex-none h-20 rounded-2xl border text-3xl font-semibold outline-none transition-transform ' +
  'focus:scale-105 focus:border-white focus:bg-white focus:text-[#05070c] focus:ring-4 focus:ring-sky-300/50';

/** Red local: el token solo se publica en el origen privado del agente. */
export default function WifiScreen({ token, dim, onClose }: { token: string | null; dim?: boolean; onClose: () => void }) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState<WifiStatus | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [unavailable, setUnavailable] = useState(!token);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<WifiNetwork | 'manual' | null>(null);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  /** Red a la que se está intentando conectar (pantalla de avance). */
  const [connecting, setConnecting] = useState<string | null>(null);
  /** El equipo ya aceptó el pedido: se espera a que la red aparezca conectada. */
  const [target, setTarget] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cada error devuelve el foco al campo para corregir.
  const [attempt, setAttempt] = useState(0);
  const [fieldFocus, setFieldFocus] = useState<'ssid' | 'password'>('password');

  const fail = useCallback((text: string) => {
    setConnecting(null);
    setTarget(null);
    setError(text);
    setAttempt((n) => n + 1);
  }, []);

  const scan = useCallback(async () => {
    if (!token) return;
    setScanning(true);
    setError(null);
    try {
      const data = parseWifiScan(await request('scan'));
      if (!alive.current) return;
      setStatus(data.status);
      setNetworks(data.networks);
      setUnavailable(false);
    } catch {
      if (alive.current) setUnavailable(true);
    }
    if (alive.current) setScanning(false);
  }, [token]);

  useEffect(() => {
    alive.current = true;
    const scanTimer = setTimeout(() => void scan(), 0);
    return () => { alive.current = false; clearTimeout(scanTimer); clearTimeout(timer.current); };
  }, [scan]);

  // Tras pedir la conexión, se consulta el estado hasta que la red quede conectada o se acabe el tiempo.
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      cancelled = true;
      clearTimeout(timer.current);
      fail(CONNECT_FAILED);
    }, CONNECT_TIMEOUT_MS);
    const poll = async () => {
      try {
        const next = parseWifiStatus(await request('status'));
        if (cancelled) return;
        setStatus(next);
        if (next && next.connected && next.ssid === target) {
          clearTimeout(timeout);
          setDone(target);
          timer.current = setTimeout(onClose, 2000);
          return;
        }
      } catch {
        // Una lectura fallida no interrumpe el intento de conexión.
      }
      if (cancelled) return;
      timer.current = setTimeout(poll, STATUS_POLL_MS);
    };
    timer.current = setTimeout(poll, STATUS_POLL_MS);
    return () => { cancelled = true; clearTimeout(timeout); clearTimeout(timer.current); };
  }, [target, onClose, fail]);

  const connect = async (name: string, pass: string, listed: boolean) => {
    if (connecting) return;
    const invalid = passwordError(pass, listed);
    if (invalid) { setError(invalid); setFieldFocus('password'); setAttempt((n) => n + 1); return; }
    setError(null);
    setConnecting(name);
    try {
      const data = await request(`connect?ssid=${encodeURIComponent(name)}&password=${encodeURIComponent(pass)}&token=${encodeURIComponent(token ?? '')}`);
      if (!alive.current) return;
      const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      if (o.ok !== true) {
        fail(typeof o.error === 'string' && o.error ? o.error.slice(0, 200) : CONNECT_FAILED);
        return;
      }
      setTarget(name);
    } catch {
      if (alive.current) { setConnecting(null); setUnavailable(true); }
    }
  };

  const choose = (network: WifiNetwork | 'manual') => {
    setError(null);
    setPassword('');
    setShow(false);
    // Una red abierta no pide nada: se conecta directo.
    if (network !== 'manual' && !network.secure) { void connect(network.ssid, '', false); return; }
    setSsid(network === 'manual' ? '' : network.ssid);
    setFieldFocus(network === 'manual' ? 'ssid' : 'password');
    setSelected(network);
  };

  const manual = selected === 'manual';
  const submit = () => void connect(ssid, password, selected !== null && !manual);
  const phase = unavailable ? 'unavailable' : done ? 'done' : connecting ? 'connecting' : selected ? 'form' : 'list';

  // "Atrás" deshace un paso.
  const back = useCallback(() => {
    if (phase === 'connecting') {
      setConnecting(null);
      setTarget(null);
    } else if (phase === 'form') {
      setSelected(null);
      setError(null);
    } else {
      onClose();
    }
  }, [phase, onClose]);

  const current = connectedSsid(status);
  const backLabel = phase === 'connecting' ? 'Cancelar' : phase === 'form' ? 'Volver a la lista' : 'Volver';
  const focusKey = phase === 'form' ? fieldFocus : phase === 'list' ? 'first' : 'back';

  // OK sobre un campo vacío abre el teclado; con texto, "Siguiente"/"Listo" (o Enter) avanza.
  const onFieldEnter = (e: ReactKeyboardEvent<HTMLInputElement>, next: () => void) => {
    if (e.key !== 'Enter' || !e.currentTarget.value) return;
    e.preventDefault();
    next();
  };

  let body: ReactNode;
  if (phase === 'unavailable') {
    body = (
      <div className="flex flex-col items-center text-center pt-24">
        <span className={`h-28 w-28 rounded-full border flex items-center justify-center ${TONE.muted}`}>
          <Icon d={ICON.lock} className="h-14 w-14" />
        </span>
        <h2 className="text-5xl font-semibold mt-8">La red la administra tu proveedor</h2>
        <p className="text-2xl text-white/60 mt-4">Desde este equipo no se puede cambiar. Si necesitás ayuda, comunicate con tu proveedor.</p>
      </div>
    );
  } else if (phase === 'connecting' || phase === 'done') {
    body = (
      <div role="status" aria-live="polite" className="flex flex-col items-center text-center pt-24">
        <span className="relative h-28 w-28 flex-none">
          {!done && <Spinner className="absolute top-0 left-0 h-full w-full" />}
          <span className={`absolute top-3 left-3 h-[5.5rem] w-[5.5rem] rounded-full border flex items-center justify-center ${done ? TONE.emerald : TONE.sky}`}>
            <Icon d={done ? ICON.check : ICON.wifi} className="h-11 w-11" />
          </span>
        </span>
        <h2 className="text-5xl font-semibold mt-8 max-w-full truncate">{done ? `Conectado a ${done}` : `Conectando a ${connecting}…`}</h2>
        <p className="text-2xl text-white/60 mt-4">
          {done ? 'Listo. Volviendo a la pantalla anterior…' : 'Puede tardar unos segundos. Presioná Atrás para cancelar.'}
        </p>
      </div>
    );
  } else if (selected) {
    const network = manual ? null : (selected as WifiNetwork);
    body = (
      <>
        <FeedbackBar feedback={error ? { kind: 'error', text: error } : null} />
        <SectionLabel>{manual ? 'Otra red' : 'Conectarte a'}</SectionLabel>
        <div className="flex items-center mb-8">
          <IconBadge icon={manual ? ICON.plus : ICON.wifi} tone="sky" />
          <div className="flex-1 min-w-0">
            <h2 className="text-4xl font-semibold truncate">{network ? network.ssid : 'Una red que no aparece en la lista'}</h2>
            <p className="text-2xl text-white/60 truncate">
              {network ? `${networkDetail(network, current)} · Señal ${signalLabel(network.level).toLowerCase()}` : 'Escribí el nombre tal cual figura en el módem, con mayúsculas y minúsculas.'}
            </p>
          </div>
          {network && <SignalBars level={network.level} />}
        </div>

        {manual && (
          <div className="flex mb-6">
            <Field icon={ICON.wifi} label="Nombre de la red">
              <input
                data-nav
                data-key="ssid"
                aria-label="Nombre de red"
                value={ssid}
                maxLength={32}
                placeholder="Presioná OK para escribir"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                onChange={(e) => setSsid(e.target.value)}
                onKeyDown={(e) => onFieldEnter(e, () => passwordRef.current?.focus())}
                className={INPUT}
              />
            </Field>
          </div>
        )}

        <div className="flex items-start">
          <Field icon={ICON.lock} label="Contraseña" hint={manual ? 'Dejala vacía si la red es abierta. Si tiene contraseña, entre 8 y 63 caracteres.' : 'Entre 8 y 63 caracteres.'}>
            <input
              ref={passwordRef}
              data-nav
              data-key="password"
              data-row="password"
              aria-label="Contraseña"
              type={show ? 'text' : 'password'}
              value={password}
              maxLength={63}
              placeholder="Presioná OK para escribir"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => onFieldEnter(e, submit)}
              className={INPUT}
            />
          </Field>
          {/* Alineado con el campo (debajo de la etiqueta): se llega con ▶ desde el final de la contraseña. */}
          <button
            data-nav
            data-row="password"
            aria-pressed={show}
            onClick={() => setShow(!show)}
            className="flex-none h-20 mt-10 ml-4 px-6 rounded-2xl border border-white/15 bg-white/5 flex items-center text-2xl text-white/75 outline-none focus:border-white/70 focus:bg-white/15 focus:text-white focus:ring-4 focus:ring-sky-300/40"
          >
            <Icon d={show ? ICON.eyeOff : ICON.eye} className="h-8 w-8 mr-3" />
            {show ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <div className="flex items-center mt-10">
          <button data-nav data-row="actions" onClick={submit} className={`${BUTTON} px-14 border-sky-400 bg-sky-400 text-[#05070c]`}>
            Conectar
          </button>
          <button data-nav data-row="actions" onClick={back} className={`${BUTTON} px-10 ml-6 border-white/25 bg-white/10 text-white`}>
            Cancelar
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <FeedbackBar feedback={error ? { kind: 'error', text: error } : scanning ? { kind: 'info', text: 'Buscando redes…' } : null} />
        <SectionLabel>Redes cercanas</SectionLabel>
        <div className="flex flex-col space-y-3">
          {networks.map((n, i) => {
            const isCurrent = n.ssid === current;
            return (
              <button
                key={n.ssid}
                data-nav
                data-key={i === 0 ? 'first' : undefined}
                data-index={i === 0 ? 0 : undefined}
                disabled={n.unsupported}
                onClick={() => choose(n)}
                className={`${ROW} py-4 border-white/10 bg-white/5 disabled:opacity-40`}
              >
                <IconBadge icon={ICON.wifi} tone={isCurrent ? 'emerald' : 'muted'} small />
                <span className="flex-1 min-w-0 flex flex-col mr-6">
                  <span className="text-3xl font-semibold truncate">{n.ssid}</span>
                  <span className={`text-xl truncate ${isCurrent ? 'text-emerald-300' : 'text-white/60'}`}>{networkDetail(n, current)}</span>
                </span>
                {n.secure && <Icon d={ICON.lock} className="flex-none h-7 w-7 text-white/45 mr-5" />}
                <SignalBars level={n.level} />
                {!n.unsupported && <OkHint idle="" action={isCurrent ? 'Reconectar' : 'Conectar'} />}
              </button>
            );
          })}
          {networks.length === 0 && !scanning && (
            <p className="rounded-2xl border border-white/10 px-6 py-5 text-2xl text-white/60">No se encontraron redes cerca. Acercá el equipo al módem y buscá de nuevo.</p>
          )}
          <ActionRow
            navKey={networks.length === 0 ? 'first' : 'other'}
            index={networks.length === 0 ? 0 : undefined}
            compact
            icon={ICON.plus}
            tone="muted"
            title="Otra red"
            detail="Para una red oculta o que no aparece en la lista."
            idle=""
            action="Escribir"
            onSelect={() => choose('manual')}
          />
          <ActionRow
            navKey="scan"
            compact
            icon={ICON.refresh}
            tone="muted"
            title="Buscar de nuevo"
            detail="Actualiza la lista de redes cercanas."
            idle=""
            action="Buscar"
            onSelect={() => void scan()}
          />
        </div>
      </>
    );
  }

  return (
    <Shell
      overlay
      title="Red Wi-Fi"
      backLabel={backLabel}
      okLabel={phase === 'form' ? 'Elegir o abrir el teclado' : 'Elegir'}
      focusKey={focusKey}
      focusToken={`${phase}|${networks.length > 0}|${attempt}`}
      dim={dim}
      onBack={back}
      aside={
        <>
          <ConnectionCard status={status} />
          {phase === 'form' && <TypingTips />}
        </>
      }
    >
      {body}
    </Shell>
  );
}
