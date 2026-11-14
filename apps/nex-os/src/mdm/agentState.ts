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
  /** Ícono real de una app Android, servido por el agente. null: la UI dibuja uno de línea. */
  icon: string | null;
  /** App de Play Store que la empresa habilitó y todavía no está instalada: al elegirla se abre su página en Play Store. */
  install: boolean;
}

export type NoticeCategory = 'corte' | 'clima' | 'salud' | 'municipal' | 'general';
export type NoticeSeverity = 'info' | 'importante' | 'emergencia';

/** Aviso de la empresa para este equipo. Texto plano: nunca se interpreta como HTML. */
export interface MdmNotice {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  severity: NoticeSeverity;
  /** Vencimiento, en segundos Unix. */
  expiresAt: number;
}

export interface MdmState {
  mode: MdmMode;
  wifiToken: string | null;
  /** false: NEX no es dueño del equipo. Si tampoco hay `guard`, la instalación está incompleta. */
  owner: boolean;
  /** Sin Device Owner, la protección por accesibilidad (Guard) está activa: el equipo igual queda protegido. */
  guard: boolean;
  /** El equipo tiene root: el técnico puede activar NEX desde la TV. */
  root: boolean;
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
  /** Avisos que este equipo todavía no marcó como leídos, del más grave al más leve (máximo 5). */
  notices: MdmNotice[];
  /** Versión instalada de NEX TV (la publica el agente de Android). null: el agente no la informa. */
  version: string | null;
  /** Número de compilación de NEX TV. null: el agente no lo informa. */
  build: number | null;
}

export const isMdmBuild = import.meta.env.VITE_NEX_MDM === '1';

const STATE_URL = '/agent/ui-state.json';
const POLL_MS = 3000;
const STALE_MS = 15000;
const MODES: readonly MdmMode[] = ['starting', 'unpaired', 'locked', 'active'];
const LOCK_KINDS: readonly MdmLockKind[] = ['manual', 'payment', 'clock', 'offline'];
const NOTICE_CATEGORIES: readonly NoticeCategory[] = ['corte', 'clima', 'salud', 'municipal', 'general'];
/** Del más leve al más grave: la posición es el rango. */
export const NOTICE_SEVERITIES: readonly NoticeSeverity[] = ['info', 'importante', 'emergencia'];
export const MAX_NOTICES = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Única forma válida de la URL de instalación: el origen local del agente y un nombre de paquete Android. */
const PLAY_INSTALL_URL = /^https:\/\/appassets\.androidplatform\.net\/android-play\/[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

const STARTING: MdmState = {
  mode: 'starting',
  wifiToken: null,
  owner: true,
  guard: false,
  root: false,
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
  notices: [],
  version: null,
  build: null,
};

function str(v: unknown, max = 280): string | null {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;
}

/** Solo versiones con forma de versión ("0.1.0", "1.4.2-beta"): cualquier otro texto se descarta. */
const VERSION = /^\d{1,5}(\.\d{1,5}){1,3}([-+][0-9A-Za-z.]{1,16})?$/;

function parseVersion(v: unknown): string | null {
  return typeof v === 'string' && VERSION.test(v) ? v : null;
}

function parseBuild(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null;
}

function parseApp(v: unknown): MdmApp | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id, 41);
  const name = str(o.name, 60);
  if (!id || !name || (o.kind !== 'web' && o.kind !== 'internal')) return null;
  let launchUrl: string | null = null;
  if (o.install === true) {
    // Se compara el texto tal cual llega (sin normalizar con URL): cualquier otra forma se descarta.
    if (o.kind !== 'web' || typeof o.launch_url !== 'string' || o.launch_url.length > 300) return null;
    if (!id.startsWith('play:') || !PLAY_INSTALL_URL.test(o.launch_url)) return null;
    // Todavía no hay ícono real: la UI dibuja un mosaico con la inicial.
    return { id, name, kind: 'web', launch_url: o.launch_url, icon: null, install: true };
  }
  if (o.kind === 'web') {
    try {
      const url = new URL(String(o.launch_url));
      if (url.protocol !== 'https:') return null;
      launchUrl = url.href;
    } catch {
      return null;
    }
  }
  // Solo la ruta local del agente: por este campo la UI no carga imágenes de afuera.
  const icon = typeof o.icon === 'string' && /^\/agent\/icon\/[\w.]+$/.test(o.icon) ? o.icon : null;
  return { id, name, kind: o.kind, launch_url: launchUrl, icon, install: false };
}

function parseNotice(v: unknown): MdmNotice | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !UUID.test(o.id)) return null;
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 80) : '';
  if (!title) return null;
  if (typeof o.expires_at !== 'number' || !Number.isFinite(o.expires_at) || o.expires_at <= 0) return null;
  // Un aviso con gravedad desconocida se descarta: mostrarlo de más o de menos sería un error.
  const severity = NOTICE_SEVERITIES.find((s) => s === o.severity);
  if (!severity) return null;
  const body = typeof o.body === 'string'
    ? o.body.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 500)
    : '';
  return {
    id: o.id.toLowerCase(),
    title,
    body,
    category: NOTICE_CATEGORIES.find((c) => c === o.category) ?? 'general',
    severity,
    expiresAt: o.expires_at,
  };
}

function parseNotices(v: unknown): MdmNotice[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: MdmNotice[] = [];
  for (const item of v) {
    const n = parseNotice(item);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  // El agente ya los manda ordenados; se reordena igual para no depender de eso.
  const rank = (n: MdmNotice) => NOTICE_SEVERITIES.indexOf(n.severity);
  return out
    .map((n, i) => ({ n, i }))
    .sort((a, b) => rank(b.n) - rank(a.n) || a.i - b.i)
    .map((x) => x.n)
    .slice(0, MAX_NOTICES);
}

/** Valida todo lo que llega del archivo: ante cualquier duda, 'starting' (pantalla de espera). */
export function parseAgentState(raw: unknown): MdmState {
  if (!raw || typeof raw !== 'object') return STARTING;
  const o = raw as Record<string, unknown>;
  const mode = MODES.find((m) => m === o.mode);
  if (!mode) return STARTING;
  const logo = str(o.logo, 64);
  const lockKind = LOCK_KINDS.find((k) => k === o.lock_kind) ?? null;
  return {
    mode,
    wifiToken: str(o.wifi_token, 64),
    // El agente de Linux no publica "owner": ahí no aplica.
    owner: o.owner !== false,
    guard: o.guard === true,
    root: o.root === true,
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
    notices: parseNotices(o.notices),
    version: parseVersion(o.version),
    build: parseBuild(o.build),
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
