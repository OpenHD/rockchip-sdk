import { useEffect, useMemo, useState } from 'react';
import { BellOff, CircleCheck, EllipsisVertical, History, MapPin, MapPinOff, Pencil, Plus, RadioTower, SearchX, Trash2, Tv } from 'lucide-react';
import { db, run, ZONE_OUTAGE_COLUMNS, type Company, type ZoneOutage, type ZoneStatus } from '../api';
import { formatWhen } from '../notices';
import { Badge, Button, Callout, Card, EmptyState, ErrorState, ErrorText, IconButton, Menu, PageHeader, SearchInput, Skeleton } from '../ui';
import type { CompanyData } from '../useCompanyData';
import { ZoneDeleteModal, ZoneFormModal } from '../ZoneDialogs';
import { devicesText, formatDuration, NO_ZONE, onlinePercent, outageDuration, searchZones, sortZonesByUrgency, zoneCounts, zoneOffline, ZONES_MAX, zoneState } from '../zones';

/** Zonas (v15): localidades, nodos u OLT. Alta, baja y cambio de nombre, estado de cada una y su historial de caídas. */

type Dialog = { kind: 'create' } | { kind: 'rename'; zone: ZoneStatus } | { kind: 'delete'; zone: ZoneStatus };

const SEARCH_FROM = 8;
const HISTORY_MAX = 50;

/** Historial de mdm_zone_outages. Se vuelve a pedir cuando empieza o termina una caída. */
function useOutageHistory(companyId: string, version: string) {
  const [rows, setRows] = useState<ZoneOutage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    run<ZoneOutage[]>(
      db().from('mdm_zone_outages').select(ZONE_OUTAGE_COLUMNS).eq('company_id', companyId).order('started_at', { ascending: false }).limit(HISTORY_MAX),
    ).then(
      (r) => {
        if (cancelled) return;
        setRows(r ?? []);
        setError(null);
      },
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [companyId, version]);
  return { rows, error };
}

function Stat({ label, value, tone = 'text-fg' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-fg-4">{label}</dt>
      <dd className={`text-[15px] font-semibold tabular-nums leading-6 ${tone}`}>{value}</dd>
    </div>
  );
}

