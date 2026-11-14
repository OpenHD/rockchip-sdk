import type { MdmApp } from './agentState';

const TILE_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#8b5cff', '#47bfff'],
  ['#ff5c8a', '#ff9a47'],
  ['#19c37d', '#1aa6b7'],
  ['#f59e0b', '#ef4444'],
  ['#6366f1', '#a855f7'],
  ['#0ea5e9', '#2563eb'],
  ['#ec4899', '#8b5cf6'],
  ['#14b8a6', '#3b82f6'],
];

/** Fondo del mosaico de una app sin ícono: siempre el mismo para la misma app. */
export function tileGradient(seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  const [from, to] = TILE_GRADIENTS[hash % TILE_GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

/** Orden del dock: primero lo que ya se puede abrir, después lo que falta instalar. */
export function orderDock(apps: readonly MdmApp[]): MdmApp[] {
  return [...apps.filter((a) => !a.install), ...apps.filter((a) => a.install)];
}
