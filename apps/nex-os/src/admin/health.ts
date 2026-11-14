import type { Device, FactoryRisk } from './api';

/**
 * Semáforo de salud del TV box (0-100) y lectura del diagnóstico de red.
 *
 * El equipo informa en health (cada sync) temperatura, memoria, almacenamiento y una medición liviana de red
 * (cada 5 min); el servidor aporta encendidos, reinicios del agente y errores de las últimas 24 h
 * (mdm_device_health_inputs). Lo que el equipo no informa (por ejemplo, la temperatura en un box que no la expone)
 * no resta: el puntaje se basa solo en lo que se sabe y las razones lo explican.
 */

/** Medición liviana de red que el equipo manda en health.net. */
export interface NetQuick {
  /** Tipo de conexión. */
  t?: 'wifi' | 'eth' | 'none' | string;
  /** dBm; solo Wi-Fi. */
  rssi?: number | null;
  /** Latencia y pérdida (%) hasta el router/ONU (gateway). */
  gw_ms?: number | null;
  gw_loss?: number | null;
  /** Latencia y pérdida (%) hasta internet. */
  inet_ms?: number | null;
  inet_loss?: number | null;
}

/** Resultado del diagnóstico completo (mdm_devices.net_diag). */
export interface NetDiag extends NetQuick {
  req?: number;
  at?: number;
  /** Velocidad del enlace Wi-Fi (Mbps) y banda (MHz). */
  link_mbps?: number | null;
  freq_mhz?: number | null;
  /** ms para resolver un nombre; null = el DNS no respondió. */
  dns_ms?: number | null;
  /** ms hasta el servidor de NEX (HTTPS). */
  mdm_ms?: number | null;
  /** Velocidad de bajada medida (Mbps). */
  down_mbps?: number | null;
  error?: string;
}

export interface HealthInputs {
  device_id: string;
  boots: number;
  restarts: number;
  errors: number;
}

export type HealthBand = 'bien' | 'atencion' | 'problemas' | 'sin-datos';

export interface HealthScore {
  score: number | null;
  band: HealthBand;
  /** Qué restó puntos, de lo más grave a lo menos. */
  reasons: { text: string; points: number }[];
}

export const BAND_META: Record<HealthBand, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  bien: { label: 'Bien', tone: 'success' },
  atencion: { label: 'Atención', tone: 'warning' },
  problemas: { label: 'Problemas', tone: 'danger' },
  'sin-datos': { label: 'Sin datos', tone: 'neutral' },
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Penalidades de red compartidas entre la medición liviana y el diagnóstico. */
function networkPenalties(n: NetQuick | undefined, add: (text: string, points: number) => void) {
  if (!n) return;
  const rssi = num(n.rssi);
  if (n.t === 'wifi' && rssi !== null) {
    if (rssi <= -80) add(`Señal Wi-Fi muy débil (${rssi} dBm)`, 15);
    else if (rssi <= -70) add(`Señal Wi-Fi débil (${rssi} dBm)`, 7);
  }
  const gwLoss = num(n.gw_loss);
  if (gwLoss !== null && gwLoss >= 20) add(`Pierde ${gwLoss}% de paquetes hasta el router`, 15);
  else if (gwLoss !== null && gwLoss >= 5) add(`Pierde ${gwLoss}% de paquetes hasta el router`, 7);
  const inetLoss = num(n.inet_loss);
  if (inetLoss !== null && inetLoss >= 10) add(`Pierde ${inetLoss}% de paquetes hasta internet`, 10);
  const inetMs = num(n.inet_ms);
  if (inetMs !== null && inetMs >= 200) add(`Latencia alta a internet (${Math.round(inetMs)} ms)`, 5);
}

/** Subida sostenida (Mbps) a partir de la cual el equipo se marca como posible infectado. */
export const UPLOAD_ALERT_MBPS = 5;

const PORT_NAMES: Record<number, string> = { 40000: 'shell root remoto (40000)', 5555: 'ADB por red (5555)' };

/** Puertas de fábrica abiertas en texto, para el panel. Vacío si no hay ninguna o el equipo no lo informa. */
export function factoryRisks(f: FactoryRisk | undefined): string[] {
  if (!f) return [];
  return [
    ...(f.ports ?? []).map((p) => PORT_NAMES[p] ?? `puerto ${p}`),
    // su solo no es una puerta trasera: los TX6698 traen root (firmware userdebug) y el kit de instalación lo usa.
    ...(f.pkgs ?? []).map((p) => `app de control remoto ${p}`),
  ];
}

