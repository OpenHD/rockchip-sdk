import { useMemo, useState } from 'react';
import {
  Bell,
  ChevronRight,
  CircleCheck,
  Clock,
  CreditCard,
  HeartPulse,
  Hourglass,
  Lock,
  LockOpen,
  MapPin,
  Power,
  RadioTower,
  RefreshCw,
  ShieldAlert,
  Skull,
  TriangleAlert,
  Tv,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { deviceStatus, enforcement, EVENT_LABELS, isOnline, type Company, type DeviceEvent, type DeviceStatus, type ZoneStatus } from '../api';
import { HealthSummary } from '../DeviceHealth';
import { statusBreakdown } from '../deviceList';
import { healthIssues, STATUS_META, type Filter } from '../deviceMeta';
import { relativeTime } from '../format';
import { TONE_DOT, type Tone } from '../tones';
import { Button, Card, EmptyState, ErrorState, ErrorText, PageHeader, Segmented, Skeleton } from '../ui';
import type { CompanyData } from '../useCompanyData';
import { devicesText, NO_ZONE, onlinePercent, outageSince, outageSummary, sortZonesByUrgency, zoneEventDetail, zoneOffline } from '../zones';

const EVENT_ICON: Record<string, LucideIcon> = {
  lock_applied: Lock,
  unlock_applied: LockOpen,
  clock_rollback: Clock,
  policy_tampered: ShieldAlert,
  agent_restarted: RefreshCw,
  image_not_hardened: ShieldAlert,
  dns_filter_down: ShieldAlert,
  firewall_unavailable: ShieldAlert,
  reflashed: TriangleAlert,
  offline: WifiOff,
  back_online: Wifi,
  piracy_attempt: Skull,
  agent_started: Power,
  test: Bell,
  zone_outage: RadioTower,
  zone_restored: Wifi,
};

const SEVERITY_RING: Record<DeviceEvent['severity'], string> = {
  critical: 'bg-danger-soft text-danger ring-danger',
  warning: 'bg-warn-soft text-warn ring-warn',
  info: 'bg-fill-2 text-fg-3 ring-line',
};

/** Filtro del listado de equipos al que lleva cada estado. "Activo" no tiene filtro propio. */
const STATUS_FILTER: Partial<Record<DeviceStatus, Filter>> = {
  bloqueado: 'bloqueados',
  'pago vencido': 'vencidos',
  restringido: 'restringidos',
  'por vencer': 'por-vencer',
  'sin conexión': 'offline',
};

interface Attention {
  id: string;
  deviceId: string;
  title: string;
  detail: string;
  tone: 'danger' | 'warning';
  icon: LucideIcon;
}

const KPI_TONE: Record<Tone, string> = {
  neutral: 'bg-fill-2 text-fg-3',
  success: 'bg-ok-soft text-ok',
  warning: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-accent-soft text-accent',
};

/** Número grande que lleva al listado ya filtrado. En cero queda apagado: solo llama la atención lo que hay que mirar. */
function Kpi({ label, value, hint, icon: Icon, tone, onClick }: { label: string; value: number; hint: string; icon: LucideIcon; tone: Tone; onClick: () => void }) {
  const active = value > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}. ${hint}. Ver en Equipos`}
      className="group flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition hover:border-line-strong hover:bg-surface-2"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${KPI_TONE[active ? tone : 'neutral']}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <ChevronRight className="h-4 w-4 text-fg-4 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className={`text-[28px] font-semibold leading-8 tabular-nums tracking-tight ${active ? 'text-fg' : 'text-fg-4'}`}>{value}</div>
        <div className="mt-1 truncate text-[13px] font-medium text-fg-2">{label}</div>
        <div className="truncate text-xs text-fg-4">{hint}</div>
      </div>
    </button>
  );
}

/** El parque de un vistazo: cuántos están en línea y cómo se reparten por estado. */
function FleetCard({ company, devices, online, goDevices }: { company: Company; devices: CompanyData['devices'] & object; online: number; goDevices: (filter: string) => void }) {
  const breakdown = useMemo(() => statusBreakdown(devices, company), [devices, company]);
  const total = devices.length;
  const pct = total ? Math.round((online / total) * 100) : 0;
  const description = breakdown.map((b) => `${b.count} ${STATUS_META[b.status].label.toLowerCase()}`).join(', ');
  return (
    <Card
      title="Equipos"
      description={`${total} ${total === 1 ? 'vinculado' : 'vinculados'} a ${company.name}`}
      action={<Button size="sm" variant="secondary" onClick={() => goDevices('todos')}>Ver todos</Button>}
      className="xl:col-span-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold leading-none tabular-nums tracking-tight text-fg">{online}</span>
          <span className="text-sm text-fg-3">de {total} en línea</span>
        </div>
        <button type="button" onClick={() => goDevices('offline')} className="rounded-md text-[13px] text-fg-3 underline-offset-4 transition hover:text-fg hover:underline">
          {total - online === 0 ? 'Ninguno sin conexión' : `${total - online} sin conexión ahora`}
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fill-2" role="img" aria-label={`${pct}% de los equipos en línea`}>
        <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-fg-4">Estado del servicio</div>
      <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Estado de ${total} equipos: ${description}`}>
        {breakdown.map((b) => (
          <span key={b.status} className={`h-full min-w-[6px] ${TONE_DOT[STATUS_META[b.status].tone]}`} style={{ flexGrow: b.count, flexBasis: 0 }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-1 gap-y-1">
        {breakdown.map((b) => {
          const meta = STATUS_META[b.status];
          const filter = STATUS_FILTER[b.status];
          const content = (
            <>
              <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[meta.tone]}`} aria-hidden />
              <span className="text-fg-3">{meta.label}</span>
              <span className="font-semibold tabular-nums text-fg">{b.count}</span>
            </>
          );
          return (
            <li key={b.status}>
              {filter ? (
                <button type="button" onClick={() => goDevices(filter)} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] transition hover:bg-fill-2">{content}</button>
              ) : (
                <span className="flex h-8 items-center gap-1.5 px-2 text-[13px]">{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const ZONES_SHOWN = 8;

/**
 * Caídas por zona. Con una caída en curso va arriba de todo y en rojo: zona, cuántos equipos no responden y desde cuándo.
 * Sin caídas muestra cada zona con su proporción de equipos en línea, para ver de un vistazo cómo está la red.
 */
function ZonesCard({ zones, unzoned, now, goDevices, goZones }: {
  zones: readonly ZoneStatus[];
  unzoned: number;
  now: number;
  goDevices: (filter: string, zone?: string) => void;
  goZones: () => void;
}) {
  const sorted = useMemo(() => sortZonesByUrgency(zones), [zones]);
  const outages = sorted.filter((z) => z.outage_started_at);
  // Sin caída: primero las que tienen equipos; las vacías no dicen nada de la red.
  const healthy = [...sorted.filter((z) => !z.outage_started_at && z.total > 0), ...sorted.filter((z) => !z.outage_started_at && z.total === 0)];
  const shown = healthy.slice(0, Math.max(0, ZONES_SHOWN - outages.length));
  const down = outages.length > 0;

  if (zones.length === 0) {
    return (
      <Card title="Caídas por zona" description="Enterate cuando se caen muchos equipos del mismo lugar a la vez">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="flex min-w-0 max-w-2xl items-start gap-2.5 text-sm text-fg-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fg-4" aria-hidden />
            Agrupá los equipos por localidad, nodo u OLT. Si la mitad de una zona se queda sin conexión, lo ves acá y te llega el aviso.
          </p>
          <Button size="sm" variant="secondary" onClick={goZones}>Crear zonas</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          Caídas por zona
          {down && <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-xs font-medium text-danger ring-1 ring-inset ring-danger">{outages.length} en curso</span>}
        </span>
      }
      description={down ? 'Muchos equipos del mismo lugar sin conexión a la vez' : `Sin caídas en curso en ${zones.length === 1 ? 'la zona' : `las ${zones.length} zonas`}`}
      action={<Button size="sm" variant="secondary" onClick={goZones}>Ver zonas</Button>}
      className={down ? 'border-danger' : ''}
      padded={false}
    >
      {down && (
        <ul className="divide-y divide-line" aria-label="Caídas en curso">
          {outages.map((z) => (
            <li key={z.zone_id}>
              <button
                type="button"
                onClick={() => goDevices('offline', z.zone_id)}
                aria-label={`${z.name}: ${outageSummary(z, now)}. Ver equipos sin conexión`}
                className="group flex w-full items-center gap-3 bg-danger-soft px-4 py-3.5 text-left transition hover:brightness-110 sm:px-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger ring-1 ring-inset ring-danger">
                  <RadioTower className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-semibold text-fg">{z.name}</span>
                  <span className="block text-sm text-fg-2">
                    <span className="font-semibold tabular-nums text-danger">{zoneOffline(z)} de {z.total}</span> sin conexión
                    <span className="text-fg-3"> · {outageSince(z, now)}</span>
                  </span>
                </span>
                <span className="hidden shrink-0 text-[13px] font-medium text-fg-2 sm:block">Ver equipos</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-4 transition group-hover:translate-x-0.5 group-hover:text-fg-2" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {shown.length > 0 && (
        <ul className={`grid gap-px overflow-hidden sm:grid-cols-2 xl:grid-cols-4 ${down ? 'border-t border-line' : ''}`} aria-label={down ? 'Zonas sin caída' : 'Zonas'}>
          {shown.map((z) => {
            const pct = onlinePercent(z);
            return (
              <li key={z.zone_id} className="shadow-[1px_0_0_0_var(--line),0_1px_0_0_var(--line)]">
                <button
                  type="button"
                  onClick={() => goDevices('todos', z.zone_id)}
                  aria-label={`${z.name}: ${z.online} de ${devicesText(z.total)} en línea. Ver equipos`}
                  className="flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-fill sm:px-5"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-fg">{z.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-fg-3">
                      {z.total === 0 ? 'Sin equipos' : <><span className="font-semibold text-fg-2">{z.online}</span> de {z.total} en línea</>}
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-fill-2" aria-hidden>
                    <span className="block h-full rounded-full bg-ok transition-all" style={{ width: `${pct}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(healthy.length > shown.length || unzoned > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[13px] text-fg-3 sm:px-5">
          {healthy.length > shown.length && (
            <button type="button" onClick={goZones} className="rounded underline-offset-4 transition hover:text-fg hover:underline">
              Y {healthy.length - shown.length} {healthy.length - shown.length === 1 ? 'zona más sin caída' : 'zonas más sin caída'}
            </button>
          )}
          {unzoned > 0 && (
            <button type="button" onClick={() => goDevices('todos', NO_ZONE)} className="rounded underline-offset-4 transition hover:text-fg hover:underline">
              {devicesText(unzoned)} sin zona
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function OverviewPage({
  company,
  data,
  goDevices,
  goZones,
  openDevice,
}: {
  company: Company;
  data: CompanyData;
  /** Abre Equipos con un filtro de estado y, si se pasa, una zona (id o "sin-zona"). */
  goDevices: (filter: string, zone?: string) => void;
  goZones: () => void;
  openDevice: (id: string) => void;
}) {
  const [onlyAlerts, setOnlyAlerts] = useState(true);
  const devices = useMemo(() => data.devices ?? [], [data.devices]);
  const names = useMemo(() => new Map(devices.map((d) => [d.id, d.name ?? d.id.slice(0, 8)])), [devices]);

  const stats = useMemo(() => {
    const status = devices.map((d) => deviceStatus(d, company));
    return {
      online: devices.filter(isOnline).length,
      locked: devices.filter((d) => d.reported_mode === 'locked').length,
      overdue: status.filter((s) => s === 'pago vencido').length,
      dueSoon: status.filter((s) => s === 'por vencer').length,
      security: devices.filter((d) => healthIssues(d).length > 0).length,
    };
  }, [devices, company]);

  const attention = useMemo<Attention[]>(() => {
    const items: Attention[] = [];
    for (const d of devices) {
      const name = d.name ?? d.id.slice(0, 8);
      for (const issue of healthIssues(d)) {
        items.push({ id: `${d.id}-${issue}`, deviceId: d.id, title: issue, detail: name, tone: 'danger', icon: ShieldAlert });
      }
      const score = data.health.get(d.id);
      if (score?.band === 'problemas') {
        items.push({
          id: `${d.id}-health`, deviceId: d.id, title: `Salud baja (${score.score} de 100)`,
          detail: `${name} · ${score.reasons[0]?.text ?? 'ver detalle'}`, tone: 'danger', icon: HeartPulse,
        });
      }
      if (enforcement(d, company) === 'pendiente') {
        items.push({ id: `${d.id}-pending`, deviceId: d.id, title: 'Cambio sin aplicar', detail: `${name} · todavía no confirmó`, tone: 'warning', icon: Hourglass });
      }
      if (!isOnline(d) && d.offline_alerted_at) {
        items.push({ id: `${d.id}-offline`, deviceId: d.id, title: 'Sin conexión', detail: `${name} · visto ${relativeTime(d.last_seen_at)}`, tone: 'warning', icon: WifiOff });
      }
      if (deviceStatus(d, company) === 'por vencer') {
        items.push({ id: `${d.id}-due`, deviceId: d.id, title: 'Pago por vencer', detail: name, tone: 'warning', icon: CreditCard });
      }
    }
    return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'danger' ? -1 : 1));
  }, [devices, company, data.health]);

  const unzoned = useMemo(() => devices.filter((d) => !d.zone_id).length, [devices]);
  const zoneIds = useMemo(() => new Set(data.zones.map((z) => z.zone_id)), [data.zones]);
  const hasOutage = data.zones.some((z) => z.outage_started_at);
  const zonesCard = <ZonesCard zones={data.zones} unzoned={unzoned} now={data.loadedAt} goDevices={goDevices} goZones={goZones} />;

  const events = onlyAlerts ? data.events.filter((e) => e.severity !== 'info') : data.events;
  const ATTENTION_MAX = 8;

  return (
    <>
      <PageHeader
        title="Resumen"
        subtitle={
          data.loadedAt
            ? `${company.name} · actualizado a las ${new Date(data.loadedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
            : company.name
        }
        actions={<Button variant="secondary" icon={RefreshCw} onClick={data.reload}>Actualizar</Button>}
      />
      {data.devices && <ErrorText error={data.error} />}

      {!data.devices ? (
        data.error ? (
          <Card><ErrorState title="No pudimos cargar el resumen" error={data.error} onRetry={data.reload} /></Card>
        ) : (
          <div className="flex flex-col gap-4" role="status" aria-label="Cargando el resumen">
            <div className="grid gap-4 xl:grid-cols-5">
              <Skeleton className="h-56 xl:col-span-3" />
              <Skeleton className="h-56 xl:col-span-2" />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
            </div>
          </div>
        )
      ) : devices.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tv}
            title="Todavía no hay equipos"
            action={<Button onClick={() => goDevices('todos')}>Ir a Equipos para vincular el primero</Button>}
          >
            Encendé un TV box con NEX: muestra un código y un QR. Cuando lo vincules, acá vas a ver cuántos están en línea,
            los pagos por vencer y las alertas.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-4 lg:gap-5">
          {/* Una caída masiva es lo primero que hay que ver; sin caídas, las zonas van más abajo. */}
          {hasOutage && zonesCard}
          <div className="grid gap-4 lg:gap-5 xl:grid-cols-5">
            <FleetCard company={company} devices={devices} online={stats.online} goDevices={goDevices} />
            <HealthSummary scores={data.health.values()} onOpenLow={() => goDevices('salud-baja')} className="xl:col-span-2" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            <Kpi label="Bloqueados" hint="Confirmado por el TV" value={stats.locked} icon={Lock} tone="danger" onClick={() => goDevices('bloqueados')} />
            <Kpi label="Pagos vencidos" hint="Pasaron los días de gracia" value={stats.overdue} icon={CreditCard} tone="danger" onClick={() => goDevices('vencidos')} />
            <Kpi label="Por vencer" hint={`Vencen en ${company.payment_warning_days} días o menos`} value={stats.dueSoon} icon={Clock} tone="warning" onClick={() => goDevices('por-vencer')} />
            <Kpi label="Alertas de seguridad" hint="Equipos para revisar" value={stats.security} icon={ShieldAlert} tone="danger" onClick={() => goDevices('alertas')} />
          </div>

          {!hasOutage && zonesCard}

          <div className="grid gap-4 lg:gap-5 xl:grid-cols-5">
            <Card
              title="Requiere atención"
              description={attention.length ? `${attention.length} ${attention.length === 1 ? 'tema' : 'temas'}, lo más grave primero` : 'Lo más grave primero'}
              className="xl:col-span-2"
              padded={false}
            >
              {attention.length === 0 ? (
                <EmptyState icon={CircleCheck} title="Todo en orden">No hay equipos con problemas.</EmptyState>
              ) : (
                <>
                  <ul className="divide-y divide-line">
                    {attention.slice(0, ATTENTION_MAX).map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => openDevice(a.deviceId)} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-fill sm:px-5">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${a.tone === 'danger' ? SEVERITY_RING.critical : SEVERITY_RING.warning}`}>
                            <a.icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-fg">{a.title}</span>
                            <span className="block truncate text-xs text-fg-4">{a.detail}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-fg-4 transition group-hover:translate-x-0.5 group-hover:text-fg-2" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {attention.length > ATTENTION_MAX && (
                    <div className="border-t border-line px-4 py-2.5 sm:px-5">
                      <Button size="sm" variant="ghost" className="-ml-2" onClick={() => goDevices('alertas')}>
                        Y {attention.length - ATTENTION_MAX} más: ver equipos con alertas
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>

            <Card
              title="Actividad"
              description="Últimos 7 días"
              className="xl:col-span-3"
              action={
                <Segmented
                  label="Qué actividad mostrar"
                  value={onlyAlerts ? 'alertas' : 'todo'}
                  onChange={(v) => setOnlyAlerts(v === 'alertas')}
                  options={[{ id: 'alertas', label: 'Alertas' }, { id: 'todo', label: 'Todo' }]}
                />
              }
            >
              {events.length === 0 ? (
                <EmptyState icon={Bell} title={onlyAlerts && data.events.length > 0 ? 'Sin alertas' : 'Sin actividad'}>
                  {onlyAlerts && data.events.length > 0 ? 'No hubo alertas en los últimos 7 días. Mirá "Todo" para ver el resto.' : 'Los eventos de los equipos aparecen acá.'}
                </EmptyState>
              ) : (
                <ol className="flex flex-col">
                  {events.slice(0, 40).map((e, i) => {
                    const Icon = EVENT_ICON[e.kind] ?? Bell;
                    return (
                      <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < Math.min(events.length, 40) - 1 && <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-fill-2" aria-hidden />}
                        <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${SEVERITY_RING[e.severity]}`}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <span className="text-sm font-medium text-fg">{EVENT_LABELS[e.kind] ?? e.kind}</span>
                            <span className="text-xs text-fg-4" title={new Date(e.created_at).toLocaleString('es-AR')}>{relativeTime(e.created_at)}</span>
                          </div>
                          <div className="text-[13px] text-fg-4">
                            {e.device_id ? (
                              <button type="button" className="rounded text-fg-2 underline-offset-2 hover:text-accent hover:underline" onClick={() => openDevice(e.device_id!)}>
                                {names.get(e.device_id) ?? e.device_id.slice(0, 8)}
                              </button>
                            ) : typeof e.details.zone === 'string' ? (
                              typeof e.details.zone_id === 'string' && zoneIds.has(e.details.zone_id) ? (
                                <button type="button" className="rounded text-fg-2 underline-offset-2 hover:text-accent hover:underline" onClick={() => goDevices('todos', e.details.zone_id as string)}>
                                  {e.details.zone}
                                </button>
                              ) : (
                                e.details.zone
                              )
                            ) : (
                              company.name
                            )}
                            {zoneEventDetail(e.kind, e.details) && <> · {zoneEventDetail(e.kind, e.details)}</>}
                            {typeof e.details.domain === 'string' && <> · <span className="font-mono text-xs">{e.details.domain}</span></>}
                            {typeof e.details.lock_kind === 'string' && e.details.lock_kind && <> · motivo: {e.details.lock_kind}</>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
