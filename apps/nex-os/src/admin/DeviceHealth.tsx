import { useState, type ReactNode } from 'react';
import {
  Bug,
  CircleCheck,
  CircleHelp,
  CircleX,
  Cpu,
  Globe,
  HardDrive,
  HeartPulse,
  LoaderCircle,
  Power,
  RefreshCw,
  RotateCw,
  Router,
  Stethoscope,
  Thermometer,
  Timer,
  TriangleAlert,
  Tv,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { ApiError, db, isOnline, run, type Device } from './api';
import { formatConnection, formatFreeOf, formatHop, formatRssi, formatTemp, formatUptime, relativeTime } from './format';
import {
  BAND_META,
  BAND_ORDER,
  bandCounts,
  DIAG_SLOW_MS,
  diagState,
  netSegments,
  netVerdict,
  VERDICT_META,
  type HealthBand,
  type HealthInputs,
  type HealthScore,
  type NetDiag,
  type SegmentState,
} from './health';
import { useToast } from './toast';
import { Button } from './ui';

/** Semáforo de salud y diagnóstico de red: lo que se ve en el listado, el detalle del equipo y el Resumen. */

type BandTone = (typeof BAND_META)[HealthBand]['tone'];

const TONE_TEXT: Record<BandTone, string> = {
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-rose-300',
  neutral: 'text-zinc-500',
};
const TONE_DOT: Record<BandTone, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
  neutral: 'bg-zinc-600',
};
const TONE_PANEL: Record<'success' | 'warning' | 'danger', string> = {
  success: 'border-emerald-500/25 bg-emerald-500/[0.07]',
  warning: 'border-amber-500/25 bg-amber-500/[0.07]',
  danger: 'border-rose-500/25 bg-rose-500/[0.07]',
};

const SECTION_TITLE = 'text-xs font-medium uppercase tracking-wider text-zinc-500';

function scoreLabel(s: HealthScore | undefined): string {
  if (!s || s.score === null) return 'Salud: sin datos';
  return `Salud ${s.score} de 100: ${BAND_META[s.band].label}`;
}

/** Punto de color + puntaje, para el listado. El color nunca va solo: siempre lo acompaña el número. */
export function HealthPill({ score }: { score: HealthScore | undefined }) {
  const tone = BAND_META[score?.band ?? 'sin-datos'].tone;
  const top = score?.reasons[0]?.text;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums" title={top ? `${scoreLabel(score)} · ${top}` : scoreLabel(score)}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
      <span className={`font-medium ${TONE_TEXT[tone]}`} aria-hidden>{score?.score ?? '—'}</span>
      <span className="sr-only">{scoreLabel(score)}</span>
    </span>
  );
}

