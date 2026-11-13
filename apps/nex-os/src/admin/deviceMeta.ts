import { CircleCheck, Clock, CreditCard, Lock, WifiOff, type LucideIcon } from 'lucide-react';
import { deviceStatus, isOnline, type Company, type Device, type DeviceStatus } from './api';
import { daysFromToday, formatDate } from './format';
import type { Tone } from './ui';

/** Presentación del estado de un equipo (compartido entre Resumen y Equipos). */
export const STATUS_META: Record<DeviceStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  activo: { tone: 'success', icon: CircleCheck, label: 'Activo' },
  bloqueado: { tone: 'danger', icon: Lock, label: 'Bloqueado' },
  'pago vencido': { tone: 'danger', icon: CreditCard, label: 'Pago vencido' },
  'por vencer': { tone: 'warning', icon: Clock, label: 'Pago por vencer' },
  'sin conexión': { tone: 'neutral', icon: WifiOff, label: 'Sin conexión' },
};

export function healthIssues(d: Device): string[] {
  const h = d.health ?? {};
  return [
    h.hardened === false && 'Imagen sin modo TV cerrado',
    h.dns_filter === false && 'Filtro DNS caído',
    h.firewall === false && 'Firewall no disponible',
  ].filter(Boolean) as string[];
}

export function paymentText(d: Device, c: Company): { text: string; tone: string } {
  if (!d.paid_until) return { text: 'Sin control de pago', tone: 'text-zinc-500' };
  const days = daysFromToday(d.paid_until);
  if (days < 0) return { text: `Vencido hace ${-days} ${-days === 1 ? 'día' : 'días'}`, tone: 'text-rose-300' };
  if (days === 0) return { text: 'Vence hoy', tone: 'text-amber-300' };
  if (days <= c.payment_warning_days) return { text: `Vence en ${days} ${days === 1 ? 'día' : 'días'}`, tone: 'text-amber-300' };
  return { text: `Hasta ${formatDate(d.paid_until)}`, tone: 'text-zinc-300' };
}

export type Filter = 'todos' | 'online' | 'bloqueados' | 'vencidos' | 'por-vencer' | 'offline' | 'alertas';

export const FILTERS: { id: Filter; label: string; test: (d: Device, c: Company) => boolean }[] = [
  { id: 'todos', label: 'Todos', test: () => true },
  { id: 'online', label: 'En línea', test: (d) => isOnline(d) },
  { id: 'bloqueados', label: 'Bloqueados', test: (d, c) => ['bloqueado', 'pago vencido'].includes(deviceStatus(d, c)) },
  { id: 'vencidos', label: 'Pago vencido', test: (d, c) => deviceStatus(d, c) === 'pago vencido' },
  { id: 'por-vencer', label: 'Por vencer', test: (d, c) => deviceStatus(d, c) === 'por vencer' },
  { id: 'offline', label: 'Sin conexión', test: (d) => !isOnline(d) },
  { id: 'alertas', label: 'Con alertas', test: (d) => healthIssues(d).length > 0 },
];

