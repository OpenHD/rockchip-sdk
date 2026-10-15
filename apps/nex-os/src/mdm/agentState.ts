import { useEffect, useState } from 'react';

/**
 * Estado que publica nex-agent en /agent/ui-state.json (ver docs/GESTION_REMOTA.md).
 * Es de solo lectura: la UI nunca decide si el equipo está bloqueado, solo lo muestra.
 */
export type MdmMode = 'starting' | 'unpaired' | 'locked' | 'restricted' | 'active';
export type MdmLockKind = 'manual' | 'payment' | 'clock' | 'offline';
/** Restringido: el menú y la red funcionan, las apps no (ver "Estados del equipo" en la doc). */
export type MdmRestrictKind = 'manual' | 'payment';

export interface MdmApp {
  id: string;
  name: string;
  kind: 'web' | 'internal';
  launch_url: string | null;
  /** La empresa habilitó pasarle al servicio la atestación del equipo (JWT). */
  pass_attestation: boolean;
  /** En modo restringido las apps se muestran, pero no se pueden abrir. */
  disabled: boolean;
}

/** Datos para que el usuario pague (los define el ISP en el panel). */
export interface MdmPayment {
  /** Fecha de vencimiento (YYYY-MM-DD). */
  due: string | null;
  phone: string | null;
  /** https: se muestra como QR para abrir en el celular. */
  url: string | null;
  message: string | null;
}

export interface MdmWifiNetwork {
  ssid: string;
  /** dBm (negativo; más cerca de 0 = mejor señal). */
  signal: number;
  secure: boolean;
}

export interface MdmWifi {
  iface: string | null;
  state: string | null;
  ssid: string | null;
  ip: string | null;
  scan: MdmWifiNetwork[];
  scannedAt: number | null;
  error: string | null;
}

export type MdmUnlockResult = 'ok' | 'invalid' | 'rate_limited' | 'unavailable';

export interface MdmUnlock {
  result: MdmUnlockResult | null;
  /** Epoch (s) del último intento procesado por el agente. */
  at: number | null;
  /** Epoch (s) hasta el que dura el desbloqueo por código. */
  until: number | null;
}

export type MdmUpdateState = 'downloading' | 'verifying' | 'installing' | 'failed';

export interface MdmUpdate {
  state: MdmUpdateState;
  version: string | null;
}

