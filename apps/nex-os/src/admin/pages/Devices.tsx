import { useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  CalendarPlus,
  CircleCheck,
  CreditCard,
  EllipsisVertical,
  HardDrive,
  Hourglass,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  QrCode,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tv,
  Unlink,
} from 'lucide-react';
import { db, deviceStatus, enforcement, EVENT_LABELS, isOnline, run, type Company, type Device, type DeviceEvent } from '../api';
import { FILTERS, healthIssues, paymentText, STATUS_META, type Filter } from '../deviceMeta';
import { addMonths, formatDate, formatUptime, LOCK_REASONS, relativeTime, todayIso } from '../format';
import { useToast } from '../toast';
import {
  Badge,
  Button,
  Card,
  Chip,
  Drawer,
  EmptyState,
  ErrorText,
  Field,
  IconButton,
  inputClass,
  Menu,
  Modal,
  PageHeader,
  Skeleton,
  StatusDot,
} from '../ui';
import type { CompanyData } from '../useCompanyData';

// ---------------------------------------------------------------------------
// Acciones (modales)
// ---------------------------------------------------------------------------

type Dialog =
  | { kind: 'lock'; device: Device }
  | { kind: 'payment'; device: Device }
  | { kind: 'rename'; device: Device }
  | { kind: 'unpair'; device: Device }
  | { kind: 'claim'; code?: string };

function useAction(onDone: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exec = async (fn: () => PromiseLike<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast.show(success);
      onDone();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, exec };
}

