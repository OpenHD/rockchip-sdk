import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, CircleCheck, Info, LoaderCircle, RefreshCw, Search, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { useLayer } from './layer';
import { TONE_DOT, TONE_TEXT, type Tone } from './tones';
import { ToastContext, type ToastTone } from './toast';

/**
 * Primitivas del panel. Los colores salen de los tokens de admin.css (text-fg, bg-surface, border-line…):
 * el mismo marcado sirve para el tema oscuro y el claro.
 */

export const inputClass =
  'nx-input w-full rounded-lg border border-line-strong bg-field px-3 py-2 text-fg placeholder:text-fg-4 shadow-card ' +
  'outline-none transition focus:border-focus focus:ring-[3px] focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60';

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-card',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-fill shadow-card',
  ghost: 'text-fg-2 hover:bg-fill-2 hover:text-fg',
  danger: 'bg-danger text-white hover:bg-danger-hover shadow-card',
  success: 'bg-ok-strong text-white hover:brightness-110 shadow-card',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: LucideIcon; loading?: boolean }) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${
        size === 'sm' ? 'nx-btn-sm' : 'nx-btn-md'
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <LoaderCircle className={`${iconSize} animate-spin`} aria-hidden /> : Icon && <Icon className={iconSize} aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  tone = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; tone?: 'default' | 'danger' | 'success' }) {
  const tones = {
    default: 'text-fg-3 hover:text-fg hover:bg-fill-2',
    danger: 'text-danger hover:bg-danger-soft',
    success: 'text-ok hover:bg-ok-soft',
  };
  return (
    <button
      type="button"
      {...props}
      title={label}
      aria-label={label}
      className={`nx-icon-btn inline-flex shrink-0 items-center justify-center rounded-lg transition disabled:pointer-events-none disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Contenedores
// ---------------------------------------------------------------------------

export function Card({
  title,
  description,
  action,
  children,
  className = '',
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  const hasHeader = Boolean(title || action);
  return (
    <section className={`rounded-xl border border-line bg-surface shadow-card ${className}`}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold leading-6 text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-5 text-fg-3">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-4 sm:p-5' : hasHeader ? 'mt-4 border-t border-line' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 sm:mb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-[22px] font-semibold leading-8 tracking-tight text-fg sm:text-2xl">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="mt-1 max-w-3xl text-sm leading-5 text-fg-3">{subtitle}</p>}
    </div>
  );
}

/** Título de sección dentro de una tarjeta o del panel lateral. */
export function SectionTitle({ children, id, action, className = '' }: { children: ReactNode; id?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`mb-2 flex items-center justify-between gap-3 ${className}`}>
      <h3 id={id} className="text-xs font-semibold uppercase tracking-wider text-fg-4">{children}</h3>
      {action}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-fg-2">{label}</span>
      {children}
      {hint && <span className="text-xs leading-relaxed text-fg-4">{hint}</span>}
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className = '',
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Nombre accesible; si falta se usa el placeholder. */
  label?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-4" aria-hidden />
      <input
        type="search"
        className={`${inputClass} pl-9 ${value ? 'pr-9' : ''} [&::-webkit-search-cancel-button]:hidden`}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Borrar búsqueda"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-4 transition hover:bg-fill-2 hover:text-fg"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

export type { Tone };

const BADGE: Record<Tone, string> = {
  neutral: 'bg-fill-2 text-fg-2 ring-line',
  success: 'bg-ok-soft text-ok ring-ok',
  warning: 'bg-warn-soft text-warn ring-warn',
  danger: 'bg-danger-soft text-danger ring-danger',
  info: 'bg-accent-soft text-accent ring-accent',
};
export function Badge({ tone = 'neutral', icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[tone]}`}>
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

export function StatusDot({ online }: { online: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
      {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-50" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${online ? 'bg-ok' : 'bg-neutral'}`} />
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? 'bg-accent' : 'bg-fill-3'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

/** Casilla nativa con un área de toque cómoda. `indeterminate` = marcada solo en parte (seleccionar todo). */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  className = '',
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <label className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-fill-2 ${className}`} onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded"
        style={{ accentColor: 'var(--accent-solid)' }}
      />
    </label>
  );
}

export function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition ${
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-surface text-fg-3 hover:bg-fill hover:text-fg'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? 'bg-accent-soft' : 'bg-fill-2 text-fg-3'}`}>{count}</span>
      )}
    </button>
  );
}

