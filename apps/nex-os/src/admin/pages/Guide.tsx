import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Activity,
  AppWindow,
  BookOpen,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleHelp,
  ClipboardCheck,
  Copy,
  Download,
  HeartPulse,
  KeyRound,
  Link2,
  ListChecks,
  Lock,
  MapPin,
  Megaphone,
  Package,
  Printer,
  RefreshCw,
  RotateCcw,
  SearchX,
  ShieldAlert,
  Terminal,
  TriangleAlert,
  Tv,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Company } from '../api';
import { APK_PATH } from '../DownloadApk';
import { copyText } from '../format';
import { FAQ, GLOSSARY, GUIDE_VERSION, KIT_PATH, PROBLEMS, matches, type Problem } from '../guideData';
import { useToast } from '../toast';
import { Badge, Button, Callout, Card, EmptyState, PageHeader, SearchInput, inputClass } from '../ui';

/**
 * Guía técnica: cómo instalar, vincular, operar y resolver problemas de los TV box con NEX TV.
 * Para técnicos de calle y soporte del ISP: lenguaje simple, por tarea, se lee en el celular y se imprime.
 * Nunca incluye el PIN técnico, claves ni direcciones internas.
 */

// ---------------------------------------------------------------------------
// Índice
// ---------------------------------------------------------------------------

type SectionId =
  | 'inicio' | 'necesitas' | 'preparar' | 'instalar' | 'vincular' | 'cliente'
  | 'acceso' | 'actualizar'
  | 'servicio' | 'apps' | 'comunicados' | 'zonas' | 'salud' | 'red' | 'seguridad'
  | 'problemas' | 'faq' | 'glosario';

interface SectionMeta {
  id: SectionId;
  title: string;
  icon: LucideIcon;
}

const TOC: { group: string; items: SectionMeta[] }[] = [
  {
    group: 'Empezar',
    items: [
      { id: 'inicio', title: 'Lista de instalación', icon: ListChecks },
      { id: 'necesitas', title: 'Qué necesitás', icon: Package },
    ],
  },
  {
    group: 'Instalar',
    items: [
      { id: 'preparar', title: 'Preparar el box y conectarte', icon: Terminal },
      { id: 'instalar', title: 'Instalar paso a paso', icon: Wrench },
      { id: 'vincular', title: 'Vincular con tu empresa', icon: Link2 },
      { id: 'cliente', title: 'En la casa del cliente', icon: Tv },
    ],
  },
  {
    group: 'Mantener',
    items: [
      { id: 'acceso', title: 'Volver a entrar (ADB apagado)', icon: KeyRound },
      { id: 'actualizar', title: 'Actualizaciones y versión', icon: RefreshCw },
    ],
  },
  {
    group: 'Operar desde el panel',
    items: [
      { id: 'servicio', title: 'Bloqueos, pagos y códigos', icon: Lock },
      { id: 'apps', title: 'Apps del operador', icon: AppWindow },
      { id: 'comunicados', title: 'Comunicados', icon: Megaphone },
      { id: 'zonas', title: 'Zonas y caídas', icon: MapPin },
      { id: 'salud', title: 'Salud del equipo', icon: HeartPulse },
      { id: 'red', title: 'Diagnóstico de red', icon: Activity },
      { id: 'seguridad', title: 'Equipo posiblemente infectado', icon: ShieldAlert },
    ],
  },
  {
    group: 'Resolver',
    items: [
      { id: 'problemas', title: 'Problemas frecuentes', icon: TriangleAlert },
      { id: 'faq', title: 'Preguntas frecuentes', icon: CircleHelp },
      { id: 'glosario', title: 'Glosario', icon: BookOpen },
    ],
  },
];
const ALL_SECTIONS = TOC.flatMap((g) => g.items);
const META = Object.fromEntries(ALL_SECTIONS.map((s) => [s.id, s])) as Record<SectionId, SectionMeta>;
/** Secciones cuyo contenido son listas de datos: el buscador filtra sus filas, no la sección entera. */
const DATA_SECTIONS: SectionId[] = ['problemas', 'faq', 'glosario'];

// ---------------------------------------------------------------------------
// Piezas de contenido
// ---------------------------------------------------------------------------

