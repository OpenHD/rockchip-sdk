import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

type Status = { ssid: string | null; connected: boolean; ethernet: boolean; level: number; ip: string | null };
type Network = { ssid: string; level: number; secure: boolean; saved: boolean; unsupported: boolean };
const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack']);
const BUTTON = 'rounded-xl border border-white/15 bg-white/5 px-5 py-4 text-xl outline-none focus:bg-white/20 focus:border-sky-300 focus:ring-2 focus:ring-sky-300';

async function request(path: string) {
  const res = await fetch(`/agent/wifi/${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Wi-Fi no disponible');
  return res.json();
}

/** Red local: el token solo se publica en el origen privado del agente. */
export default function WifiScreen({ token, onClose }: { token: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [unavailable, setUnavailable] = useState(!token);
  const [selected, setSelected] = useState<Network | 'manual' | null>(null);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scan = useCallback(async () => {
    if (!token) return;
    setMessage('Buscando redes…');
    try {
      const data = await request('scan');
      if (!alive.current) return;
      setStatus(data.status);
      setNetworks(data.networks);
      setMessage('');
      setUnavailable(false);
    } catch {
      if (alive.current) setUnavailable(true);
    }
  }, [token]);

  useEffect(() => {
    alive.current = true;
    const scanTimer = setTimeout(() => void scan(), 0);
    return () => { alive.current = false; clearTimeout(scanTimer); clearTimeout(timer.current); };
  }, [scan]);

  // El foco va a lo útil (primera red, el nombre o la contraseña), no a "Volver": con el control cada paso cuenta.
  const hasNetworks = networks.length > 0;
  useEffect(() => {
    const root = ref.current;
    (root?.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)') ?? root?.querySelector<HTMLElement>('input, button:not(:disabled)'))?.focus();
  }, [selected, unavailable, busy, hasNetworks]);

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      // Retroceso dentro del campo permite corregir el texto con el teclado.
      if (!BACK_KEYS.has(e.key) || (e.key === 'Backspace' && e.target instanceof HTMLInputElement)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [onClose]);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      cancelled = true;
      clearTimeout(timer.current);
      setBusy(false);
      setTarget(null);
      setMessage('No se pudo conectar. Revisá la contraseña.');
    }, 25000);
    const poll = async () => {
      try {
        const next: Status = await request('status');
        if (cancelled) return;
        setStatus(next);
        if (next.connected && next.ssid === target) {
          clearTimeout(timeout);
          setMessage(`Conectado a ${target}`);
          timer.current = setTimeout(onClose, 2000);
          return;
        }
      } catch {
        // Una lectura fallida no interrumpe el intento de conexión.
      }
      if (cancelled) return;
      timer.current = setTimeout(poll, 1500);
    };
    timer.current = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timeout); clearTimeout(timer.current); };
  }, [target, onClose]);

  const connect = async (name: string, pass: string) => {
    if (busy) return;
    if ((selected !== null && selected !== 'manual' && pass.length < 8) || (pass.length > 0 && (pass.length < 8 || pass.length > 63))) {
      setMessage('La contraseña debe tener entre 8 y 63 caracteres.');
      return;
    }
    setBusy(true);
    setMessage('Conectando…');
    try {
      const data = await request(`connect?ssid=${encodeURIComponent(name)}&password=${encodeURIComponent(pass)}&token=${encodeURIComponent(token ?? '')}`);
      if (!alive.current) return;
      if (!data.ok) {
        setBusy(false);
        setMessage(data.error || 'No se pudo conectar. Revisá la contraseña.');
        return;
      }
      setTarget(name);
    } catch {
      if (alive.current) { setBusy(false); setUnavailable(true); }
    }
  };

  const navigate = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const input = e.target instanceof HTMLInputElement;
    if (input && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault();
    e.stopPropagation();
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[Math.min(Math.max(index + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1), 0), items.length - 1)]?.focus();
  };

  const choose = (network: Network | 'manual') => {
    setMessage('');
    setPassword('');
    setShow(false);
    if (network !== 'manual' && !network.secure) { void connect(network.ssid, ''); return; }
    setSsid(network === 'manual' ? '' : network.ssid);
    setSelected(network);
  };
  const line = status?.ethernet ? 'Conectado por cable' : status?.connected && status.ssid ? `Conectado a ${status.ssid}` : 'Sin conexión';

  return (
    <div ref={ref} onKeyDown={navigate} className="fixed inset-0 z-50 bg-[#05070c] text-white flex flex-col px-16 py-10 overflow-auto space-y-6">
      <header className="flex items-center justify-between">
        <div><h1 className="text-4xl font-semibold">Red</h1><p className="text-xl text-white/60 mt-3">{line}</p></div>
        <button className={BUTTON} onClick={onClose}>← Volver</button>
      </header>
      {unavailable ? <p className="text-2xl">La red la administra tu proveedor.</p> : <>
        <p role="status" className="text-2xl text-sky-300">{message}</p>
        {selected ? <div className="flex flex-col space-y-5 max-w-3xl">
          <h2 className="text-3xl">{selected === 'manual' ? 'Otra red' : selected.ssid}</h2>
          {selected === 'manual' && <label className="text-xl">Nombre de red (SSID)
            {/* Enter o "Siguiente" del teclado en pantalla pasa a la contraseña (con el teclado abierto las flechas lo mueven a él). */}
            <input aria-label="Nombre de red" data-autofocus value={ssid} onChange={(e) => setSsid(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus(); } }}
              className={`${BUTTON} block w-full mt-2`} />
          </label>}
          <label className="text-xl">Contraseña{selected === 'manual' ? ' (dejá vacío si es abierta)' : ''}
            <input ref={passwordRef} aria-label="Contraseña" data-autofocus={selected !== 'manual' || undefined} type={show ? 'text' : 'password'} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void connect(ssid, password); } }}
              className={`${BUTTON} block w-full mt-2`} />
          </label>
          <button className={BUTTON} onClick={() => setShow(!show)}>{show ? 'Ocultar' : 'Mostrar'}</button>
          <button className={BUTTON} disabled={busy} onClick={() => void connect(ssid, password)}>Conectar</button>
          <button className={BUTTON} disabled={busy} onClick={() => { setSelected(null); setMessage(''); }}>Cancelar</button>
        </div> : <div className="flex flex-col space-y-3">
          <button className={BUTTON} disabled={busy} onClick={() => void scan()}>Buscar redes</button>
          {networks.map((network, i) => <button key={network.ssid} data-autofocus={i === 0 || undefined} className={`${BUTTON} flex items-center justify-between text-left`} disabled={busy || network.unsupported} onClick={() => choose(network)}>
            <span>{network.ssid}</span><span className="text-white/60">{'▮'.repeat(network.level)}{'▯'.repeat(4 - network.level)} {network.secure ? '🔒' : ''} {network.saved ? 'Guardada' : ''} {network.unsupported ? 'No compatible' : ''}</span>
          </button>)}
          <button className={BUTTON} disabled={busy} onClick={() => choose('manual')}>Otra red…</button>
        </div>}
      </>}
    </div>
  );
}
