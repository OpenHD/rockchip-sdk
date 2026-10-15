import { useEffect, useState } from 'react';

/**
 * Estado que publica nex-agent en /agent/ui-state.json (ver docs/GESTION_REMOTA.md).
 * Es de solo lectura: la UI nunca decide si el equipo está bloqueado, solo lo muestra.
 */
export type MdmMode = 'starting' | 'unpaired' | 'locked' | 'active';
export type MdmLockKind = 'manual' | 'payment' | 'clock' | 'offline';

export interface MdmApp {
  id: string;
  name: string;
  kind: 'web' | 'internal';
  launch_url: string | null;
}

export interface MdmState {
  mode: MdmMode;
  logo: string | null;
  companyName: string | null;
  deviceName: string | null;
  lockKind: MdmLockKind | null;
  lockMessage: string | null;
  lockReason: string | null;
  paymentDue: string | null;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  apps: MdmApp[];
}

export const isMdmBuild = import.meta.env.VITE_NEX_MDM === '1';

const STATE_URL = '/agent/ui-state.json';
const POLL_MS = 3000;
const STALE_MS = 15000;
/**
 * El agente reescribe el archivo en cada vuelta (cada ~5 s; una vuelta con
 * sync lento puede tardar ~1 min). Si deja de hacerlo, el archivo en /run
 * sigue ahí con el último estado: pasado este margen se lo ignora (falla cerrado).
 */
const AGENT_DEAD_MS = 120000;
const MODES: readonly MdmMode[] = ['starting', 'unpaired', 'locked', 'active'];
const LOCK_KINDS: readonly MdmLockKind[] = ['manual', 'payment', 'clock', 'offline'];

const STARTING: MdmState = {
  mode: 'starting',
  logo: null,
  companyName: null,
  deviceName: null,
  lockKind: null,
  lockMessage: null,
  lockReason: null,
  paymentDue: null,
  pairingCode: null,
  pairingExpiresAt: null,
  apps: [],
};

function str(v: unknown, max = 280): string | null {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;
}

function parseApp(v: unknown): MdmApp | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id, 41);
  const name = str(o.name, 60);
  if (!id || !name || (o.kind !== 'web' && o.kind !== 'internal')) return null;
  let launchUrl: string | null = null;
  if (o.kind === 'web') {
    try {
      const url = new URL(String(o.launch_url));
      if (url.protocol !== 'https:') return null;
      launchUrl = url.href;
    } catch {
      return null;
    }
  }
  return { id, name, kind: o.kind, launch_url: launchUrl };
}

/**
 * Valida todo lo que llega del archivo: ante cualquier duda, 'starting' (pantalla de espera).
 * Un estado viejo (agente caído) también cuenta como duda.
 */
export function parseAgentState(raw: unknown, now = Date.now()): MdmState {
  if (!raw || typeof raw !== 'object') return STARTING;
  const o = raw as Record<string, unknown>;
  const mode = MODES.find((m) => m === o.mode);
  if (!mode) return STARTING;
  if (typeof o.updated_at !== 'number' || now - o.updated_at * 1000 > AGENT_DEAD_MS) return STARTING;
  const logo = str(o.logo, 64);
  const lockKind = LOCK_KINDS.find((k) => k === o.lock_kind) ?? null;
  return {
    mode,
    logo: logo && /^\/agent\/logo\.(png|jpg|webp)$/.test(logo) ? logo : null,
    companyName: str(o.company_name, 80),
    deviceName: str(o.device_name, 80),
    lockKind,
    lockMessage: str(o.lock_message),
    lockReason: str(o.lock_reason),
    paymentDue: str(o.payment_due, 10),
    pairingCode: str(o.pairing_code, 8),
    pairingExpiresAt: str(o.pairing_expires_at, 40),
    apps: Array.isArray(o.apps)
      ? o.apps.map(parseApp).filter((a): a is MdmApp => a !== null)
      : [],
  };
}

export function useAgentState(): MdmState {
  const [state, setState] = useState<MdmState>(STARTING);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastOk = 0;

    const poll = async () => {
      let next: MdmState | null = null;
      try {
        const res = await fetch(STATE_URL, { cache: 'no-store' });
        if (res.ok) next = parseAgentState(await res.json());
      } catch {
        // Archivo ausente o ilegible.
      }
      if (cancelled) return;
      if (next) {
        lastOk = Date.now();
      } else if (Date.now() - lastOk > STALE_MS) {
        // Sin agente: pantalla de espera (falla cerrado). Un fallo aislado no interrumpe.
        next = STARTING;
      }
      if (next) {
        const value = next;
        setState((prev) => (JSON.stringify(prev) === JSON.stringify(value) ? prev : value));
      }
      timer = setTimeout(poll, POLL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return state;
}