function LockModal({ device, company, onClose, onDone }: { device: Device; company: Company; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState(LOCK_REASONS[0]);
  const [custom, setCustom] = useState('');
  const { busy, error, exec } = useAction(onDone);
  const finalReason = reason === 'Otro' ? custom.trim() : reason;
  const submit = () =>
    exec(
      () => run(db().rpc('mdm_set_device_lock', { p_device: device.id, p_locked: true, p_reason: finalReason })),
      `Bloqueo enviado a "${device.name ?? 'equipo'}". Esperando confirmación del TV…`,
    ).then((ok) => ok && onClose());

  return (
    <Modal
      title="Bloquear equipo"
      description={device.name ?? device.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon={Lock} disabled={busy || !finalReason} onClick={submit}>Bloquear ahora</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-300">Motivo</div>
          <div className="flex flex-wrap gap-2">
            {[...LOCK_REASONS, 'Otro'].map((r) => (
              <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{r}</Chip>
            ))}
          </div>
        </div>
        {reason === 'Otro' && (
          <Field label="Describí el motivo">
            <input autoFocus className={inputClass} maxLength={280} value={custom} onChange={(e) => setCustom(e.target.value)} />
          </Field>
        )}
        <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">Así lo verá el cliente en el TV</div>
          <div className="text-sm font-medium text-white">🔒 Equipo bloqueado</div>
          <div className="mt-1 text-sm text-zinc-300">{company.lock_message}</div>
          {finalReason && <div className="mt-1 text-xs text-zinc-500">{finalReason}</div>}
        </div>
        <p className="text-xs text-zinc-500">El TV aplica el bloqueo en menos de un minuto y corta lo que se esté reproduciendo.</p>
        <ErrorText error={error} />
      </div>
    </Modal>
  );
}

function PaymentModal({ device, company, onClose, onDone }: { device: Device; company: Company; onClose: () => void; onDone: () => void }) {
  const base = device.paid_until && device.paid_until >= todayIso() ? device.paid_until : todayIso();
  const [date, setDate] = useState(addMonths(base, 1));
  const [note, setNote] = useState('');
  const { busy, error, exec } = useAction(onDone);
  const wasOverdue = deviceStatus(device, company) === 'pago vencido';

  const save = (value: string | null) =>
    exec(
      () => run(db().rpc('mdm_set_paid_until', { p_device: device.id, p_paid_until: value, p_note: note || null })),
      value ? `Pago registrado: pagado hasta ${formatDate(value)}` : 'Control de pago desactivado',
    ).then((ok) => ok && onClose());

  return (
    <Modal
      title="Registrar pago"
      description={device.name ?? device.id}
      onClose={onClose}
      footer={
        <>
          {device.paid_until && (
            <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => save(null)}>Quitar control de pago</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button icon={CreditCard} disabled={busy || !date} onClick={() => save(date)}>Guardar</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-sm text-zinc-400">
          Pagado hasta ahora: <span className="text-zinc-200">{device.paid_until ? formatDate(device.paid_until) : 'sin control'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 3, 6].map((m) => {
            const value = addMonths(base, m);
            return (
              <button
                key={m}
                onClick={() => setDate(value)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  date === value ? 'border-indigo-400/60 bg-indigo-500/15' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="text-sm font-semibold text-white">+{m} {m === 1 ? 'mes' : 'meses'}</div>
                <div className="text-xs text-zinc-400">{formatDate(value)}</div>
              </button>
            );
          })}
        </div>
        <Field label="O elegí la fecha">
          <input type="date" className={inputClass} value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Nota (opcional)" hint="Ej. número de comprobante. Queda en el historial de pagos.">
          <input className={inputClass} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {wasOverdue && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <LockOpen className="h-4 w-4" aria-hidden /> El equipo se desbloquea solo en el próximo minuto.
          </div>
        )}
        <ErrorText error={error} />
      </div>
    </Modal>
  );
}

function RenameModal({ device, onClose, onDone }: { device: Device; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(device.name ?? '');
  const { busy, error, exec } = useAction(onDone);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    exec(() => run(db().rpc('mdm_rename_device', { p_device: device.id, p_name: name })), 'Nombre actualizado').then((ok) => ok && onClose());
  };
  return (
    <Modal title="Renombrar equipo" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre" hint="Cliente y ambiente, para encontrarlo rápido. Ej. Juan Pérez · Living">
          <input autoFocus className={inputClass} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}

function UnpairModal({ device, onClose, onDone }: { device: Device; onClose: () => void; onDone: () => void }) {
  const [confirm, setConfirm] = useState('');
  const { busy, error, exec } = useAction(onDone);
  const expected = 'DESVINCULAR';
  return (
    <Modal
      title="Desvincular equipo"
      description={device.name ?? device.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            icon={Unlink}
            disabled={busy || confirm !== expected}
            onClick={() =>
              exec(() => run(db().rpc('mdm_unpair_device', { p_device: device.id })), 'Equipo desvinculado').then((ok) => ok && onClose())
            }
          >
            Desvincular
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-zinc-300">
        <p>
          El equipo deja de pertenecer a la empresa, pierde su configuración y vuelve a la pantalla de vinculación.
          Se borra su historial de eventos y de pagos.
        </p>
        <Field label={`Escribí ${expected} para confirmar`}>
          <input className={`${inputClass} font-mono`} value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} />
        </Field>
        <ErrorText error={error} />
      </div>
    </Modal>
  );
}

function formatCodeInput(v: string): string {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function ClaimModal({ company, initialCode, onClose, onDone }: { company: Company; initialCode?: string; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState(formatCodeInput(initialCode ?? ''));
  const [name, setName] = useState('');
  const { busy, error, exec } = useAction(onDone);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    exec(async () => {
      const id = await run<string | null>(db().rpc('mdm_claim_device', { p_company: company.id, p_code: code, p_name: name }));
      if (!id) throw new Error('Código inválido o vencido. Revisá el código que muestra el TV.');
    }, `Equipo vinculado a ${company.name}`).then((ok) => ok && onClose());
  };
  return (
    <Modal title="Vincular equipo" description={`Se agrega a ${company.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.07] p-3 text-sm text-indigo-200">
          <QrCode className="h-5 w-5 shrink-0" aria-hidden />
          Encendé el TV box: muestra un QR y un código. Escaneá el QR con este celular o escribí el código.
        </div>
        <Field label="Código del TV">
          <input
            autoFocus={!initialCode}
            required
            inputMode="text"
            autoCapitalize="characters"
            className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.3em]`}
            placeholder="ABCD-EFGH"
            value={code}
            onChange={(e) => setCode(formatCodeInput(e.target.value))}
          />
        </Field>
        <Field label="Nombre del equipo" hint="Cliente y ambiente. Lo vas a ver en el listado y en los avisos.">
          <input autoFocus={!!initialCode} className={inputClass} maxLength={80} placeholder="Juan Pérez · Living" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <ErrorText error={error} />
        <Button type="submit" icon={Plus} disabled={busy || code.length !== 9} className="h-11">Vincular equipo</Button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detalle del equipo
// ---------------------------------------------------------------------------

function HealthRow({ ok, label, detail }: { ok: boolean | undefined; label: string; detail?: string }) {
  const known = ok !== undefined;
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-2.5 text-sm text-zinc-300">
        {known && ok ? <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden /> : known ? <ShieldAlert className="h-4 w-4 text-rose-400" aria-hidden /> : <Activity className="h-4 w-4 text-zinc-500" aria-hidden />}
        {label}
      </span>
      <span className={`text-xs ${known ? (ok ? 'text-emerald-300' : 'text-rose-300') : 'text-zinc-500'}`}>{detail ?? (known ? (ok ? 'OK' : 'Falla') : 'Sin datos')}</span>
    </div>
  );
}

function DeviceDrawer({
  device,
  company,
  events,
  onClose,
  onAction,
  onChanged,
}: {
  device: Device;
  company: Company;
  events: DeviceEvent[];
  onClose: () => void;
  onAction: (d: Dialog) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const status = deviceStatus(device, company);
  const meta = STATUS_META[status];
  const applied = enforcement(device, company);
  const online = isOnline(device);
  const pay = paymentText(device, company);
  const h = device.health ?? {};
  const history = events.filter((e) => e.device_id === device.id).slice(0, 30);

  const unlock = async () => {
    try {
      await run(db().rpc('mdm_set_device_lock', { p_device: device.id, p_locked: false }));
      toast.show('Desbloqueo enviado. Esperando confirmación del TV…');
      onChanged();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  };

  return (
    <Drawer
      title={device.name ?? 'Equipo sin nombre'}
      subtitle={<span className="font-mono">{device.id.slice(0, 8)} · {device.firmware_version ?? 'firmware desconocido'}</span>}
      onClose={onClose}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
          {applied === 'pendiente' && <Badge tone="warning" icon={Hourglass}>Pendiente de aplicar</Badge>}
          {applied === 'confirmado' && device.reported_mode === 'locked' && <Badge tone="success" icon={CircleCheck}>Bloqueo confirmado</Badge>}
          <span className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
            <StatusDot online={online} /> {online ? 'En línea' : `Visto ${relativeTime(device.last_seen_at)}`}
          </span>
        </div>

        {device.locked && device.lock_reason && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-200">
            Motivo del bloqueo: {device.lock_reason}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {device.locked ? (
            <Button variant="success" icon={LockOpen} onClick={unlock}>Desbloquear</Button>
          ) : (
            <Button variant="danger" icon={Lock} onClick={() => onAction({ kind: 'lock', device })}>Bloquear</Button>
          )}
          <Button variant="secondary" icon={CreditCard} onClick={() => onAction({ kind: 'payment', device })}>Registrar pago</Button>
        </div>

        <section>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">Pago</h3>
          <div className="flex items-center justify-between rounded-xl border border-white/[0.07] px-4 py-3">
            <span className={`text-sm ${pay.tone}`}>{pay.text}</span>
            {device.paid_until && <span className="text-xs text-zinc-500">{formatDate(device.paid_until)}</span>}
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">Seguridad y salud</h3>
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] px-4">
            <HealthRow ok={h.hardened} label="Modo TV cerrado" />
            <HealthRow ok={h.dns_filter} label="Filtro DNS anti-piratería" />
            <HealthRow ok={h.firewall} label="Firewall" />
            <HealthRow ok={undefined} label="Encendido hace" detail={formatUptime(h.uptime)} />
            <HealthRow ok={undefined} label="Espacio libre" detail={h.free_mb ? `${(h.free_mb / 1024).toFixed(1)} GB` : '—'} />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Historial (7 días)</h3>
          {history.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin eventos.</p>
          ) : (
            <ol className="relative ml-2 border-l border-white/10">
              {history.map((e) => (
                <li key={e.id} className="mb-3 ml-4">
                  <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${e.severity === 'critical' ? 'bg-rose-400' : e.severity === 'warning' ? 'bg-amber-400' : 'bg-zinc-500'}`} />
                  <div className="text-sm text-zinc-200">{EVENT_LABELS[e.kind] ?? e.kind}</div>
                  <div className="text-xs text-zinc-500">
                    {relativeTime(e.created_at)}
                    {typeof e.details.domain === 'string' && ` · ${e.details.domain}`}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onAction({ kind: 'rename', device })}>Renombrar</Button>
          <Button variant="ghost" size="sm" icon={Unlink} className="text-rose-300 hover:text-rose-200" onClick={() => onAction({ kind: 'unpair', device })}>
            Desvincular
          </Button>
        </section>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function DevicesPage({
  company,
  data,
  initialFilter = 'todos',
  initialClaim,
  selectedId,
  onSelect,
}: {
  company: Company;
  data: CompanyData;
  initialFilter?: string;
  initialClaim?: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>(FILTERS.some((f) => f.id === initialFilter) ? (initialFilter as Filter) : 'todos');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(initialClaim ? { kind: 'claim', code: initialClaim } : null);
  const devices = useMemo(() => data.devices ?? [], [data.devices]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, devices.filter((d) => f.test(d, company)).length])),
    [devices, company],
  );
  const shown = devices.filter((d) => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const q = query.trim().toLowerCase();
    return f.test(d, company) && (!q || (d.name ?? '').toLowerCase().includes(q) || d.id.startsWith(q));
  });
  const selected = devices.find((d) => d.id === selectedId) ?? null;

  const quickUnlock = async (d: Device) => {
    try {
      await run(db().rpc('mdm_set_device_lock', { p_device: d.id, p_locked: false }));
      toast.show(`Desbloqueo enviado a "${d.name ?? 'equipo'}"`);
      data.reload();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Equipos"
        subtitle={data.devices ? `${devices.length} equipos vinculados a ${company.name}` : 'Cargando…'}
        actions={<Button icon={Plus} onClick={() => setDialog({ kind: 'claim' })}>Vincular equipo</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input className={`${inputClass} pl-9`} placeholder="Buscar por nombre o ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)} count={counts[f.id]}>{f.label}</Chip>
          ))}
        </div>
      </div>

      <ErrorText error={data.error} />

      <Card padded={false}>
        {!data.devices ? (
          <div className="flex flex-col gap-3 p-5">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={Tv} title={devices.length === 0 ? 'Todavía no hay equipos' : 'Ningún equipo coincide'}>
            {devices.length === 0 ? 'Encendé un TV box con NEX-OS y vinculalo con el código o el QR que muestra.' : 'Probá con otro filtro o búsqueda.'}
          </EmptyState>
        ) : (
          <>
            {/* Escritorio */}
            <table className="hidden w-full text-left md:table">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-5 pb-3 font-medium">Equipo</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Conexión</th>
                  <th className="pb-3 font-medium">Pago</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => {
                  const st = STATUS_META[deviceStatus(d, company)];
                  const applied = enforcement(d, company);
                  const issues = healthIssues(d);
                  const pay = paymentText(d, company);
                  const online = isOnline(d);
                  return (
                    <tr key={d.id} onClick={() => onSelect(d.id)} className="cursor-pointer border-t border-white/[0.05] transition hover:bg-white/[0.03]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-400">
                            <Tv className="h-4 w-4" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-100">{d.name ?? 'Sin nombre'}</div>
                            <div className="font-mono text-[11px] text-zinc-500">{d.id.slice(0, 8)} · {d.firmware_version ?? '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>
                          {applied === 'pendiente' && <span className="flex items-center gap-1 text-[11px] text-amber-300"><Hourglass className="h-3 w-3" aria-hidden /> Pendiente de aplicar</span>}
                          {issues.length > 0 && <span className="flex items-center gap-1 text-[11px] text-rose-300"><ShieldAlert className="h-3 w-3" aria-hidden /> {issues[0]}</span>}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2 text-sm text-zinc-300">
                          <StatusDot online={online} /> {online ? 'En línea' : relativeTime(d.last_seen_at)}
                        </div>
                      </td>
                      <td className={`py-3.5 text-sm ${pay.tone}`}>{pay.text}</td>
                      <td className="py-3.5 pr-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {d.locked ? (
                            <IconButton icon={LockOpen} label="Desbloquear" tone="success" onClick={() => quickUnlock(d)} />
                          ) : (
                            <IconButton icon={Lock} label="Bloquear" tone="danger" onClick={() => setDialog({ kind: 'lock', device: d })} />
                          )}
                          <IconButton icon={CalendarPlus} label="Registrar pago" onClick={() => setDialog({ kind: 'payment', device: d })} />
                          <Menu
                            trigger={(toggle) => <IconButton icon={EllipsisVertical} label="Más acciones" onClick={toggle} />}
                            items={[
                              { label: 'Ver detalle', icon: Activity, onClick: () => onSelect(d.id) },
                              { label: 'Renombrar', icon: Pencil, onClick: () => setDialog({ kind: 'rename', device: d }) },
                              { label: 'Desvincular', icon: Unlink, danger: true, onClick: () => setDialog({ kind: 'unpair', device: d }) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Celular */}
            <ul className="divide-y divide-white/[0.05] md:hidden">
              {shown.map((d) => {
                const st = STATUS_META[deviceStatus(d, company)];
                const pay = paymentText(d, company);
                return (
                  <li key={d.id}>
                    <button onClick={() => onSelect(d.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                      <StatusDot online={isOnline(d)} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-100">{d.name ?? 'Sin nombre'}</div>
                        <div className={`text-xs ${pay.tone}`}>{pay.text}</div>
                      </div>
                      <Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
        <HardDrive className="h-3.5 w-3.5" aria-hidden />
        Los equipos sincronizan cada minuto. Un pago vencido bloquea el TV aunque no tenga internet.
      </p>

      {selected && (
        <DeviceDrawer device={selected} company={company} events={data.events} onClose={() => onSelect(null)} onAction={setDialog} onChanged={data.reload} />
      )}
      {dialog?.kind === 'lock' && <LockModal device={dialog.device} company={company} onClose={() => setDialog(null)} onDone={data.reload} />}
      {dialog?.kind === 'payment' && <PaymentModal device={dialog.device} company={company} onClose={() => setDialog(null)} onDone={data.reload} />}
      {dialog?.kind === 'rename' && <RenameModal device={dialog.device} onClose={() => setDialog(null)} onDone={data.reload} />}
      {dialog?.kind === 'unpair' && (
        <UnpairModal device={dialog.device} onClose={() => setDialog(null)} onDone={() => { onSelect(null); data.reload(); }} />
      )}
      {dialog?.kind === 'claim' && <ClaimModal company={company} initialCode={dialog.code} onClose={() => setDialog(null)} onDone={data.reload} />}
    </>
  );
}
