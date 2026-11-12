import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { BACK_KEYS, ICON, ROW, TONE, noticeOpen, type Tone } from './tvStyle';
import { moveFocus } from './wifi';

/**
 * Componentes de las pantallas de Ajustes y Wi-Fi de NEX TV. Pensados para ver a 3 metros y manejar con el
 * control remoto: filas grandes que el foco enciende enteras y un marco común con la ayuda de las teclas.
 */

export function Icon({ d, className }: { d: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function IconBadge({ icon, tone, small }: { icon: string; tone: Tone; small?: boolean }) {
  return (
    <span className={`flex-none rounded-full border flex items-center justify-center mr-6 ${small ? 'h-14 w-14' : 'h-20 w-20'} ${TONE[tone]}`}>
      <Icon d={icon} className={small ? 'h-7 w-7' : 'h-10 w-10'} />
    </span>
  );
}

/** Texto "OK · acción" que aparece en la fila enfocada; sin foco queda la pista en gris. */
export function OkHint({ idle, action }: { idle: string; action: string }) {
  return (
    <>
      <span className="flex-none flex items-center text-2xl text-white/45 group-focus:hidden">
        <span>{idle}</span>
        <Icon d={ICON.chevron} className="h-7 w-7 ml-2" />
      </span>
      <span className="flex-none hidden group-focus:block rounded-full bg-white px-5 py-1 text-2xl font-semibold text-[#05070c]">
        OK · {action}
      </span>
    </>
  );
}

export function ActionRow({ navKey, index, icon, tone = 'sky', compact, title, detail, idle, action, onSelect, children }: {
  navKey: string;
  /** Solo la primera fila de la pantalla lleva 0: ahí vuelve el foco si el equipo lo pierde. */
  index?: number;
  icon: string;
  tone?: Tone;
  /** Fila más baja, para listas largas. */
  compact?: boolean;
  title: string;
  detail: string;
  idle: string;
  action: string;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <button data-nav data-key={navKey} data-index={index} onClick={onSelect} className={`${ROW} ${compact ? 'py-4' : 'py-7'} border-white/10 bg-white/5`}>
      <IconBadge icon={icon} tone={tone} small={compact} />
      <span className="flex-1 min-w-0 flex flex-col mr-6">
        <span className="text-3xl font-semibold truncate">{title}</span>
        <span className={`${compact ? 'text-xl' : 'text-2xl'} text-white/60 truncate`}>{detail}</span>
      </span>
      {children}
      <OkHint idle={idle} action={action} />
    </button>
  );
}

/** Barras de señal del Wi-Fi (0 a 4). */
export function SignalBars({ level }: { level: number }) {
  return (
    <span className="flex-none flex items-end h-8 mr-6" aria-label={`Señal ${level} de 4`}>
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={`w-2 rounded-sm ${bar > 1 ? 'ml-1.5' : ''} ${bar <= level ? 'bg-emerald-300' : 'bg-white/20'}`}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </span>
  );
}

export function SectionLabel({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <h2 className={`text-lg uppercase tracking-[0.25em] mb-3 ${muted ? 'text-white/40' : 'text-sky-300'}`}>{children}</h2>;
}

export function InfoRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center py-5 border-t border-white/10">
      <Icon d={icon} className="flex-none h-7 w-7 text-white/40 mr-4" />
      <span className="flex-none text-2xl text-white/55 mr-6">{label}</span>
      <span className="flex-1 min-w-0 text-2xl font-medium text-right truncate">{children}</span>
    </div>
  );
}

export function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-3 w-3 rounded-full mr-3 ${ok ? 'bg-emerald-300' : 'bg-amber-300'}`} aria-hidden />;
}

/** Tarjeta de la columna derecha: solo informa, no se enfoca. */
export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl border border-white/10 bg-white/5 px-8 pt-7 pb-4">{children}</div>;
}

function KeyHint({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <span className="flex items-center">
      <span className="rounded-lg border border-white/25 px-3 text-lg leading-8 text-white/75 mr-3">{keys}</span>
      <span>{children}</span>
    </span>
  );
}

/**
 * Marco común: encabezado, contenido a la izquierda, tarjetas a la derecha y ayuda del control.
 * Las flechas recorren los elementos con `data-nav` en el orden en que aparecen: ▲▼ cambian de fila y ◀▶ se
 * mueven entre los que comparten `data-row`. "Atrás" llama a `onBack`.
 */
export function Shell({ eyebrow, title, backLabel, okLabel = 'Elegir', focusKey, focusToken, dim, overlay, brand, clock, aside, onBack, children }: {
  eyebrow?: string;
  title: string;
  backLabel: string;
  okLabel?: string;
  /** `data-key` del elemento que toma el foco al abrir. */
  focusKey: string;
  /** Al cambiar, el foco vuelve a `focusKey` (por ejemplo, al pasar de la lista al formulario). */
  focusToken?: string;
  dim?: boolean;
  /** Se muestra encima de otra pantalla (Wi-Fi desde la vinculación o el bloqueo). */
  overlay?: boolean;
  brand?: ReactNode;
  clock?: string;
  aside: ReactNode;
  onBack: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    (node?.querySelector<HTMLElement>(`[data-key="${focusKey}"]:not(:disabled)`) ?? node?.querySelector<HTMLElement>('[data-nav]:not(:disabled)'))?.focus();
  }, [focusKey, focusToken]);

  // Si lo que tenía el foco desapareció (una red que ya no está, un botón que se desactivó), el control no queda en el aire.
  useEffect(() => {
    const node = root.current;
    if (!node || node.contains(document.activeElement) || noticeOpen()) return;
    (node.querySelector<HTMLElement>(`[data-key="${focusKey}"]:not(:disabled)`) ?? node.querySelector<HTMLElement>('[data-nav]:not(:disabled)'))?.focus();
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Retroceso dentro de un campo corrige el texto.
      if (!BACK_KEYS.has(e.key) || (e.key === 'Backspace' && e.target instanceof HTMLInputElement)) return;
      if (noticeOpen()) return;
      e.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const onKeyNav = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // OK mantenido apretado no repite la acción (un interruptor no queda prendiendo y apagando).
    if (e.key === 'Enter' && e.repeat) e.preventDefault();
    if (!e.key.startsWith('Arrow')) return;
    // Las flechas son de esta pantalla: no las recibe la que quedó detrás.
    e.stopPropagation();
    const field = e.target instanceof HTMLInputElement ? e.target : null;
    const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    if (field && horizontal) {
      // Dentro de un campo ◀▶ mueven el cursor; recién en el borde del texto pasan al elemento de al lado.
      const edge = e.key === 'ArrowRight' ? field.value.length : 0;
      if (field.selectionStart !== edge || field.selectionEnd !== edge) return;
    }
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-nav]:not(:disabled)') ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = moveFocus(items.map((el, i) => el.dataset.row ?? `#${i}`), current, e.key);
    if (field && horizontal && next === current) return;
    // El WebView no mueve el foco por su cuenta.
    e.preventDefault();
    items[next]?.focus();
  };

  return (
    <div
      ref={root}
      onKeyDown={onKeyNav}
      className={`w-screen h-screen text-white text-left flex flex-col select-none px-16 pt-10 pb-8 overflow-hidden ${overlay ? 'fixed top-0 left-0 z-50' : ''}`}
      style={{
        background: dim
          ? '#05070c'
          : 'radial-gradient(ellipse at 12% 0%, rgba(56,189,248,.14), rgba(5,7,12,0) 60%), linear-gradient(#0b1020, #05070c)',
      }}
    >
      <header className="flex-none flex items-center justify-between">
        <div className="flex items-center min-w-0">
          <button
            data-nav
            data-key="back"
            onClick={onBack}
            aria-label={backLabel}
            className="flex-none h-16 w-16 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mr-6 outline-none focus:border-white/70 focus:bg-white/20 focus:ring-4 focus:ring-sky-300/40"
          >
            <Icon d={ICON.back} className="h-8 w-8" />
          </button>
          <div className="min-w-0">
            {eyebrow && <div className="text-sky-300 text-lg uppercase tracking-[0.25em]">{eyebrow}</div>}
            <h1 className="text-5xl font-semibold truncate">{title}</h1>
          </div>
        </div>
        <div className="flex-none flex items-center">
          {brand}
          {clock && <span className="text-3xl font-light tabular-nums ml-8">{clock}</span>}
        </div>
      </header>

      <div className="nex-notice-in flex-1 min-h-0 flex mt-10">
        {/* El relleno deja lugar al borde de foco de las filas, que si no quedaría cortado al desplazar la lista. */}
        <main className="flex-1 min-w-0 overflow-y-auto p-2 -ml-2 mr-10">{children}</main>
        <aside className="w-[44rem] flex-none pt-2">{aside}</aside>
      </div>

      <footer className="flex-none flex items-center pt-4 text-xl text-white/50">
        <KeyHint keys="▲ ▼">Moverte</KeyHint>
        <span className="mx-6 text-white/20">·</span>
        <KeyHint keys="OK">{okLabel}</KeyHint>
        <span className="mx-6 text-white/20">·</span>
        <KeyHint keys="Atrás">{backLabel}</KeyHint>
      </footer>
    </div>
  );
}
