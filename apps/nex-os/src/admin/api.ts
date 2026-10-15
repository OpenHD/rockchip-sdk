import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, getSupabaseErrorMessage } from '../lib/supabase';

export interface Company {
  id: string;
  name: string;
  offline_lock_days: number;
  lock_message: string;
  logo_path: string | null;
  timezone: string;
  payment_grace_days: number;
  payment_warning_days: number;
  payment_message: string;
  /** v9: días después del vencimiento para pasar a "restringido". null = sin etapa (o sin efecto si >= gracia). */
  payment_restrict_days: number | null;
  /** v9: datos de pago que se muestran en el TV (la URL como QR). */
  payment_phone: string | null;
  payment_url: string | null;
  alert_telegram_chat_id: string | null;
  alert_emails: string[];
  alert_offline_hours: number;
  alert_kinds: AlertKind[];
  alert_digest: boolean;
}

export type AlertKind = 'lock_applied' | 'unlock_applied' | 'tamper' | 'offline' | 'piracy';

export interface DeviceHealth {
  mode?: string;
  lock_kind?: string | null;
  hardened?: boolean;
  dns_filter?: boolean;
  firewall?: boolean;
  uptime?: number;
  free_mb?: number;
  agent?: number;
}

export interface DeviceEvent {
  id: number;
  device_id: string | null;
  kind: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  details: Record<string, unknown>;
  created_at: string;
}

export const EVENT_LABELS: Record<string, string> = {
  lock_applied: 'Bloqueo aplicado',
  unlock_applied: 'Desbloqueo aplicado',
  clock_rollback: 'Reloj atrasado (intento de evitar el bloqueo)',
  policy_tampered: 'Política de navegación modificada',
  agent_restarted: 'Agente reiniciado sin reiniciar el equipo',
  image_not_hardened: 'Imagen sin modo TV cerrado',
  dns_filter_down: 'Filtro DNS caído',
  firewall_unavailable: 'Firewall no disponible',
  reflashed: 'Equipo reinstalado/reseteado (re-vinculado solo)',
  offline: 'Sin conexión',
  back_online: 'De nuevo en línea',
  piracy_attempt: 'Intento de abrir sitio pirata',
  agent_started: 'Equipo encendido',
  test: 'Aviso de prueba',
};

export const DEVICE_COLUMNS =
  'id, company_id, name, locked, lock_reason, firmware_version, last_seen_at, paired_at, paid_until, health, reported_mode, reported_lock_kind, reported_at, offline_alerted_at, external_ref, restricted, restrict_reason' as const;

export interface Device {
  id: string;
  company_id: string;
  name: string | null;
  locked: boolean;
  lock_reason: string | null;
  firmware_version: string | null;
  last_seen_at: string | null;
  paired_at: string | null;
  paid_until: string | null;
  health: DeviceHealth;
  reported_mode: string | null;
  reported_lock_kind: string | null;
  reported_at: string | null;
  offline_alerted_at: string | null;
  /** N.º de cliente del ISP (único por empresa). */
  external_ref: string | null;
  /** v9: restricción manual (menú y red sí, apps no). */
  restricted: boolean;
  restrict_reason: string | null;
}