/** Selector de una opción entre pocas (2-4), tipo interruptor. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
}: {
  options: { id: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`inline-flex rounded-lg bg-fill-2 p-0.5 ${className}`}>
      {options.map(({ id, label: text, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`flex h-7 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition ${
            value === id ? 'bg-surface text-fg shadow-card ring-1 ring-line' : 'text-fg-3 hover:text-fg'
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
          {text}
        </button>
      ))}
    </div>
  );
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Marca la pestaña con un punto (hay algo para mirar adentro). */
  dot?: Tone;
}

/** Pestañas con subrayado. Flechas izquierda/derecha para moverse con el teclado. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
  className = '',
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** Prefijo de los id: la pestaña es `${idBase}-tab-${id}` y su panel `${idBase}-panel-${id}`. */
  idBase: string;
  className?: string;
}) {
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = tabs[(tabs.findIndex((t) => t.id === value) + dir + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`${idBase}-tab-${next.id}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={`scroll-x flex gap-5 border-b border-line ${className}`}>
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm font-medium transition ${
              selected ? 'border-focus text-fg' : 'border-transparent text-fg-3 hover:text-fg'
            }`}
          >
            {t.label}
            {t.dot && <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[t.dot]}`} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

const CALLOUT: Record<Tone, string> = {
  neutral: 'border-line bg-fill',
  success: 'border-ok bg-ok-soft',
  warning: 'border-warn bg-warn-soft',
  danger: 'border-danger bg-danger-soft',
  info: 'border-accent bg-accent-soft',
};

/** Aviso en línea: explica algo o avisa de un riesgo sin frenar el trabajo. */
export function Callout({
  tone = 'info',
  icon: Icon,
  title,
  children,
  action,
  className = '',
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm ${CALLOUT[tone]} ${className}`}>
      {Icon && <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE_TEXT[tone]}`} aria-hidden />}
      <div className="min-w-0 flex-1">
        {title && <div className={`font-medium ${tone === 'neutral' ? 'text-fg' : TONE_TEXT[tone]}`}>{title}</div>}
        {children && <div className={`text-fg-2 ${title ? 'mt-0.5' : ''}`}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fill-2 text-fg-3 ring-1 ring-inset ring-line">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <div className="text-sm font-semibold text-fg">{title}</div>
        {children && <div className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-fg-3">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-fill-2 ${className}`} aria-hidden />;
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="my-2 flex items-start gap-2 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{error}</span>
    </p>
  );
}

/** No se pudo cargar una pantalla: dice qué pasó y deja reintentar sin recargar todo el panel. */
export function ErrorState({ title = 'No pudimos cargar los datos', error, onRetry }: { title?: string; error: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-danger-soft text-danger ring-1 ring-inset ring-danger">
        <TriangleAlert className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <div className="text-sm font-semibold text-fg">{title}</div>
        <div className="mx-auto mt-1 max-w-sm break-words text-sm leading-relaxed text-fg-3">{error}</div>
      </div>
      {onRetry && <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

/**
 * Barra flotante "tenés cambios sin guardar": en formularios largos el botón de Guardar del encabezado queda lejos,
 * sobre todo en el celular. Se apoya arriba de la barra inferior del celular y al costado del menú en escritorio.
 */
export function SaveBar({ show, busy, disabled, onSave, hint }: { show: boolean; busy?: boolean; disabled?: boolean; onSave: () => void; hint?: string }) {
  if (!show) return null;
  return (
    <div
      role="region"
      aria-label="Cambios sin guardar"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-20 flex justify-center px-3 pb-3 lg:bottom-0 lg:left-[264px] lg:pb-5"
    >
      <div className="pointer-events-auto flex w-full max-w-md animate-[nexIn_.18s_ease-out] items-center gap-3 rounded-xl border border-line-strong bg-overlay py-2 pl-4 pr-2 shadow-pop">
        <span className="h-2 w-2 shrink-0 rounded-full bg-warn" aria-hidden />
        <span className="min-w-0 flex-1 text-sm text-fg-2">{hint ?? 'Tenés cambios sin guardar'}</span>
        <Button size="sm" loading={busy} disabled={disabled} onClick={onSave}>Guardar</Button>
      </div>
    </div>
  );
}

/** Pie de un listado paginado: "1–50 de 320" y botones anterior / siguiente. */
export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPage,
  noun = 'equipos',
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
  noun?: string;
}) {
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 sm:px-5">
      <p className="text-[13px] tabular-nums text-fg-3" aria-live="polite">
        {total === 0 ? `0 ${noun}` : <><span className="font-medium text-fg-2">{from}–{to}</span> de {total} {noun}</>}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)} />
          <span className="px-1 text-[13px] tabular-nums text-fg-3">{page} / {pageCount}</span>
          <IconButton icon={ChevronRight} label="Página siguiente" disabled={page >= pageCount} onClick={() => onPage(page + 1)} />
        </div>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Capas: modal y panel lateral
