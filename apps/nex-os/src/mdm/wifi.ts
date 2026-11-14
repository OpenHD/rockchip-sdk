/** Lógica pura del Wi-Fi de NEX TV: valida lo que publica el agente y arma los textos de la pantalla. */

/** Respuesta de /agent/wifi/status (solo la publica el agente de Android). */
export interface WifiStatus {
  ssid: string | null;
  connected: boolean;
  ethernet: boolean;
  /** Intensidad de la señal, de 0 a 4. */
  level: number;
  ip: string | null;
}

/** Red encontrada por /agent/wifi/scan. */
export interface WifiNetwork {
  ssid: string;
  /** Intensidad de la señal, de 0 a 4. */
  level: number;
  secure: boolean;
  saved: boolean;
  /** Seguridad que este equipo no sabe usar (WEP, empresarial, solo WPA3). */
  unsupported: boolean;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const MAX_NETWORKS = 30;

function level(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 0), 4) : 0;
}

/** Valida el estado del Wi-Fi: ante cualquier duda, null (la pantalla muestra solo "Conectado" o "Sin conexión"). */
export function parseWifiStatus(raw: unknown): WifiStatus | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.connected !== 'boolean') return null;
  const ssid = typeof o.ssid === 'string' ? o.ssid.trim().slice(0, 32) : '';
  return {
    ssid: ssid || null,
    connected: o.connected,
    ethernet: o.ethernet === true,
    level: level(o.level),
    ip: typeof o.ip === 'string' && IPV4.test(o.ip) ? o.ip : null,
  };
}

function parseNetwork(raw: unknown): WifiNetwork | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  // El nombre va tal cual (sin recortar espacios): es el que se manda de vuelta al conectar.
  if (typeof o.ssid !== 'string' || !o.ssid.trim() || o.ssid.length > 32) return null;
  return { ssid: o.ssid, level: level(o.level), secure: o.secure === true, saved: o.saved === true, unsupported: o.unsupported === true };
}

/** Valida la búsqueda de redes. Sin repetidas (queda la de mejor señal) y de la señal más fuerte a la más débil. */
export function parseWifiScan(raw: unknown): { status: WifiStatus | null; networks: WifiNetwork[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { status: null, networks: [] };
  const o = raw as Record<string, unknown>;
  const best = new Map<string, WifiNetwork>();
  for (const item of Array.isArray(o.networks) ? o.networks : []) {
    const n = parseNetwork(item);
    if (!n) continue;
    const prev = best.get(n.ssid);
    if (!prev || n.level > prev.level) best.set(n.ssid, n);
  }
  const networks = Array.from(best.values())
    .map((n, i) => ({ n, i }))
    .sort((a, b) => b.n.level - a.n.level || a.i - b.i)
    .map((x) => x.n)
    .slice(0, MAX_NETWORKS);
  return { status: parseWifiStatus(o.status), networks };
}

/** Red a la que el equipo está conectado ahora por Wi-Fi (null si no hay o va por cable). */
export function connectedSsid(status: WifiStatus | null): string | null {
  return status && status.connected && !status.ethernet ? status.ssid : null;
}

/** Renglón chico de cada red de la lista. */
export function networkDetail(n: WifiNetwork, current: string | null): string {
  if (n.unsupported) return 'No es compatible con este equipo';
  if (n.ssid === current) return 'Conectada';
  const security = n.secure ? 'Con contraseña' : 'Abierta';
  return n.saved ? `Guardada · ${security}` : security;
}

const SIGNAL = ['Sin señal', 'Débil', 'Regular', 'Buena', 'Excelente'];

export function signalLabel(value: number): string {
  return SIGNAL[level(value)];
}

/**
 * Revisa la contraseña antes de pedirle al equipo que se conecte. `listed`: la red se eligió de la lista
 * (ahí siempre lleva contraseña); en "Otra red" puede quedar vacía si la red es abierta.
 */
export function passwordError(password: string, listed: boolean): string | null {
  const n = password.length;
  if ((listed && n < 8) || (n > 0 && (n < 8 || n > 63))) return 'La contraseña debe tener entre 8 y 63 caracteres.';
  return null;
}

/**
 * Flechas del control sobre elementos agrupados en filas. `rows[i]` es la fila del elemento i (en el orden en
 * que se ven); ◀▶ se mueven dentro de la fila y ▲▼ van al primer elemento de la fila vecina. Devuelve el índice
 * del próximo elemento, o el mismo si no hay adónde ir.
 */
export function moveFocus(rows: readonly string[], current: number, key: string): number {
  if (rows.length === 0) return -1;
  if (current < 0 || current >= rows.length) return 0;
  const row = rows[current];
  if (key === 'ArrowRight') return rows[current + 1] === row ? current + 1 : current;
  if (key === 'ArrowLeft') return rows[current - 1] === row ? current - 1 : current;
  if (key === 'ArrowDown') {
    for (let i = current + 1; i < rows.length; i++) if (rows[i] !== row) return i;
    return current;
  }
  if (key === 'ArrowUp') {
    let i = current - 1;
    while (i >= 0 && rows[i] === row) i--;
    if (i < 0) return current;
    while (i > 0 && rows[i - 1] === rows[i]) i--;
    return i;
  }
  return current;
}
