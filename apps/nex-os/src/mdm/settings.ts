/** Lógica pura de la pantalla de Ajustes de NEX TV: preferencias, estado de la red y versión. */

import type { WifiStatus } from './wifi';

export type Appearance = { dimWallpaper: boolean; bigTiles: boolean };

export const APPEARANCE_KEY = 'nex.tv.appearance';
export const DEFAULT_APPEARANCE: Appearance = { dimWallpaper: false, bigTiles: false };

/** Lee las preferencias guardadas. Cualquier cosa que no sea `true` vale como apagado. */
export function parseAppearance(raw: string | null): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;
  try {
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== 'object') return DEFAULT_APPEARANCE;
    const v = o as Record<string, unknown>;
    return { dimWallpaper: v.dimWallpaper === true, bigTiles: v.bigTiles === true };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export interface NetworkSummary {
  kind: 'wifi' | 'ethernet' | 'online' | 'offline';
  /** Frase para la persona: "Conectado a Casa", "Conectado por cable", "Sin conexión". */
  label: string;
  /** Nombre corto de la red para la ficha del equipo. */
  network: string | null;
  /** Barras de señal (0 a 4). null: no es Wi-Fi o no se conoce. */
  level: number | null;
  ip: string | null;
}

/**
 * Resume la conexión del equipo. `status` es null cuando el agente no informa el Wi-Fi (agente de Linux o
 * lectura fallida): ahí solo queda lo que dice el navegador.
 */
export function networkSummary(status: WifiStatus | null, online: boolean): NetworkSummary {
  if (status?.ethernet) return { kind: 'ethernet', label: 'Conectado por cable', network: 'Cable', level: null, ip: status.ip };
  if (status?.connected) {
    return {
      kind: 'wifi',
      label: status.ssid ? `Conectado a ${status.ssid}` : 'Conectado por Wi-Fi',
      network: status.ssid ?? 'Wi-Fi',
      level: status.level,
      ip: status.ip,
    };
  }
  if (!status && online) return { kind: 'online', label: 'Conectado', network: null, level: null, ip: null };
  return { kind: 'offline', label: 'Sin conexión', network: null, level: null, ip: null };
}

/** Versión para mostrar: la del agente si la informa; si no, la de compilación de la interfaz. */
export function versionLabel(version: string | null, build: number | null, fallback: string): string {
  if (!version) return fallback;
  return build ? `${version} (compilación ${build})` : version;
}
