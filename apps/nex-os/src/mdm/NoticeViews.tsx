import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type Ref } from 'react';
import type { MdmNotice, NoticeCategory, NoticeSeverity } from './agentState';
import { formatUntil, noticeLabel } from './notices';

/**
 * Avisos de la empresa en la TV. Una emergencia ocupa toda la pantalla y toma el control remoto;
 * el resto se muestra como una franja en el inicio y se lee completo en la misma pantalla de lectura.
 * El texto es plano: React lo escapa, nunca se inserta como HTML.
 */

const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack']);
/** Una emergencia aparece de golpe: un OK apretado justo en ese momento no la da por leída. */
const ARM_MS = 700;
/** Renglones de texto que entran sin desplazar (estimado, para mostrar la ayuda de las flechas). */
const VISIBLE_LINES = 8;
const CHARS_PER_LINE = 75;

/** Íconos de línea, mismo trazo que los del inicio. */
const CATEGORY_ICON: Record<NoticeCategory, string> = {
  corte: 'M2 8.8a15 15 0 0 1 20 0 M5 12.5a10.5 10.5 0 0 1 14 0 M8.5 16.2a5.5 5.5 0 0 1 7 0 M12 20h.01 M3 3l18 18',
  clima: 'M17.5 15a3.5 3.5 0 0 0 .5-6.96A6 6 0 0 0 6.34 7.5 4 4 0 0 0 7 15z M8 18.5v2 M12 18.5v2 M16 18.5v2',
  salud: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  municipal: 'M3 21h18 M5 21V10 M19 21V10 M9.5 21v-7 M14.5 21v-7 M12 3l9 7H3z',
  general: 'M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z M10 20.5a2.2 2.2 0 0 0 4 0',
};

const TONE: Record<NoticeSeverity, { glow: string; bar: string; accent: string; icon: string; pulse: string; ring: string }> = {
  emergencia: {
    glow: 'rgba(239,68,68,.30)',
    bar: 'bg-red-500',
    accent: 'text-red-300',
    icon: 'bg-red-500/15 border-red-400/60 text-red-200',
    pulse: 'border-red-400',
    ring: 'focus:ring-red-400',
  },
  importante: {
    glow: 'rgba(251,191,36,.20)',
    bar: 'bg-amber-400',
    accent: 'text-amber-300',
    icon: 'bg-amber-400/15 border-amber-300/50 text-amber-200',
    pulse: 'border-amber-300',
    ring: 'focus:ring-amber-300',
  },
  info: {
    glow: 'rgba(56,189,248,.18)',
    bar: 'bg-sky-400',
    accent: 'text-sky-300',
    icon: 'bg-sky-400/15 border-sky-300/50 text-sky-200',
    pulse: 'border-sky-300',
    ring: 'focus:ring-sky-300',
  },
};

function CategoryIcon({ category, className }: { category: NoticeCategory; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={CATEGORY_ICON[category]} />
    </svg>
  );
}

function estimatedLines(body: string): number {
  return body.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0);
}

const MODAL_BUTTON =
  'rounded-2xl border border-white/25 bg-white/10 px-14 py-4 text-3xl font-semibold text-white outline-none transition-transform ' +
  'focus:scale-105 focus:border-white focus:bg-white focus:text-[#05070c] focus:ring-4';

/**
 * Aviso a pantalla completa. Con `onLater` es la lectura de un aviso del inicio ("Atrás" lo deja para después);
 * sin `onLater` es una emergencia: solo se cierra con "Entendido".
 */
