import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  Ban,
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  Copy,
  CreditCard,
  EllipsisVertical,
  HardDrive,
  Hourglass,
  KeyRound,
  Lock,
  LockOpen,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Tv,
  Unlink,
  X,
} from 'lucide-react';
import {
  db,
  deviceStatus,
  enforcement,
  EVENT_LABELS,
  EXTERNAL_REF_RE,
  isOnline,
  restrictDay,
  run,
  serviceState,
  STATE_LOG_COLUMNS,
  type Company,
  type Device,
  type DeviceEvent,
  type ServiceState,
  type StateLogEntry,
  type UnlockCode,
  type ZoneStatus,
} from '../api';
import { HealthPill, HealthSection, NetDiagSection } from '../DeviceHealth';
import { DEVICE_SORTS, matchesQuery, paginate, sortDevices, type DeviceSort } from '../deviceList';
import { FILTERS, healthIssues, paymentText, SERVICE_STAGES, STATE_SOURCE_LABELS, STATUS_META, type Filter } from '../deviceMeta';
import { addMonths, copyText, formatDate, LOCK_REASONS, relativeTime, RESTRICT_REASONS, todayIso } from '../format';
import type { HealthInputs, HealthScore } from '../health';
import { useStepUp } from '../stepUp';
import { useToast } from '../toast';
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  Chip,
  Drawer,
  EmptyState,
  ErrorState,
  ErrorText,
  Field,
  IconButton,
  inputClass,
  Menu,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SectionTitle,
  Skeleton,
  StatusDot,
  Tabs,
  type Tone,
} from '../ui';
import type { CompanyData } from '../useCompanyData';
import { ZoneAssignModal } from '../ZoneDialogs';
import { matchesZone, NO_ZONE, outageSummary, pageSelection, parseZoneFilter, setSelected, zoneCounts, zoneEventDetail } from '../zones';

// ---------------------------------------------------------------------------
// Acciones (modales)
// ---------------------------------------------------------------------------

type Dialog =
  | { kind: 'lock'; device: Device }
  | { kind: 'restrict'; device: Device }
  | { kind: 'payment'; device: Device }
  | { kind: 'rename'; device: Device }
  | { kind: 'unpair'; device: Device }
  | { kind: 'external-ref'; device: Device }
  | { kind: 'unlock-code'; device: Device; result: UnlockCode }
  | { kind: 'claim'; code?: string }
  | { kind: 'zone'; devices: Device[] };

// RPC de v8 en un solo lugar (contrato NEX MDM v8).
const rpcUnlockCode = (device: string) => run<UnlockCode>(db().rpc('mdm_unlock_code', { p_device: device }));
const rpcSetExternalRef = (device: string, ref: string | null) =>
  run(db().rpc('mdm_set_external_ref', { p_device: device, p_ref: ref }));
// RPC de v9.
const rpcSetRestricted = (device: string, restricted: boolean, reason: string | null = null) =>
  run(db().rpc('mdm_set_device_restricted', { p_device: device, p_restricted: restricted, p_reason: reason }));

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
          <div className="mb-2 text-[13px] font-medium text-fg-2">Motivo</div>
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
        <div className="rounded-xl border border-line bg-inset p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-4">Así lo verá el cliente en el TV</div>
          <div className="flex items-center gap-2 text-sm font-semibold text-fg"><Lock className="h-4 w-4" aria-hidden /> Equipo bloqueado</div>
          <div className="mt-1 text-sm text-fg-2">{company.lock_message}</div>
          {finalReason && <div className="mt-1 text-xs text-fg-4">{finalReason}</div>}
        </div>
        <p className="text-xs text-fg-4">El TV aplica el bloqueo en menos de un minuto y corta lo que se esté reproduciendo.</p>
        <ErrorText error={error} />
      </div>
    </Modal>
  );
}