export function healthScore(d: Device, inputs: HealthInputs | undefined, now = Date.now()): HealthScore {
  if (!d.last_seen_at) return { score: null, band: 'sin-datos', reasons: [] };
  const h = d.health ?? {};
  const reasons: HealthScore['reasons'] = [];
  const add = (text: string, points: number) => reasons.push({ text, points });

  const hoursOff = (now - new Date(d.last_seen_at).getTime()) / 3_600_000;
  if (hoursOff >= 24) add(`Sin conexión hace ${Math.floor(hoursOff / 24)} d`, 40);
  else if (hoursOff >= 1) add(`Sin conexión hace ${Math.floor(hoursOff)} h`, 25);

  const temp = num(h.temp_c);
  if (temp !== null) {
    if (temp >= 85) add(`Temperatura muy alta (${Math.round(temp)} °C)`, 30);
    else if (temp >= 75) add(`Temperatura alta (${Math.round(temp)} °C)`, 15);
    else if (temp >= 65) add(`Temperatura elevada (${Math.round(temp)} °C)`, 5);
  }

  const ramAvail = num(h.ram_avail_mb);
  const ramTotal = num(h.ram_total_mb);
  if (h.low_mem === true) add('Android avisa poca memoria', 15);
  else if (ramAvail !== null && ramTotal) {
    const pct = (ramAvail / ramTotal) * 100;
    if (pct < 10) add(`Memoria libre ${Math.round(pct)}%`, 10);
    else if (pct < 15) add(`Memoria libre ${Math.round(pct)}%`, 5);
  }

  const free = num(h.free_mb);
  if (free !== null) {
    if (free < 200) add(`Almacenamiento casi lleno (${free} MB libres)`, 25);
    else if (free < 500) add(`Poco almacenamiento (${free} MB libres)`, 10);
    else if (free < 1024) add(`Almacenamiento justo (${(free / 1024).toFixed(1)} GB libres)`, 5);
  }

  networkPenalties(h.net, add);

  // Firmas del incidente de CAPPI (ver CureBox): subida alta sin uso y accesos remotos de fábrica.
  const up = num(h.up_mbps);
  if (up !== null && up >= 20) add(`Sube ${up} Mbps sin uso: posible equipo infectado`, 50);
  else if (up !== null && up >= UPLOAD_ALERT_MBPS) add(`Sube ${up} Mbps sin uso: posible equipo infectado`, 35);
  const risks = factoryRisks(h.factory);
  if (risks.length) add(`Puertas traseras de fábrica abiertas: ${risks.join(', ')}`, 25);

  if (inputs) {
    if (inputs.boots >= 6) add(`${inputs.boots} encendidos en 24 h`, 25);
    else if (inputs.boots >= 3) add(`${inputs.boots} encendidos en 24 h`, 15);
    if (inputs.restarts >= 5) add(`NEX se reinició ${inputs.restarts} veces en 24 h`, 20);
    else if (inputs.restarts >= 2) add(`NEX se reinició ${inputs.restarts} veces en 24 h`, 10);
    if (inputs.errors > 0) add(`${inputs.errors} ${inputs.errors === 1 ? 'error' : 'errores'} en 24 h`, Math.min(20, inputs.errors * 5));
  }

  reasons.sort((a, b) => b.points - a.points);
  const score = Math.max(0, 100 - reasons.reduce((s, r) => s + r.points, 0));
  return { score, band: score >= 80 ? 'bien' : score >= 50 ? 'atencion' : 'problemas', reasons };
}

// ---------------------------------------------------------------------------
// Diagnóstico de red
// ---------------------------------------------------------------------------

export type NetVerdict = 'ok' | 'red-local' | 'internet' | 'sin-conexion';

export const VERDICT_META: Record<NetVerdict, { title: string; text: string; tone: 'success' | 'warning' | 'danger' }> = {
  ok: {
    title: 'La red está bien',
    text: 'Wi-Fi, router e internet responden bien. Si una app de TV falla, el problema está en la app o en su servidor.',
    tone: 'success',
  },
  'red-local': {
    title: 'Problema en la red de la casa',
    text: 'Falla el tramo entre el TV box y el router/ONU (Wi-Fi débil o con interferencia, o el cable). Acercar el router, usar 5 GHz o cable.',
    tone: 'warning',
  },
  internet: {
    title: 'Problema en el acceso a internet',
    text: 'El router responde bien pero internet no: revisar la ONU, el enlace o la red del ISP.',
    tone: 'danger',
  },
  'sin-conexion': {
    title: 'Sin conexión',
    text: 'El equipo no llega al router. Revisar que esté conectado al Wi-Fi o al cable.',
    tone: 'danger',
  },
};