function HealthGauge({ score }: { score: HealthScore }) {
  const tone = BAND_META[score.band].tone;
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const filled = score.score === null ? 0 : (score.score / 100) * circumference;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0" role="img" aria-label={scoreLabel(score)}>
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" stroke="currentColor" className="text-white/10" />
        {score.score !== null && score.score > 0 && (
          <circle
            cx="38" cy="38" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke="currentColor"
            strokeDasharray={`${filled} ${circumference}`}
            className={`${TONE_TEXT[tone]} transition-[stroke-dasharray] duration-500`}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums text-white" aria-hidden>
        {score.score ?? '—'}
      </span>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
      <div className="min-w-0">
        <dt className="text-[11px] text-zinc-500">{label}</dt>
        <dd className={`text-sm ${value === '—' ? 'text-zinc-500' : 'text-zinc-200'}`}>{value}</dd>
      </div>
    </div>
  );
}

const SUMMARY: Record<HealthBand, string> = {
  bien: 'Funciona bien: no hay nada para revisar.',
  atencion: 'Anda, pero hay cosas para mirar antes de que el cliente lo note.',
  problemas: 'Es probable que el cliente tenga problemas para ver TV.',
  'sin-datos': 'El equipo todavía no se conectó nunca.',
};

/** Sección "Salud" del detalle: puntaje, por qué bajó y las mediciones que informa el equipo. */
export function HealthSection({ device, score, inputs }: { device: Device; score: HealthScore | undefined; inputs: HealthInputs | undefined }) {
  const h = device.health ?? {};
  const net = h.net;
  const s: HealthScore = score ?? { score: null, band: 'sin-datos', reasons: [] };
  const meta = BAND_META[s.band];
  // Los box con NEX-OS (Linux) no miden temperatura, memoria ni red: se avisa para que un 100 no parezca un chequeo completo.
  const partial = s.score !== null && h.temp_c == null && h.ram_total_mb == null && !net;

  return (
    <section aria-labelledby="salud-titulo">
      <h3 id="salud-titulo" className={`mb-2 ${SECTION_TITLE}`}>Salud</h3>
      <div className="rounded-xl border border-white/[0.07]">
        <div className="flex items-center gap-4 px-4 py-4">
          <HealthGauge score={s} />
          <div className="min-w-0">
            <div className={`flex items-center gap-2 text-base font-semibold ${TONE_TEXT[meta.tone]}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${TONE_DOT[meta.tone]}`} aria-hidden />
              {meta.label}
            </div>
            <p className="mt-0.5 text-sm text-zinc-400">{SUMMARY[s.band]}</p>
          </div>
        </div>

        {s.reasons.length > 0 && (
          <div className="border-t border-white/[0.06] px-4 py-3">
            <div className="mb-1.5 text-[11px] text-zinc-500">Qué le baja el puntaje</div>
            <ul className="flex flex-col gap-1.5">
              {s.reasons.map((r) => (
                <li key={r.text} className="flex items-baseline gap-3 text-sm text-zinc-200">
                  <span className={`w-8 shrink-0 text-right text-xs font-medium tabular-nums ${r.points >= 15 ? 'text-rose-300' : 'text-amber-300'}`}>
                    <span aria-hidden>−{r.points}</span>
                    <span className="sr-only">resta {r.points} puntos:</span>
                  </span>
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 border-t border-white/[0.06] px-4 py-1">
          <Metric icon={Thermometer} label="Temperatura" value={formatTemp(h.temp_c)} />
          <Metric icon={Cpu} label="Memoria libre" value={h.low_mem === true && h.ram_avail_mb == null ? 'Poca' : formatFreeOf(h.ram_avail_mb, h.ram_total_mb)} />
          <Metric icon={HardDrive} label="Almacenamiento libre" value={formatFreeOf(h.free_mb, h.storage_mb)} />
          <Metric icon={Wifi} label="Conexión" value={net?.t === 'wifi' && net.rssi != null ? `Wi-Fi · ${formatRssi(net.rssi)}` : formatConnection(net?.t)} />
          <Metric icon={Router} label="Hasta el router" value={formatHop(net?.gw_ms, net?.gw_loss)} />
          <Metric icon={Globe} label="Hasta internet" value={formatHop(net?.inet_ms, net?.inet_loss)} />
          <Metric icon={Timer} label="Encendido hace" value={formatUptime(h.uptime)} />
          <Metric icon={Power} label="Encendidos (24 h)" value={inputs ? String(inputs.boots) : '—'} />
          <Metric icon={RotateCw} label="Reinicios de NEX (24 h)" value={inputs ? String(inputs.restarts) : '—'} />
          <Metric icon={Bug} label="Errores (24 h)" value={inputs ? String(inputs.errors) : '—'} />
        </dl>

        {partial && (
          <p className="border-t border-white/[0.06] px-4 py-3 text-xs text-zinc-500">
            Este equipo no informa temperatura, memoria ni red (lo hacen los TV box con NEX TV para Android). El puntaje usa solo lo que se sabe.
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Diagnóstico de red
// ---------------------------------------------------------------------------

type VerdictTone = 'success' | 'warning' | 'danger';
const VERDICT_ICON: Record<VerdictTone, LucideIcon> = { success: CircleCheck, warning: TriangleAlert, danger: CircleX };

const SEGMENT_WORD: Record<SegmentState, string> = { ok: 'bien', falla: 'con problemas', 'sin-datos': 'no se pudo evaluar' };

function Hop({ state, failTone, from, to, caption }: { state: SegmentState; failTone: VerdictTone; from: string; to: string; caption: string }) {
  const tone: VerdictTone | 'neutral' = state === 'ok' ? 'success' : state === 'falla' ? failTone : 'neutral';
  const Icon = state === 'ok' ? CircleCheck : state === 'falla' ? VERDICT_ICON[failTone] : CircleHelp;
  const line = tone === 'neutral' ? 'border-t-2 border-dashed border-white/15' : `h-0.5 rounded-full ${TONE_DOT[tone]}`;
  return (
    <li className="flex min-w-0 flex-1 flex-col items-center gap-1.5 pt-[11px]">
      <div className="flex w-full items-center gap-1">
        <span className={`flex-1 ${line}`} aria-hidden />
        <Icon className={`h-[18px] w-[18px] shrink-0 ${TONE_TEXT[tone]}`} aria-hidden />
        <span className={`flex-1 ${line}`} aria-hidden />
      </div>
      <span className="sr-only">Tramo de {from} a {to}: {SEGMENT_WORD[state]}.</span>
      <span className={`px-1 text-center text-[11px] leading-tight ${state === 'falla' ? TONE_TEXT[tone] : 'text-zinc-500'}`}>{caption}</span>
    </li>
  );
}

function Node({ icon: Icon, label }: { icon: LucideIcon; label: ReactNode }) {
  return (
    <li className="flex w-14 shrink-0 flex-col items-center gap-1.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-300 ring-1 ring-inset ring-white/10">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-center text-[11px] leading-tight text-zinc-400">{label}</span>
    </li>
  );
}

/** TV box → router/ONU → internet, con cada tramo pintado según dónde está el problema. */
function SegmentDiagram({ diag, failTone }: { diag: NetDiag; failTone: VerdictTone }) {
  const seg = netSegments(diag);
  const localCaption = [
    diag.t === 'wifi' ? (diag.rssi != null ? `Wi-Fi ${Math.round(diag.rssi)} dBm` : 'Wi-Fi') : diag.t === 'eth' ? 'Cable' : diag.t === 'none' ? 'Sin red' : null,
    diag.gw_ms != null ? `${Math.round(diag.gw_ms)} ms` : null,
  ].filter(Boolean).join(' · ') || 'Sin medición';
  const inetCaption = formatHop(diag.inet_ms, diag.inet_loss).replace('—', 'Sin medición');
  return (
    <ol className="flex items-start" aria-label="Recorrido de la conexión">
      <Node icon={Tv} label="TV box" />
      <Hop state={seg.local} failTone={failTone} from="el TV box" to="el router" caption={localCaption} />
      <Node icon={Router} label={<>Router<br />u ONU</>} />
      <Hop state={seg.internet} failTone={failTone} from="el router" to="internet" caption={inetCaption} />
      <Node icon={Globe} label="Internet" />
    </ol>
  );
}

const mbps = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `${v >= 10 ? Math.round(v) : v.toFixed(1).replace('.', ',')} Mbps` : '—');
const millis = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)} ms` : '—');

function DiagResult({ diag, at, now, stale }: { diag: NetDiag; at: string | null; now: number; stale: boolean }) {
  const { verdict, reasons } = netVerdict(diag);
  const meta = VERDICT_META[verdict];
  const Icon = VERDICT_ICON[meta.tone];
  const rows: [string, string][] = [
    ['Conexión', formatConnection(diag.t, diag.freq_mhz)],
    ...(diag.t === 'wifi'
      ? ([['Señal Wi-Fi', formatRssi(diag.rssi)], ['Velocidad del enlace Wi-Fi', mbps(diag.link_mbps)]] as [string, string][])
      : []),
    ['Hasta el router', formatHop(diag.gw_ms, diag.gw_loss)],
    ['Hasta internet', formatHop(diag.inet_ms, diag.inet_loss)],
    ['DNS', 'dns_ms' in diag && diag.dns_ms === null ? 'No responde' : millis(diag.dns_ms)],
    ['Servidor de NEX', millis(diag.mdm_ms)],
    ['Velocidad de bajada', mbps(diag.down_mbps)],
  ];
  return (
    <div className={`flex flex-col gap-4 ${stale ? 'opacity-60' : ''}`}>
      <div className={`rounded-xl border px-4 py-3 ${TONE_PANEL[meta.tone]}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${TONE_TEXT[meta.tone]}`}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {meta.title}
        </div>
        <p className="mt-1 text-sm text-zinc-300">{meta.text}</p>
        {reasons.length > 0 && (
          <ul className="mt-2 flex list-disc flex-col gap-0.5 pl-5 text-sm text-zinc-300">
            {reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
      </div>

      {typeof diag.error === 'string' && diag.error && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>El equipo no pudo completar toda la medición: <span className="break-words font-mono">{diag.error.slice(0, 160)}</span></span>
        </p>
      )}

      <SegmentDiagram diag={diag} failTone={meta.tone} />

      <dl className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] px-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-sm text-zinc-400">{label}</dt>
            <dd className={`text-right text-sm tabular-nums ${value === '—' ? 'text-zinc-500' : 'text-zinc-200'}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-zinc-500" title={at ? new Date(at).toLocaleString('es-AR') : undefined}>
        {stale ? 'Resultado anterior, medido' : 'Medido'} {relativeTime(at, now)}.
      </p>
    </div>
  );
}

/**
 * Sección "Diagnóstico de red" del detalle. El panel pide la medición, el equipo la corre en su próximo sync
 * (1-2 min si está en línea) y el resultado llega con el refresco de datos del panel (cada 20 s o a mano).
 */
export function NetDiagSection({ device, now, onRefresh }: { device: Device; now: number; onRefresh: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const state = diagState(device, now);
  const online = isOnline(device);
  const pending = state === 'pendiente';
  const waited = device.diag_requested_at ? now - new Date(device.diag_requested_at).getTime() : 0;

  const request = async () => {
    setBusy(true);
    try {
      await run(db().rpc('mdm_request_net_diag', { p_device: device.id }));
      toast.show(online ? 'Diagnóstico pedido: el resultado aparece en 1 o 2 minutos' : 'Diagnóstico pedido: el equipo lo mide cuando vuelva a conectarse', 'info');
      onRefresh();
    } catch (err) {
      const limited = err instanceof ApiError && err.code === '54000';
      toast.show(limited ? 'Ya pediste 6 diagnósticos de este equipo en la última hora. Probá de nuevo más tarde.' : (err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="red-titulo">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 id="red-titulo" className={SECTION_TITLE}>Diagnóstico de red</h3>
        <Button size="sm" variant="secondary" icon={Stethoscope} disabled={busy || pending} onClick={request}>
          {device.net_diag || state === 'sin-respuesta' ? 'Medir de nuevo' : 'Diagnosticar red'}
        </Button>
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        Mide el Wi-Fi, el router y la salida a internet desde el TV box, para saber en qué tramo está el problema.
        Si la red da bien, la falla está en la app de TV o en su servidor.
      </p>

      <div className="flex flex-col gap-4" aria-live="polite">
        {pending && (
          <div className="flex items-start gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.07] px-4 py-3">
            <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-indigo-300" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium text-indigo-200">
                {online ? 'Midiendo la red del equipo…' : 'Esperando a que el equipo se conecte…'}
              </div>
              <p className="mt-0.5 text-zinc-400">
                {!online
                  ? 'El equipo está sin conexión. Si vuelve dentro de la hora, mide y el resultado aparece acá.'
                  : waited > DIAG_SLOW_MS
                    ? 'Está tardando más de lo normal. Puede que el TV esté apagado o que su versión de NEX no incluya el diagnóstico.'
                    : 'Tarda 1 o 2 minutos. Esta pantalla se actualiza sola; podés seguir trabajando.'}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Pedido {relativeTime(device.diag_requested_at, now)}.</p>
            </div>
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRefresh}>Actualizar</Button>
          </div>
        )}

        {state === 'sin-respuesta' && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <div>
              <div className="font-medium text-amber-200">El equipo no respondió al último pedido</div>
              <p className="mt-0.5 text-zinc-400">
                Estuvo apagado o sin conexión durante la hora que dura el pedido, o su versión de NEX no incluye el diagnóstico.
                {!online && ' Si el TV no se conecta, revisá en la casa que esté enchufado y con red.'}
              </p>
            </div>
          </div>
        )}

        {device.net_diag ? (
          <DiagResult diag={device.net_diag} at={device.net_diag_at} now={now} stale={state !== 'listo'} />
        ) : (
          state === 'nunca' && (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-4 text-center text-sm text-zinc-500">
              Todavía no se midió la red de este equipo.
            </p>
          )
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Resumen por banda (página Resumen)
// ---------------------------------------------------------------------------

const BAND_HINT: Record<HealthBand, string> = {
  problemas: '0 a 49',
  atencion: '50 a 79',
  bien: '80 a 100',
  'sin-datos': 'nunca conectados',
};

/** Barra apilada + conteo por banda. Cada banda con equipos para mirar lleva al listado filtrado. */
export function HealthSummary({ scores, onOpenLow }: { scores: Iterable<HealthScore>; onOpenLow: () => void }) {
  const counts = bandCounts(scores);
  const total = BAND_ORDER.reduce((n, b) => n + counts[b], 0);
  const low = counts.problemas + counts.atencion;
  if (total === 0) return null;
  const description = BAND_ORDER.filter((b) => counts[b] > 0).map((b) => `${counts[b]} ${BAND_META[b].label.toLowerCase()}`).join(', ');
  return (
    <section aria-labelledby="salud-resumen" className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="salud-resumen" className="flex items-center gap-2 text-[15px] font-semibold text-zinc-100">
          <HeartPulse className="h-4 w-4 text-zinc-400" aria-hidden />
          Salud de los equipos
        </h2>
        {low > 0 ? (
          <Button size="sm" variant="secondary" onClick={onOpenLow}>
            Ver {low} con salud baja
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-emerald-300"><CircleCheck className="h-3.5 w-3.5" aria-hidden /> Ninguno con salud baja</span>
        )}
      </div>

      <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Salud de ${total} equipos: ${description}`}>
        {BAND_ORDER.filter((b) => counts[b] > 0).map((b) => (
          <span key={b} className={`h-full min-w-[6px] ${TONE_DOT[BAND_META[b].tone]}`} style={{ flexGrow: counts[b], flexBasis: 0 }} />
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {BAND_ORDER.map((b, i) => (
            <div key={b} className={i === 0 ? '' : 'sm:border-l sm:border-white/[0.06] sm:pl-4'}>
              <dt className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className={`h-2 w-2 rounded-full ${TONE_DOT[BAND_META[b].tone]}`} aria-hidden />
                {BAND_META[b].label}
              </dt>
              <dd className="mt-0.5 flex items-baseline gap-1.5">
                <span className={`text-2xl font-semibold tabular-nums ${counts[b] > 0 && b !== 'sin-datos' ? TONE_TEXT[BAND_META[b].tone] : 'text-zinc-500'}`}>{counts[b]}</span>
                <span className="text-[11px] text-zinc-500">{BAND_HINT[b]}</span>
              </dd>
            </div>
        ))}
      </dl>
    </section>
  );
}