function RestrictModal({ device, company, onClose, onDone }: { device: Device; company: Company; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState(RESTRICT_REASONS[0]);
  const [custom, setCustom] = useState('');
  const { busy, error, exec } = useAction(onDone);
  const finalReason = reason === 'Otro' ? custom.trim() : reason;
  const submit = () =>
    exec(
      () => rpcSetRestricted(device.id, true, finalReason),
      `Restricción enviada a "${device.name ?? 'equipo'}". Esperando confirmación del TV…`,
    ).then((ok) => ok && onClose());

  return (
    <Modal
      title="Restringir equipo"
      description={device.name ?? device.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon={Ban} disabled={busy || !finalReason} onClick={submit}>Restringir</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-2">
          Paso intermedio antes del bloqueo: el menú, la pantalla de pago y la configuración de red siguen funcionando, pero
          las apps quedan deshabilitadas.
        </p>
        <div>
          <div className="mb-2 text-[13px] font-medium text-fg-2">Motivo</div>
          <div className="flex flex-wrap gap-2">
            {[...RESTRICT_REASONS, 'Otro'].map((r) => (
              <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{r}</Chip>
            ))}
          </div>
        </div>
        {reason === 'Otro' && (
          <Field label="Describí el motivo">
            <input autoFocus className={inputClass} maxLength={280} value={custom} onChange={(e) => setCustom(e.target.value)} />
          </Field>
        )}
        <div className="rounded-xl border border-line bg-inset p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-4">Así lo verá el cliente en el TV</div>
          <div className="text-sm font-medium text-fg">Apps deshabilitadas</div>
          <div className="mt-1 text-sm text-fg-2">{company.payment_message}</div>
          {finalReason && <div className="mt-1 text-xs text-fg-4">{finalReason}</div>}
          {(company.payment_phone || company.payment_url) && (
            <div className="mt-2 text-xs text-fg-3">
              {company.payment_phone && <span>Tel. {company.payment_phone}</span>}
              {company.payment_phone && company.payment_url && ' · '}
              {company.payment_url && <span>QR de pago</span>}
            </div>
          )}
        </div>
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
        <div className="text-sm text-fg-3">
          Pagado hasta ahora: <span className="text-fg-2">{device.paid_until ? formatDate(device.paid_until) : 'sin control'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 3, 6].map((m) => {
            const value = addMonths(base, m);
            return (
              <button
                key={m}
                onClick={() => setDate(value)}
                type="button"
                aria-pressed={date === value}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  date === value ? 'border-accent bg-accent-soft' : 'border-line-strong hover:bg-fill'
                }`}
              >
                <div className="text-sm font-semibold text-fg">+{m} {m === 1 ? 'mes' : 'meses'}</div>
                <div className="text-xs text-fg-3">{formatDate(value)}</div>
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
        {wasOverdue && <Callout tone="success" icon={LockOpen}>El equipo se desbloquea solo en el próximo minuto.</Callout>}
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
  const stepUp = useStepUp();
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
              exec(() => stepUp.guard(() => run(db().rpc('mdm_unpair_device', { p_device: device.id }))), 'Equipo desvinculado').then((ok) => ok && onClose())
            }
          >
            Desvincular
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-fg-2">
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

function ExternalRefModal({ device, onClose, onDone }: { device: Device; onClose: () => void; onDone: () => void }) {
  const [ref, setRef] = useState(device.external_ref ?? '');
  const { busy, error, exec } = useAction(onDone);
  const value = ref.trim();
  const valid = value === '' || EXTERNAL_REF_RE.test(value);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    exec(() => rpcSetExternalRef(device.id, value || null), value ? 'N.º de cliente guardado' : 'N.º de cliente quitado').then(
      (ok) => ok && onClose(),
    );
  };
  return (
    <Modal title="N.º de cliente (ISP)" description={device.name ?? device.id} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="N.º de cliente"
          hint="El que usa tu sistema de gestión o facturación. Sirve para operar el equipo por API (ref:<n.º>). Único en la empresa."
        >
          <input
            autoFocus
            className={`${inputClass} font-mono`}
            maxLength={64}
            placeholder="ABO-000123"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </Field>
        {!valid && <p role="alert" className="text-xs text-danger">Solo letras, números y . _ : @ - (empezando por letra o número, hasta 64).</p>}
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy || !valid}>Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}

function UnlockCodeModal({ device, result, onClose }: { device: Device; result: UnlockCode; onClose: () => void }) {
  const toast = useToast();
  const pretty = `${result.code.slice(0, 4)} ${result.code.slice(4)}`;
  const copy = async () => toast.show((await copyText(result.code)) ? 'Código copiado' : 'No se pudo copiar', 'info');
  return (
    <Modal
      title="Código de desbloqueo"
      description={device.name ?? device.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" icon={Copy} onClick={copy}>Copiar</Button>
          <Button onClick={onClose}>Listo</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-accent bg-accent-soft py-6 text-center font-mono text-4xl font-semibold tracking-[0.15em] text-fg tabular-nums sm:text-5xl">
          {pretty}
        </div>
        <ul className="flex flex-col gap-1.5 text-sm text-fg-2">
          <li>Válido el {formatDate(result.valid_on)} (UTC) y hasta el día siguiente.</li>
          <li>Desbloquea el equipo por {result.hours ?? 72} h, aunque no tenga internet.</li>
          <li className="text-fg-4">
            Dictáselo al cliente: en el TV bloqueado elige "Tengo un código de desbloqueo" y lo ingresa con el control. Queda registrado en la auditoría.
          </li>
        </ul>
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
        <Callout tone="info" icon={QrCode}>Encendé el TV box: muestra un QR y un código. Escaneá el QR con este celular o escribí el código.</Callout>
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
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5 text-sm text-fg-2">
        {known && ok ? <ShieldCheck className="h-4 w-4 shrink-0 text-ok" aria-hidden /> : known ? <ShieldAlert className="h-4 w-4 shrink-0 text-danger" aria-hidden /> : <Activity className="h-4 w-4 shrink-0 text-fg-4" aria-hidden />}
        {label}
      </span>
      <span className={`shrink-0 text-right text-[13px] ${known ? (ok ? 'text-ok' : 'font-medium text-danger') : 'text-fg-4'}`}>{detail ?? (known ? (ok ? 'OK' : 'Falla') : 'Sin datos')}</span>
    </div>
  );
}

const STAGE_ACTIVE: Record<string, string> = {
  success: 'bg-ok-soft text-ok ring-ok',
  warning: 'bg-warn-soft text-warn ring-warn',
  danger: 'bg-danger-soft text-danger ring-danger',
};

/** Activo → Aviso → Restringido → Bloqueado, con la etapa actual resaltada. */
function ServiceStages({ state }: { state: ServiceState }) {
  const at = SERVICE_STAGES.findIndex((s) => s.id === state);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Estado del servicio">
      {SERVICE_STAGES.map((s, i) => (
        <li
          key={s.id}
          aria-current={s.id === state ? 'step' : undefined}
          className={`flex h-8 items-center justify-center rounded-md px-1 text-center text-xs ring-1 ring-inset ${
            s.id === state ? `${STAGE_ACTIVE[s.tone]} font-semibold` : i < at ? 'bg-fill text-fg-3 ring-line' : 'text-fg-4 ring-line'
          }`}
        >
          <span className="truncate">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

const STATE_DOT: Record<ServiceState, string> = {
  active: 'bg-ok',
  warning: 'bg-warn',
  restricted: 'bg-warn',
  locked: 'bg-danger',
};

function stateChangeText(e: StateLogEntry): string {
  const d = e.details;
  switch (d.change) {
    case 'lock':
      return 'Bloqueo';
    case 'unlock':
      return 'Desbloqueo';
    case 'restrict':
      return 'Restricción';
    case 'unrestrict':
      return 'Restricción quitada';
    case 'paid_until':
      return typeof d.paid_until === 'string' ? `Pagado hasta ${formatDate(d.paid_until)}` : 'Control de pago desactivado';
    default:
      return e.source === 'device' ? 'Informado por el equipo' : 'Cambio de estado';
  }
}

/** Historial de mdm_device_state_log del equipo. Se recarga cuando cambia algo que mueve el estado. */
function useStateLog(deviceId: string, version: string) {
  const [rows, setRows] = useState<StateLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    run<StateLogEntry[]>(
      db().from('mdm_device_state_log').select(STATE_LOG_COLUMNS).eq('device_id', deviceId).order('at', { ascending: false }).limit(30),
    ).then(
      (r) => {
        if (cancelled) return;
        setRows(r);
        setError(null);
      },
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [deviceId, version]);
  return { rows, error };
}

/** Renglón de una línea de tiempo: punto de color, título y detalle. */
function TimelineItem({ dot, title, detail }: { dot: string; title: ReactNode; detail: ReactNode }) {
  return (
    <li className="relative pb-4 pl-6 last:pb-0">
      <span className="absolute bottom-0 left-[4.5px] top-2 w-px bg-fill-2 [li:last-child>&]:hidden" aria-hidden />
      <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--surface)] ${dot}`} aria-hidden />
      <div className="text-sm text-fg">{title}</div>
      <div className="text-xs text-fg-4">{detail}</div>
    </li>
  );
}

/** Renglón "etiqueta — valor" de la ficha del equipo. */
function InfoRow({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-[2.75rem] items-center justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-sm text-fg-3">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 text-right text-sm text-fg">
        <span className="min-w-0 break-words">{children}</span>
        {action}
      </dd>
    </div>
  );
}

type DrawerTab = 'resumen' | 'salud' | 'historial';

function DeviceDrawer({
  device,
  company,
  zone,
  events,
  score,
  inputs,
  now,
  onClose,
  onAction,
  onChanged,
}: {
  device: Device;
  company: Company;
  /** Zona del equipo, si tiene. */
  zone: ZoneStatus | undefined;
  events: DeviceEvent[];
  score: HealthScore | undefined;
  inputs: HealthInputs | undefined;
  /** Momento de la última carga de datos: contra eso se calcula si el diagnóstico sigue pendiente. */
  now: number;
  onClose: () => void;
  onAction: (d: Dialog) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<DrawerTab>('resumen');
  const status = deviceStatus(device, company);
  const meta = STATUS_META[status];
  const applied = enforcement(device, company);
  const online = isOnline(device);
  const pay = paymentText(device, company);
  const h = device.health ?? {};
  const issues = healthIssues(device);
  // Los eventos de zona (caída masiva, recuperación) no tienen equipo: se suman los de la zona de este.
  const history = events
    .filter((e) => e.device_id === device.id || (e.device_id === null && !!device.zone_id && e.details.zone_id === device.zone_id))
    .slice(0, 30);
  const state = serviceState(device, company);
  const rDay = restrictDay(device, company);
  const stateLog = useStateLog(device.id, [device.locked, device.restricted, device.paid_until, device.reported_mode].join('|'));
  const healthDot: Tone | undefined = issues.length > 0 || score?.band === 'problemas' ? 'danger' : score?.band === 'atencion' ? 'warning' : undefined;

  const unrestrict = async () => {
    try {
      await rpcSetRestricted(device.id, false);
      toast.show('Restricción quitada. Esperando confirmación del TV…');
      onChanged();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  };

  const unlock = async () => {
    try {
      await run(db().rpc('mdm_set_device_lock', { p_device: device.id, p_locked: false }));
      toast.show('Desbloqueo enviado. Esperando confirmación del TV…');
      onChanged();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  };

  const [codeBusy, setCodeBusy] = useState(false);
  const unlockCode = async () => {
    setCodeBusy(true);
    try {
      onAction({ kind: 'unlock-code', device, result: await rpcUnlockCode(device.id) });
    } catch (err) {
      toast.show((err as Error).message, 'error');
    } finally {
      setCodeBusy(false);
    }
  };

  return (
    <Drawer
      title={device.name ?? 'Equipo sin nombre'}
      subtitle={<span className="font-mono">{device.id.slice(0, 8)} · {device.firmware_version ?? 'firmware desconocido'}</span>}
      onClose={onClose}
      header={
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
            <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
            {applied === 'pendiente' && <Badge tone="warning" icon={Hourglass}>Pendiente de aplicar</Badge>}
            {applied === 'confirmado' && device.reported_mode === 'locked' && <Badge tone="success" icon={CircleCheck}>Bloqueo confirmado</Badge>}
            {applied === 'confirmado' && device.reported_mode === 'restricted' && <Badge tone="success" icon={CircleCheck}>Restricción confirmada</Badge>}
            <span className="ml-auto flex items-center gap-2 text-[13px] text-fg-3">
              <StatusDot online={online} /> {online ? 'En línea' : `Visto ${relativeTime(device.last_seen_at)}`}
            </span>
          </div>
          <Tabs
            idBase="equipo"
            label="Secciones del equipo"
            value={tab}
            onChange={setTab}
            className="px-4 sm:px-6"
            tabs={[
              { id: 'resumen', label: 'Servicio' },
              { id: 'salud', label: 'Salud y red', dot: healthDot },
              { id: 'historial', label: 'Historial' },
            ]}
          />
        </>
      }
      footer={
        <div className="flex gap-2">
          {device.locked ? (
            <Button variant="success" icon={LockOpen} className="flex-1" onClick={unlock}>Desbloquear</Button>
          ) : (
            <Button variant="danger" icon={Lock} className="flex-1" onClick={() => onAction({ kind: 'lock', device })}>Bloquear</Button>
          )}
          <Button variant="secondary" icon={CreditCard} className="flex-1" onClick={() => onAction({ kind: 'payment', device })}>Registrar pago</Button>
        </div>
      }
    >
      <div role="tabpanel" id={`equipo-panel-${tab}`} aria-labelledby={`equipo-tab-${tab}`} className="flex flex-col gap-6">
        {tab === 'resumen' && (
          <>
            {device.locked && device.lock_reason && (
              <Callout tone="danger" icon={Lock} title="Bloqueado a mano">Motivo: {device.lock_reason}</Callout>
            )}
            {zone?.outage_started_at && (
              <Callout tone="danger" icon={MapPin} title={`Caída en curso en ${zone.name}`}>
                {outageSummary(zone, now)}. Si este equipo no responde, lo más probable es que sea por la caída de la zona.
              </Callout>
            )}
            {device.restricted && (
              <Callout tone="warning" icon={Ban} title="Restringido a mano">{device.restrict_reason ? `Motivo: ${device.restrict_reason}` : 'Sin motivo cargado.'}</Callout>
            )}

            <section>
              <SectionTitle>Estado del servicio</SectionTitle>
              <ServiceStages state={state} />
              {rDay && !device.locked && state !== 'locked' && (
                <p className="mt-2 text-xs text-fg-4">Si no paga, se restringe el {formatDate(rDay)}.</p>
              )}
            </section>

            <section>
              <SectionTitle>Cliente y pago</SectionTitle>
              <dl className="divide-y divide-line rounded-xl border border-line px-4">
                <InfoRow label="Pago"><span className={pay.tone}>{pay.text}</span></InfoRow>
                <InfoRow
                  label="N.º de cliente"
                  action={<IconButton icon={Pencil} label="Editar n.º de cliente" className="-mr-2" onClick={() => onAction({ kind: 'external-ref', device })} />}
                >
                  {device.external_ref ? <span className="font-mono text-[13px]">{device.external_ref}</span> : <span className="text-fg-4">Sin asignar</span>}
                </InfoRow>
                <InfoRow
                  label="Nombre"
                  action={<IconButton icon={Pencil} label="Renombrar equipo" className="-mr-2" onClick={() => onAction({ kind: 'rename', device })} />}
                >
                  {device.name ?? <span className="text-fg-4">Sin nombre</span>}
                </InfoRow>
                <InfoRow
                  label="Zona"
                  action={<IconButton icon={Pencil} label="Cambiar la zona del equipo" className="-mr-2" onClick={() => onAction({ kind: 'zone', devices: [device] })} />}
                >
                  {zone ? zone.name : <span className="text-fg-4">Sin zona</span>}
                </InfoRow>
              </dl>
            </section>

            <section>
              <SectionTitle>Otras acciones</SectionTitle>
              <div className="grid gap-2 min-[440px]:grid-cols-2">
                {device.restricted ? (
                  <Button variant="secondary" icon={CircleCheck} onClick={unrestrict}>Quitar restricción</Button>
                ) : (
                  <Button variant="secondary" icon={Ban} onClick={() => onAction({ kind: 'restrict', device })}>Restringir</Button>
                )}
                <Button variant="secondary" icon={KeyRound} loading={codeBusy} onClick={unlockCode}>Código de desbloqueo</Button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-fg-4">
                Restringir deja el menú y la pantalla de pago, sin apps. El código es para un equipo bloqueado o restringido sin
                internet: el cliente lo ingresa en el TV y queda activo por 72 h.
              </p>
            </section>

            <section className="border-t border-line pt-4">
              <Button variant="ghost" size="sm" icon={Unlink} className="-ml-2 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => onAction({ kind: 'unpair', device })}>
                Desvincular equipo
              </Button>
            </section>
          </>
        )}

        {tab === 'salud' && (
          <>
            {issues.length > 0 && (
              <Callout tone="danger" icon={ShieldAlert} title={issues.length === 1 ? 'Alerta de seguridad' : `${issues.length} alertas de seguridad`}>
                <ul className={issues.length > 1 ? 'list-disc pl-4' : ''}>{issues.map((i) => <li key={i}>{i}</li>)}</ul>
              </Callout>
            )}

            <HealthSection device={device} score={score} inputs={inputs} />

            <NetDiagSection device={device} now={now} onRefresh={onChanged} />

            <section>
              <SectionTitle>Seguridad</SectionTitle>
              <div className="divide-y divide-line rounded-xl border border-line px-4">
                <HealthRow ok={h.hardened} label="Modo TV cerrado" />
                {h.platform === 'android' ? (
                  <>
                    <HealthRow ok={h.webview_filter} label="Filtro anti-piratería en apps de NEX TV" />
                    {/* Chrome y las apps de la Play Store navegan sin filtro: Android no permite DNS ni firewall de sistema. */}
                    <HealthRow ok={undefined} label="Filtro en Chrome y apps de Play Store" detail="No disponible en Android" />
                    {h.version && <HealthRow ok={undefined} label="Versión de NEX TV" detail={`${h.version} (build ${h.build ?? '—'})`} />}
                  </>
                ) : (
                  <>
                    <HealthRow ok={h.dns_filter} label="Filtro DNS anti-piratería" />
                    <HealthRow ok={h.firewall} label="Firewall" />
                  </>
                )}
              </div>
            </section>
          </>
        )}

        {tab === 'historial' && (
          <>
            <section>
              <SectionTitle>Cambios de estado</SectionTitle>
              <ErrorText error={stateLog.error} />
              {!stateLog.rows ? (
                !stateLog.error && <Skeleton className="h-16" />
              ) : stateLog.rows.length === 0 ? (
                <p className="text-sm text-fg-4">Sin cambios registrados.</p>
              ) : (
                <ol>
                  {stateLog.rows.map((e) => (
                    <TimelineItem
                      key={e.id}
                      dot={STATE_DOT[e.state] ?? 'bg-neutral'}
                      title={<>{SERVICE_STAGES.find((s) => s.id === e.state)?.label ?? e.state}<span className="text-fg-3"> · {stateChangeText(e)}</span></>}
                      detail={
                        <>
                          <span title={new Date(e.at).toLocaleString('es-AR')}>{relativeTime(e.at)}</span> · {STATE_SOURCE_LABELS[e.source] ?? e.source}
                          {e.source === 'api' && typeof e.details.actor === 'string' && ` (${e.details.actor.replace(/^api:/, '')})`}
                          {typeof e.details.reason === 'string' && ` · ${e.details.reason}`}
                        </>
                      }
                    />
                  ))}
                </ol>
              )}
            </section>

            <section>
              <SectionTitle>Eventos (7 días)</SectionTitle>
              {history.length === 0 ? (
                <p className="text-sm text-fg-4">Sin eventos.</p>
              ) : (
                <ol>
                  {history.map((e) => (
                    <TimelineItem
                      key={e.id}
                      dot={e.severity === 'critical' ? 'bg-danger' : e.severity === 'warning' ? 'bg-warn' : 'bg-neutral'}
                      title={EVENT_LABELS[e.kind] ?? e.kind}
                      detail={
                        <>
                          <span title={new Date(e.created_at).toLocaleString('es-AR')}>{relativeTime(e.created_at)}</span>
                          {typeof e.details.domain === 'string' && <> · <span className="font-mono">{e.details.domain}</span></>}
                          {typeof e.details.zone === 'string' && <> · {e.details.zone}</>}
                          {zoneEventDetail(e.kind, e.details) && <> · {zoneEventDetail(e.kind, e.details)}</>}
                        </>
                      }
                    />
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
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
  initialZone,
  initialClaim,
  selectedId,
  onSelect,
  goZones,
}: {
  company: Company;
  data: CompanyData;
  initialFilter?: string;
  /** Zona con la que arranca el listado: id de zona o "sin-zona". */
  initialZone?: string;
  /** Lleva a la sección Zonas (para crearlas o administrarlas). */
  goZones?: () => void;
  initialClaim?: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>(FILTERS.some((f) => f.id === initialFilter) ? (initialFilter as Filter) : 'todos');
  const [zoneRaw, setZoneRaw] = useState<string | null>(initialZone ?? null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DeviceSort>('nombre');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog | null>(initialClaim ? { kind: 'claim', code: initialClaim } : null);
  const devices = useMemo(() => data.devices ?? [], [data.devices]);

  const filterCtx = useMemo(() => ({ health: data.health }), [data.health]);
  const zones = data.zones;
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.zone_id, z])), [zones]);
  const perZone = useMemo(() => zoneCounts(devices), [devices]);
  // Hasta que cargan las zonas no se sabe si la de la URL existe: se respeta tal cual.
  const zone = data.devices ? parseZoneFilter(zoneRaw, zones) : zoneRaw;
  const zoneInfo = zone && zone !== NO_ZONE ? zoneById.get(zone) : undefined;
  const inZone = useMemo(() => devices.filter((d) => matchesZone(d, zone)), [devices, zone]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, inZone.filter((d) => f.test(d, company, filterCtx)).length])),
    [inZone, company, filterCtx],
  );
  const matching = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    return sortDevices(inZone.filter((d) => f.test(d, company, filterCtx) && matchesQuery(d, query)), sort, company, data.health);
  }, [inZone, filter, query, sort, company, filterCtx, data.health]);
  const view = paginate(matching, page);
  const shown = view.items;
  const selected = devices.find((d) => d.id === selectedId) ?? null;
  const narrowed = filter !== 'todos' || query.trim() !== '' || zone !== null;
  const clear = () => {
    setFilter('todos');
    setZoneRaw(null);
    setQuery('');
    setPage(1);
  };
  const goPage = (p: number) => {
    setPage(p);
    document.getElementById('equipos-listado')?.scrollIntoView({ block: 'start' });
  };

  // Selección para acciones en lote. Se guarda por id y sobrevive a cambiar de página o de filtro.
  const pickedDevices = useMemo(() => devices.filter((d) => picked.has(d.id)), [devices, picked]);
  const pageIds = shown.map((d) => d.id);
  const pageState = pageSelection(pageIds, picked);
  const allMatchingPicked = matching.length > 0 && matching.every((d) => picked.has(d.id));
  const toggle = (id: string, on: boolean) => setPicked((p) => setSelected(p, [id], on));

  const quickUnlock = async (d: Device) => {
    try {
      await run(db().rpc('mdm_set_device_lock', { p_device: d.id, p_locked: false }));
      toast.show(`Desbloqueo enviado a "${d.name ?? 'equipo'}"`);
      data.reload();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  };

  const quickUnrestrict = async (d: Device) => {
    try {
      await rpcSetRestricted(d.id, false);
      toast.show(`Restricción quitada a "${d.name ?? 'equipo'}"`);
      data.reload();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  };

  const th = 'sticky top-0 z-10 border-b border-line bg-surface-2 py-2.5 text-left text-xs font-medium text-fg-3';

  return (
    <>
      <PageHeader
        title="Equipos"
        subtitle={data.devices ? `${devices.length} ${devices.length === 1 ? 'equipo vinculado' : 'equipos vinculados'} a ${company.name}` : 'Cargando…'}
        actions={<Button icon={Plus} onClick={() => setDialog({ kind: 'claim' })}>Vincular equipo</Button>}
      />

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          className="w-full sm:max-w-sm sm:flex-1"
          placeholder="Buscar por nombre, ID o n.º de cliente"
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
        />
        {zones.length > 0 && (
          <label className="flex items-center gap-2 sm:ml-auto">
            <span className="w-14 shrink-0 text-[13px] text-fg-3 sm:w-auto">Zona</span>
            <select
              className={`${inputClass} sm:w-auto sm:max-w-[14rem]`}
              value={zone ?? ''}
              onChange={(e) => {
                setZoneRaw(e.target.value || null);
                setPage(1);
              }}
            >
              <option value="">Todas las zonas</option>
              {zones.map((z) => (
                <option key={z.zone_id} value={z.zone_id}>{z.name} ({perZone.get(z.zone_id) ?? 0}){z.outage_started_at ? ' · en caída' : ''}</option>
              ))}
              <option value={NO_ZONE}>Sin zona ({perZone.get(NO_ZONE) ?? 0})</option>
            </select>
          </label>
        )}
        <label className={`flex items-center gap-2 ${zones.length > 0 ? '' : 'sm:ml-auto'}`}>
          <span className="w-14 shrink-0 text-[13px] text-fg-3 sm:w-auto">Ordenar</span>
          <select
            className={`${inputClass} sm:w-auto`}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as DeviceSort);
              setPage(1);
            }}
          >
            {DEVICE_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <div className="scroll-x -mx-4 mb-4 flex gap-2 px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar equipos">
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            active={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setPage(1);
            }}
            count={counts[f.id]}
          >
            {f.label}
          </Chip>
        ))}
      </div>

      {data.devices && <ErrorText error={data.error} />}

      {zoneInfo?.outage_started_at && (
        <Callout tone="danger" icon={MapPin} title={`Caída en curso en ${zoneInfo.name}`} className="mb-4">
          {outageSummary(zoneInfo, data.loadedAt || undefined)}.
        </Callout>
      )}
      {data.devices && zones.length === 0 && devices.length > 0 && goZones && (
        <Callout tone="neutral" icon={MapPin} className="mb-4" action={<Button size="sm" variant="secondary" onClick={goZones}>Crear zonas</Button>}>
          Agrupá los equipos por localidad o nodo para mandar comunicados a una sola zona y enterarte de las caídas masivas.
        </Callout>
      )}

      <section id="equipos-listado" aria-label="Listado de equipos" className="scroll-mt-16 rounded-xl border border-line bg-surface shadow-card">
        {!data.devices ? (
          data.error ? (
            <ErrorState title="No pudimos cargar los equipos" error={data.error} onRetry={data.reload} />
          ) : (
            <div className="flex flex-col gap-3 p-4 sm:p-5" role="status" aria-label="Cargando equipos">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          )
        ) : shown.length === 0 ? (
          devices.length === 0 ? (
            <EmptyState icon={Tv} title="Todavía no hay equipos" action={<Button icon={Plus} onClick={() => setDialog({ kind: 'claim' })}>Vincular el primer equipo</Button>}>
              Encendé un TV box con NEX y vinculalo con el código o el QR que muestra en pantalla.
            </EmptyState>
          ) : (
            <EmptyState icon={SearchX} title="Ningún equipo coincide" action={narrowed && <Button variant="secondary" onClick={clear}>Quitar filtros</Button>}>
              {zone === NO_ZONE && filter === 'todos' && !query.trim() ? 'Todos los equipos tienen una zona asignada.' : 'Probá con otro filtro o con otra búsqueda.'}
            </EmptyState>
          )
        ) : (
          <>
            {pageState === 'all' && matching.length > shown.length && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-t-xl border-b border-line bg-accent-soft px-4 py-2 text-[13px] text-fg-2 sm:px-5" role="status">
                {allMatchingPicked ? (
                  <>Están seleccionados los {matching.length} equipos {narrowed ? 'que coinciden' : 'del listado'}.</>
                ) : (
                  <>
                    Seleccionaste los {shown.length} de esta página.
                    <button type="button" className="rounded font-medium text-accent underline-offset-2 hover:underline" onClick={() => setPicked((p) => setSelected(p, matching.map((d) => d.id), true))}>
                      Seleccionar los {matching.length} {narrowed ? 'que coinciden' : 'del listado'}
                    </button>
                  </>
                )}
              </div>
            )}
            {/* Celular: seleccionar todo */}
            <div className="flex items-center gap-1 border-b border-line py-1 pl-1.5 pr-4 text-[13px] text-fg-3 md:hidden">
              <Checkbox
                label={pageState === 'all' ? 'Quitar de la selección los equipos de esta página' : 'Seleccionar los equipos de esta página'}
                checked={pageState === 'all'}
                indeterminate={pageState === 'some'}
                onChange={(on) => setPicked((p) => setSelected(p, pageIds, on))}
                className="h-11 w-11"
              />
              <span aria-hidden>Seleccionar los de esta página</span>
            </div>
            {/* Escritorio */}
            <table className="hidden w-full border-separate border-spacing-0 md:table">
              <thead>
                <tr>
                  <th scope="col" className={`${th} w-12 rounded-tl-xl pl-3`}>
                    <Checkbox
                      label={pageState === 'all' ? 'Quitar de la selección los equipos de esta página' : 'Seleccionar los equipos de esta página'}
                      checked={pageState === 'all'}
                      indeterminate={pageState === 'some'}
                      onChange={(on) => setPicked((p) => setSelected(p, pageIds, on))}
                    />
                  </th>
                  <th scope="col" className={th}>Equipo</th>
                  {zones.length > 0 && <th scope="col" className={`${th} hidden xl:table-cell`}>Zona</th>}
                  <th scope="col" className={th}>Estado</th>
                  <th scope="col" className={th}>Salud</th>
                  <th scope="col" className={th}>Conexión</th>
                  <th scope="col" className={th}>Pago</th>
                  <th scope="col" className={`${th} rounded-tr-xl`}><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => {
                  const st = STATUS_META[deviceStatus(d, company)];
                  const applied = enforcement(d, company);
                  const issues = healthIssues(d);
                  const pay = paymentText(d, company);
                  const online = isOnline(d);
                  const td = 'border-b border-line py-2.5 align-middle group-last:border-b-0';
                  const z = d.zone_id ? zoneById.get(d.zone_id) : undefined;
                  const isPicked = picked.has(d.id);
                  return (
                    <tr key={d.id} onClick={() => onSelect(d.id)} className={`group cursor-pointer transition ${d.id === selectedId || isPicked ? 'bg-accent-soft' : 'hover:bg-fill'}`}>
                      <td className={`${td} w-12 pl-3`} onClick={(e) => e.stopPropagation()}>
                        <Checkbox label={`Seleccionar ${d.name ?? d.id.slice(0, 8)}`} checked={isPicked} onChange={(on) => toggle(d.id, on)} />
                      </td>
                      <td className={`${td} max-w-0 pr-4 lg:w-[28%]`}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(d.id); }} className="block max-w-full rounded text-left">
                          <span className={`block truncate text-sm font-medium ${d.name ? 'text-fg' : 'text-fg-3'}`}>{d.name ?? 'Sin nombre'}</span>
                          <span className="block truncate font-mono text-[11px] text-fg-4">
                            {d.id.slice(0, 8)} · {d.firmware_version ?? '—'}{d.external_ref && ` · ${d.external_ref}`}
                          </span>
                          {z && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-fg-3 xl:hidden">
                              <MapPin className={`h-3 w-3 shrink-0 ${z.outage_started_at ? 'text-danger' : 'text-fg-4'}`} aria-hidden />
                              <span className="truncate">{z.name}</span>
                            </span>
                          )}
                        </button>
                      </td>
                      {zones.length > 0 && (
                        <td className={`${td} hidden max-w-0 pr-4 xl:table-cell xl:w-[14%]`}>
                          {z ? (
                            <span className="flex items-center gap-1.5 text-sm text-fg-2" title={z.outage_started_at ? `${z.name}: caída en curso` : z.name}>
                              {z.outage_started_at && <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-label="Caída en curso" role="img" />}
                              <span className="truncate">{z.name}</span>
                            </span>
                          ) : (
                            <span className="text-sm text-fg-4">Sin zona</span>
                          )}
                        </td>
                      )}
                      <td className={`${td} max-w-0 pr-4 lg:w-[22%]`}>
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>
                          {applied === 'pendiente' && <span className="flex items-center gap-1 text-xs text-warn"><Hourglass className="h-3 w-3 shrink-0" aria-hidden /> Pendiente de aplicar</span>}
                          {issues.length > 0 && (
                            <span className="flex max-w-full items-center gap-1 text-xs text-danger" title={issues.join(' · ')}>
                              <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden /> <span className="truncate">{issues[0]}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${td} pr-4`}><HealthPill score={data.health.get(d.id)} /></td>
                      <td className={`${td} pr-4`}>
                        <div className="flex items-center gap-2 whitespace-nowrap text-sm text-fg-2">
                          <StatusDot online={online} /> {online ? 'En línea' : <span className="text-fg-3">{relativeTime(d.last_seen_at)}</span>}
                        </div>
                      </td>
                      <td className={`${td} whitespace-nowrap pr-4 text-sm ${pay.tone}`}>{pay.text}</td>
                      <td className={`${td} pr-3`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          {d.locked ? (
                            <IconButton icon={LockOpen} label="Desbloquear" tone="success" onClick={() => quickUnlock(d)} />
                          ) : (
                            <IconButton icon={Lock} label="Bloquear" onClick={() => setDialog({ kind: 'lock', device: d })} />
                          )}
                          <IconButton icon={CalendarPlus} label="Registrar pago" onClick={() => setDialog({ kind: 'payment', device: d })} />
                          <Menu
                            trigger={(toggle, open) => <IconButton icon={EllipsisVertical} label="Más acciones" aria-haspopup="menu" aria-expanded={open} onClick={toggle} />}
                            items={[
                              { label: 'Ver detalle', icon: Activity, onClick: () => onSelect(d.id) },
                              d.restricted
                                ? { label: 'Quitar restricción', icon: CircleCheck, onClick: () => quickUnrestrict(d) }
                                : { label: 'Restringir', icon: Ban, onClick: () => setDialog({ kind: 'restrict', device: d }) },
                              { label: 'Renombrar', icon: Pencil, onClick: () => setDialog({ kind: 'rename', device: d }) },
                              { label: 'Cambiar zona', icon: MapPin, onClick: () => setDialog({ kind: 'zone', devices: [d] }) },
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
            <ul className="divide-y divide-line md:hidden">
              {shown.map((d) => {
                const st = STATUS_META[deviceStatus(d, company)];
                const pay = paymentText(d, company);
                const online = isOnline(d);
                const issues = healthIssues(d);
                const z = d.zone_id ? zoneById.get(d.zone_id) : undefined;
                const isPicked = picked.has(d.id);
                return (
                  <li key={d.id} className={`flex items-center ${isPicked ? 'bg-accent-soft' : ''}`}>
                    <Checkbox label={`Seleccionar ${d.name ?? d.id.slice(0, 8)}`} checked={isPicked} onChange={(on) => toggle(d.id, on)} className="ml-1.5 h-11 w-11" />
                    <button type="button" onClick={() => onSelect(d.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-1 pr-4 text-left transition active:bg-fill">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StatusDot online={online} />
                          <span className={`truncate text-[15px] font-medium ${d.name ? 'text-fg' : 'text-fg-3'}`}>{d.name ?? 'Sin nombre'}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>
                          {issues.length > 0 && <Badge tone="danger" icon={ShieldAlert}>Alerta</Badge>}
                          <HealthPill score={data.health.get(d.id)} />
                        </div>
                        <div className="mt-1.5 text-[13px] text-fg-4">
                          <span className="sr-only">{online ? 'En línea. ' : 'Sin conexión. '}</span>
                          {!online && <>Visto {relativeTime(d.last_seen_at)} · </>}
                          <span className={pay.tone}>{pay.text}</span>
                          {z && <> · <span className={z.outage_started_at ? 'text-danger' : ''}>{z.name}</span></>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-fg-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>

            <Pagination page={view.page} pageCount={view.pageCount} from={view.from} to={view.to} total={view.total} onPage={goPage} />
          </>
        )}
      </section>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-fg-4">
        <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Los equipos sincronizan cada minuto. Un pago vencido restringe o bloquea el TV aunque no tenga internet.
      </p>

      {pickedDevices.length > 0 && (
        <>
          <div className="h-20" aria-hidden />
          <div
            role="region"
            aria-label="Acciones para los equipos seleccionados"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-20 flex justify-center px-3 pb-3 lg:bottom-0 lg:left-[264px] lg:pb-5"
          >
            <div className="pointer-events-auto flex w-full max-w-lg animate-[nexIn_.18s_ease-out] items-center gap-2 rounded-xl border border-line-strong bg-overlay py-2 pl-4 pr-2 shadow-pop">
              <span className="min-w-0 flex-1 truncate text-sm text-fg-2" aria-live="polite">
                <span className="font-semibold tabular-nums text-fg">{pickedDevices.length}</span> {pickedDevices.length === 1 ? 'seleccionado' : 'seleccionados'}
              </span>
              <Button size="sm" icon={MapPin} onClick={() => setDialog({ kind: 'zone', devices: pickedDevices })}>Asignar zona</Button>
              <IconButton icon={X} label="Quitar la selección" onClick={() => setPicked(new Set())} />
            </div>
          </div>
        </>
      )}

      {selected && (
        <DeviceDrawer
          key={selected.id}
          device={selected}
          company={company}
          zone={selected.zone_id ? zoneById.get(selected.zone_id) : undefined}
          events={data.events}
          score={data.health.get(selected.id)}
          inputs={data.healthInputs.get(selected.id)}
          now={data.loadedAt}
          onClose={() => onSelect(null)}
          onAction={setDialog}
          onChanged={data.reload}
        />
      )}
      {dialog?.kind === 'lock' && <LockModal device={dialog.device} company={company} onClose={() => setDialog(null)} onDone={data.reload} />}
      {dialog?.kind === 'restrict' && <RestrictModal device={dialog.device} company={company} onClose={() => setDialog(null)} onDone={data.reload} />}
      {dialog?.kind === 'payment' && <PaymentModal device={dialog.device} company={company} onClose={() => setDialog(null)} onDone={data.reload} />}
      {dialog?.kind === 'rename' && <RenameModal device={dialog.device} onClose={() => setDialog(null)} onDone={data.reload} />}
      {dialog?.kind === 'unpair' && (
        <UnpairModal device={dialog.device} onClose={() => setDialog(null)} onDone={() => { onSelect(null); data.reload(); }} />
      )}
      {dialog?.kind === 'external-ref' && <ExternalRefModal device={dialog.device} onClose={() => setDialog(null)} onDone={data.reload} />}
      {dialog?.kind === 'unlock-code' && <UnlockCodeModal device={dialog.device} result={dialog.result} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'zone' && (
        <ZoneAssignModal
          company={company}
          devices={dialog.devices}
          zones={zones}
          onClose={() => setDialog(null)}
          onZoneCreated={data.reload}
          onDone={() => {
            if (dialog.devices.length > 1) setPicked(new Set());
            data.reload();
          }}
        />
      )}
      {dialog?.kind === 'claim' && <ClaimModal company={company} initialCode={dialog.code} onClose={() => setDialog(null)} onDone={data.reload} />}
    </>
  );
}