/** Lee el diagnóstico y dice en qué tramo está el problema, con los motivos. */
export function netVerdict(n: NetDiag): { verdict: NetVerdict; reasons: string[] } {
  const reasons: string[] = [];
  const gwMs = num(n.gw_ms);
  const gwLoss = num(n.gw_loss);
  const rssi = num(n.rssi);
  if (n.t === 'none' || (gwMs === null && (gwLoss === null || gwLoss >= 100) && num(n.inet_ms) === null)) {
    return { verdict: 'sin-conexion', reasons: ['No responde el router ni internet'] };
  }

  // Tramo local: TV box ↔ router/ONU.
  if (n.t === 'wifi' && rssi !== null && rssi <= -75) reasons.push(`Señal Wi-Fi débil (${rssi} dBm)`);
  if (gwLoss !== null && gwLoss >= 10) reasons.push(`Pierde ${gwLoss}% de paquetes hasta el router`);
  if (gwMs !== null && gwMs >= 40) reasons.push(`Router lento en responder (${Math.round(gwMs)} ms)`);
  const linkMbps = num(n.link_mbps);
  if (n.t === 'wifi' && linkMbps !== null && linkMbps < 20) reasons.push(`Enlace Wi-Fi lento (${linkMbps} Mbps)`);
  if (reasons.length) return { verdict: 'red-local', reasons };

  // Tramo de acceso: router ↔ internet.
  const inetLoss = num(n.inet_loss);
  const inetMs = num(n.inet_ms);
  const down = num(n.down_mbps);
  if (inetMs === null && (inetLoss === null || inetLoss >= 100)) reasons.push('Internet no responde');
  if (inetLoss !== null && inetLoss >= 5 && inetLoss < 100) reasons.push(`Pierde ${inetLoss}% de paquetes hasta internet`);
  if (inetMs !== null && inetMs >= 150) reasons.push(`Latencia alta a internet (${Math.round(inetMs)} ms)`);
  if ('dns_ms' in n && n.dns_ms === null) reasons.push('El DNS no responde');
  if (down !== null && down < 5) reasons.push(`Velocidad de bajada baja (${down} Mbps)`);
  if (reasons.length) return { verdict: 'internet', reasons };

  return { verdict: 'ok', reasons: [] };
}

// ---------------------------------------------------------------------------
// Ayudas para las pantallas (resumen por banda, tramos y estado del pedido)
// ---------------------------------------------------------------------------

/** De peor a mejor: así se muestran en el resumen y se ordenan en las listas. */
export const BAND_ORDER: HealthBand[] = ['problemas', 'atencion', 'bien', 'sin-datos'];

export function bandCounts(scores: Iterable<HealthScore>): Record<HealthBand, number> {
  const counts: Record<HealthBand, number> = { bien: 0, atencion: 0, problemas: 0, 'sin-datos': 0 };
  for (const s of scores) counts[s.band] += 1;
  return counts;
}

/** Salud baja = hay algo para mirar (amarillo o rojo). */
export function isLowHealth(s: HealthScore | undefined): boolean {
  return s?.band === 'atencion' || s?.band === 'problemas';
}

export type SegmentState = 'ok' | 'falla' | 'sin-datos';

/**
 * Estado de cada tramo para el dibujo TV box → router/ONU → internet. Sale del mismo veredicto, así el dibujo
 * nunca contradice el texto. Si falla el tramo local, el de internet solo se marca bien cuando la medición lo
 * confirma: con la red de la casa rota no se puede culpar (ni absolver) al acceso.
 */
export function netSegments(n: NetDiag): { local: SegmentState; internet: SegmentState } {
  const { verdict } = netVerdict(n);
  if (verdict === 'ok') return { local: 'ok', internet: 'ok' };
  if (verdict === 'internet') return { local: 'ok', internet: 'falla' };
  if (verdict === 'sin-conexion') return { local: 'falla', internet: 'sin-datos' };
  const inetMs = num(n.inet_ms);
  const inetLoss = num(n.inet_loss);
  return { local: 'falla', internet: inetMs !== null && inetMs < 150 && (inetLoss ?? 0) < 5 ? 'ok' : 'sin-datos' };
}

/** El sync le pasa el pedido al equipo solo durante una hora (mdm_device_sync, v12). */
export const DIAG_WINDOW_MS = 3_600_000;
/** El equipo sincroniza cada minuto y la medición tarda menos de un minuto: pasado esto, algo lo demora. */
export const DIAG_SLOW_MS = 4 * 60_000;

/**
 * nunca: no hay pedido ni resultado. pendiente: hay un pedido que el equipo todavía puede tomar.
 * sin-respuesta: el pedido venció sin resultado. listo: el último pedido tiene resultado.
 */
export type DiagState = 'nunca' | 'pendiente' | 'sin-respuesta' | 'listo';

export function diagState(d: Pick<Device, 'diag_requested_at' | 'net_diag' | 'net_diag_at'>, now = Date.now()): DiagState {
  const req = d.diag_requested_at ? new Date(d.diag_requested_at).getTime() : null;
  const res = d.net_diag_at ? new Date(d.net_diag_at).getTime() : null;
  if (req !== null && (res === null || res < req)) return now - req < DIAG_WINDOW_MS ? 'pendiente' : 'sin-respuesta';
  return d.net_diag ? 'listo' : 'nunca';
}