export interface MdmState {
  mode: MdmMode;
  logo: string | null;
  companyName: string | null;
  deviceName: string | null;
  lockKind: MdmLockKind | null;
  restrictKind: MdmRestrictKind | null;
  /** Aviso de pago próximo a vencer (banner fijo en el home). */
  serviceWarning: boolean;
  payment: MdmPayment | null;
  lockMessage: string | null;
  lockReason: string | null;
  paymentDue: string | null;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  apps: MdmApp[];
  wifi: MdmWifi | null;
  unlock: MdmUnlock;
  /** JWT de atestación: solo en modo 'active'. */
  attestation: string | null;
  update: MdmUpdate | null;
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
const MODES: readonly MdmMode[] = ['starting', 'unpaired', 'locked', 'restricted', 'active'];
const LOCK_KINDS: readonly MdmLockKind[] = ['manual', 'payment', 'clock', 'offline'];
const RESTRICT_KINDS: readonly MdmRestrictKind[] = ['manual', 'payment'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^[0-9 +()-]{5,32}$/;
const UNLOCK_RESULTS: readonly MdmUnlockResult[] = ['ok', 'invalid', 'rate_limited', 'unavailable'];
const UPDATE_STATES: readonly MdmUpdateState[] = ['downloading', 'verifying', 'installing', 'failed'];
const MAX_SCAN = 40;
/** JWT compacto (header.payload.firma en base64url) y de tamaño acotado. */
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const NO_UNLOCK: MdmUnlock = { result: null, at: null, until: null };

const STARTING: MdmState = {
  mode: 'starting',
  logo: null,
  companyName: null,
  deviceName: null,
  lockKind: null,
  restrictKind: null,
  serviceWarning: false,
  payment: null,
  lockMessage: null,
  lockReason: null,
  paymentDue: null,
  pairingCode: null,
  pairingExpiresAt: null,
  apps: [],
  wifi: null,
  unlock: NO_UNLOCK,
  attestation: null,
  update: null,
};

function str(v: unknown, max = 280): string | null {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;
}

/** Entero acotado (epoch, dBm…); cualquier otra cosa es null. */
function int(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const EPOCH_MAX = 2 ** 32;

function parseNetwork(v: unknown): MdmWifiNetwork | null {
  const o = obj(v);
  if (!o) return null;
  const ssid = str(o.ssid, 32);
  const signal = int(o.signal, -127, 0);
  if (!ssid || signal === null) return null;
  return { ssid, signal, secure: o.secure !== false };
}

function parseWifi(v: unknown): MdmWifi | null {
  const o = obj(v);
  if (!o) return null;
  const state = str(o.state, 24);
  const ip = str(o.ip, 45);
  return {
    iface: str(o.iface, 16),
    state: state && /^[a-z_]+$/.test(state) ? state : null,
    ssid: str(o.ssid, 32),
    ip: ip && /^[0-9a-fA-F.:]+$/.test(ip) ? ip : null,
    scan: Array.isArray(o.scan)
      ? o.scan
          .slice(0, MAX_SCAN)
          .map(parseNetwork)
          .filter((n): n is MdmWifiNetwork => n !== null)
      : [],
    scannedAt: int(o.scanned_at, 0, EPOCH_MAX),
    error: str(o.error, 160),
  };
}

function parseUnlock(v: unknown): MdmUnlock {
  const o = obj(v);
  if (!o) return NO_UNLOCK;
  return {
    result: UNLOCK_RESULTS.find((r) => r === o.result) ?? null,
    at: int(o.at, 0, EPOCH_MAX),
    until: int(o.until, 0, EPOCH_MAX),
  };
}

function parseUpdate(v: unknown): MdmUpdate | null {
  const o = obj(v);
  const state = o && UPDATE_STATES.find((s) => s === o.state);
  if (!o || !state) return null;
  return { state, version: str(o.version, 32) };
}

function httpsUrl(v: unknown, max = 300): string | null {
  const raw = str(v, max + 1);
  if (!raw || raw.length > max) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function parsePayment(v: unknown): MdmPayment | null {
  const o = obj(v);
  if (!o) return null;
  const due = str(o.due, 10);
  const phone = str(o.phone, 32);
  return {
    due: due && DATE_RE.test(due) ? due : null,
    phone: phone && PHONE_RE.test(phone) ? phone : null,
    url: httpsUrl(o.url),
    message: str(o.message),
  };
}

function parseApp(v: unknown): MdmApp | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id, 41);
  const name = str(o.name, 60);
  if (!id || !name || (o.kind !== 'web' && o.kind !== 'internal')) return null;
  // Deshabilitada (modo restringido): sin URL, nunca se abre.
  if (o.disabled === true) return { id, name, kind: o.kind, launch_url: null, pass_attestation: false, disabled: true };
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
  return { id, name, kind: o.kind, launch_url: launchUrl, pass_attestation: o.pass_attestation === true, disabled: false };
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
  const jwt = str(o.attestation, 4096);
  return {
    mode,
    logo: logo && /^\/agent\/logo\.(png|jpg|webp)$/.test(logo) ? logo : null,
    companyName: str(o.company_name, 80),
    deviceName: str(o.device_name, 80),
    lockKind,
    restrictKind: mode === 'restricted' ? (RESTRICT_KINDS.find((k) => k === o.restrict_kind) ?? 'manual') : null,
    serviceWarning: mode === 'active' && o.service_warning === true,
    payment: parsePayment(o.payment),
    lockMessage: str(o.lock_message),
    lockReason: str(o.lock_reason),
    paymentDue: str(o.payment_due, 10),
    pairingCode: str(o.pairing_code, 8),
    pairingExpiresAt: str(o.pairing_expires_at, 40),
    apps: Array.isArray(o.apps)
      ? o.apps
          .map(parseApp)
          .filter((a): a is MdmApp => a !== null)
          // Fuera del modo activo ninguna app se puede abrir, diga lo que diga el archivo.
          .map((a) => (mode === 'active' ? a : { ...a, launch_url: null, pass_attestation: false, disabled: true }))
      : [],
    wifi: parseWifi(o.wifi),
    unlock: parseUnlock(o.unlock),
    // Solo con el equipo activo: un equipo bloqueado nunca presenta atestación.
    attestation: mode === 'active' && jwt && JWT_RE.test(jwt) ? jwt : null,
    update: parseUpdate(o.update),
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
