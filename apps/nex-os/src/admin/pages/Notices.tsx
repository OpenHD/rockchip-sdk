import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  Ban,
  CalendarClock,
  CloudLightning,
  Copy,
  Eye,
  HeartPulse,
  Info,
  Landmark,
  MapPin,
  Megaphone,
  Send,
  Siren,
  TriangleAlert,
  Tv,
  ZapOff,
  type LucideIcon,
} from 'lucide-react';
import { ApiError, db, run, type Company, type Device, type Notice, type NoticeCategory, type NoticeSeverity, type ZoneStatus } from '../api';
import { relativeTime } from '../format';
import {
  CATEGORY_LABELS,
  DURATIONS,
  EMPTY_DRAFT,
  formatWhen,
  NOTICE_BODY_MAX,
  NOTICE_MAX_DAYS,
  NOTICE_TITLE_MAX,
  NOTICES_PER_DAY,
  noticeStatus,
  noticeWindow,
  noticeZones,
  seenPercent,
  sentLastDay,
  SEVERITY_META,
  STATUS_LABELS,
  TEMPLATES,
  toLocalInput,
  validateNotice,
  type NoticeDraft,
  type NoticeStatus,
  type NoticeTemplate,
} from '../notices';
import { useToast } from '../toast';
import { Badge, Button, Card, Chip, EmptyState, ErrorText, IconButton, inputClass, Modal, PageHeader, SearchInput, Skeleton } from '../ui';
import { audienceCount, audienceLabel, devicesText, searchZones } from '../zones';

const POLL_MS = 30_000;

const CATEGORY_ICON: Record<NoticeCategory, LucideIcon> = {
  corte: ZapOff,
  clima: CloudLightning,
  salud: HeartPulse,
  municipal: Landmark,
  general: Megaphone,
};
const CATEGORIES = Object.keys(CATEGORY_LABELS) as NoticeCategory[];

const SEVERITY_ICON: Record<NoticeSeverity, LucideIcon> = { info: Info, importante: TriangleAlert, emergencia: Siren };
const SEVERITIES: NoticeSeverity[] = ['info', 'importante', 'emergencia'];
const SEVERITY_SELECTED: Record<NoticeSeverity, string> = {
  info: 'border-accent bg-accent-soft',
  importante: 'border-warn bg-warn-soft',
  emergencia: 'border-danger bg-danger-soft',
};
const SEVERITY_ICON_TONE: Record<NoticeSeverity, string> = {
  info: 'text-accent',
  importante: 'text-warn',
  emergencia: 'text-danger',
};

const LABEL = 'text-xs font-medium text-fg-2';

// ---------------------------------------------------------------------------
// Selector tipo radio (teclado: flechas para moverse, como un grupo de radios nativo)
// ---------------------------------------------------------------------------

