import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { CircleCheck, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { ToastContext, type ToastTone } from './toast';

export const inputClass =
  'w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 ' +
  'outline-none transition focus:border-indigo-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-indigo-500/20';

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-sm shadow-indigo-500/20',
  secondary: 'bg-white/[0.06] text-zinc-100 hover:bg-white/[0.1] border border-white/10',
  ghost: 'text-zinc-300 hover:bg-white/[0.06] hover:text-white',
  danger: 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-sm shadow-rose-500/20',
  success: 'bg-emerald-500/90 text-white hover:bg-emerald-500',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: LucideIcon }) {
  const sizing = size === 'sm' ? 'h-8 px-3 text-xs gap-1.5' : 'h-9 px-4 text-sm gap-2';
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${sizing} ${VARIANTS[variant]} ${className}`}
    >
      {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />}
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
    default: 'text-zinc-400 hover:text-white hover:bg-white/[0.08]',
    danger: 'text-rose-300 hover:text-rose-200 hover:bg-rose-500/15',
    success: 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/15',
  };
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-40 ${tones[tone]} ${className}`}
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
  return (
    <section className={`rounded-2xl border border-white/[0.07] bg-white/[0.025] ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-zinc-100">{title}</h2>}
            {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : 'pt-3'}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const BADGE: Record<Tone, string> = {
  neutral: 'bg-white/[0.06] text-zinc-300 ring-white/10',
  success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
  warning: 'bg-amber-500/10 text-amber-300 ring-amber-500/25',
  danger: 'bg-rose-500/10 text-rose-300 ring-rose-500/25',
  info: 'bg-indigo-500/10 text-indigo-300 ring-indigo-500/25',
};

export function Badge({ tone = 'neutral', icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[tone]}`}>
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

export function StatusDot({ online }: { online: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
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
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-indigo-500' : 'bg-white/15'
      }`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-200' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? 'bg-indigo-400/25' : 'bg-white/[0.08]'}`}>{count}</span>
      )}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-zinc-400">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="text-sm font-medium text-zinc-200">{title}</div>
      {children && <div className="max-w-sm text-sm text-zinc-500">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="my-2 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
      <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
      {error}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Capas: modal y panel lateral
// ---------------------------------------------------------------------------

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

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
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full ${width} animate-[nexIn_.18s_ease-out] rounded-t-2xl border border-white/10 bg-[#12141c] shadow-2xl sm:rounded-2xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} />
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md animate-[nexSlide_.2s_ease-out] flex-col border-l border-white/10 bg-[#0f1118] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">{title}</div>
            {subtitle && <div className="mt-1 text-xs text-zinc-500">{subtitle}</div>}
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
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

export function Menu({ trigger, items }: { trigger: (open: () => void) => ReactNode; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-52 animate-[nexIn_.12s_ease-out] overflow-hidden rounded-xl border border-white/10 bg-[#171a24] p-1 shadow-xl">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                it.danger ? 'text-rose-300 hover:bg-rose-500/10' : 'text-zinc-200 hover:bg-white/[0.06]'
              }`}
            >
              <it.icon className="h-4 w-4 opacity-80" aria-hidden />
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
const TOAST_TONE = {
  success: 'border-emerald-500/30 text-emerald-200',
  error: 'border-rose-500/30 text-rose-200',
  info: 'border-indigo-500/30 text-indigo-200',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
        {items.map((t) => {
          const Icon = TOAST_ICON[t.tone];
          return (
            <div key={t.id} className={`pointer-events-auto flex animate-[nexIn_.18s_ease-out] items-start gap-3 rounded-xl border bg-[#151822]/95 px-4 py-3 text-sm shadow-xl backdrop-blur ${TOAST_TONE[t.tone]}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="text-zinc-100">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
