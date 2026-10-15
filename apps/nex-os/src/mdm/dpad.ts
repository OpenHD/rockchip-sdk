import { useEffect, useRef, type RefObject } from 'react';

/**
 * Navegación con el control remoto (flechas + OK + atrás): el foco salta al botón
 * más cercano en la dirección pedida, según la posición en pantalla. Sirve igual
 * para grillas, listas y el teclado en pantalla, sin cablear vecinos a mano.
 */
type Dir = 'up' | 'down' | 'left' | 'right';

const DIRS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
export const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack']);
const FOCUSABLE = 'button:not([disabled])';

/** Distancia entre dos intervalos (0 si se superponen). */
function gap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.max(a1, b1) - Math.min(a2, b2));
}

function visible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

export function focusFirst(root: HTMLElement | null): void {
  const first = root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).find(visible) : undefined;
  first?.focus();
}

export function moveFocus(root: HTMLElement, dir: Dir): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
  const active = document.activeElement as HTMLElement | null;
  if (!active || !items.includes(active)) {
    items[0]?.focus();
    return;
  }
  const a = active.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === active) continue;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    let main: number;
    let cross: number;
    if (dir === 'right' || dir === 'left') {
      if (dir === 'right' ? x <= ax + 1 : x >= ax - 1) continue;
      main = dir === 'right' ? r.left - a.right : a.left - r.right;
      cross = gap(a.top, a.bottom, r.top, r.bottom);
    } else {
      if (dir === 'down' ? y <= ay + 1 : y >= ay - 1) continue;
      main = dir === 'down' ? r.top - a.bottom : a.top - r.bottom;
      cross = gap(a.left, a.right, r.left, r.right);
    }
    // Prioriza lo alineado (misma fila/columna); desempata por cercanía de centros.
    const align = dir === 'left' || dir === 'right' ? Math.abs(y - ay) : Math.abs(x - ax);
    const score = Math.max(0, main) + cross * 4 + align * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

/**
 * Engancha flechas y "atrás" a nivel ventana para la pantalla montada.
 * `onKey` corre primero (para escribir con los números del control) y devuelve true si consumió la tecla.
 */
export function useDpad(
  rootRef: RefObject<HTMLElement | null>,
  opts: { onBack?: () => void; onKey?: (e: KeyboardEvent) => boolean } = {},
): void {
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const root = rootRef.current;
      if (!root || e.defaultPrevented) return;
      if (optsRef.current.onKey?.(e)) {
        e.preventDefault();
        return;
      }
      const dir = DIRS[e.key];
      if (dir) {
        e.preventDefault();
        moveFocus(root, dir);
      } else if (BACK_KEYS.has(e.key) && optsRef.current.onBack) {
        e.preventDefault();
        optsRef.current.onBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rootRef]);
}