/** Sección plegable. En papel y mientras se busca siempre va abierta. */
function Section({ id, lead, hidden, open, onToggle, children }: { id: SectionId; lead?: ReactNode; hidden?: boolean; open: boolean; onToggle: () => void; children: ReactNode }) {
  const { title, icon: Icon } = META[id];
  return (
    <section id={`guia-${id}`} data-guide-section={id} hidden={hidden} className="scroll-mt-[4.5rem] lg:scroll-mt-6 print:mt-6">
      <div className="rounded-xl border border-line bg-surface shadow-card print:border-0 print:shadow-none">
        <header className={`relative flex items-start gap-3 px-4 py-4 sm:px-6 print:break-after-avoid print:border-b print:px-0 print:py-2 ${open ? 'border-b border-line' : 'border-line'}`}>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent print:hidden" aria-hidden>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-7 tracking-tight text-fg">
              {/* El botón se estira sobre todo el encabezado: se toca en cualquier parte. */}
              <button type="button" id={`guia-${id}-t`} aria-expanded={open} aria-controls={`guia-${id}-c`} onClick={onToggle} className="rounded text-left after:absolute after:inset-0 after:rounded-xl after:content-['']">
                {title}
              </button>
            </h2>
            {lead && <p className={`mt-0.5 text-sm leading-6 text-fg-3 print:block ${open ? '' : 'hidden sm:block'}`}>{lead}</p>}
          </div>
          <ChevronDown data-noprint className={`mt-1.5 h-4 w-4 shrink-0 text-fg-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </header>
        <div id={`guia-${id}-c`} role="region" aria-labelledby={`guia-${id}-t`} className={`flex-col gap-4 px-4 py-4 text-[15px] leading-7 text-fg-2 sm:px-6 sm:py-5 print:flex print:px-0 print:py-2 ${open ? 'flex' : 'hidden'}`}>
          {children}
        </div>
      </div>
    </section>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 text-[15px] font-semibold leading-6 text-fg print:break-after-avoid">{children}</h3>;
}

/** Lista numerada de pasos, con el número bien visible. */
function Steps({ children, start = 1 }: { children: ReactNode; start?: number }) {
  return (
    <ol start={start} style={{ counterReset: `paso ${start - 1}` }} className="flex flex-col gap-3">
      {children}
    </ol>
  );
}

function Step({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return (
    <li className="print-keep relative pl-10 [counter-increment:paso] before:absolute before:left-0 before:top-0.5 before:flex before:h-7 before:w-7 before:items-center before:justify-center before:rounded-full before:bg-fill-2 before:text-[13px] before:font-semibold before:text-fg before:ring-1 before:ring-inset before:ring-line before:content-[counter(paso)]">
      {title && <div className="font-medium text-fg">{title}</div>}
      {children && (title ? <div className="mt-1 flex flex-col gap-2">{children}</div> : <div>{children}</div>)}
    </li>
  );
}

function Bullets({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-fg-4">{children}</ul>;
}

/** Recorrido por un menú: Ajustes → Acceso técnico → … */
function Path({ steps }: { steps: string[] }) {
  return (
    <span className="font-medium text-fg">
      {steps.map((s, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1 font-normal text-fg-4" aria-hidden>→</span>}
          {i > 0 && <span className="sr-only">, después </span>}
          {s}
        </span>
      ))}
    </span>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="break-words rounded bg-fill-2 px-1 py-0.5 font-mono text-[0.86em] text-fg">{children}</code>;
}

/** Comando para copiar y pegar en la terminal. */
function Cmd({ children, label }: { children: string; label?: string }) {
  const toast = useToast();
  const copy = async () => toast.show((await copyText(children)) ? 'Comando copiado' : 'No se pudo copiar', 'info');
  return (
    <div className="print-keep flex items-stretch overflow-hidden rounded-lg border border-line bg-inset">
      <pre className="scroll-x min-w-0 flex-1 px-3 py-2.5 font-mono text-[13px] leading-6 text-fg print:whitespace-pre-wrap print:break-all" tabIndex={0} aria-label={label ?? 'Comando'}>{children}</pre>
      <button type="button" data-noprint onClick={copy} aria-label={`Copiar: ${label ?? children}`} title="Copiar" className="flex w-11 shrink-0 items-center justify-center border-l border-line text-fg-3 transition hover:bg-fill-2 hover:text-fg">
        <Copy className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/** Captura de la pantalla del TV. Siempre oscura, como se ve en el televisor. */
function Shot({ file, alt, caption }: { file: string; alt: string; caption: ReactNode }) {
  return (
    <figure className="print-keep overflow-hidden rounded-lg border border-line bg-inset">
      <img src={`/docs/tecnicos/${file}.webp`} alt={alt} width={1120} height={630} decoding="async" className="block h-auto w-full bg-[#06080d]" />
      <figcaption className="border-t border-line px-3 py-2 text-[13px] leading-5 text-fg-3">{caption}</figcaption>
    </figure>
  );
}

function Shots({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">{children}</div>;
}

/** Tabla. En el celular cada fila se apila como una ficha, con el nombre de la columna arriba de cada dato. */
function Table({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption: string }) {
  const cell = 'block py-0.5 sm:table-cell sm:py-2.5 sm:pr-4';
  return (
    <table className="w-full border-collapse text-left text-sm leading-6">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only sm:not-sr-only sm:table-header-group">
        <tr className="border-b border-line-strong">
          {head.map((h, i) => (
            <th key={i} scope="col" className="py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-fg-4 last:pr-0">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="print-keep block border-b border-line py-2.5 align-top first:pt-0 last:border-0 last:pb-0 sm:table-row sm:py-0">
            {r.map((c, j) =>
              j === 0 ? (
                <th key={j} scope="row" className={`${cell} font-medium text-fg`}>{c}</th>
              ) : (
                <td key={j} data-label={head[j]} className={`${cell} text-fg-2 before:mr-1.5 before:text-xs before:font-semibold before:uppercase before:tracking-wider before:text-fg-4 before:content-[attr(data-label)] last:pr-0 sm:before:hidden`}>{c}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Enlace a otra sección del panel de esta empresa. */
function PanelLink({ company, section, children }: { company: Company; section: string; children: ReactNode }) {
  return (
    <a href={`#/c/${company.id}/${section}`} className="font-medium text-accent underline decoration-[color:var(--accent-line)] underline-offset-2 hover:decoration-current">
      {children}
    </a>
  );
}

/** true si el archivo está publicado junto al panel (el panel puede salir antes que el kit). null = todavía no se sabe. */
function usePublished(path: string): boolean | null {
  const [state, setState] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(path, { method: 'HEAD', cache: 'no-store' })
      .then((r) => !cancelled && setState(r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')))
      .catch(() => !cancelled && setState(false));
    return () => {
      cancelled = true;
    };
  }, [path]);
  return state;
}

function DownloadRow({ path, name, title, detail }: { path: string; name: string; title: string; detail: string }) {
  const published = usePublished(path);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-fill px-3.5 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <div className="font-medium leading-6 text-fg">{title}</div>
        <div className="text-[13px] leading-5 text-fg-3">{detail}</div>
      </div>
      {published ? (
        <a href={path} download={name} data-noprint className="nx-btn-md inline-flex shrink-0 items-center justify-center rounded-lg bg-accent font-medium text-white shadow-card transition hover:bg-accent-hover">
          <Download className="h-4 w-4" aria-hidden />
          Descargar
        </a>
      ) : (
        <span data-noprint role="status" className="text-[13px] text-fg-4">{published === null ? 'Comprobando…' : 'Todavía no está publicado: pedíselo a NEX.'}</span>
      )}
      <span className="hidden font-mono text-xs text-fg-3 print:inline">{name}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista de control (se guarda en este navegador)
// ---------------------------------------------------------------------------

const CHECKLIST: { id: string; text: string; go: SectionId }[] = [
  { id: 'kit', text: 'Tengo la computadora con adb, el kit descomprimido y el firmware original a mano.', go: 'necesitas' },
  { id: 'adb', text: 'El box está en mi misma red, con la Depuración USB encendida, y sé su IP.', go: 'preparar' },
  { id: 'system', text: 'Paso 1: install-system terminó con "Listo" (NEX quedó en el sistema).', go: 'instalar' },
  { id: 'logo', text: 'Paso 2 (opcional): grabar-logo terminó con "grabada y verificada".', go: 'instalar' },
  { id: 'blindar', text: 'Paso 3: blindar-box terminó con "Listo" y "puerto 40000 cerrado".', go: 'instalar' },
  { id: 'box', text: 'Paso 4: install-box terminó con "Listo", todas las líneas con ✓ y el ADB apagado.', go: 'instalar' },
  { id: 'link', text: 'El box está vinculado: aparece en Equipos con el nombre del cliente.', go: 'vincular' },
  { id: 'entrega', text: 'En el domicilio: tiene red, la versión es la correcta y el cliente vio cómo se usa.', go: 'cliente' },
];
const CHECK_KEY = 'nex-guia-checklist';

function useChecklist() {
  const [done, setDone] = useState<string[]>(() => {
    try {
      const v: unknown = JSON.parse(localStorage.getItem(CHECK_KEY) ?? '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const save = (next: string[]) => {
    setDone(next);
    try {
      localStorage.setItem(CHECK_KEY, JSON.stringify(next));
    } catch {
      // Sin almacenamiento (modo privado): la lista dura hasta recargar.
    }
  };
  return {
    done,
    toggle: (id: string) => save(done.includes(id) ? done.filter((x) => x !== id) : [...done, id]),
    reset: () => save([]),
  };
}

// ---------------------------------------------------------------------------
// Problemas frecuentes
// ---------------------------------------------------------------------------

const AREAS: Problem['area'][] = ['Instalación', 'Vinculación', 'En la casa del cliente', 'Panel'];

function ProblemList({ items }: { items: Problem[] }) {
  return (
    <div className="flex flex-col gap-5">
      {AREAS.filter((a) => items.some((p) => p.area === a)).map((area) => (
        <div key={area}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-4">{area}</h3>
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="hidden grid-cols-[1fr_1fr_1.35fr] gap-4 border-b border-line bg-fill px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-fg-4 md:grid" aria-hidden>
              <span>Qué ves</span>
              <span>Por qué pasa</span>
              <span>Qué hacer</span>
            </div>
            <ul className="divide-y divide-line">
              {items.filter((p) => p.area === area).map((p) => (
                <li key={p.symptom} className="print-keep grid gap-x-4 gap-y-1.5 px-3.5 py-3 text-sm leading-6 md:grid-cols-[1fr_1fr_1.35fr]">
                  <p className="font-medium text-fg"><span className="sr-only">Qué ves: </span>{p.symptom}</p>
                  <p className="text-fg-3"><span className="font-medium text-fg-4 md:sr-only">Por qué: </span>{p.cause}</p>
                  <p className="text-fg-2"><span className="font-medium text-ok md:sr-only">Qué hacer: </span>{p.fix}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const IP_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/** Sección pedida en el enlace (#/c/<empresa>/guia?s=<sección>). */
function sectionFromHash(): SectionId | null {
  const s = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('s');
  return ALL_SECTIONS.find((x) => x.id === s)?.id ?? null;
}

export default function GuidePage({ company }: { company: Company }) {
  const [query, setQuery] = useState('');
  /** Secciones de texto que no coinciden con la búsqueda (se calculan leyendo su contenido en pantalla). */
  const [hiddenProse, setHiddenProse] = useState<SectionId[]>([]);
  const [active, setActive] = useState<SectionId>('inicio');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('3222');
  /** Secciones abiertas. En pantallas anchas arrancan todas abiertas; en el celular, solo la primera y la del enlace. */
  const [open, setOpen] = useState<SectionId[]>(() => {
    if (window.matchMedia('(min-width: 1280px)').matches) return ALL_SECTIONS.map((s) => s.id);
    const linked = sectionFromHash();
    return linked && linked !== 'inicio' ? ['inicio', linked] : ['inicio'];
  });
  const root = useRef<HTMLDivElement>(null);
  const checklist = useChecklist();

  const base = `#/c/${company.id}/guia`;
  const target = `${IP_RE.test(ip.trim()) ? ip.trim() : '<ip-del-box>'}:${/^\d{2,5}$/.test(port) ? port : '3222'}`;

  /** Salto directo, sin animación: la guía es larga y un desplazamiento suave tarda y marea. */
  const scrollTo = useCallback((id: SectionId | 'top', focus = true) => {
    const el = document.getElementById(id === 'top' ? 'guia-indice' : `guia-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    if (focus) el.querySelector<HTMLElement>('h2 button')?.focus({ preventScroll: true });
  }, []);

  /** Los enlaces del índice son reales (se pueden copiar o abrir en otra pestaña) y con un clic normal solo desplazan. */
  const go = (id: SectionId) => ({
    href: `${base}?s=${id}`,
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      window.history.replaceState(null, '', `${base}?s=${id}`);
      setOpen((o) => (o.includes(id) ? o : [...o, id]));
      // Después de que la sección se abra, para caer en el lugar correcto.
      requestAnimationFrame(() => scrollTo(id));
    },
  });

  // Enlace directo a una sección.
  useEffect(() => {
    const id = sectionFromHash();
    if (id) scrollTo(id, false);
  }, [scrollTo]);

  // Resalta en el índice la sección que se está leyendo.
  useEffect(() => {
    const sections = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-guide-section]') ?? []);
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set((e.target as HTMLElement).dataset.guideSection ?? '', e.isIntersecting));
        const first = sections.find((s) => seen.get(s.dataset.guideSection ?? ''));
        if (first) setActive(first.dataset.guideSection as SectionId);
      },
      { rootMargin: '-72px 0px -55% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // Al imprimir, tema claro (tinta) aunque el panel esté en oscuro.
  useEffect(() => {
    const html = document.documentElement;
    let previous: string | undefined;
    const before = () => {
      previous = html.dataset.theme;
      html.dataset.theme = 'light';
    };
    const after = () => {
      if (previous) html.dataset.theme = previous;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const search = (value: string) => {
    setQuery(value);
    const hidden: SectionId[] = [];
    root.current?.querySelectorAll<HTMLElement>('[data-guide-section]').forEach((el) => {
      const id = el.dataset.guideSection as SectionId;
      if (!DATA_SECTIONS.includes(id) && !matches(el.textContent ?? '', value)) hidden.push(id);
    });
    setHiddenProse(hidden);
  };

  const q = query.trim();
  const problems = useMemo(() => PROBLEMS.filter((p) => matches(`${p.area} ${p.symptom} ${p.cause} ${p.fix}`, q)), [q]);
  const faq = useMemo(() => FAQ.filter((f) => matches(`${f.q} ${f.a}`, q)), [q]);
  const glossary = useMemo(() => GLOSSARY.filter((g) => matches(`${g.term} ${g.def}`, q)), [q]);
  const isHidden = (id: SectionId) =>
    id === 'problemas' ? !problems.length : id === 'faq' ? !faq.length : id === 'glosario' ? !glossary.length : hiddenProse.includes(id);
  const visibleCount = ALL_SECTIONS.filter((s) => !isHidden(s.id)).length;
  const allOpen = open.length === ALL_SECTIONS.length;
  const toggle = (id: SectionId) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  /** Mientras se busca, lo que coincide se muestra abierto. */
  const sec = (id: SectionId) => ({ id, hidden: isHidden(id), open: q !== '' || open.includes(id), onToggle: () => toggle(id) });

  const toc = (compact: boolean) => (
    <nav aria-label="Contenido de la guía" className={compact ? 'grid gap-x-6 gap-y-4 sm:grid-cols-2' : 'flex flex-col gap-4'}>
      {TOC.map((g) => {
        const items = g.items.filter((s) => !isHidden(s.id));
        if (!items.length) return null;
        return (
          <div key={g.group} className="print-keep">
            <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-fg-4">{g.group}</div>
            <ul>
              {items.map((s) => {
                const current = !compact && active === s.id;
                return (
                  <li key={s.id}>
                    <a
                      {...go(s.id)}
                      aria-current={current ? 'location' : undefined}
                      className={`flex items-center gap-2 rounded-lg px-2 text-[13px] leading-5 transition ${compact ? 'min-h-10 py-2 sm:min-h-8 sm:py-1.5' : 'py-1.5'} ${
                        current ? 'bg-fill-2 font-medium text-fg' : 'text-fg-3 hover:bg-fill hover:text-fg'
                      }`}
                    >
                      <s.icon className={`h-3.5 w-3.5 shrink-0 ${current ? 'text-accent' : 'text-fg-4'}`} aria-hidden />
                      {s.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div ref={root}>
      <PageHeader
        title="Guía técnica"
        subtitle={`Cómo instalar, vincular, operar y resolver problemas de los TV box con NEX TV ${GUIDE_VERSION}. Pensada para leer en el celular, en el taller o en la casa del cliente.`}
        actions={<span data-noprint><Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimir / Guardar PDF</Button></span>}
      />

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_248px] xl:items-start xl:gap-8">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 xl:mx-0 print:max-w-none">
          <div id="guia-indice" className="scroll-mt-[4.5rem] lg:scroll-mt-6" data-noprint>
            <SearchInput value={query} onChange={search} placeholder="Buscar: ADB, código, bloqueado, Wi-Fi…" label="Buscar en la guía" />
            <div className="mt-1.5 flex items-start justify-between gap-3 pl-1">
              <p className="py-1.5 text-xs leading-5 text-fg-4" role="status">
                {q ? (visibleCount ? `${visibleCount} de ${ALL_SECTIONS.length} secciones coinciden con "${q}".` : '') : 'Escribí una palabra o el mensaje de error que te aparece.'}
              </p>
              {!q && (
                <Button variant="ghost" size="sm" icon={allOpen ? ChevronsDownUp : ChevronsUpDown} onClick={() => setOpen(allOpen ? [] : ALL_SECTIONS.map((x) => x.id))}>
                  {allOpen ? 'Cerrar todo' : 'Abrir todo'}
                </Button>
              )}
            </div>
          </div>

          {/* En papel, el índice va arriba. En pantalla las secciones plegadas ya hacen de índice (y en ancho va al costado). */}
          <div className="hidden print:block">
            <Card title="Contenido">{toc(true)}</Card>
          </div>

          {visibleCount === 0 && (
            <Card>
              <EmptyState icon={SearchX} title={`Nada coincide con "${q}"`} action={<Button variant="secondary" size="sm" onClick={() => search('')}>Borrar búsqueda</Button>}>
                Probá con otra palabra (por ejemplo "ADB", "código" o "Wi-Fi") o con menos palabras.
              </EmptyState>
            </Card>
          )}

          {/* ------------------------------------------------------------------ Empezar */}
          <Section {...sec('inicio')} lead="El recorrido completo, de la caja al cliente. Marcá cada punto a medida que avanzás: queda guardado en este navegador.">
            <ul className="flex flex-col gap-1">
              {CHECKLIST.map((c) => {
                const checked = checklist.done.includes(c.id);
                return (
                  <li key={c.id} className="print-keep flex items-start gap-1">
                    <label className="flex min-h-11 flex-1 cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-fill sm:min-h-0 sm:py-2">
                      <input type="checkbox" checked={checked} onChange={() => checklist.toggle(c.id)} className="mt-1 h-[18px] w-[18px] shrink-0 cursor-pointer rounded" style={{ accentColor: 'var(--accent-solid)' }} />
                      <span className={checked ? 'text-fg-4 line-through decoration-[color:var(--line-strong)]' : 'text-fg-2'}>{c.text}</span>
                    </label>
                    <a {...go(c.go)} data-noprint className="mt-2 shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-fill-2 sm:mt-1.5" aria-label={`Ver cómo: ${META[c.go].title}`}>
                      Ver cómo
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2" data-noprint>
              <span className="text-[13px] text-fg-3" role="status">{checklist.done.length} de {CHECKLIST.length} listos</span>
              <Button variant="ghost" size="sm" icon={RotateCcw} disabled={!checklist.done.length} onClick={checklist.reset}>Empezar con otro equipo</Button>
            </div>
            <Callout tone="info" icon={ClipboardCheck} title="El orden importa">
              Primero el sistema, después el logo y al final la instalación. El último paso apaga el ADB: lo que necesite ADB (pasos 1 y 2) se hace antes.
            </Callout>
          </Section>

          <Section {...sec('necesitas')} lead="Juntá todo antes de abrir la primera caja. Con esto instalás cualquier cantidad de equipos.">
            <H3>Descargas</H3>
            <div className="flex flex-col gap-2">
              <DownloadRow path={KIT_PATH} name={`kit-instalacion-${GUIDE_VERSION}.zip`} title={`Kit de instalación ${GUIDE_VERSION}`} detail="Los scripts de instalación y blindaje, nex-tv.apk, el logo de NEX y un archivo LEEME. Es lo que vas a usar." />
              <DownloadRow path={APK_PATH} name="nex-tv.apk" title="Solo el APK de NEX TV" detail="Por si ya tenés el kit y solo te falta la app. Es el mismo archivo que trae el kit." />
            </div>
            <p className="text-sm leading-6 text-fg-3">
              El kit trae un archivo <Code>SHA256SUMS</Code> para comprobar que la descarga llegó entera. Dentro de la carpeta del kit: <Code>shasum -a 256 -c SHA256SUMS</Code> tiene que decir "OK" en cada línea.
            </p>

            <H3>Lista de materiales</H3>
            <Table
              caption="Qué necesitás para instalar"
              head={['Qué', 'Para qué', 'Detalle']}
              rows={[
                ['Computadora', 'Corre los scripts del kit', 'macOS, Linux o Windows 10/11 (en Windows los scripts corren dentro de Ubuntu con WSL).'],
                ['adb', 'Le da órdenes al box', 'Viene en "Android platform-tools". Abajo está cómo instalarlo en cada sistema.'],
                ['Red', 'Conecta la computadora con el box', 'Los dos en la misma red (mismo router o switch). Mejor por cable: el paso 1 reinicia el box.'],
                ['Kit de instalación', 'Los scripts, la app y el logo', 'Descomprimido en una carpeta. No cambies los nombres de los archivos.'],
                ['Firmware original + HiTool', 'Recuperar un box que no arranca', 'El firmware del mismo modelo y HiTool en una PC con Windows. Ojalá no lo uses, pero tenelo.'],
                ['Usuario del panel', 'Vincular el box a tu empresa', 'Con la verificación en dos pasos (2FA) ya configurada en tu celular.'],
                ['PIN técnico', 'Volver a entrar a un box instalado', 'El que te pasó NEX. No está escrito en esta guía ni se le da al cliente.'],
                ['TV y control', 'Ver la pantalla del box', 'Cualquier TV con HDMI. Vas a necesitar leer el código de vinculación.'],
              ]}
            />

            <H3>Instalar adb</H3>
            <Table
              caption="Cómo instalar adb en cada sistema"
              head={['Sistema', 'Cómo']}
              rows={[
                ['macOS', <>Con Homebrew: <Code>brew install android-platform-tools</Code></>],
                ['Linux (Ubuntu, Debian)', <><Code>sudo apt update &amp;&amp; sudo apt install -y adb unzip xxd</Code></>],
                ['Windows', 'Una sola vez, seguí los 4 pasos de abajo. Después trabajás siempre en la ventana de Ubuntu.'],
              ]}
            />
            <div className="rounded-lg border border-line bg-fill px-3.5 py-3">
              <div className="mb-2 font-medium text-fg">Windows: preparar Ubuntu (WSL), una sola vez</div>
              <Steps>
                <Step title="Abrí PowerShell como administrador y escribí:">
                  <Cmd label="Instalar Ubuntu en Windows">wsl --install -d Ubuntu</Cmd>
                  <p className="text-sm text-fg-3">Cuando termine, reiniciá la PC.</p>
                </Step>
                <Step title="Abrí Ubuntu desde el menú Inicio.">
                  <p className="text-sm text-fg-3">La primera vez te pide crear un usuario y una contraseña. Son solo para esa ventana: anotalos.</p>
                </Step>
                <Step title="Instalá las herramientas:">
                  <Cmd label="Instalar adb en Ubuntu">sudo apt update &amp;&amp; sudo apt install -y adb unzip xxd</Cmd>
                </Step>
                <Step title="Descomprimí el kit que bajaste a Descargas:">
                  <Cmd label="Descomprimir el kit">{`cd ~ && unzip -o /mnt/c/Users/*/Downloads/kit-instalacion-${GUIDE_VERSION}.zip && cd kit-instalacion-${GUIDE_VERSION}`}</Cmd>
                </Step>
              </Steps>
            </div>

            <H3>Equipos compatibles</H3>
            <p>
              El kit {GUIDE_VERSION} está hecho y probado para el <strong className="font-semibold text-fg">TV box TX6698 (HiSilicon, Android 9)</strong>. Los scripts revisan el equipo antes de grabar y se detienen si algo no coincide.
              Si tu empresa compra otro modelo, pasale a NEX el modelo, la versión de Android y el número de compilación antes de instalar el primero.
            </p>
          </Section>

          {/* ------------------------------------------------------------------ Instalar */}
          <Section {...sec('preparar')} lead="Dos minutos por box: encender el ADB, anotar la IP y comprobar que la computadora lo ve.">
            <Steps>
              <Step title="Conectá el box a la TV, a la corriente y a la red.">
                <p>Por cable si podés. Si es un box usado, conviene dejarlo de fábrica antes (Ajustes de Android → Preferencias del dispositivo → Restablecer) y no iniciar sesión en Google todavía.</p>
              </Step>
              <Step title="Encendé la Depuración USB (ADB).">
                <p>En muchos TX6698 ya viene encendida y podés saltear este punto. Si no:</p>
                <Bullets>
                  <li><Path steps={['Ajustes', 'Preferencias del dispositivo', 'Información']} /> y apretá OK <strong className="font-semibold text-fg">7 veces</strong> sobre "Compilación".</li>
                  <li>Volvé atrás: <Path steps={['Opciones de desarrollador', 'Depuración USB']} /> (y "Depuración por red", si existe).</li>
                </Bullets>
              </Step>
              <Step title="Anotá la IP del box.">
                <p>Está en <Path steps={['Ajustes', 'Red e Internet']} />, tocando la red conectada. Es un número como 192.168.0.112.</p>
              </Step>
              <Step title="Comprobá la conexión desde la computadora.">
                <div className="grid gap-2 rounded-lg border border-line bg-fill p-3 sm:grid-cols-[1fr_7rem]" data-noprint>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-fg-3">IP del box (completa los comandos de la guía)</span>
                    <input className={`${inputClass} font-mono`} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder="192.168.0.112" value={ip} onChange={(e) => setIp(e.target.value)} aria-invalid={ip.trim() !== '' && !IP_RE.test(ip.trim())} aria-describedby="guia-ip-ayuda" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-fg-3">Puerto</span>
                    <input className={`${inputClass} font-mono`} inputMode="numeric" autoComplete="off" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, '').slice(0, 5))} />
                  </label>
                  <p id="guia-ip-ayuda" className="text-xs leading-5 text-fg-4 sm:col-span-2">
                    {ip.trim() !== '' && !IP_RE.test(ip.trim())
                      ? 'Eso no parece una IP. Tiene que ser como 192.168.0.112.'
                      : 'No se guarda ni se envía a ningún lado. El TX6698 usa el puerto 3222; si no responde, probá 5555.'}
                  </p>
                </div>
                <Cmd label="Conectar con el box">{`adb connect ${target}`}</Cmd>
                <Cmd label="Ver los equipos conectados">adb devices</Cmd>
                <p>Al lado de la IP tiene que decir <Code>device</Code>.</p>
                <Table
                  caption="Qué significa la respuesta de adb devices"
                  head={['Dice', 'Qué hacer']}
                  rows={[
                    [<Code>device</Code>, 'Está todo bien. Seguí con la instalación.'],
                    [<Code>unauthorized</Code>, 'Mirá la TV: hay un cartel para permitir la depuración. Aceptalo.'],
                    [<Code>offline</Code>, <>Desconectá con <Code>adb disconnect</Code> y volvé a conectar.</>],
                    ['failed to connect / connection refused', 'La IP o el puerto están mal, el ADB está apagado o no están en la misma red.'],
                  ]}
                />
              </Step>
            </Steps>
          </Section>

          <Section {...sec('instalar')} lead="Tres comandos, en este orden, desde la carpeta del kit. Cada uno revisa el equipo antes de tocarlo y te dice en pantalla qué hizo.">
            <Callout tone="warning" icon={TriangleAlert} title="Antes de empezar">
              Los pasos 1 y 2 escriben en la memoria interna del box. No lo desenchufes ni cortes la red mientras corren, y tené a mano el firmware original y HiTool por si hay que recuperarlo.
            </Callout>
            <p className="text-sm leading-6 text-fg-3">
              Abrí una terminal en la carpeta del kit (en Windows, la ventana de Ubuntu). Si en el punto anterior cargaste la IP, los comandos ya están completos. Para ensayar sin cambiar nada, agregá <Code>--dry-run</Code> al final.
            </p>

            <H3>Paso 1 · NEX al sistema (unos 2 minutos)</H3>
            <Cmd label="Paso 1: copiar NEX al sistema">{`./install-system.sh ${target} --apk nex-tv.apk`}</Cmd>
            <p>
              Copia NEX TV a la parte del box que un reset de fábrica no borra y reinicia el equipo. Gracias a esto NEX sobrevive a un reset, se actualiza sola y puede instalar las apps de tu empresa sin preguntarle al cliente.
            </p>
            <Table
              caption="Qué revisa el paso 1 y qué hacer si se detiene"
              head={['Revisa', 'Si se detiene']}
              rows={[
                ['Que el box responda por ADB', <>"No responde por ADB": IP, puerto o red. Volvé a <a {...go('preparar')} className="text-accent underline underline-offset-2">Preparar el box</a>.</>],
                ['Que el firmware permita escribir el sistema', '"Firmware cerrado (ro.debuggable=0)": ese box no es compatible con este paso. Consultá a NEX.'],
                ['Que tenga acceso de administrador (root)', '"su no da root en este equipo": igual, consultá a NEX.'],
                ['Que la copia haya terminado bien', '"Falló la copia al sistema: el equipo NO se reinicia". El box queda como estaba. Mandale el error a NEX.'],
                ['Que el box vuelva después de reiniciar (espera hasta 5 minutos)', '"El equipo no volvió en 5 minutos": mirá la TV. Si arrancó, revisá si cambió la IP y repetí el paso.'],
                ['Que NEX quedó en el sistema, como app privilegiada y con sus 5 permisos', 'Una línea con ✗ ("falta el permiso…"): no sigas. Mandale la salida completa a NEX.'],
              ]}
            />
            <p>Salió bien si termina con <Code>Listo. Ahora correr install-box.sh…</Code> y todas las líneas de "Verificación" tienen ✓.</p>

            <H3>Paso 2 · Logo de NEX al prender (opcional, menos de 1 minuto)</H3>
            <Cmd label="Paso 2: grabar el logo">{`./grabar-logo.sh ${target} logo-nex.img`}</Cmd>
            <p>Cambia la imagen que se ve al enchufar el box, antes de que arranque Android. Si no lo corrés, queda el logo de fábrica y todo lo demás funciona igual.</p>
            <Bullets>
              <li>Comprueba que la imagen y la memoria del box tengan el formato y el tamaño esperados. Si no coinciden, <strong className="font-semibold text-fg">no graba nada</strong>.</li>
              <li>Guarda una copia del logo que tenía el box en la carpeta del kit (<Code>logo-respaldo-…img</Code>). No la borres hasta entregar el equipo.</li>
              <li>Graba, vuelve a leer y compara. Si el box ya tenía ese logo, avisa y no hace nada.</li>
              <li>Si dice "La partición no quedó igual a la imagen", no apagues el box: corré el comando que te muestra para volver a grabar la copia.</li>
            </Bullets>
            <p>Salió bien si dice <Code>✓ grabada y verificada</Code>. El logo nuevo se ve en el próximo reinicio.</p>

            <H3>Paso 3 · Cerrar la puerta trasera de fábrica (unos 2 minutos)</H3>
            <Cmd label="Paso 3: blindar">{`./blindar-box.sh ${target}`}</Cmd>
            <p>Estos box traen de fábrica un programa que da control total del equipo a cualquiera en la red (puerto 40000), y un "root" que cualquier app puede pedir. Es por donde se infectan. Este paso los cierra sin reflashear:</p>
            <Steps>
              <Step>Busca qué programa escucha en el puerto 40000. Solo lo desactiva si es un servicio propio del fabricante; guarda el original para poder deshacerlo.</Step>
              <Step>Si el box permite el root del técnico por ADB, le saca el root a las apps. Vos podés seguir entrando para reinstalar.</Step>
              <Step>Reinicia y verifica: puerto 40000 cerrado, el servicio de fábrica apagado y NEX como inicio.</Step>
            </Steps>
            <Callout tone="warning" icon={TriangleAlert} title="Si se detiene sin cambiar nada">
              Si dice que lo que escucha en el 40000 es "un programa compartido del sistema" o que "ningún servicio de init lo arranca", ese box necesita la reparación completa del firmware: no lo entregues y consultá a NEX. Para deshacer el blindaje: <Code>./restaurar-blindaje.sh {target}</Code>.
            </Callout>
            <p>Salió bien si termina con <Code>✓ puerto 40000 cerrado</Code> y <Code>Listo. Seguir con install-box.sh…</Code>. Va después del logo: después del blindaje, grabar-logo ya no tiene root.</p>

            <H3>Paso 4 · Instalar, proteger y apagar el ADB (1 minuto)</H3>
            <Cmd label="Paso 4: instalar y proteger">{`./install-box.sh ${target} --apk nex-tv.apk`}</Cmd>
            <p>Es el paso que deja el box listo para el cliente. En orden, hace esto:</p>
            <Steps>
              <Step>Instala (o actualiza) NEX TV. Si falla con "¿APK firmado con otra clave?", el box tenía una versión de prueba o el APK no es el oficial.</Step>
              <Step>Deja NEX como pantalla de inicio.</Step>
              <Step>Desactiva la publicidad y las apps de fábrica conocidas: anuncios superpuestos, el protector de pantalla con avisos, un proxy oculto, una tienda de apps alternativa, un "Netflix" falso y los duplicadores de pantalla.</Step>
              <Step>Fija la zona horaria de Argentina (Buenos Aires). Para otra, agregá <Code>--tz</Code> y la zona, por ejemplo <Code>--tz America/Montevideo</Code>.</Step>
              <Step>Enciende la protección de NEX (Guard), que vuelve al inicio si alguien abre los Ajustes de Android u otro inicio.</Step>
              <Step>Si el firmware lo permite, hace a NEX "dueño del equipo". En el TX6698 no lo permite y es normal que diga "protege Guard". Si avisa "hay cuentas cargadas", quitá las cuentas de Google y repetí el paso.</Step>
              <Step>Verifica todo, línea por línea, y <strong className="font-semibold text-fg">recién si todo dio ✓ apaga el ADB</strong>.</Step>
            </Steps>
            <Callout tone="success" icon={ClipboardCheck} title="Cómo saber que terminó bien">
              Todas las líneas de "Verificación" con ✓, el aviso "ADB: apagando: la conexión se corta acá" y al final "Listo. Falta vincular el equipo…". La TV muestra el código de vinculación.
            </Callout>
            <Callout tone="warning" icon={TriangleAlert} title="Si alguna verificación da ✗">
              El script avisa "queda ABIERTO: hay verificaciones que fallaron" y no apaga el ADB, justamente para que puedas corregir. Leé qué línea falló y volvé a correr el paso 4. Si la misma línea falla dos veces, mandale la salida completa a NEX.
            </Callout>
            <p className="text-sm leading-6 text-fg-3">
              En el taller, si todavía vas a seguir trabajando con ese box, agregá <Code>--keep-adb</Code> para que no apague el ADB. Nunca entregues un equipo con el ADB abierto: volvé a correr el paso 4 sin esa opción.
            </p>
          </Section>

          <Section {...sec('vincular')} lead="Vincular es decirle a NEX que ese box es de tu empresa. Se hace una vez por equipo y tarda un minuto.">
            <Shot file="vincular" alt="Pantalla del TV con el texto Vinculá este equipo desde el panel de tu empresa y un código de ocho caracteres" caption={`Al terminar la instalación la TV muestra el código (4 + 4 caracteres) y a qué hora vence. En NEX TV ${GUIDE_VERSION} aparece además un QR al lado.`} />
            <Steps>
              <Step title={<>En el panel, entrá a <PanelLink company={company} section="equipos">Equipos</PanelLink> y tocá "Vincular equipo".</>} />
              <Step title="Cargá el código que muestra la TV.">
                <p>Desde el celular es más rápido: con el panel ya abierto y tu sesión iniciada, escaneá el QR de la TV con la cámara. El código se completa solo.</p>
              </Step>
              <Step title='Tocá "Vincular equipo".'>
                <p>En menos de un minuto la TV pasa al inicio con el nombre de tu empresa.</p>
              </Step>
              <Step title="Ponele nombre y datos del cliente.">
                <p>Abrí el equipo y usá "Renombrar" (por ejemplo "Pérez — living"). Si tu empresa usa zonas, asignale la suya con "Cambiar zona". Si corresponde, cargá la referencia del abonado y hasta cuándo tiene pago.</p>
              </Step>
            </Steps>
            <Bullets>
              <li>El código vence a los <strong className="font-semibold text-fg">15 minutos</strong> y la TV muestra uno nuevo sola. Si el panel dice "Código inválido o vencido", cargá el que está ahora en pantalla.</li>
              <li>El box necesita internet para mostrar el código. Si no aparece, conectalo a la red desde esa misma pantalla.</li>
              <li>Mientras no esté vinculado, el box solo deja usar NEX: no se pueden abrir otras apps.</li>
              <li>"Desvincular" (en el menú del equipo) lo da de baja de tu empresa. Pide confirmación y tu verificación en dos pasos. Para volver a usarlo hay que vincularlo de nuevo.</li>
            </Bullets>
          </Section>

          <Section {...sec('cliente')} lead="Lo que hay que dejar funcionando antes de irte, y lo que el cliente tiene que saber.">
            <H3>Conectar a la red del cliente</H3>
            <p>Por cable no hay que hacer nada. Por Wi-Fi: <Path steps={['Ajustes (el engranaje del inicio)', 'Red Wi-Fi']} />, elegí la red y escribí la clave con el control.</p>
            <Shots>
              <Shot file="wifi" alt="Pantalla Red Wi-Fi de NEX TV con la lista de redes cercanas, Otra red y Buscar de nuevo" caption='Redes cercanas. "Buscar de nuevo" actualiza la lista.' />
              <Shot file="wifi-otra-red" alt="Formulario Otra red con los campos Nombre de la red y Contraseña" caption='"Otra red" es para redes ocultas: el nombre va igual que en el módem, con mayúsculas y minúsculas.' />
            </Shots>

            <H3>Chequeo de entrega</H3>
            <Bullets>
              <li>En <Path steps={['Ajustes']} />, la tarjeta "Este equipo" dice <strong className="font-semibold text-fg">Vinculado</strong>, <strong className="font-semibold text-fg">En línea</strong> y la versión de NEX TV correcta.</li>
              <li>En el panel, el equipo figura en línea y con salud en verde.</li>
              <li>Abrí una app y comprobá que reproduce.</li>
              <li>Si tu empresa ofrece apps propias, comprobá que aparecen en el inicio (ver <a {...go('apps')} className="text-accent underline underline-offset-2">Apps del operador</a>).</li>
            </Bullets>
            <Shot file="ajustes" alt="Pantalla Ajustes de NEX TV con Red Wi-Fi, Apariencia, Acceso técnico y la tarjeta Este equipo" caption={`Ajustes de NEX TV. A la derecha, "Este equipo": proveedor, conexión, red, IP y versión. La captura es de una versión de prueba: en un equipo instalado tiene que decir ${GUIDE_VERSION}.`} />

            <H3>Qué decirle al cliente</H3>
            <Bullets>
              <li>La Play Store funciona normal: lo que instala aparece solo en el inicio. Para instalar le va a pedir su cuenta de Google.</li>
              <li>Si aparece un mosaico con el botón "Instalar", es una app que recomienda tu empresa: OK abre la ficha en la Play Store.</li>
              <li>Si cambia el router o la clave del Wi-Fi, lo arregla él mismo desde Ajustes → Red Wi-Fi, incluso con el equipo bloqueado.</li>
              <li>"Acceso técnico" pide un PIN y es solo para el instalador.</li>
            </Bullets>
            <Shot file="instalar-app" alt="Inicio de NEX TV con una app llamada TV Play y el botón Instalar" caption='Una app de la Play Store cargada por la empresa: el cliente aprieta OK y confirma la instalación en la Play Store.' />
          </Section>

          {/* ------------------------------------------------------------------ Mantener */}
          <Section {...sec('acceso')} lead="El último paso de la instalación apaga el ADB para que nadie entre al box por la red. Si necesitás volver a entrar, se abre desde la TV con el PIN técnico.">
            <Steps>
              <Step title={<>En la TV: <Path steps={['Ajustes', 'Acceso técnico']} />.</>}>
                <p>Está abajo de todo, en "Soporte".</p>
              </Step>
              <Step title="Ingresá el PIN técnico que te pasó NEX.">
                <p>Se carga con el control, número por número. No lo digas en voz alta delante del cliente.</p>
              </Step>
              <Step title='Elegí "Abrir Ajustes de Android".'>
                <p>Quedan disponibles <strong className="font-semibold text-fg">10 minutos</strong>. Después la protección vuelve a cerrarlos sola.</p>
              </Step>
              <Step title="Solo la primera vez: hacé aparecer las Opciones de desarrollador.">
                <p><Path steps={['Preferencias del dispositivo', 'Información']} /> y apretá OK 7 veces sobre "Compilación". Volvé atrás.</p>
              </Step>
              <Step title={<><Path steps={['Opciones de desarrollador', 'Depuración USB']} />: encendela.</>}>
                <p>A los segundos el box vuelve a responder por ADB en el mismo puerto de antes (3222 en el TX6698).</p>
              </Step>
              <Step title="Al terminar, cerrá el ADB de nuevo.">
                <p>Corré otra vez el paso 4 de la instalación (<Code>install-box.sh</Code>): verifica todo y lo apaga. Es seguro repetirlo.</p>
              </Step>
            </Steps>
            <Shots>
              <Shot file="pin" alt="Pantalla Acceso técnico de NEX TV con un teclado numérico para ingresar el PIN del instalador" caption="El PIN se ingresa con el control. Atrás cancela." />
              <Shot file="acceso-tecnico" alt="Pantalla Diagnóstico del equipo del modo técnico, con la opción Reiniciar la interfaz y los datos del equipo" caption='Modo técnico. En un TV box instalado aparece además "Abrir Ajustes de Android"; a la derecha, el estado del equipo.' />
            </Shots>
            <Callout tone="info" icon={KeyRound} title="Sobre el PIN técnico">
              Es el mismo para todos los equipos de una versión y solo lo tienen los instaladores. Si creés que se filtró, avisale a NEX para cambiarlo en la próxima versión.
            </Callout>
            <p className="text-sm leading-6 text-fg-3">
              "Reiniciar la interfaz" vuelve a cargar NEX TV sin reiniciar el box: sirve si la pantalla quedó rara. Desvincular o bloquear se hacen siempre desde el panel, no desde la TV.
            </p>
          </Section>

          <Section {...sec('actualizar')} lead="No hay que hacer nada: NEX publica las versiones nuevas y cada box las instala solo.">
            <Bullets>
              <li>El box consulta si hay una versión nueva cada vez que se sincroniza. La descarga, comprueba que sea auténtica y la instala sin preguntarle al cliente.</li>
              <li>Esto funciona porque NEX quedó como app de sistema (paso 1). Un box instalado sin ese paso no puede actualizarse solo: Android pide confirmar cada instalación.</li>
              <li>Un box solo instala versiones más nuevas que la suya. No se puede volver a una anterior por este camino.</li>
              <li>Las actualizaciones llegan aunque el equipo esté bloqueado o sin vincular.</li>
            </Bullets>
            <H3>Cómo ver qué versión tiene un equipo</H3>
            <Table
              caption="Dónde ver la versión de NEX TV"
              head={['Dónde', 'Cómo']}
              rows={[
                ['En la TV', <><Path steps={['Ajustes']} />, tarjeta "Este equipo", renglón "NEX TV". Muestra la versión y el número de compilación.</>],
                ['En el panel', <><PanelLink company={company} section="equipos">Equipos</PanelLink>: debajo del nombre de cada equipo. En el detalle, pestaña "Salud y red", renglón "Versión de NEX TV".</>],
              ]}
            />
            <H3>Si un equipo quedó en una versión vieja</H3>
            <Steps>
              <Step>Revisá que esté en línea: un box apagado o sin internet se actualiza cuando vuelve.</Step>
              <Step>Revisá el almacenamiento en "Salud y red": sin espacio no puede descargar la versión nueva.</Step>
              <Step>Si pasó un día en línea y sigue igual, avisale a NEX con el nombre del equipo. También podés reinstalar con el kit nuevo: no se pierde la vinculación.</Step>
            </Steps>
          </Section>

          {/* ------------------------------------------------------------------ Operar */}
          <Section {...sec('servicio')} lead="Lo que más usa soporte: cortar, restringir o devolver el servicio de un cliente. Todo se hace abriendo el equipo en Equipos, pestaña Servicio.">
            <Table
              caption="Estados del servicio y qué ve el cliente"
              head={['Estado', 'Qué ve el cliente', 'Qué funciona']}
              rows={[
                [<Badge tone="success">Activo</Badge>, 'El inicio normal.', 'Todo.'],
                [<Badge tone="warning">Aviso</Badge>, 'Un cartel fijo arriba: "Tu pago vence el…".', 'Todo.'],
                [<Badge tone="warning">Restringido</Badge>, 'El menú y la pantalla de pago. Las apps aparecen deshabilitadas.', 'Ajustes y red. No las apps.'],
                [<Badge tone="danger">Bloqueado</Badge>, 'Pantalla completa con el logo, tu mensaje, el teléfono y el QR de pago.', 'Solo esa pantalla y la red Wi-Fi.'],
              ]}
            />
            <Shots>
              <Shot file="aviso-pago" alt="Inicio de NEX TV con un cartel amarillo que avisa que el pago vence pronto" caption="Aviso: el cliente sigue usando todo, con el cartel a la vista." />
              <Shot file="bloqueado" alt="Pantalla de bloqueo de NEX TV con un candado y el texto Pago vencido" caption="Bloqueado por falta de pago. El texto se configura en Marca y cobro." />
            </Shots>

            <H3>Acciones</H3>
            <Table
              caption="Acciones sobre el servicio de un equipo"
              head={['Querés…', 'Hacé esto', 'Tené en cuenta']}
              rows={[
                ['Cortar el servicio ya', '"Bloquear ahora", con el motivo.', 'La TV lo aplica en menos de un minuto y corta lo que se esté viendo.'],
                ['Dejarlo sin apps pero con menú', '"Restringir", con el motivo.', 'Paso intermedio antes de bloquear. Se saca con "Quitar restricción".'],
                ['Devolver el servicio', '"Desbloquear" o "Quitar restricción".', 'El equipo vuelve solo en el próximo minuto.'],
                ['Anotar que pagó', '"Registrar pago" y la fecha hasta la que tiene pago.', 'Si ya no hay deuda, se desbloquea solo. Los avisos y bloqueos futuros salen de esa fecha.'],
                ['Que deje de bloquearse por fecha', '"Quitar control de pago".', 'El equipo queda activo hasta que alguien lo bloquee a mano.'],
                ['Desbloquear un box sin internet', '"Código de desbloqueo".', 'Ver abajo.'],
              ]}
            />
            <p className="text-sm leading-6 text-fg-3">
              En el detalle vas a ver "Pendiente de aplicar" hasta que la TV confirme el cambio ("Bloqueo confirmado"). Si el box está sin conexión, la orden le llega cuando vuelve. Cada cambio queda en "Cambios de estado" y en Auditoría.
            </p>

            <H3>Código de desbloqueo (cliente que pagó y no tiene internet)</H3>
            <Steps>
              <Step>Abrí el equipo del cliente en el panel y tocá "Código de desbloqueo". Fijate que sea el equipo correcto: el código sirve solo para ese.</Step>
              <Step>Dictale los 8 números. En la TV bloqueada elige "Tengo un código de desbloqueo" y los carga con el control.</Step>
              <Step>El box queda activo por un tiempo limitado (el panel te dice cuántas horas). Cuando vuelve a tener internet, toma el estado real del panel.</Step>
            </Steps>
            <Bullets>
              <li>El código vale <strong className="font-semibold text-fg">solo ese día</strong> y no se puede usar dos veces.</li>
              <li>Después de varios intentos fallidos la TV hace esperar unos minutos.</li>
              <li>Registrá igual el pago en el panel: si no, cuando el box se conecte vuelve a bloquearse.</li>
            </Bullets>

            <H3>Plazos automáticos</H3>
            <p>
              Cuántos días antes avisa, cuándo restringe, cuántos días de gracia da y qué teléfono y link de pago muestra la TV se configuran una sola vez en <PanelLink company={company} section="marca">Marca y cobro</PanelLink>. Ahí también está el mensaje de bloqueo y el logo de tu empresa.
            </p>
          </Section>

          <Section {...sec('apps')} lead="Tu empresa puede poner sus propias apps Android en todos los TV box, sin pasar por NEX. Se cargan en Apps → Apps Android de tu empresa.">
            <Table
              caption="Diferencias entre cargar una app desde Play Store o subir un APK"
              head={['', 'Desde Play Store', 'Subir APK']}
              rows={[
                ['Cuándo usarla', 'La app está publicada en la Play Store (YouTube, una app de streaming).', 'Tu app propia o una que no está en la Play Store.'],
                ['Qué cargás', 'El link de la ficha o el nombre del paquete (com.empresa.app).', 'El archivo .apk, de hasta 200 MB. Pide tu verificación en dos pasos.'],
                ['Qué ve el cliente', 'Un mosaico con el botón "Instalar" que abre la ficha. Confirma ahí.', 'Nada: la app aparece sola en el inicio.'],
                ['Necesita cuenta de Google', 'Sí, la Play Store la exige.', 'No.'],
                ['Cómo se actualiza', 'La actualiza la Play Store.', 'Subís el APK nuevo, con el mismo paquete y un número de versión mayor.'],
                ['Si la quitás del panel', 'Desaparece el mosaico. Si ya la instaló, queda.', 'NEX TV la desinstala de los equipos.'],
              ]}
            />
            <Bullets>
              <li>Los cambios llegan a los equipos en el próximo minuto. La descarga de un APK grande puede tardar según la conexión del cliente.</li>
              <li>Si una instalación falla, el box reintenta cada 6 horas y en el Historial del equipo aparece "No se pudo instalar una app del operador".</li>
              <li>Hasta 40 apps por empresa. No se pueden cargar NEX TV, la Play Store ni los servicios de Google.</li>
              <li>La instalación silenciosa de APK necesita que el box se haya instalado con el paso 1 (NEX en el sistema).</li>
            </Bullets>
            <p className="text-sm leading-6 text-fg-3">Cargar o quitar apps lo puede hacer el dueño o un administrador de la empresa. Ir a <PanelLink company={company} section="apps">Apps</PanelLink>.</p>
          </Section>

          <Section {...sec('comunicados')} lead="Mensajes de tu empresa en la pantalla de los clientes: cortes programados, alertas del clima, avisos municipales.">
            <Steps>
              <Step>En <PanelLink company={company} section="comunicados">Comunicados</PanelLink>, tocá "Nuevo comunicado". Podés empezar con una plantilla y reemplazar lo que está entre [corchetes].</Step>
              <Step>Elegí el tipo (corte, clima, salud, municipal o general) y la importancia.</Step>
              <Step>Elegí quién lo recibe: todos los equipos o solo algunas zonas.</Step>
              <Step>Elegí cuándo empieza y cuánto dura (hasta 31 días). Mirá la vista previa "Así se ve en el TV".</Step>
              <Step>"Revisar y enviar". Llega a los equipos en línea en menos de un minuto.</Step>
            </Steps>
            <Table
              caption="Importancia de un comunicado y cómo se muestra"
              head={['Importancia', 'Cómo aparece en la TV', 'Usala para']}
              rows={[
                [<Badge tone="info">Info</Badge>, 'Un aviso en el inicio.', 'Novedades, campañas, recordatorios.'],
                [<Badge tone="warning">Importante</Badge>, 'Un aviso destacado en el inicio.', 'Cortes programados, cambios de servicio.'],
                [<Badge tone="danger">Emergencia</Badge>, 'Pantalla completa, por encima de lo que se esté viendo.', 'Alertas reales. Usala poco para que no pierda efecto.'],
              ]}
            />
            <Bullets>
              <li>Una vez enviado no se puede editar. Si tiene un error, cancelalo y mandá uno nuevo.</li>
              <li>Los equipos que están apagados lo ven cuando vuelven, si todavía está vigente.</li>
              <li>El panel muestra "visto por X de Y equipos": cuenta cuando el cliente lo cierra con el control.</li>
              <li>Máximo 30 comunicados por día por empresa.</li>
            </Bullets>
          </Section>

          <Section {...sec('zonas')} lead="Una zona agrupa equipos por localidad, barrio, nodo u OLT. Sirve para avisarle solo a una parte y para detectar un corte masivo antes de que llamen.">
            <Steps>
              <Step>Creá las zonas en <PanelLink company={company} section="zonas">Zonas</PanelLink> con nombres que tu equipo ya use ("Centro", "Nodo Sur · OLT 2").</Step>
              <Step>Asignale zona a cada equipo: en Equipos, seleccioná varios y usá "Asignar zona", o "Cambiar zona" en el menú de uno.</Step>
              <Step>Activá los avisos de "Sin conexión" en <PanelLink company={company} section="avisos">Avisos</PanelLink> para que la caída te llegue por Telegram o email.</Step>
            </Steps>
            <Callout tone="info" icon={MapPin} title='Cuándo una zona entra "En caída"'>
              Cuando tiene 3 o más equipos activos y la mitad o más (mínimo 3) llevan más de 3 minutos sin reportarse. Al volver, el panel anota cuánto duró en el "Historial de caídas".
            </Callout>
            <Bullets>
              <li>Una caída de zona casi nunca es culpa de los box: revisá el nodo, la OLT, el enlace o la energía de esa zona.</li>
              <li>Un box apagado por el cliente también cuenta como "sin reportarse". Por eso hace falta un mínimo de 3 a la vez.</li>
              <li>Los equipos sin zona no entran en los comunicados por zona ni en el control de caídas.</li>
              <li>En una caída, mandá un comunicado a esa zona: lo ven apenas vuelve la conexión.</li>
            </Bullets>
          </Section>

          <Section {...sec('salud')} lead="Cada equipo tiene un puntaje de 0 a 100. Empieza en 100 y va restando por cada problema que informa. Sirve para ver cuál atender primero.">
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { tone: 'success' as const, label: 'Bien', range: '80 a 100', text: 'No hay nada que hacer.' },
                { tone: 'warning' as const, label: 'Atención', range: '50 a 79', text: 'Mirá el motivo. Puede esperar.' },
                { tone: 'danger' as const, label: 'Problemas', range: '0 a 49', text: 'Atendelo: el cliente lo está notando.' },
              ].map((b) => (
                <div key={b.label} className="print-keep rounded-lg border border-line bg-fill px-3.5 py-3">
                  <Badge tone={b.tone}>{b.label}</Badge>
                  <div className="mt-1.5 text-lg font-semibold tabular-nums text-fg">{b.range}</div>
                  <div className="text-[13px] leading-5 text-fg-3">{b.text}</div>
                </div>
              ))}
            </div>
            <p>
              Dónde verlo: en <PanelLink company={company} section="equipos">Equipos</PanelLink> ordená por "Peor salud primero". En el detalle, pestaña "Salud y red", "Qué le baja el puntaje" lista los motivos del más grave al más leve. "Sin datos" quiere decir que el box todavía no se reportó nunca.
            </p>
            <Table
              caption="Qué resta puntos de salud y qué hacer"
              head={['Motivo', 'Resta', 'Qué hacer']}
              rows={[
                ['Sin conexión hace más de 1 hora / más de 1 día', '25 / 40', 'Puede estar apagado. Si el cliente reclama, revisá la red de la casa.'],
                ['Temperatura alta (desde 65 °C, 75 °C y 85 °C)', '5 / 15 / 30', 'Sacarlo de lugares cerrados, de arriba del módem o del sol. Limpiar las rejillas.'],
                ['Poca memoria libre', '5 a 15', 'Reiniciar el box. Si se repite, tiene demasiadas apps abiertas o instaladas.'],
                ['Poco almacenamiento (menos de 1 GB, 500 MB y 200 MB)', '5 / 10 / 25', 'Desinstalar apps que no usa. Sin espacio no entran las actualizaciones.'],
                ['Señal Wi-Fi débil (-70 dBm) o muy débil (-80 dBm)', '7 / 15', 'Acercar el router, usar la red de 5 GHz o pasar a cable.'],
                ['Pierde paquetes hasta el router (5% / 20%)', '7 / 15', 'Problema dentro de la casa: Wi-Fi con interferencia o cable dañado.'],
                ['Pierde paquetes o tarda mucho hasta internet', '5 a 10', 'Problema del acceso: ONU, enlace o red del ISP. Pedí un diagnóstico de red.'],
                ['Se encendió 3 o más / 6 o más veces en 24 h', '15 / 25', 'Fuente floja, enchufe con falso contacto o cortes de luz. Probar otra fuente.'],
                ['NEX se reinició 2 o más / 5 o más veces en 24 h', '10 / 20', 'Avisar a NEX con el nombre del equipo.'],
                ['Errores en las últimas 24 h', '5 por error, hasta 20', 'Mirá cuáles en el Historial del equipo.'],
                ['Sube datos sin estar en uso (5 Mbps / 20 Mbps)', '35 / 50', <>Posible equipo infectado. Ver <a {...go('seguridad')} className="text-accent underline underline-offset-2">la sección siguiente</a>.</>],
                ['Puertas de fábrica abiertas', '25', <>Ver <a {...go('seguridad')} className="text-accent underline underline-offset-2">Equipo posiblemente infectado</a>.</>],
              ]}
            />
            <p className="text-sm leading-6 text-fg-3">Lo que el box no puede medir (por ejemplo, la temperatura en algunos modelos) no resta puntos.</p>
          </Section>

          <Section {...sec('red')} lead='Cuando un cliente dice "anda lento" o "se corta", el box mide la red por tramos y el panel te dice dónde está el problema: en la casa, en el acceso o en la app.'>
            <Steps>
              <Step>Abrí el equipo en <PanelLink company={company} section="equipos">Equipos</PanelLink>, pestaña "Salud y red".</Step>
              <Step>Tocá "Diagnosticar red". El equipo tiene que estar en línea.</Step>
              <Step>Esperá entre 15 y 25 segundos: el resultado aparece solo.</Step>
            </Steps>
            <p>El box mide: tipo de conexión (Wi-Fi o cable), señal y velocidad del Wi-Fi, respuesta del router u ONU, respuesta de internet, DNS, tiempo hasta el servidor de NEX y velocidad de bajada.</p>
            <Table
              caption="Cómo leer el resultado del diagnóstico de red"
              head={['Resultado', 'Qué significa', 'Qué hacer']}
              rows={[
                [<Badge tone="warning">Red de la casa</Badge>, 'Falla el tramo entre el box y el router/ONU: señal Wi-Fi débil (-75 dBm o menos), enlace lento, o el router pierde paquetes o tarda en responder.', 'Acercar el router, usar 5 GHz o pasar a cable. Revisar el cable y el puerto. No es un problema del ISP hacia afuera.'],
                [<Badge tone="danger">Acceso a internet</Badge>, 'El router responde bien pero internet no: se pierden paquetes, la latencia es alta, el DNS no responde o la bajada es menor a 5 Mbps.', 'Revisar la ONU (potencia óptica, luces), el plan, el enlace y si hay más clientes de la zona con lo mismo.'],
                [<Badge tone="success">La red está bien</Badge>, 'Wi-Fi, router e internet responden bien.', 'Si una app falla, el problema es de esa app o de su servidor: probá otra app, actualizala o esperá.'],
                [<Badge tone="danger">Sin conexión</Badge>, 'El box no llega ni al router.', 'Revisar que esté conectado al Wi-Fi correcto o que el cable esté bien puesto.'],
              ]}
            />
            <Bullets>
              <li>Debajo del resultado el panel lista los motivos con sus números (por ejemplo "Señal Wi-Fi débil (-78 dBm)"). Usalos al hablar con el cliente.</li>
              <li>Máximo 6 diagnósticos por hora por equipo.</li>
              <li>Si el equipo no responde al pedido, ya sabés que no tiene conexión: es un problema de la casa o del acceso, no del box.</li>
              <li>El tramo de la casa se mide desde el box. Todavía no se consulta al router ni a la ONU directamente.</li>
            </Bullets>
          </Section>

          <Section {...sec('seguridad')} lead="Algunos TV box genéricos traen de fábrica accesos remotos ocultos. Alguien de afuera puede usarlos para infectar el equipo y usar la conexión del cliente. NEX TV los detecta y te avisa.">
            <Table
              caption="Alertas de seguridad del equipo"
              head={['Alerta', 'Qué detectó', 'Qué tan grave']}
              rows={[
                ['Sube datos sin uso', 'El box subió más de 5 Mbps durante 15 minutos sin que nadie lo usara (no cuenta lo que habla con NEX).', 'Alta: es la señal típica de un equipo infectado que trabaja para otro. Además le consume el ancho de banda al cliente.'],
                ['Puertas de fábrica abiertas', 'Un puerto de control remoto (40000), el ADB por red (5555) o una app de control remoto del fabricante. El root (su) que traen los TX6698 no cuenta: el kit lo usa para instalar NEX.', 'Media: todavía no hay infección confirmada, pero el equipo está expuesto.'],
              ]}
            />
            <p>Las dos alertas bajan la salud, aparecen en el filtro "Con alertas" de Equipos y, si tu empresa tiene activados los avisos de "Manipulación", llegan por Telegram o email.</p>
            <H3>Qué hacer</H3>
            <Steps>
              <Step>Anotá qué equipo es y qué alerta tiene (abrilo → Salud y red).</Step>
              <Step>Si está subiendo datos sin uso, desconectalo de la red del cliente hasta repararlo, o bloqueá su tráfico desde tu red.</Step>
              <Step>Avisale a NEX. NEX TV informa el problema pero no puede cerrar esos accesos: están en el firmware.</Step>
              <Step>La solución es <strong className="font-semibold text-fg">reparar el firmware</strong> (NEX te indica cómo) o cambiar el equipo. Después se instala NEX de nuevo con el kit.</Step>
            </Steps>
            <Callout tone="warning" icon={ShieldAlert} title="Si aparece en muchos equipos del mismo lote">
              Es un problema del proveedor de los box. Guardá el modelo y el número de compilación y pasáselos a NEX antes de seguir instalando ese lote.
            </Callout>
            <p className="text-sm leading-6 text-fg-3">
              Los pasos 3 y 4 de la instalación cierran el puerto 40000, le sacan el root a las apps, desactivan las apps de publicidad y control remoto conocidas y apagan el ADB. Estas alertas avisan si algo de eso vuelve o si el equipo se instaló sin blindar.
            </p>
          </Section>

          {/* ------------------------------------------------------------------ Resolver */}
          <Section {...sec('problemas')} lead="Buscá lo que ves en pantalla. Si el mensaje no está acá, copialo completo y mandáselo a NEX junto con el modelo del box.">
            <ProblemList items={problems} />
          </Section>

          <Section {...sec('faq')}>
            <dl className="flex flex-col divide-y divide-line">
              {faq.map((f) => (
                <div key={f.q} className="print-keep py-3 first:pt-0 last:pb-0">
                  <dt className="font-medium text-fg">{f.q}</dt>
                  <dd className="mt-1 text-sm leading-6 text-fg-2">{f.a}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section {...sec('glosario')} lead="Las palabras técnicas que aparecen en la guía y en el panel, en simple.">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 print:grid-cols-2">
              {glossary.map((g) => (
                <div key={g.term} className="print-keep">
                  <dt className="font-medium text-fg">{g.term}</dt>
                  <dd className="text-sm leading-6 text-fg-3">{g.def}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <p className="px-1 text-xs leading-5 text-fg-4">
            Guía para NEX TV {GUIDE_VERSION} en TV box Android. Si algo de la guía no coincide con lo que ves en el equipo, avisale a NEX: la versión instalada manda.
          </p>
        </div>

        <aside className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-xl border border-line bg-surface p-3 shadow-card xl:block print:hidden" data-noprint>
          {visibleCount > 0 ? toc(false) : <p className="px-2 py-1 text-[13px] text-fg-4">Sin resultados.</p>}
        </aside>
      </div>
    </div>
  );
}