function RadioCards<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  render,
  optionClass,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  className: string;
  render: (option: T, selected: boolean) => ReactNode;
  optionClass: (option: T, selected: boolean) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();
  const onKey = (e: KeyboardEvent, index: number) => {
    const step = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]);
    refs.current[next]?.focus();
  };
  return (
    <div>
      <div id={labelId} className={`mb-2 ${LABEL}`}>{label}</div>
      <div role="radiogroup" aria-labelledby={labelId} className={className}>
        {options.map((o, i) => {
          const selected = o === value;
          return (
            <button
              key={o}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(o)}
              onKeyDown={(e) => onKey(e, i)}
              className={`rounded-xl border text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent ${optionClass(o, selected)}`}
            >
              {render(o, selected)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista previa del TV
// ---------------------------------------------------------------------------

/*
 * La pantalla del TV es oscura también con el panel en tema claro. Por eso acá adentro se usa la paleta slate y
 * colores fijos (red/amber/sky-400…) en vez de los tokens del panel (text-fg, bg-surface…), que cambian con el tema.
 * Los tamaños van en cqw para que el texto escale con el ancho del marco, como en una pantalla real.
 */
const TV_ACCENT: Record<NoticeSeverity, { bar: string; icon: string }> = {
  info: { bar: 'bg-sky-400', icon: 'text-sky-400' },
  importante: { bar: 'bg-amber-400', icon: 'text-amber-400' },
  emergencia: { bar: 'bg-red-500', icon: 'text-red-500' },
};

function TvPreview({ title, body, category, severity, companyName }: {
  title: string;
  body: string;
  category: NoticeCategory;
  severity: NoticeSeverity;
  companyName: string;
}) {
  const Icon = CATEGORY_ICON[category];
  const shownTitle = title.trim() || 'Título del comunicado';
  const shownBody = body.trim() || 'Acá va el mensaje que van a leer tus clientes en el TV.';
  const dim = (text: string) => (text.trim() ? '' : 'opacity-50');
  const accent = TV_ACCENT[severity];

  return (
    <div
      role="img"
      aria-label={`Vista previa en el TV, ${SEVERITY_META[severity].label.toLowerCase()}: ${shownTitle}. ${shownBody}`}
      className="relative aspect-video w-full select-none overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 shadow-lg [container-type:inline-size]"
    >
      {/* Fondo: un inicio de TV genérico, para que se vea cuánto tapa el comunicado. */}
      <div className="absolute inset-0 flex flex-col gap-[3%] p-[4%]" aria-hidden>
        <div className="flex items-center justify-between text-[2.2cqw] text-slate-500">
          <span className="font-semibold text-slate-400">{companyName}</span>
          <span>21:30</span>
        </div>
        <div className="flex-1 rounded-[1.5cqw] bg-gradient-to-br from-slate-800 to-slate-900" />
        <div className="grid h-[22%] grid-cols-5 gap-[2%]">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="rounded-[1.2cqw] bg-slate-800" />)}
        </div>
      </div>

      {severity === 'emergencia' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2.5%] bg-slate-950/95 px-[9%] text-center" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-[1.6%] bg-red-500" />
          <span className="flex items-center gap-[1cqw] text-[2cqw] font-semibold uppercase tracking-widest text-red-400">
            <Siren className="h-[3cqw] w-[3cqw]" />
            Emergencia · {CATEGORY_LABELS[category]}
          </span>
          <span className={`break-words text-[5cqw] font-bold leading-tight text-slate-50 ${dim(title)}`}>{shownTitle}</span>
          <span className={`line-clamp-5 whitespace-pre-line break-words text-[2.5cqw] leading-snug text-slate-300 ${dim(body)}`}>{shownBody}</span>
          <span className="mt-[1.5%] rounded-[1cqw] bg-slate-50 px-[4cqw] py-[1cqw] text-[2.3cqw] font-semibold text-slate-900">Entendido</span>
          <span className="absolute bottom-[4%] text-[1.7cqw] text-slate-500">{companyName}</span>
        </div>
      ) : (
        <div
          aria-hidden
          className={`absolute flex overflow-hidden rounded-[1.2cqw] bg-slate-900/95 shadow-xl ${
            severity === 'importante' ? 'inset-x-[4%] top-[5%]' : 'bottom-[6%] right-[4%] w-[64%]'
          }`}
        >
          <span className={`w-[1cqw] shrink-0 ${accent.bar}`} />
          <div className="flex min-w-0 items-start gap-[1.6cqw] px-[2.2cqw] py-[1.6cqw]">
            <Icon className={`mt-[0.3cqw] shrink-0 ${accent.icon} ${severity === 'importante' ? 'h-[3.8cqw] w-[3.8cqw]' : 'h-[3.2cqw] w-[3.2cqw]'}`} />
            <div className="min-w-0">
              <div className={`break-words font-semibold leading-tight text-slate-50 ${severity === 'importante' ? 'text-[3cqw]' : 'text-[2.7cqw]'} ${dim(title)}`}>{shownTitle}</div>
              <div className={`mt-[0.4cqw] whitespace-pre-line break-words leading-snug text-slate-300 ${severity === 'importante' ? 'line-clamp-3 text-[2.3cqw]' : 'line-clamp-2 text-[2.1cqw]'} ${dim(body)}`}>{shownBody}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

type ListFilter = 'todos' | 'activo' | 'programado' | 'finalizado';
const LIST_FILTERS: { id: ListFilter; label: string; test: (s: NoticeStatus) => boolean }[] = [
  { id: 'todos', label: 'Todos', test: () => true },
  { id: 'activo', label: 'En pantalla', test: (s) => s === 'activo' },
  { id: 'programado', label: 'Programados', test: (s) => s === 'programado' },
  { id: 'finalizado', label: 'Finalizados', test: (s) => s === 'vencido' || s === 'cancelado' },
];

function SeenProgress({ notice }: { notice: Notice }) {
  const pct = seenPercent(notice);
  const text = notice.devices > 0
    ? `Visto en ${Math.min(notice.seen, notice.devices)} de ${notice.devices} ${notice.devices === 1 ? 'equipo' : 'equipos'}`
    : notice.zone_ids?.length ? 'Sin equipos en esas zonas' : 'Sin equipos vinculados';
  return (
    <div className="mt-2.5 max-w-sm">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-fg-3"><Eye className="h-3.5 w-3.5" aria-hidden /> {text}</span>
        {notice.devices > 0 && <span className="tabular-nums text-fg-4">{pct}%</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fill-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={text}>
        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-ok' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NoticeRow({ notice, zones, status, now, onCancel, onReuse }: {
  notice: Notice;
  zones: readonly ZoneStatus[];
  status: NoticeStatus;
  now: number;
  onCancel: () => void;
  onReuse: () => void;
}) {
  const Icon = CATEGORY_ICON[notice.category] ?? Megaphone;
  const severity = SEVERITY_META[notice.severity] ?? SEVERITY_META.info;
  const live = status === 'activo' || status === 'programado';
  const start = new Date(notice.starts_at);
  const end = new Date(notice.expires_at);
  const when =
    status === 'programado' ? `Empieza ${formatWhen(start, now)} · termina ${formatWhen(end, now)}`
    : status === 'activo' ? `Desde ${formatWhen(start, now)} · termina ${formatWhen(end, now)}`
    : status === 'cancelado' ? `Cancelado ${relativeTime(notice.cancelled_at, now)} · había empezado ${formatWhen(start, now)}`
    : `Se mostró desde ${formatWhen(start, now)} hasta ${formatWhen(end, now)}`;

  return (
    <li className={`flex gap-3 px-4 py-4 sm:gap-4 sm:px-5 ${live ? '' : 'opacity-75'}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${live ? 'bg-accent-soft text-accent' : 'bg-fill text-fg-3'}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 break-words text-sm font-semibold text-fg">{notice.title}</h3>
          <Badge tone={STATUS_LABELS[status].tone}>{STATUS_LABELS[status].label}</Badge>
          {notice.severity !== 'info' && <Badge tone={severity.tone} icon={SEVERITY_ICON[notice.severity]}>{severity.label}</Badge>}
        </div>
        <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-sm text-fg-3">{notice.body}</p>
        <p className="mt-1.5 text-xs text-fg-4">{CATEGORY_LABELS[notice.category] ?? notice.category} · {when}</p>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-fg-3">
          {notice.zone_ids?.length ? <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-fg-4" aria-hidden /> : <Tv className="mt-px h-3.5 w-3.5 shrink-0 text-fg-4" aria-hidden />}
          <span className="min-w-0 break-words" title={notice.zone_ids?.length ? audienceLabel(notice.zone_ids, zones, 99) : undefined}>
            <span className="sr-only">Lo reciben: </span>
            {notice.zone_ids?.length ? `Solo ${audienceLabel(notice.zone_ids, zones, 3)}` : 'Todos los equipos'}
          </span>
        </p>
        {status !== 'programado' && <SeenProgress notice={notice} />}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
        <IconButton icon={Copy} label={`Usar "${notice.title}" como base de uno nuevo`} onClick={onReuse} />
        {live && <IconButton icon={Ban} tone="danger" label={`Cancelar "${notice.title}"`} onClick={onCancel} />}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const ZONE_SEARCH_FROM = 10;

/** A quién le llega: todos los equipos o solo los de algunas zonas (se pueden elegir varias). */
function AudiencePicker({ draft, zones, perZone, total, reach, onMode, onToggle, onAll, goZones }: {
  draft: Pick<NoticeDraft, 'audience' | 'zoneIds'>;
  zones: readonly ZoneStatus[];
  /** Equipos por zona según el listado ya cargado; null si todavía no cargó. */
  perZone: ((zoneId: string) => number) | null;
  total: number | null;
  /** Equipos que lo reciben con lo elegido ahora; null si todavía no se sabe. */
  reach: number | null;
  onMode: (mode: 'all' | 'zones') => void;
  onToggle: (zoneId: string) => void;
  onAll: (zoneIds: string[]) => void;
  goZones?: () => void;
}) {
  const [query, setQuery] = useState('');
  const groupId = useId();
  const shown = searchZones(zones, query);
  const byZone = draft.audience === 'zones';
  const picked = new Set(draft.zoneIds);
  const options: { id: 'all' | 'zones'; icon: LucideIcon; title: string; hint: string }[] = [
    { id: 'all', icon: Tv, title: 'Todos los equipos', hint: total === null ? 'Toda la empresa' : devicesText(total) },
    { id: 'zones', icon: MapPin, title: 'Solo algunas zonas', hint: zones.length === 0 ? 'Todavía no hay zonas' : `${zones.length} ${zones.length === 1 ? 'zona' : 'zonas'} para elegir` },
  ];
  return (
    <div>
      <RadioCards
        label="Quién lo recibe"
        value={draft.audience}
        options={['all', 'zones'] as const}
        onChange={onMode}
        className="grid gap-2 sm:grid-cols-2"
        optionClass={(_o, selected) => `px-3 py-3 ${selected ? 'border-accent bg-accent-soft' : 'border-line-strong hover:bg-fill'}`}
        render={(o, selected) => {
          const opt = options.find((x) => x.id === o)!;
          return (
            <>
              <span className={`flex items-center gap-2 text-sm font-semibold ${selected ? 'text-fg' : 'text-fg-2'}`}>
                <opt.icon className={`h-4 w-4 shrink-0 ${selected ? 'text-accent' : 'text-fg-4'}`} aria-hidden />
                {opt.title}
              </span>
              <span className="mt-1 block text-xs text-fg-4">{opt.hint}</span>
            </>
          );
        }}
      />

      {byZone && (
        <div className="mt-3 rounded-xl border border-line bg-inset p-3">
          {zones.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-fg-3">Creá zonas (localidad, nodo u OLT) y asignales equipos para poder avisarle solo a una parte.</p>
              {goZones && <Button type="button" size="sm" variant="secondary" onClick={goZones}>Crear zonas</Button>}
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <span id={groupId} className={LABEL}>Zonas</span>
                <span className="flex items-center gap-3 text-xs">
                  {draft.zoneIds.length < zones.length && (
                    <button type="button" className="rounded font-medium text-accent underline-offset-2 hover:underline" onClick={() => onAll(zones.map((z) => z.zone_id))}>Elegir todas</button>
                  )}
                  {draft.zoneIds.length > 0 && (
                    <button type="button" className="rounded text-fg-3 underline-offset-2 hover:text-fg hover:underline" onClick={() => onAll([])}>Quitar todas</button>
                  )}
                </span>
              </div>
              {zones.length >= ZONE_SEARCH_FROM && <SearchInput className="mb-2" value={query} onChange={setQuery} placeholder="Buscar zona" />}
              <div role="group" aria-labelledby={groupId} className="flex max-h-44 flex-wrap gap-2 overflow-y-auto p-0.5">
                {shown.map((z) => (
                  <Chip key={z.zone_id} active={picked.has(z.zone_id)} onClick={() => onToggle(z.zone_id)} count={perZone ? perZone(z.zone_id) : z.total}>
                    {z.outage_started_at && <span className="h-1.5 w-1.5 rounded-full bg-danger" role="img" aria-label="En caída" />}
                    <span className="max-w-[12rem] truncate">{z.name}</span>
                  </Chip>
                ))}
                {shown.length === 0 && <p className="px-1 py-1.5 text-sm text-fg-4">Ninguna zona coincide.</p>}
              </div>
              <p className={`mt-2.5 text-xs ${draft.zoneIds.length > 0 && reach === 0 ? 'text-warn' : 'text-fg-3'}`} aria-live="polite">
                {draft.zoneIds.length === 0
                  ? 'Elegí una o más zonas.'
                  : reach === null
                    ? `${draft.zoneIds.length} ${draft.zoneIds.length === 1 ? 'zona elegida' : 'zonas elegidas'}.`
                    : reach === 0
                      ? 'Esas zonas no tienen equipos: no lo va a ver nadie.'
                      : <>Lo {reach === 1 ? 'recibe' : 'reciben'} <span className="font-semibold text-fg">{devicesText(reach)}</span> de {draft.zoneIds.length === 1 ? '1 zona' : `${draft.zoneIds.length} zonas`}{total ? ` (de ${total} en total)` : ''}.</>}
              </p>
              {zones.some((z) => z.outage_started_at && picked.has(z.zone_id)) && (
                <p className="mt-1 text-xs text-fg-4">Los equipos que están sin conexión lo ven cuando vuelven, si el comunicado sigue vigente.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function NoticesPage({ company, deviceCount, devices = null, zones = [], goZones }: {
  company: Company;
  deviceCount: number | null;
  /** Equipos de la empresa (para contar cuántos hay en las zonas elegidas); null mientras cargan. */
  devices?: readonly Device[] | null;
  zones?: readonly ZoneStatus[];
  goZones?: () => void;
}) {
  const toast = useToast();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  const [draft, setDraft] = useState<NoticeDraft>(EMPTY_DRAFT);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Notice | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>('todos');
  const titleRef = useRef<HTMLInputElement>(null);
  const ids = { title: useId(), body: useId(), titleCount: useId(), bodyCount: useId(), start: useId(), until: useId() };

  useEffect(() => {
    let cancelled = false;
    run<Notice[]>(db().rpc('mdm_list_notices', { p_company: company.id })).then(
      (rows) => {
        if (cancelled) return;
        setNotices(rows ?? []);
        setLoadError(null);
        setNow(Date.now());
      },
      (err: Error) => !cancelled && setLoadError(err.message),
    );
    // Refresca "visto en X equipos" y pasa solo de programado a en pantalla y a finalizado.
    const timer = setTimeout(() => setTick((t) => t + 1), POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [company.id, tick]);

  const set = <K extends keyof NoticeDraft>(key: K, value: NoticeDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setFormError(null);
  };

  const applyTemplate = (t: NoticeTemplate) => {
    setDraft((d) => ({ ...d, ...t.draft }));
    setTemplateId(t.id);
    setFormError(null);
    titleRef.current?.focus();
  };

  const reuse = (n: Notice) => {
    // Las zonas que ya no existen no se copian; si no queda ninguna, vuelve a "todos" y hay que elegir a propósito.
    const zoneIds = (n.zone_ids ?? []).filter((id) => zones.some((z) => z.zone_id === id));
    setDraft({ ...EMPTY_DRAFT, title: n.title, body: n.body, category: n.category, severity: n.severity, audience: zoneIds.length ? 'zones' : 'all', zoneIds });
    setTemplateId(null);
    setFormError(null);
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const statuses = useMemo(() => new Map((notices ?? []).map((n) => [n.id, noticeStatus(n, now)])), [notices, now]);
  const counts = useMemo(
    () => Object.fromEntries(LIST_FILTERS.map((f) => [f.id, [...statuses.values()].filter(f.test).length])) as Record<ListFilter, number>,
    [statuses],
  );
  const shown = (notices ?? []).filter((n) => LIST_FILTERS.find((f) => f.id === listFilter)!.test(statuses.get(n.id)!));
  const sentToday = sentLastDay(notices ?? [], now);
  const remaining = Math.max(0, NOTICES_PER_DAY - sentToday);

  const window_ = noticeWindow(draft, now);
  const dirty = draft.title.trim() !== '' || draft.body.trim() !== '';
  const targetZones = noticeZones(draft);
  // A cuántos equipos les llega: por zona se cuenta sobre el listado; si todavía no cargó, con el total que informa cada zona.
  const reach = targetZones === null
    ? deviceCount
    : devices
      ? audienceCount(devices, targetZones)
      : zones.filter((z) => targetZones.includes(z.zone_id)).reduce((n, z) => n + z.total, 0);
  const audience = reach === null ? 'todos los equipos' : devicesText(reach);
  const audienceName = audienceLabel(targetZones, zones, 3);
  const audienceLine = targetZones === null ? `Todos los equipos${reach === null ? '' : ` (${reach})`}` : `${audienceName} · ${audience}`;

  const review = () => {
    const at = Date.now();
    setNow(at);
    const problem = validateNotice(draft, at);
    setFormError(problem);
    if (!problem) setConfirming(true);
  };

  const send = async () => {
    const at = Date.now();
    const w = noticeWindow(draft, at);
    if (!w.ok) {
      setConfirming(false);
      return setFormError(w.error);
    }
    setSending(true);
    try {
      await run(db().rpc('mdm_create_notice', {
        p_company: company.id, p_title: draft.title.trim(), p_body: draft.body.trim(),
        p_category: draft.category, p_severity: draft.severity, p_starts_at: w.startsAt, p_expires_at: w.expiresAt,
        p_zones: noticeZones(draft),
      }));
      toast.show(w.startsAt ? `Comunicado programado para ${formatWhen(w.start, at)}` : 'Comunicado enviado: aparece en los TV en el próximo minuto');
      setDraft(EMPTY_DRAFT);
      setTemplateId(null);
      setConfirming(false);
      setListFilter('todos');
      reload();
    } catch (err) {
      setConfirming(false);
      setFormError(
        err instanceof ApiError && err.code === '54000'
          ? `Llegaste al máximo de ${NOTICES_PER_DAY} comunicados por día. Probá de nuevo mañana o cancelá uno y reutilizá su texto.`
          : (err as Error).message,
      );
    } finally {
      setSending(false);
    }
  };

  const cancel = async (n: Notice) => {
    setCancelling(true);
    try {
      await run(db().rpc('mdm_cancel_notice', { p_id: n.id }));
      toast.show('Comunicado cancelado: deja de mostrarse en el próximo minuto');
      setCancelTarget(null);
      reload();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  const minLocal = toLocalInput(new Date(now));

  return (
    <>
      <PageHeader
        title="Comunicados"
        help={{ section: 'comunicados', label: 'comunicados' }}
        subtitle={`Mensajes que aparecen en la pantalla de los TV de ${company.name}, en todos o solo en algunas zonas: cortes, alertas del clima, campañas de salud y avisos municipales.`}
      />

      <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <Card title="Nuevo comunicado" description="Lo ven los equipos que elijas la próxima vez que estén encendidos dentro del período del comunicado.">
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              review();
            }}
          >
            <div>
              <div className={`mb-2 ${LABEL}`}>Empezar con una plantilla</div>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <Chip key={t.id} active={templateId === t.id} onClick={() => applyTemplate(t)}>{t.label}</Chip>
                ))}
              </div>
            </div>

            <AudiencePicker
              draft={draft}
              zones={zones}
              perZone={devices ? (id) => audienceCount(devices, [id]) : null}
              total={deviceCount}
              reach={targetZones === null ? null : reach}
              onMode={(mode) => set('audience', mode)}
              onToggle={(id) => set('zoneIds', draft.zoneIds.includes(id) ? draft.zoneIds.filter((z) => z !== id) : [...draft.zoneIds, id])}
              onAll={(ids) => set('zoneIds', ids)}
              goZones={goZones}
            />

            <RadioCards
              label="Tema"
              value={draft.category}
              options={CATEGORIES}
              onChange={(v) => set('category', v)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-5"
              optionClass={(_o, selected) => `flex items-center gap-2 px-3 py-2.5 text-sm sm:flex-col sm:gap-1.5 sm:px-2 sm:py-3 sm:text-center sm:text-xs ${
                selected ? 'border-accent bg-accent-soft text-accent' : 'border-line text-fg-3 hover:border-line-strong hover:text-fg-2'
              }`}
              render={(o) => {
                const Icon = CATEGORY_ICON[o];
                return <><Icon className="h-4 w-4 shrink-0" aria-hidden />{CATEGORY_LABELS[o]}</>;
              }}
            />

            <RadioCards
              label="Cómo aparece en el TV"
              value={draft.severity}
              options={SEVERITIES}
              onChange={(v) => set('severity', v)}
              className="grid gap-2 sm:grid-cols-3"
              optionClass={(o, selected) => `px-3 py-3 ${selected ? SEVERITY_SELECTED[o] : 'border-line-strong hover:bg-fill'}`}
              render={(o, selected) => {
                const Icon = SEVERITY_ICON[o];
                return (
                  <>
                    <span className={`flex items-center gap-2 text-sm font-semibold ${selected ? 'text-fg' : 'text-fg-2'}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${selected ? SEVERITY_ICON_TONE[o] : 'text-fg-4'}`} aria-hidden />
                      {SEVERITY_META[o].label}
                    </span>
                    <span className="mt-1 block text-xs text-fg-4">{SEVERITY_META[o].tv}</span>
                  </>
                );
              }}
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={ids.title} className={LABEL}>Título</label>
                <span id={ids.titleCount} className={`text-xs tabular-nums ${draft.title.length >= NOTICE_TITLE_MAX ? 'text-warn' : 'text-fg-4'}`}>
                  {draft.title.length}/{NOTICE_TITLE_MAX}
                </span>
              </div>
              <input
                id={ids.title}
                ref={titleRef}
                className={inputClass}
                maxLength={NOTICE_TITLE_MAX}
                aria-describedby={ids.titleCount}
                placeholder="Ej.: Corte programado de servicio"
                value={draft.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={ids.body} className={LABEL}>Mensaje</label>
                <span id={ids.bodyCount} className={`text-xs tabular-nums ${draft.body.length >= NOTICE_BODY_MAX ? 'text-warn' : 'text-fg-4'}`}>
                  {draft.body.length}/{NOTICE_BODY_MAX}
                </span>
              </div>
              <textarea
                id={ids.body}
                className={`${inputClass} min-h-[7.5rem] resize-y leading-relaxed`}
                maxLength={NOTICE_BODY_MAX}
                aria-describedby={ids.bodyCount}
                placeholder="Qué pasa, cuándo y qué tiene que hacer el cliente. Corto: se lee desde el sillón."
                value={draft.body}
                onChange={(e) => set('body', e.target.value)}
              />
              {templateId && <span className="text-xs text-fg-4">Reemplazá lo que está entre [corchetes] con tus datos.</span>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className={`mb-2 ${LABEL}`}>Cuándo empieza</div>
                <div className="flex flex-wrap gap-2">
                  <Chip active={draft.startMode === 'now'} onClick={() => set('startMode', 'now')}>Ahora</Chip>
                  <Chip
                    active={draft.startMode === 'later'}
                    onClick={() => setDraft((d) => ({ ...d, startMode: 'later', startsAt: d.startsAt || toLocalInput(new Date(Date.now() + 3_600_000)) }))}
                  >
                    Programar
                  </Chip>
                </div>
                {draft.startMode === 'later' && (
                  <div className="mt-2">
                    <label htmlFor={ids.start} className="sr-only">Fecha y hora de inicio</label>
                    <input id={ids.start} type="datetime-local" className={inputClass} min={minLocal} value={draft.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
                  </div>
                )}
              </div>
              <div>
                <div className={`mb-2 ${LABEL}`}>Cuánto dura</div>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <Chip key={d.id} active={draft.duration === d.id} onClick={() => set('duration', d.id)}>{d.label}</Chip>
                  ))}
                  <Chip
                    active={draft.duration === 'custom'}
                    onClick={() => setDraft((d) => ({ ...d, duration: 'custom', until: d.until || toLocalInput(new Date(Date.now() + 86_400_000)) }))}
                  >
                    Hasta una fecha
                  </Chip>
                </div>
                {draft.duration === 'custom' && (
                  <div className="mt-2">
                    <label htmlFor={ids.until} className="sr-only">Fecha y hora de fin</label>
                    <input id={ids.until} type="datetime-local" className={inputClass} min={minLocal} value={draft.until} onChange={(e) => set('until', e.target.value)} />
                    <span className="mt-1 block text-xs text-fg-4">Hasta {NOTICE_MAX_DAYS} días.</span>
                  </div>
                )}
              </div>
            </div>

            <ErrorText error={formError} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="flex min-w-0 items-center gap-2 text-xs text-fg-3">
                <CalendarClock className="h-4 w-4 shrink-0 text-fg-4" aria-hidden />
                {window_.ok
                  ? <span>{draft.startMode === 'now' ? 'Desde ahora' : `Desde ${formatWhen(window_.start, now)}`} hasta {formatWhen(window_.end, now)}, para {targetZones === null ? audience : `${audience} de ${audienceName}`}.</span>
                  : <span>{window_.error}.</span>}
              </p>
              <div className="flex items-center gap-2">
                {dirty && (
                  <Button type="button" variant="ghost" onClick={() => { setDraft(EMPTY_DRAFT); setTemplateId(null); setFormError(null); }}>
                    Borrar
                  </Button>
                )}
                <Button type="submit" icon={Send} disabled={sending || remaining === 0}>Revisar y enviar</Button>
              </div>
            </div>
            {sentToday >= NOTICES_PER_DAY - 10 && (
              <p className={`-mt-2 text-xs ${remaining === 0 ? 'text-warn' : 'text-fg-4'}`}>
                {remaining === 0
                  ? `Ya enviaste ${NOTICES_PER_DAY} comunicados en las últimas 24 horas, que es el máximo.`
                  : `Enviaste ${sentToday} comunicados en las últimas 24 horas. El máximo es ${NOTICES_PER_DAY}.`}
              </p>
            )}
            {deviceCount === 0 && targetZones === null && (
              <p className="-mt-2 text-xs text-warn">Todavía no hay equipos vinculados: por ahora no lo va a ver nadie.</p>
            )}
          </form>
        </Card>

        <div className="xl:sticky xl:top-6">
          <Card title="Así se ve en el TV" description={SEVERITY_META[draft.severity].tv}>
            <TvPreview title={draft.title} body={draft.body} category={draft.category} severity={draft.severity} companyName={company.name} />
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-fill px-3 py-2 text-[13px] text-fg-2">
              {targetZones === null ? <Tv className="mt-0.5 h-4 w-4 shrink-0 text-fg-4" aria-hidden /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />}
              <span className="min-w-0 break-words">
                <span className="text-fg-4">Lo reciben: </span>
                {draft.audience === 'zones' && targetZones === null ? <span className="text-fg-4">elegí las zonas</span> : audienceLine}
              </span>
            </p>
            <p className="mt-3 text-xs text-fg-4">
              Vista aproximada. El TV avisa al panel cuando lo muestra: así sabés cuántos equipos lo vieron.
            </p>
          </Card>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="comunicados-enviados">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="comunicados-enviados" className="text-base font-semibold text-fg">Enviados</h2>
          {notices && notices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {LIST_FILTERS.map((f) => (
                <Chip key={f.id} active={listFilter === f.id} onClick={() => setListFilter(f.id)} count={counts[f.id]}>{f.label}</Chip>
              ))}
            </div>
          )}
        </div>
        <ErrorText error={loadError} />
        <Card padded={false}>
          {!notices ? (
            <div className="flex flex-col gap-3 p-4 sm:p-5">
              {loadError ? <Button variant="secondary" className="self-start" onClick={reload}>Reintentar</Button> : [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : notices.length === 0 ? (
            <EmptyState icon={Megaphone} title="Todavía no enviaste comunicados">
              Escribí el primero arriba. Podés partir de una plantilla y ver cómo queda antes de mandarlo.
            </EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState icon={Megaphone} title="No hay comunicados en este estado">Probá con otro filtro.</EmptyState>
          ) : (
            <ul className="divide-y divide-line pb-1">
              {shown.map((n) => (
                <NoticeRow key={n.id} notice={n} zones={zones} status={statuses.get(n.id)!} now={now} onCancel={() => setCancelTarget(n)} onReuse={() => reuse(n)} />
              ))}
            </ul>
          )}
        </Card>
        {notices && notices.length >= 50 && <p className="mt-2 text-xs text-fg-4">Se muestran los últimos 50.</p>}
      </section>

      {confirming && window_.ok && (
        <Modal
          title={draft.startMode === 'now' ? '¿Enviar este comunicado?' : '¿Programar este comunicado?'}
          description={targetZones === null ? `Lo van a ver ${audience} de ${company.name}.` : `Lo van a ver ${audience} de ${company.name}: solo ${targetZones.length === 1 ? 'una zona' : `${targetZones.length} zonas`}.`}
          onClose={() => !sending && setConfirming(false)}
          footer={
            <>
              <Button variant="secondary" disabled={sending} onClick={() => setConfirming(false)}>Seguir editando</Button>
              <Button variant={draft.severity === 'emergencia' ? 'danger' : 'primary'} icon={Send} disabled={sending} onClick={send}>
                {sending ? 'Enviando…' : draft.startMode === 'now' ? 'Enviar ahora' : 'Programar'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <TvPreview title={draft.title} body={draft.body} category={draft.category} severity={draft.severity} companyName={company.name} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-fg-4">Lo reciben</dt>
              <dd className="min-w-0 break-words text-fg-2">
                {targetZones === null ? audienceLine : <><span className="font-medium text-fg">{audienceLabel(targetZones, zones, 99)}</span> · {audience}</>}
              </dd>
              <dt className="text-fg-4">Empieza</dt>
              <dd className="text-fg-2">{draft.startMode === 'now' ? 'Ahora (llega a los TV en el próximo minuto)' : formatWhen(window_.start, now)}</dd>
              <dt className="text-fg-4">Termina</dt>
              <dd className="text-fg-2">{formatWhen(window_.end, now)}</dd>
              <dt className="text-fg-4">Aparece como</dt>
              <dd className="text-fg-2">{SEVERITY_META[draft.severity].label} · {CATEGORY_LABELS[draft.category]}</dd>
            </dl>
            {targetZones !== null && reach === 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Las zonas elegidas no tienen equipos: por ahora no lo va a ver nadie.
              </p>
            )}
            {draft.severity === 'emergencia' && (
              <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                <Siren className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Interrumpe lo que cada cliente esté viendo hasta que lo acepte con el control. Usalo solo para emergencias reales.
              </p>
            )}
            <p className="text-xs text-fg-4">Una vez enviado no se puede editar: si hay un error, cancelalo y mandá uno nuevo.</p>
          </div>
        </Modal>
      )}

      {cancelTarget && (
        <Modal
          title="¿Cancelar el comunicado?"
          description={cancelTarget.title}
          onClose={() => !cancelling && setCancelTarget(null)}
          footer={
            <>
              <Button variant="secondary" disabled={cancelling} onClick={() => setCancelTarget(null)}>Volver</Button>
              <Button variant="danger" icon={Ban} disabled={cancelling} onClick={() => cancel(cancelTarget)}>Cancelar comunicado</Button>
            </>
          }
        >
          <p className="text-sm text-fg-2">
            {statuses.get(cancelTarget.id) === 'programado'
              ? 'No se va a mostrar en ningún TV.'
              : 'Deja de mostrarse en los TV en el próximo minuto. Los clientes que ya lo vieron no reciben ningún aviso.'}
            {' '}No se puede deshacer, pero podés usar su texto como base de uno nuevo.
          </p>
        </Modal>
      )}
    </>
  );
}
