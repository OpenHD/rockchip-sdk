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
  'id, company_id, name, locked, lock_reason, firmware_version, last_seen_at, paired_at, paid_until, health, reported_mode, reported_lock_kind, reported_at, offline_alerted_at' as const;

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
  const shouldLock = status === 'bloqueado' || status === 'pago vencido';
  const isLocked = d.reported_mode === 'locked';
  return shouldLock === isLocked ? 'confirmado' : 'pendiente';
}

export interface CatalogApp {
  id: string;
  name: string;
  kind: 'web' | 'internal';
  launch_url: string | null;
  icon_url: string | null;
  domains: string[];
  active: boolean;
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

export type DeviceStatus = 'activo' | 'bloqueado' | 'pago vencido' | 'por vencer' | 'sin conexión';

export function deviceStatus(d: Device, c: Company): DeviceStatus {
  if (d.locked) return 'bloqueado';
  if (d.paid_until) {
    const today = new Date().toISOString().slice(0, 10);
    const lockDay = addDays(d.paid_until, 1 + c.payment_grace_days);
    if (today >= lockDay) return 'pago vencido';
    if (today >= addDays(d.paid_until, 1 - c.payment_warning_days)) return 'por vencer';
  }
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