// ---------------------------------------------------------------------------

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useLayer(ref, onClose);
  return (
    <div className="fixed inset-0 z-50 flex animate-[nexFade_.15s_ease-out] items-end justify-center bg-scrim sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full ${width} animate-[nexSheet_.2s_ease-out] flex-col rounded-t-2xl border border-line bg-overlay shadow-pop outline-none sm:max-h-[86dvh] sm:animate-[nexIn_.18s_ease-out] sm:rounded-2xl`}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-fill-3 sm:hidden" aria-hidden />
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-3 sm:pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold leading-6 text-fg">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-fg-3">{description}</p>}
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} className="-mr-2 -mt-1" />
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 pt-1 ${footer ? 'pb-4' : 'pb-5'}`}>{children}</div>
        {footer && (
          <footer className="pb-safe shrink-0 rounded-b-2xl border-t border-line bg-fill">
            <div className="flex flex-col-reverse gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-end">{footer}</div>
          </footer>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  header,
  footer,
  label,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Contenido fijo debajo del título (estado, pestañas…). */
  header?: ReactNode;
  /** Barra fija al pie (acciones principales). */
  footer?: ReactNode;
  /** Nombre accesible si el título no es texto. */
  label?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  useLayer(ref, onClose);
  return (
    <div className="fixed inset-0 z-40 flex animate-[nexFade_.15s_ease-out] justify-end bg-scrim" onMouseDown={onClose}>
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={label ? undefined : titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[520px] animate-[nexSlide_.2s_ease-out] flex-col border-l border-line bg-surface shadow-pop outline-none"
      >
        <header className="shrink-0 border-b border-line">
          <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-lg font-semibold leading-6 text-fg">{title}</h2>
              {subtitle && <div className="mt-1 text-xs text-fg-4">{subtitle}</div>}
            </div>
            <IconButton icon={X} label="Cerrar" onClick={onClose} className="-mr-1.5 -mt-1" />
          </div>
          {header}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer && <footer className="pb-safe shrink-0 border-t border-line bg-surface-2"><div className="px-4 py-3 sm:px-6">{footer}</div></footer>}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menú contextual
// ---------------------------------------------------------------------------

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

export function Menu({
  trigger,
  items,
  placement = 'bottom',
  align = 'right',
}: {
  /** Recibe la función que abre o cierra el menú y si está abierto (para aria-expanded). */
  trigger: (toggle: () => void, open: boolean) => ReactNode;
  items: MenuItem[];
  placement?: 'bottom' | 'top';
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      opener?.focus();
    };
    window.addEventListener('mousedown', onDown);
    // En captura: Escape cierra el menú antes que la capa (modal o panel) que lo contiene.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!dir && e.key !== 'Home' && e.key !== 'End' && e.key !== 'Tab') return;
    if (e.key === 'Tab') return setOpen(false);
    e.preventDefault();
    const els = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = els.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? els.length - 1 : (at + dir + els.length) % els.length;
    els[next]?.focus();
  };

  return (
    <div ref={ref} className="relative">
      {trigger(() => setOpen((o) => !o), open)}
      {open && (
        <div
          ref={list}
          role="menu"
          onKeyDown={onKeyDown}
          className={`absolute z-30 w-60 animate-[nexIn_.12s_ease-out] rounded-xl border border-line bg-overlay p-1 shadow-pop ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${placement === 'top' ? 'bottom-full mb-2' : 'mt-1'}`}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`flex min-h-[2.25rem] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                it.danger ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft' : 'text-fg-2 hover:bg-fill-2 hover:text-fg focus-visible:bg-fill-2'
              }`}
            >
              <it.icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const TOAST_ICON = { success: CircleCheck, error: TriangleAlert, info: Info };
const TOAST_TONE = { success: 'text-ok', error: 'text-danger', info: 'text-accent' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { id, message, tone }]);
      // Los errores quedan más tiempo: hay que llegar a leerlos.
      setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:w-[22rem] sm:items-stretch lg:bottom-5"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => {
          const Icon = TOAST_ICON[t.tone];
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-[nexIn_.18s_ease-out] items-start gap-3 rounded-xl border border-line-strong bg-overlay py-3 pl-4 pr-2 text-sm shadow-pop">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TOAST_TONE[t.tone]}`} aria-hidden />
              <span className="min-w-0 flex-1 break-words text-fg">{t.message}</span>
              <button type="button" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)} className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-4 transition hover:bg-fill-2 hover:text-fg">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
