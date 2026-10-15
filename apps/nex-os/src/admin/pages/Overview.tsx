import { useMemo, useState } from 'react';
import {
  Bell,
  CircleCheck,
  Clock,
  CreditCard,
  Hourglass,
  Lock,
  LockOpen,
  Power,
  RefreshCw,
  ShieldAlert,
  Skull,
  TriangleAlert,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { deviceStatus, enforcement, EVENT_LABELS, isOnline, type Company, type DeviceEvent } from '../api';
import { healthIssues } from '../deviceMeta';
import { relativeTime } from '../format';
import { Button, Card, Chip, EmptyState, ErrorText, PageHeader, Skeleton } from '../ui';
import type { CompanyData } from '../useCompanyData';

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
};

const SEVERITY_RING: Record<DeviceEvent['severity'], string> = {
  critical: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  warning: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  info: 'bg-white/[0.06] text-zinc-400 ring-white/10',
};

interface Attention {
  id: string;
  deviceId: string;
  title: string;
  detail: string;
  tone: 'danger' | 'warning';
  icon: LucideIcon;
}

function Kpi({
  label,
  value,
  total,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  total?: number;
  icon: LucideIcon;
  tone: 'indigo' | 'emerald' | 'rose' | 'amber' | 'zinc';
  onClick?: () => void;
}) {
  const tones = {
    indigo: 'text-indigo-300 bg-indigo-500/10',
    emerald: 'text-emerald-300 bg-emerald-500/10',
    rose: 'text-rose-300 bg-rose-500/10',
    amber: 'text-amber-300 bg-amber-500/10',
    zinc: 'text-zinc-300 bg-white/[0.06]',
  };
  const pct = total ? Math.round((Number(value) / total) * 100) : null;
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-white">{value}</span>
        {total !== undefined && <span className="text-sm text-zinc-500">/ {total}</span>}
      </div>
      {pct !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-emerald-400/80 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </button>
  );
}

export default function OverviewPage({
  company,
  data,
  goDevices,
  openDevice,
}: {
  company: Company;
  data: CompanyData;
  goDevices: (filter: string) => void;
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
  }, [devices, company]);

  const events = onlyAlerts ? data.events.filter((e) => e.severity !== 'info') : data.events;

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
      <ErrorText error={data.error} />

      {!data.devices ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="En línea" value={stats.online} total={devices.length} icon={Wifi} tone="emerald" onClick={() => goDevices('online')} />
          <Kpi label="Bloqueados" value={stats.locked} icon={Lock} tone="zinc" onClick={() => goDevices('bloqueados')} />
          <Kpi label="Pagos vencidos" value={stats.overdue} icon={CreditCard} tone={stats.overdue ? 'rose' : 'zinc'} onClick={() => goDevices('vencidos')} />
          <Kpi label="Por vencer" value={stats.dueSoon} icon={Clock} tone={stats.dueSoon ? 'amber' : 'zinc'} onClick={() => goDevices('por-vencer')} />
          <Kpi label="Alertas de seguridad" value={stats.security} icon={ShieldAlert} tone={stats.security ? 'rose' : 'zinc'} onClick={() => goDevices('alertas')} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Requiere atención" description="Ordenado por prioridad" className="xl:col-span-2" padded={false}>
          {attention.length === 0 ? (
            <EmptyState icon={CircleCheck} title="Todo en orden">No hay equipos con problemas.</EmptyState>
          ) : (
            <ul className="divide-y divide-white/[0.05] pb-2">
              {attention.slice(0, 12).map((a) => (
                <li key={a.id}>
                  <button onClick={() => openDevice(a.deviceId)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.03]">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${a.tone === 'danger' ? SEVERITY_RING.critical : SEVERITY_RING.warning}`}>
                      <a.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">{a.title}</span>
                      <span className="block truncate text-xs text-zinc-500">{a.detail}</span>
                    </span>
                    <span className="text-xs text-indigo-300">Ver</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Actividad"
          description="Últimos 7 días"
          className="xl:col-span-3"
          action={
            <div className="flex gap-1.5">
              <Chip active={onlyAlerts} onClick={() => setOnlyAlerts(true)}>Alertas</Chip>
              <Chip active={!onlyAlerts} onClick={() => setOnlyAlerts(false)}>Todo</Chip>
            </div>
          }
        >
          {events.length === 0 ? (
            <EmptyState icon={Bell} title="Sin actividad">Los eventos de los equipos aparecen acá.</EmptyState>
          ) : (
            <ol className="flex flex-col">
              {events.slice(0, 40).map((e, i) => {
                const Icon = EVENT_ICON[e.kind] ?? Bell;
                return (
                  <li key={e.id} className="relative flex gap-3 pb-4">
                    {i < Math.min(events.length, 40) - 1 && <span className="absolute left-4 top-9 h-[calc(100%-2rem)] w-px bg-white/[0.07]" />}
                    <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${SEVERITY_RING[e.severity]}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm font-medium text-zinc-100">{EVENT_LABELS[e.kind] ?? e.kind}</span>
                        <span className="text-xs text-zinc-500" title={new Date(e.created_at).toLocaleString('es-AR')}>{relativeTime(e.created_at)}</span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {e.device_id ? (
                          <button className="text-zinc-300 hover:text-indigo-300 hover:underline" onClick={() => openDevice(e.device_id!)}>
                            {names.get(e.device_id) ?? e.device_id.slice(0, 8)}
                          </button>
                        ) : (
                          company.name
                        )}
                        {typeof e.details.domain === 'string' && <> · <span className="font-mono">{e.details.domain}</span></>}
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
    </>
  );
}
