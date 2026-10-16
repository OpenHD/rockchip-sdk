import { useEffect, useRef, type RefObject } from 'react';

/**
 * Navegación con el control remoto (flechas + OK + atrás): el foco salta al botón
 * más cercano en la dirección pedida, según la posición en pantalla. Sirve igual
 * para grillas, listas y el teclado en pantalla, sin cablear vecinos a mano.
 */
type Dir = 'up' | 'down' | 'left' | 'right';

const DIRS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack']);
// keyCode de "atrás" en controles de TV (Android: 4, Tizen: 10009).
const BACK_KEY_CODES = new Set([4, 10009]);
const HOME_KEYS = new Set(['BrowserHome', 'GoHome', 'Home']);
// OK del control: según el keymap del IR llega como Enter (nativo en botones) o como
// KEY_SELECT / KEY_REPLY / KEY_OK, que Chromium entrega con estos nombres y no activa solo.
const OK_KEYS = new Set(['Select', 'Accept', 'MailReply', 'Execute']);
const FOCUSABLE = 'button:not([disabled])';
/** Para apps internas: además de botones, campos y links. */
export const FOCUSABLE_ANY =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Foco en un campo de texto: ahí Backspace borra e Inicio va al principio, no navegan. */
function editing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'submit', 'reset', 'range'].includes((el as HTMLInputElement).type);
}

export function isBackKey(e: KeyboardEvent): boolean {
  if (e.key === 'Backspace') return !editing();
  return BACK_KEYS.has(e.key) || BACK_KEY_CODES.has(e.keyCode);
}

export function isHomeKey(e: KeyboardEvent): boolean {
  if (e.key === 'Home') return !editing();
  return HOME_KEYS.has(e.key);
}

/** OK que no es Enter: se activa a mano el elemento con foco. */
function activateOnOk(e: KeyboardEvent): boolean {
  if (!OK_KEYS.has(e.key)) return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.focus();
  else el.click();
  return true;
}

/** Distancia entre dos intervalos (0 si se superponen). */
function gap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.max(a1, b1) - Math.min(a2, b2));
}

function visible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

export function focusFirst(root: HTMLElement | null, selector = FOCUSABLE): void {
  const first = root ? Array.from(root.querySelectorAll<HTMLElement>(selector)).find(visible) : undefined;
  first?.focus();
}

export function moveFocus(root: HTMLElement, dir: Dir, selector = FOCUSABLE): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(visible);
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
 * Engancha flechas, OK, "atrás" e "inicio" a nivel ventana para la pantalla montada.
 * `onKey` corre primero (para escribir con los números del control) y devuelve true si consumió la tecla.
 * `selector`: qué se puede enfocar (por defecto, botones).
 */
export function useDpad(
  rootRef: RefObject<HTMLElement | null>,
  opts: {
    onBack?: () => void;
    onHome?: () => void;
    onKey?: (e: KeyboardEvent) => boolean;
    selector?: string;
    /** Las flechas son primero de la app (un juego): se navega solo si nadie las usó. */
    yieldArrows?: boolean;
  } = {},
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
      const { onBack, onHome, selector, yieldArrows } = optsRef.current;
      const dir = DIRS[e.key];
      if (dir) {
        // En un campo, izquierda/derecha mueven el cursor del texto.
        if (editing() && (dir === 'left' || dir === 'right')) return;
        if (yieldArrows) {
          // Después de los demás listeners: si la app la consumió (preventDefault), es suya.
          setTimeout(() => {
            if (!e.defaultPrevented) moveFocus(root, dir, selector);
          });
          return;
        }
        e.preventDefault();
        moveFocus(root, dir, selector);
      } else if (activateOnOk(e)) {
        e.preventDefault();
      } else if (isHomeKey(e) && onHome) {
        e.preventDefault();
        onHome();
      } else if (isBackKey(e) && onBack) {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rootRef]);
}