export function NoticeModal({ notice, companyName, now, pending, onAck, onLater }: {
  notice: MdmNotice;
  companyName: string | null;
  now: number;
  /** Avisos del mismo tipo que quedan después de este. */
  pending: number;
  onAck: () => void;
  onLater?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const armedAt = useRef(0);
  const tone = TONE[notice.severity];
  const emergency = notice.severity === 'emergencia';
  const scrollable = estimatedLines(notice.body) > VISIBLE_LINES;

  // Toma el foco al aparecer y lo devuelve a donde estaba al cerrarse.
  useEffect(() => {
    const node = root.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    armedAt.current = Date.now() + (emergency ? ARM_MS : 0);
    primary.current?.focus();
    return () => {
      if (previous && previous !== document.body && document.contains(previous) && !previous.hasAttribute('disabled')) {
        previous.focus();
        return;
      }
      // Lo que tenía el foco ya no está: va al primer botón de la pantalla, como hace el equipo al volver de una app.
      const outside = (selector: string) =>
        Array.from(document.querySelectorAll<HTMLElement>(selector)).find((el) => !node || !node.contains(el));
      (outside('button[data-index="0"]') ?? outside('button:not(:disabled)'))?.focus();
    };
  }, [emergency]);

  // Mientras está abierto, el control remoto es solo del aviso: nada de lo que hay detrás recibe teclas ni foco.
  useEffect(() => {
    const inside = (target: EventTarget | null) => target instanceof Node && !!root.current?.contains(target);
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (!inside(document.activeElement)) primary.current?.focus();
      if ((e.key === 'Enter' || e.key === ' ') && inside(e.target)) return; // El botón enfocado hace su clic.
      e.preventDefault();
      if (BACK_KEYS.has(e.key)) {
        onLater?.();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const el = text.current;
        if (el) el.scrollTop += (e.key === 'ArrowDown' ? 1 : -1) * el.clientHeight * 0.6;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        const cur = buttons.findIndex((b) => b === document.activeElement);
        buttons[Math.min(Math.max(cur + (e.key === 'ArrowRight' ? 1 : -1), 0), buttons.length - 1)]?.focus();
      }
    };
    const onFocus = (e: FocusEvent) => {
      if (!inside(e.target)) primary.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
    };
  }, [onLater]);

  const ack = () => {
    if (Date.now() < armedAt.current) return;
    onAck();
  };

  const hints = [
    scrollable ? '▲ ▼ para leer todo' : null,
    onLater ? 'Atrás para leerlo después' : 'Presioná OK en el control para continuar',
    pending > 0 ? (pending === 1 ? 'Queda 1 aviso más' : `Quedan ${pending} avisos más`) : null,
  ].filter(Boolean);

  return (
    <div
      ref={root}
      data-nex-modal
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="nex-notice-title"
      aria-describedby="nex-notice-body"
      className="fixed top-0 left-0 z-[100] w-screen h-screen flex flex-col items-center justify-center px-24 py-14 text-white text-center select-none"
      style={{ background: `radial-gradient(ellipse at 50% 0%, ${tone.glow}, rgba(5,7,12,0) 65%), #05070c` }}
    >
      <div className={`absolute top-0 left-0 w-full h-2 ${tone.bar}`} aria-hidden />
      <div className="nex-notice-in flex flex-col items-center space-y-6 w-full max-w-[84rem]">
        <div className="relative h-24 w-24 flex-none">
          {emergency && <span className={`nex-notice-ring absolute top-0 left-0 h-full w-full rounded-full border-2 ${tone.pulse}`} aria-hidden />}
          <div className={`relative h-full w-full rounded-full border-2 flex items-center justify-center ${tone.icon}`}>
            <CategoryIcon category={notice.category} className="h-12 w-12" />
          </div>
        </div>
        <div className={`text-2xl font-semibold uppercase tracking-[0.3em] ${tone.accent}`}>{noticeLabel(notice)}</div>
        <h1 id="nex-notice-title" className="text-6xl font-semibold leading-tight break-words max-w-full">{notice.title}</h1>
        {notice.body && (
          <p
            id="nex-notice-body"
            ref={text}
            className="text-3xl leading-snug text-white/85 whitespace-pre-line break-words max-w-full max-h-[21rem] overflow-hidden"
          >
            {notice.body}
          </p>
        )}
        <p className="text-xl text-white/55">
          {companyName ? `${companyName} · ` : ''}Vigente hasta {formatUntil(notice.expiresAt, new Date(now))}
        </p>
        <div className="flex items-center justify-center space-x-8 pt-2">
          <button ref={primary} data-index="0" onClick={ack} className={`${MODAL_BUTTON} ${tone.ring}`}>
            Entendido
          </button>
          {onLater && (
            <button onClick={onLater} className={`${MODAL_BUTTON} ${tone.ring}`}>
              Leer después
            </button>
          )}
        </div>
        <p className="text-xl text-white/55">{hints.join('  ·  ')}</p>
      </div>
    </div>
  );
}

/** Franja del inicio para avisos que no son emergencia. Se llega con ▲ desde el dock y OK abre la lectura. */
export function NoticeBanner({ notice, more, buttonRef, onOpen, onKeyDown }: {
  notice: MdmNotice;
  /** Avisos que quedan detrás de este. */
  more: number;
  buttonRef: Ref<HTMLButtonElement>;
  onOpen: () => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
}) {
  const tone = TONE[notice.severity];
  const important = notice.severity === 'importante';
  const teaser = notice.body.split('\n')[0];
  return (
    <button
      ref={buttonRef}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      aria-label={`${noticeLabel(notice)}: ${notice.title}. Presioná OK para leerlo.`}
      className={`nex-notice-in group mx-16 mt-6 flex items-center space-x-5 rounded-2xl border px-6 text-left outline-none focus:ring-4 ${
        important
          ? 'py-4 border-amber-400/50 bg-amber-400/10 focus:border-amber-200 focus:bg-amber-400/25 focus:ring-amber-300/50'
          : 'py-3 border-white/10 bg-white/5 focus:border-white/70 focus:bg-white/15 focus:ring-sky-300/40'
      }`}
    >
      <span className={`flex-none rounded-full border flex items-center justify-center ${important ? 'h-16 w-16' : 'h-12 w-12'} ${tone.icon}`}>
        <CategoryIcon category={notice.category} className={important ? 'h-9 w-9' : 'h-7 w-7'} />
      </span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className={`text-lg font-semibold uppercase tracking-[0.2em] ${tone.accent}`}>{noticeLabel(notice)}</span>
        <span className={`${important ? 'text-3xl' : 'text-2xl'} font-semibold truncate`}>{notice.title}</span>
        {important && teaser && <span className="text-xl text-white/65 truncate">{teaser}</span>}
      </span>
      {more > 0 && <span className="flex-none rounded-full bg-white/10 px-4 py-1 text-xl text-white/70">+{more}</span>}
      <span className="flex-none text-xl text-white/50 group-focus:hidden">▲ Leer</span>
      <span className="flex-none hidden group-focus:block rounded-full bg-white px-5 py-1 text-xl font-semibold text-[#05070c]">OK · Leer</span>
    </button>
  );
}
