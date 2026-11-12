import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { MapPin, MapPinOff, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { ApiError, db, rpcDeleteZone, rpcSetDevicesZone, rpcUpsertZone, run, type Company, type Device, type Notice, type ZoneStatus } from './api';
import { noticesHitByZoneDelete } from './notices';
import { useToast } from './toast';
import { Button, Callout, ErrorText, inputClass, Modal, SearchInput } from './ui';
import { devicesText, NO_ZONE, planZoneMove, searchZones, ZONE_NAME_MAX, zoneNameProblem, ZONES_MAX } from './zones';

/** Diálogos de zonas (v15) que se usan desde Zonas y desde Equipos: crear o renombrar, eliminar y asignar equipos. */

function zoneError(err: unknown): string {
  if (err instanceof ApiError && err.code === '23505') return 'Ya hay una zona con ese nombre';
  if (err instanceof ApiError && err.code === '54000') return `Llegaste al máximo de ${ZONES_MAX} zonas. Eliminá alguna que no uses.`;
  return (err as Error).message;
}

// ---------------------------------------------------------------------------
// Crear / renombrar
// ---------------------------------------------------------------------------

export function ZoneFormModal({ company, zone, zones, onClose, onSaved }: {
  company: Company;
  /** Zona a renombrar; sin ella se crea una nueva. */
  zone?: ZoneStatus;
  zones: readonly ZoneStatus[];
  onClose: () => void;
  onSaved: (id: string, name: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(zone?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const hintId = useId();
  const others = useMemo(() => zones.filter((z) => z.zone_id !== zone?.zone_id).map((z) => z.name), [zones, zone]);
  const problem = zoneNameProblem(name, others);
  const unchanged = !!zone && name.trim() === zone.name;
  const full = !zone && zones.length >= ZONES_MAX;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (problem || unchanged || full) return;
    setBusy(true);
    setError(null);
    try {
      const id = await rpcUpsertZone(company.id, zone?.zone_id ?? null, name.trim());
      toast.show(zone ? 'Zona renombrada' : `Zona "${name.trim()}" creada`);
      onSaved(id, name.trim());
      onClose();
    } catch (err) {
      setError(zoneError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={zone ? 'Renombrar zona' : 'Nueva zona'} description={zone ? zone.name : `Se agrega a ${company.name}`} onClose={() => !busy && onClose()} width="max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium text-fg-2">Nombre</span>
            <span className={`text-xs tabular-nums ${name.length >= ZONE_NAME_MAX ? 'text-warn' : 'text-fg-4'}`}>{name.length}/{ZONE_NAME_MAX}</span>
          </span>
          <input
            autoFocus
            className={inputClass}
            maxLength={ZONE_NAME_MAX}
            placeholder="Ej.: Barrio Centro, Nodo Norte, OLT 3"
            aria-describedby={hintId}
            aria-invalid={touched && !!problem}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          <span id={hintId} className="text-xs leading-relaxed text-fg-4">
            Usá el nombre con el que tu equipo técnico conoce esa parte de la red: es el que aparece en los avisos de caída.
          </span>
        </label>
        {full && <Callout tone="warning" icon={TriangleAlert}>Llegaste al máximo de {ZONES_MAX} zonas. Eliminá alguna que no uses.</Callout>}
        <ErrorText error={error ?? (touched && problem && !unchanged ? problem : null)} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={busy} disabled={unchanged || full || !name.trim()}>{zone ? 'Guardar' : 'Crear zona'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Eliminar
// ---------------------------------------------------------------------------

export function ZoneDeleteModal({ company, zone, onClose, onDeleted }: {
  company: Company;
  zone: ZoneStatus;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Comunicados vigentes que toca: se buscan al abrir para decir cuáles son. Si falla, se avisa en general.
  const [notices, setNotices] = useState<Notice[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    run<Notice[]>(db().rpc('mdm_list_notices', { p_company: company.id })).then(
      (rows) => !cancelled && setNotices(rows ?? []),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [company.id]);
  const hit = notices ? noticesHitByZoneDelete(notices, zone.zone_id) : null;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await rpcDeleteZone(zone.zone_id);
      toast.show(`Zona "${zone.name}" eliminada`);
      onDeleted();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="¿Eliminar la zona?"
      description={zone.name}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon={Trash2} loading={busy} onClick={remove}>Eliminar zona</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-fg-2">
        <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-fg-4">
          <li>
            {zone.total === 0
              ? 'No tiene equipos asignados.'
              : <><strong className="font-semibold text-fg">{devicesText(zone.total)}</strong> {zone.total === 1 ? 'queda' : 'quedan'} sin zona. Siguen vinculados y funcionando igual.</>}
          </li>
          <li>
            {!hit ? (
              'Los comunicados vigentes que iban solo a esta zona se cancelan.'
            ) : hit.cancelled.length === 0 ? (
              'No hay comunicados vigentes que vayan solo a esta zona.'
            ) : (
              <>
                <strong className="font-semibold text-fg">
                  {hit.cancelled.length === 1 ? 'Se cancela 1 comunicado' : `Se cancelan ${hit.cancelled.length} comunicados`}
                </strong>{' '}
                que {hit.cancelled.length === 1 ? 'iba' : 'iban'} solo a esta zona: {hit.cancelled.map((n) => `"${n.title}"`).join(', ')}.
              </>
            )}
            {hit && hit.trimmed.length > 0 && (
              <> {hit.trimmed.length === 1 ? 'Otro comunicado sigue' : `Otros ${hit.trimmed.length} comunicados siguen`} para el resto de sus zonas.</>
            )}
          </li>
          <li>Se borra su historial de caídas.</li>
        </ul>
        {zone.outage_started_at && (
          <Callout tone="warning" icon={TriangleAlert}>Esta zona tiene una caída en curso: si la eliminás, dejás de verla y no te avisamos cuando se recupere.</Callout>
        )}
        <p className="text-xs text-fg-4">No se puede deshacer. Si solo querés cambiarle el nombre, usá Renombrar.</p>
        <ErrorText error={error} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Asignar equipos a una zona
// ---------------------------------------------------------------------------

export function ZoneAssignModal({ company, devices, zones, onClose, onDone, onZoneCreated }: {
  company: Company;
  /** Equipos elegidos en el listado (uno o muchos). */
  devices: readonly Device[];
  zones: readonly ZoneStatus[];
  onClose: () => void;
  /** Los equipos ya cambiaron de zona. */
  onDone: () => void;
  /** Se creó una zona desde acá (todavía sin asignar nada). */
  onZoneCreated: () => void;
}) {
  const toast = useToast();
  const group = useId();
  const [query, setQuery] = useState('');
  // undefined = todavía no eligió; null = sin zona.
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [created, setCreated] = useState<{ zone_id: string; name: string }[]>([]);
  const [busy, setBusy] = useState<'create' | 'assign' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Las zonas recién creadas acá aparecen enseguida, sin esperar la próxima recarga de datos.
  const all = useMemo(
    () => [...zones.map((z) => ({ zone_id: z.zone_id, name: z.name })), ...created.filter((c) => !zones.some((z) => z.zone_id === c.zone_id))],
    [zones, created],
  );
  const names = useMemo(() => new Map(all.map((z) => [z.zone_id, z.name])), [all]);
  const shown = searchZones(all, query);
  const newName = query.trim();
  const canCreate = newName !== '' && zoneNameProblem(newName, all.map((z) => z.name)) === null && all.length < ZONES_MAX;
  const plan = target === undefined ? null : planZoneMove(devices, target);
  const one = devices.length === 1;
  const hasZone = devices.some((d) => d.zone_id);

  const create = async () => {
    setBusy('create');
    setError(null);
    try {
      const id = await rpcUpsertZone(company.id, null, newName);
      setCreated((c) => [...c, { zone_id: id, name: newName }]);
      setTarget(id);
      setQuery('');
      onZoneCreated();
    } catch (err) {
      setError(zoneError(err));
    } finally {
      setBusy(null);
    }
  };

  const assign = async () => {
    if (target === undefined || !plan || plan.changing === 0) return;
    setBusy('assign');
    setError(null);
    try {
      const changed = await rpcSetDevicesZone(company.id, devices.map((d) => d.id), target);
      toast.show(
        target === null
          ? `${devicesText(changed)} ${changed === 1 ? 'quedó' : 'quedaron'} sin zona`
          : `${devicesText(changed)} ${changed === 1 ? 'pasó' : 'pasaron'} a ${names.get(target) ?? 'la zona'}`,
      );
      onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const option = (value: string | null, label: string, Icon: typeof MapPin, muted = false) => {
    const checked = target === value;
    return (
      <label
        key={value ?? NO_ZONE}
        className={`flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
          checked ? 'border-accent bg-accent-soft text-fg' : 'border-transparent text-fg-2 hover:bg-fill'
        }`}
      >
        <input type="radio" name={group} className="sr-only" checked={checked} onChange={() => setTarget(value)} />
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${checked ? 'border-accent' : 'border-line-strong'}`} aria-hidden>
          {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
        </span>
        <Icon className={`h-4 w-4 shrink-0 ${checked ? 'text-accent' : 'text-fg-4'}`} aria-hidden />
        <span className={`min-w-0 flex-1 truncate ${muted && !checked ? 'text-fg-3' : ''}`}>{label}</span>
      </label>
    );
  };

  return (
    <Modal
      title={one ? 'Zona del equipo' : 'Asignar zona'}
      description={one ? devices[0].name ?? devices[0].id.slice(0, 8) : `${devicesText(devices.length)} seleccionados`}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <Button variant="secondary" disabled={!!busy} onClick={onClose}>Cancelar</Button>
          <Button icon={target === null ? MapPinOff : MapPin} loading={busy === 'assign'} disabled={busy === 'create' || !plan || plan.changing === 0} onClick={assign}>
            {!plan || plan.changing === 0
              ? 'Asignar'
              : target === null
                ? `Quitar la zona a ${devicesText(plan.changing)}`
                : `Asignar ${devicesText(plan.changing)}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder={all.length === 0 ? 'Nombre de la primera zona' : 'Buscar o crear una zona'} />
        <div role="radiogroup" aria-label="Zona de destino" className="-mx-1 flex max-h-[min(18rem,40dvh)] flex-col gap-0.5 overflow-y-auto px-1 py-0.5">
          {shown.map((z) => option(z.zone_id, z.name, MapPin))}
          {query === '' && hasZone && option(null, 'Sin zona (quitar la que tienen)', MapPinOff, true)}
        </div>
        {all.length === 0 && query === '' && (
          <p className="text-sm text-fg-3">Todavía no creaste zonas. Escribí el nombre de la primera: por ejemplo la localidad, el nodo o la OLT.</p>
        )}
        {query !== '' && (canCreate || shown.length === 0) && (
          <Button variant="secondary" icon={Plus} loading={busy === 'create'} disabled={!canCreate || busy === 'assign'} onClick={create} className="max-w-full self-start">
            <span className="truncate">Crear la zona "{newName}"</span>
          </Button>
        )}
        {plan && (
          <div aria-live="polite" className="rounded-lg border border-line bg-fill px-3.5 py-3 text-sm text-fg-2">
            {plan.changing === 0 ? (
              one ? 'El equipo ya está en esa zona.' : target === null ? 'Ninguno de los equipos elegidos tiene zona.' : 'Todos los equipos elegidos ya están en esa zona.'
            ) : (
              <>
                <span className="font-medium text-fg">
                  {target === null
                    ? `${devicesText(plan.changing)} ${plan.changing === 1 ? 'queda' : 'quedan'} sin zona`
                    : `${devicesText(plan.changing)} ${plan.changing === 1 ? 'pasa' : 'pasan'} a ${names.get(target ?? '') ?? 'la zona'}`}
                </span>
                {!one && (
                  <>
                    {': '}
                    {plan.from.slice(0, 3).map((f) => `${f.count} ${f.zone === NO_ZONE ? 'sin zona' : `de ${names.get(f.zone) ?? 'otra zona'}`}`).join(', ')}
                    {plan.from.length > 3 && ` y ${plan.from.slice(3).reduce((n, f) => n + f.count, 0)} de otras zonas`}.
                    {plan.unchanged > 0 && ` ${plan.unchanged === 1 ? 'Otro ya está' : `Otros ${plan.unchanged} ya están`} ahí.`}
                  </>
                )}
                <span className="mt-1 block text-xs text-fg-4">
                  No cambia el servicio ni lo que ve el cliente. Los comunicados por zona que estén vigentes les empiezan a llegar (o dejan de llegarles) en el próximo minuto.
                </span>
              </>
            )}
          </div>
        )}
        <ErrorText error={error} />
      </div>
    </Modal>
  );
}