function ZoneRow({ zone, now, onDevices, onRename, onDelete }: {
  zone: ZoneStatus;
  now: number;
  onDevices: (offlineOnly: boolean) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const state = zoneState(zone);
  const offline = zoneOffline(zone);
  const pct = onlinePercent(zone);
  return (
    <li className={`flex flex-col gap-3 px-4 py-3.5 sm:px-5 md:flex-row md:items-center md:gap-6 ${state === 'caida' ? 'bg-danger-soft' : ''}`}>
      <div className="flex min-w-0 items-start gap-3 md:w-[36%]">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
            state === 'caida' ? 'bg-danger-soft text-danger ring-danger' : 'bg-fill-2 text-fg-3 ring-line'
          }`}
          aria-hidden
        >
          {state === 'caida' ? <RadioTower className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 break-words text-sm font-semibold text-fg">{zone.name}</h3>
            {state === 'caida' && <Badge tone="danger">En caída</Badge>}
            {state === 'vacia' && <Badge>Sin equipos</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-fg-4">
            {state === 'caida'
              ? <span className="text-danger">Desde hace {formatDuration(now - new Date(zone.outage_started_at!).getTime())}{zone.outage_offline != null && ` · pico de ${zone.outage_offline} sin conexión`}</span>
              : state === 'vacia'
                ? 'Asignale equipos desde el listado de Equipos.'
                : 'Sin caídas en curso'}
          </p>
        </div>
        <div className="md:hidden">
          <ZoneMenu zone={zone} onDevices={() => onDevices(false)} onRename={onRename} onDelete={onDelete} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Equipos" value={zone.total} tone={zone.total ? 'text-fg' : 'text-fg-4'} />
          <Stat label="En línea" value={zone.online} tone={zone.online ? 'text-ok' : 'text-fg-4'} />
          <Stat label="Sin conexión" value={offline} tone={state === 'caida' ? 'text-danger' : offline ? 'text-fg-2' : 'text-fg-4'} />
        </dl>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill-2" role="img" aria-label={zone.total ? `${pct}% de los equipos en línea` : 'Sin equipos'}>
          <div className={`h-full rounded-full transition-all ${state === 'caida' ? 'bg-danger' : 'bg-ok'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="hidden w-[10.5rem] shrink-0 items-center justify-end gap-1 md:flex">
        <Button size="sm" variant="secondary" disabled={zone.total === 0} onClick={() => onDevices(state === 'caida')}>
          {state === 'caida' ? 'Ver los caídos' : 'Ver equipos'}
        </Button>
        <ZoneMenu zone={zone} onRename={onRename} onDelete={onDelete} />
      </div>
    </li>
  );
}

function ZoneMenu({ zone, onDevices, onRename, onDelete }: { zone: ZoneStatus; onDevices?: () => void; onRename: () => void; onDelete: () => void }) {
  return (
    <Menu
      trigger={(toggle, open) => <IconButton icon={EllipsisVertical} label={`Acciones de ${zone.name}`} aria-haspopup="menu" aria-expanded={open} onClick={toggle} />}
      items={[
        ...(onDevices && zone.total > 0 ? [{ label: 'Ver equipos', icon: Tv, onClick: onDevices }] : []),
        { label: 'Renombrar', icon: Pencil, onClick: onRename },
        { label: 'Eliminar', icon: Trash2, danger: true, onClick: onDelete },
      ]}
    />
  );
}

export default function ZonesPage({ company, data, goDevices, goAlerts }: {
  company: Company;
  data: CompanyData;
  /** Abre Equipos filtrado por zona (id o "sin-zona") y, si se pide, por estado. */
  goDevices: (filter: string, zone?: string) => void;
  goAlerts: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [query, setQuery] = useState('');
  const zones = data.zones;
  const now = data.loadedAt;
  const loading = !data.devices && !data.error;
  const sorted = useMemo(() => sortZonesByUrgency(zones), [zones]);
  const shown = searchZones(sorted, query);
  const outages = sorted.filter((z) => z.outage_started_at);
  const unzoned = useMemo(() => zoneCounts(data.devices ?? []).get(NO_ZONE) ?? 0, [data.devices]);
  const names = useMemo(() => new Map(zones.map((z) => [z.zone_id, z.name])), [zones]);
  const history = useOutageHistory(company.id, `${zones.length}|${outages.map((z) => z.zone_id).join(',')}`);
  const alertsOff = !company.alert_kinds.includes('offline') || (!company.alert_telegram_chat_id && company.alert_emails.length === 0);
  const loadError = data.zonesError ?? (!data.devices ? data.error : null);

  return (
    <>
      <PageHeader
        title="Zonas"
        help={{ section: 'zonas', label: 'zonas y caídas' }}
        subtitle="Agrupá los equipos por localidad, nodo u OLT. Sirve para mandar un comunicado solo a una parte de la red y para enterarte cuando se caen muchos equipos juntos."
        actions={zones.length > 0 && <Button icon={Plus} disabled={zones.length >= ZONES_MAX} onClick={() => setDialog({ kind: 'create' })}>Nueva zona</Button>}
      />

      <div className="flex flex-col gap-4 lg:gap-5">
        {zones.length > 0 && alertsOff && (
          <Callout tone="warning" icon={BellOff} title="No te va a llegar el aviso de caída" action={<Button size="sm" variant="secondary" onClick={goAlerts}>Configurar avisos</Button>}>
            {company.alert_kinds.includes('offline')
              ? 'Falta cargar un chat de Telegram o un email donde recibirlo.'
              : 'Activá los avisos de "Sin conexión" para que una caída masiva te llegue por Telegram o email.'}
          </Callout>
        )}

        <Card padded={false}>
          {loadError && zones.length === 0 ? (
            <ErrorState title="No pudimos cargar las zonas" error={loadError} onRetry={data.reload} />
          ) : loading ? (
            <div className="flex flex-col gap-3 p-4 sm:p-5" role="status" aria-label="Cargando zonas">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : zones.length === 0 ? (
            <EmptyState icon={MapPin} title="Todavía no creaste zonas" action={<Button icon={Plus} onClick={() => setDialog({ kind: 'create' })}>Crear la primera zona</Button>}>
              Creá una zona por cada localidad, nodo u OLT y después asignale sus equipos desde Equipos (podés elegir muchos a la vez).
              Con 3 equipos o más en una zona, te avisamos si la mitad se queda sin conexión al mismo tiempo.
            </EmptyState>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <p className="text-[13px] text-fg-3">
                  <span className="font-medium text-fg-2">{zones.length} {zones.length === 1 ? 'zona' : 'zonas'}</span>
                  {' · '}
                  {outages.length === 0
                    ? <span className="inline-flex items-center gap-1 align-middle text-ok"><CircleCheck className="h-3.5 w-3.5" aria-hidden /> sin caídas en curso</span>
                    : <span className="inline-flex items-center gap-1 align-middle font-medium text-danger"><RadioTower className="h-3.5 w-3.5" aria-hidden /> {outages.length === 1 ? '1 con una caída en curso' : `${outages.length} con una caída en curso`}</span>}
                </p>
                {zones.length >= SEARCH_FROM && <SearchInput className="w-full sm:w-64" value={query} onChange={setQuery} placeholder="Buscar zona" />}
              </div>
              {data.zonesError && <div className="px-4 sm:px-5"><ErrorText error={data.zonesError} /></div>}
              {shown.length === 0 ? (
                <EmptyState icon={SearchX} title="Ninguna zona coincide" action={<Button variant="secondary" onClick={() => setQuery('')}>Borrar búsqueda</Button>} />
              ) : (
                <ul className="divide-y divide-line">
                  {shown.map((z) => (
                    <ZoneRow
                      key={z.zone_id}
                      zone={z}
                      now={now}
                      onDevices={(offlineOnly) => goDevices(offlineOnly ? 'offline' : 'todos', z.zone_id)}
                      onRename={() => setDialog({ kind: 'rename', zone: z })}
                      onDelete={() => setDialog({ kind: 'delete', zone: z })}
                    />
                  ))}
                </ul>
              )}
              {unzoned > 0 && query === '' && (
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-surface-2 px-4 py-3 sm:px-5 rounded-b-xl">
                  <p className="flex min-w-0 items-center gap-2 text-[13px] text-fg-3">
                    <MapPinOff className="h-4 w-4 shrink-0 text-fg-4" aria-hidden />
                    <span><span className="font-medium text-fg-2">{devicesText(unzoned)} sin zona</span>: no entran en los comunicados por zona ni en el control de caídas.</span>
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => goDevices('todos', NO_ZONE)}>Asignarles una zona</Button>
                </div>
              )}
            </>
          )}
        </Card>

        {zones.length > 0 && (
          <Card title="Historial de caídas" description={`Las últimas ${HISTORY_MAX}, de la más nueva a la más vieja`} padded={false}>
            {history.error ? (
              <div className="px-4 pb-2 sm:px-5"><ErrorText error={history.error} /></div>
            ) : !history.rows ? (
              <div className="flex flex-col gap-3 p-4 sm:p-5" role="status" aria-label="Cargando el historial"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : history.rows.length === 0 ? (
              <EmptyState icon={History} title="Sin caídas registradas">Cuando una zona tenga una caída masiva, queda anotada acá con cuánto duró.</EmptyState>
            ) : (
              <ol className="divide-y divide-line">
                {history.rows.map((o) => {
                  const open = !o.ended_at;
                  return (
                    <li key={o.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${open ? 'bg-danger' : 'bg-neutral'}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="min-w-0 break-words text-sm font-medium text-fg">{names.get(o.zone_id) ?? 'Zona eliminada'}</span>
                          {open && <Badge tone="danger">En curso</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-fg-4">
                          <span title={new Date(o.started_at).toLocaleString('es-AR')}>Empezó {formatWhen(new Date(o.started_at), now)}</span>
                          {' · '}
                          {open ? `lleva ${outageDuration(o, now)}` : `duró ${outageDuration(o, now)}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-medium tabular-nums text-fg-2">{o.peak_offline} de {o.total}</div>
                        <div className="text-xs text-fg-4">sin conexión en el pico</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        )}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-4">
          <RadioTower className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Una zona entra en caída cuando tiene 3 o más equipos activos y la mitad o más (mínimo 3) llevan más de 3 minutos sin sincronizar.
          "En línea" cuenta los equipos que sincronizaron en los últimos 5 minutos: un TV apagado también figura sin conexión.
        </p>
      </div>

      {dialog?.kind === 'create' && <ZoneFormModal company={company} zones={zones} onClose={() => setDialog(null)} onSaved={data.reload} />}
      {dialog?.kind === 'rename' && <ZoneFormModal company={company} zone={dialog.zone} zones={zones} onClose={() => setDialog(null)} onSaved={data.reload} />}
      {dialog?.kind === 'delete' && <ZoneDeleteModal company={company} zone={dialog.zone} onClose={() => setDialog(null)} onDeleted={data.reload} />}
    </>
  );
}