/** Mismo formato que valida la base (mdm_devices.external_ref). */
export const EXTERNAL_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,63}$/;
/** Mismos formatos que valida mdm_update_company (v9). */
export const PAYMENT_PHONE_RE = /^[0-9 +()-]{5,32}$/;
export const PAYMENT_URL_RE = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][A-Za-z0-9._~%/+=&?#:@,;!*-]*)?$/;
export const PAYMENT_URL_MAX = 300;

/** Estado de servicio (v9), mismo cálculo que el servidor (service_state de la API del ISP). */
export type ServiceState = 'active' | 'warning' | 'restricted' | 'locked';

export const STATE_LOG_COLUMNS = 'id, device_id, state, source, details, at' as const;

/** Fila de mdm_device_state_log: cada cambio de estado (panel, API del ISP o lo que informó el equipo). */
export interface StateLogEntry {
  id: number;
  device_id: string;
  state: ServiceState;
  source: 'panel' | 'api' | 'device';
  details: Record<string, unknown>;
  at: string;
}

/** El equipo considera "online" si sincronizó en los últimos 5 minutos (sync cada 60 s). */
export function isOnline(d: Device): boolean {
  return !!d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 5 * 60_000;
}

export type Enforcement = 'confirmado' | 'pendiente' | 'sin datos';

/** ¿El equipo aplicó lo que pidió el panel? Compara el estado deseado con el que informó. */
export function enforcement(d: Device, c: Company): Enforcement {
  if (!d.reported_mode) return 'sin datos';
  const status = deviceStatus(d, c);
  const expected = status === 'bloqueado' || status === 'pago vencido' ? 'locked' : status === 'restringido' ? 'restricted' : 'active';
  const actual = d.reported_mode === 'locked' ? 'locked' : d.reported_mode === 'restricted' ? 'restricted' : 'active';
  return expected === actual ? 'confirmado' : 'pendiente';
}

export interface CatalogApp {
  id: string;
  name: string;
  kind: 'web' | 'internal';
  launch_url: string | null;
  icon_url: string | null;
  domains: string[];
  active: boolean;
  /** Se le pasa al servicio la atestación del equipo (JWT) al abrirlo. */
  pass_attestation?: boolean;
}

export interface UnlockCode {
  code: string;
  valid_on: string;
  hours: number;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/** Respuesta de mdm_create_api_key: la clave completa solo viaja esta vez. */
export interface NewApiKey {
  id: string;
  key: string;
  prefix: string;
}

export interface FirmwareRelease {
  id: string;
  version: string;
  build: number;
  url: string;
  sha256: string;
  size: number;
  sig: string;
  notes: string | null;
  created_at: string;
}

/** company_id null = target global. */
export interface FirmwareTarget {
  company_id: string | null;
  company_name: string | null;
  release_id: string;
  version: string;
  build: number;
  updated_at: string;
}

export interface Member {
  user_id: string;
  role: 'owner' | 'admin';
}

export interface AuditEntry {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface DomainReportRow {
  domain: string;
  devices: number;
  companies: number;
  hits: number;
  last_seen_at: string;
  status: 'pirateria' | 'legitimo' | 'ignorar' | null;
}

export const LOGO_BUCKET = 'mdm-branding';
export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function db(): SupabaseClient {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no configurado (VITE_SUPABASE_URL / KEY)');
  return client;
}

/** Ejecuta una consulta y convierte el error de Supabase en Error con mensaje legible. */
export async function run<T>(query: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(getSupabaseErrorMessage(error));
  return data as T;
}

export function logoUrl(path: string | null): string | null {
  if (!path) return null;
  return db().storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Valida tipo real del archivo por su firma, no solo por la extensión declarada. */
export async function sniffImageType(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp';
  return null;
}

export type DeviceStatus = 'activo' | 'bloqueado' | 'pago vencido' | 'restringido' | 'por vencer' | 'sin conexión';

/** Día (inclusive) en que el equipo pasa a restringido por pago, o null si la empresa no usa esa etapa. */
export function restrictDay(d: Device, c: Company): string | null {
  if (!d.paid_until || c.payment_restrict_days == null || c.payment_restrict_days >= c.payment_grace_days) return null;
  return addDays(d.paid_until, 1 + c.payment_restrict_days);
}

/** Mismo orden que el servidor: bloqueo manual > pago vencido > restringido manual > restringido por pago > aviso. */
export function serviceState(d: Device, c: Company): ServiceState {
  if (d.locked) return 'locked';
  if (!d.paid_until) return d.restricted ? 'restricted' : 'active';
  const today = new Date().toISOString().slice(0, 10);
  if (today >= addDays(d.paid_until, 1 + c.payment_grace_days)) return 'locked';
  const rDay = restrictDay(d, c);
  if (d.restricted || (rDay && today >= rDay)) return 'restricted';
  if (today >= addDays(d.paid_until, 1 - c.payment_warning_days)) return 'warning';
  return 'active';
}

export function deviceStatus(d: Device, c: Company): DeviceStatus {
  const state = serviceState(d, c);
  if (d.locked) return 'bloqueado';
  if (state === 'locked') return 'pago vencido';
  if (state === 'restricted') return 'restringido';
  if (state === 'warning') return 'por vencer';
  if (d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() > c.offline_lock_days * 86_400_000) {
    return 'sin conexión';
  }
  return 'activo';
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
