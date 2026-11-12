import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AppWindow,
  Bell,
  BookOpen,
  Building2,
  Check,
  ChevronsUpDown,
  Cpu,
  Ellipsis,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MailCheck,
  MapPin,
  Megaphone,
  Menu as MenuIcon,
  MonitorX,
  Package,
  Palette,
  Plug,
  ScrollText,
  ShieldCheck,
  Skull,
  Tv,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { IdleGuard, StepUpProvider } from './security';
import { isAdminSupabaseConfigured } from './supabaseAdmin';
import { SIGNUP_ENABLED, TURNSTILE_SITE_KEY } from './config';
import Turnstile from './Turnstile';
import { db, run, type Company } from './api';
import { FILTERS } from './deviceMeta';
import { NO_ZONE } from './zones';
import { AcceptLink, ForgotPassword, SetPassword } from './AuthFlows';
import { parseAuthLink, passwordPending } from './authLink';
import ChangePasswordModal from './ChangePassword';
import DownloadApk from './DownloadApk';
import { passwordProblem } from './password';
import { initials } from './format';
import { useLayer } from './layer';
import ThemeToggle from './ThemeToggle';
import AlertsPage from './pages/Alerts';
import AppsPage from './pages/Apps';
import BrandPage from './pages/Brand';
import DevicesPage from './pages/Devices';
import { CatalogPage, FirmwarePage, NewCompanyPage, PiracyPage } from './pages/Nex';
import NoticesPage from './pages/Notices';
import OverviewPage from './pages/Overview';
import GuidePage from './pages/Guide';
import { ApiKeysPage, AuditPage, MembersPage } from './pages/Team';
import ZonesPage from './pages/Zones';
import { formatRoute, takeClaimParam, useRoute, type CompanySection, type NexSection, type Route } from './routing';
import { Button, Callout, EmptyState, ErrorState, ErrorText, Field, IconButton, inputClass, Menu, SearchInput, Skeleton, ToastProvider } from './ui';
import { useCompanyData } from './useCompanyData';

const initialClaim = takeClaimParam();

/** Espera tras N fallos seguidos de login: 0, 0, 0, 10 s, 20 s, 40 s… hasta 5 min. */
function lockoutSeconds(failures: number): number {
  return failures < 3 ? 0 : Math.min(10 * 2 ** (failures - 3), 300);
}

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

type AuthStage = 'loading' | 'signed-out' | 'mfa-enroll' | 'mfa-verify' | 'ready';

function useAuthStage() {
  const [session, setSession] = useState<Session | null>(null);
  const [stage, setStage] = useState<AuthStage>('loading');

  const evaluate = useCallback(async (s: Session | null) => {
    setSession(s);
    // Una sesión anónima (de NEX Music en el mismo dominio) no sirve para administrar.
    if (!s || s.user.is_anonymous) {
      setStage('signed-out');
      return;
    }
    const { data } = await db().auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel === 'aal2') setStage('ready');
    else if (data?.nextLevel === 'aal2') setStage('mfa-verify');
    else setStage('mfa-enroll');
  }, []);

  useEffect(() => {
    const client = db();
    client.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data } = client.auth.onAuthStateChange((_event, s) => {
      // Diferido: no llamar a la API de auth dentro del callback.
      setTimeout(() => evaluate(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [evaluate]);

  return { session, stage, refresh: () => db().auth.getSession().then(({ data }) => evaluate(data.session)) };
}

function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-11 w-11 rounded-xl' : 'h-8 w-8 rounded-lg';
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm ${box}`}>
        <Tv className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden />
      </div>
      <div className="leading-tight">
        <div className={`font-semibold tracking-tight text-fg ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>NEX MDM</div>
        <div className="text-[11px] text-fg-4">Gestión de TV box</div>
      </div>
    </div>
  );
}

function AuthLayout({ title, subtitle, step, children }: { title: string; subtitle: string; step?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
      <main className="w-full max-w-[400px]">
        <div className="mb-7 flex justify-center"><Logo size="lg" /></div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-7">
          {step && <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-accent">{step}</div>}
          <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
          <p className="mb-6 mt-1 text-sm leading-relaxed text-fg-3">{subtitle}</p>
          {children}
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-fg-4">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Acceso protegido con segundo factor
        </p>
        <div className="mt-4 flex justify-center"><ThemeToggle /></div>
      </main>
    </div>
  );
}

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failures, setFailures] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const onCaptcha = useCallback((t: string | null) => setCaptcha(t), []);
  const wait = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (Date.now() < lockedUntil) return;
    if (TURNSTILE_SITE_KEY && !captcha) {
      setError('Completá la verificación anti-robots');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const options = captcha ? { captchaToken: captcha } : undefined;
    try {
      const auth = db().auth;
      if (mode === 'in') {
        const { error: err } = await auth.signInWithPassword({ email, password, options });
        if (err) throw err;
        setFailures(0);
      } else {
        const problem = passwordProblem(password, email);
        if (problem) throw new Error(problem);
        const { error: err } = await auth.signUp({ email, password, options });
        if (err) throw err;
        setInfo('Revisá tu email para confirmar la cuenta. Después, NEX o el dueño de tu empresa te da acceso.');
      }
    } catch (err) {
      if (mode === 'in') {
        // Mensaje genérico: no revelar si el email existe. Freno progresivo ante fuerza bruta
        // (el límite real lo aplica Supabase Auth por IP; esto evita martillar desde la UI).
        const next = failures + 1;
        setFailures(next);
        const secs = lockoutSeconds(next);
        if (secs) {
          setLockedUntil(Date.now() + secs * 1000);
          setNow(Date.now());
        }
        setError('Email o contraseña incorrectos');
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
      setPassword('');
      setShowPassword(false);
      if (TURNSTILE_SITE_KEY) setCaptchaReset((k) => k + 1);
    }
  };

  if (mode === 'forgot') {
    return (
      <AuthLayout title="Olvidé mi contraseña" subtitle="Te mandamos un link por email para definir una nueva.">
        <div className="flex flex-col gap-4">
          {TURNSTILE_SITE_KEY && <Turnstile onToken={onCaptcha} resetKey={captchaReset} />}
          <ForgotPassword captchaToken={captcha} captchaRequired={Boolean(TURNSTILE_SITE_KEY)} onBack={() => { setMode('in'); setError(null); }} />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={mode === 'in' ? 'Ingresar' : 'Crear cuenta'}
      subtitle={mode === 'in' ? 'Administrá los equipos de tu empresa' : 'Para técnicos y administradores de empresas'}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email">
          <input className={inputClass} type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Contraseña" hint={mode === 'up' ? 'Mínimo 12 caracteres' : undefined}>
          <span className="relative">
            <input className={`${inputClass} pr-11`} type={showPassword ? 'text' : 'password'} required minLength={mode === 'up' ? 12 : undefined}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button
              type="button"
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-4 transition hover:bg-fill-2 hover:text-fg"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </span>
        </Field>
        {TURNSTILE_SITE_KEY && <Turnstile onToken={onCaptcha} resetKey={captchaReset} />}
        <ErrorText error={error} />
        {info && <Callout tone="success" icon={MailCheck}>{info}</Callout>}
        <Button type="submit" loading={busy} disabled={wait > 0} className="h-11">
          {wait > 0 ? `Esperá ${wait} s` : mode === 'in' ? 'Ingresar' : 'Crear cuenta'}
        </Button>
        {mode === 'in' && (
          <button type="button" className="rounded-md py-1 text-sm text-fg-3 transition hover:text-fg" onClick={() => { setMode('forgot'); setError(null); }}>
            Olvidé mi contraseña
          </button>
        )}
        {SIGNUP_ENABLED ? (
          <button type="button" className="rounded-md py-1 text-sm text-fg-3 transition hover:text-fg" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? '¿No tenés cuenta? Crear una' : 'Ya tengo cuenta'}
          </button>
        ) : (
          <p className="text-center text-xs leading-relaxed text-fg-4">¿Sin cuenta? Pedile a NEX o al dueño de tu empresa que te invite.</p>
        )}
      </form>
    </AuthLayout>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.5em]`}
      aria-label="Código de 6 dígitos"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={6}
      placeholder="••••••"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
    />
  );
}

export function MfaEnroll({ onDone }: { onDone: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const auth = db().auth;
      const { data: list } = await auth.mfa.listFactors();
      for (const f of list?.all ?? []) {
        if (f.status === 'unverified') await auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: err } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: 'NEX MDM' });
      if (err || !data) setError(err?.message ?? 'No se pudo iniciar el alta del segundo factor');
      else setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, []);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!factor) return;
    const { error: err } = await db().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (err) setError('Código incorrecto, probá de nuevo');
    else onDone();
  };

  return (
    <AuthLayout step="Paso 2 de 2" title="Activá el segundo factor" subtitle="Bloquear equipos de clientes es una acción crítica: el segundo factor es obligatorio.">
      <div className="mb-5 flex flex-col items-center gap-3">
        {factor ? <img src={factor.qr} alt="Código QR para la app de autenticación" className="h-44 w-44 rounded-xl border border-line bg-white p-2" /> : <Skeleton className="h-44 w-44" />}
        <p className="text-center text-xs text-fg-4">Escaneá con Google Authenticator, 1Password o Authy.</p>
        {factor && <code className="select-all break-all rounded-md bg-fill-2 px-2 py-1 font-mono text-[11px] text-fg-3">{factor.secret}</code>}
      </div>
      <form onSubmit={verify} className="flex flex-col gap-3">
        <CodeInput value={code} onChange={setCode} />
        <ErrorText error={error} />
        <Button type="submit" disabled={!factor || code.length !== 6} className="h-11">Verificar y entrar</Button>
      </form>
    </AuthLayout>
  );
}

export function MfaVerify({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    const auth = db().auth;
    const { data } = await auth.mfa.listFactors();
    const totp = data?.totp?.[0];
    if (!totp) return setError('No hay un segundo factor configurado');
    const { error: err } = await auth.mfa.challengeAndVerify({ factorId: totp.id, code });
    if (err) setError('Código incorrecto, probá de nuevo');
    else onDone();
  };
  return (
    <AuthLayout title="Código de verificación" subtitle="Ingresá el código de 6 dígitos de tu app de autenticación.">
      <form onSubmit={verify} className="flex flex-col gap-3">
        <CodeInput value={code} onChange={setCode} />
        <ErrorText error={error} />
        <Button type="submit" icon={KeyRound} disabled={code.length !== 6} className="h-11">Verificar</Button>
      </form>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------------
// Armazón
// ---------------------------------------------------------------------------

interface NavItem<T> {
  id: T;
  label: string;
  icon: LucideIcon;
}

/** Navegación de la empresa, agrupada por lo que se viene a hacer. */
const COMPANY_NAV: { group: string; items: NavItem<CompanySection>[] }[] = [
  {
    group: 'Operación',
    items: [
      { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
      { id: 'equipos', label: 'Equipos', icon: Tv },
      { id: 'zonas', label: 'Zonas', icon: MapPin },
      { id: 'comunicados', label: 'Comunicados', icon: Megaphone },
    ],
  },
  {
    group: 'Configuración',
    items: [
      { id: 'apps', label: 'Apps', icon: AppWindow },
      { id: 'marca', label: 'Marca y cobro', icon: Palette },
      { id: 'avisos', label: 'Avisos', icon: Bell },
    ],
  },
  {
    group: 'Acceso',
    items: [
      { id: 'miembros', label: 'Miembros', icon: Users },
      { id: 'api', label: 'API', icon: Plug },
      { id: 'auditoria', label: 'Auditoría', icon: ScrollText },
    ],
  },
  {
    group: 'Ayuda',
    items: [{ id: 'guia', label: 'Guía técnica', icon: BookOpen }],
  },
];

const NEX_NAV: NavItem<NexSection>[] = [
  { id: 'nueva-empresa', label: 'Nueva empresa', icon: Building2 },
  { id: 'catalogo', label: 'Catálogo de apps', icon: Package },
  { id: 'firmware', label: 'Firmware', icon: Cpu },
  { id: 'pirateria', label: 'Anti-piratería', icon: Skull },
];

/** Lo que más se usa en la calle: queda a un toque en la barra inferior del celular. */
const MOBILE_TABS: CompanySection[] = ['resumen', 'equipos', 'comunicados'];
const ALL_COMPANY_ITEMS = COMPANY_NAV.flatMap((g) => g.items);

/** Enlace real (se puede abrir en otra pestaña) que navega sin recargar con un clic normal. */
function useRouteLink(go: (r: Route) => void) {
  return (route: Route) => ({
    href: formatRoute(route),
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      go(route);
    },
  });
}

function NavLink({ active, icon: Icon, label, link }: { active: boolean; icon: LucideIcon; label: string; link: { href: string; onClick: (e: MouseEvent<HTMLAnchorElement>) => void } }) {
  return (
    <a
      {...link}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition ${
        active ? 'bg-fill-2 font-medium text-fg' : 'text-fg-3 hover:bg-fill hover:text-fg'
      }`}
    >
      {active && <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" aria-hidden />}
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-accent' : 'text-fg-4 group-hover:text-fg-2'}`} aria-hidden />
      <span className="truncate">{label}</span>
    </a>
  );
}

function NavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-4">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function CompanyAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-accent-soft font-semibold text-accent ring-1 ring-inset ring-accent ${
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'
      }`}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Con más empresas que esto, el selector muestra un buscador (NEX administra muchas). */
const SWITCHER_SEARCH_FROM = 7;

function CompanySwitcher({ companies, current, onPick }: { companies: Company[]; current: Company; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const many = companies.length >= SWITCHER_SEARCH_FROM;
  const shown = query.trim() ? companies.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())) : companies;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      ref.current?.querySelector('button')?.focus();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const single = companies.length < 2;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setQuery('');
          setOpen((o) => !o);
        }}
        disabled={single}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={single ? `Empresa: ${current.name}` : `Empresa: ${current.name}. Cambiar de empresa`}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-fill px-2.5 py-2 text-left transition enabled:hover:border-line-strong enabled:hover:bg-fill-2 disabled:cursor-default"
      >
        <CompanyAvatar name={current.name} />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] leading-4 text-fg-4">Empresa</span>
          <span className="block truncate text-sm font-medium leading-5 text-fg">{current.name}</span>
        </span>
        {!single && <ChevronsUpDown className="h-4 w-4 shrink-0 text-fg-4" aria-hidden />}
      </button>
      {open && (
        <div className="absolute inset-x-0 z-30 mt-1.5 animate-[nexIn_.12s_ease-out] rounded-xl border border-line bg-overlay p-1 shadow-pop">
          {many && (
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar empresa…" className="mb-1" autoFocus />
          )}
          <ul role="listbox" aria-label="Empresas" className="max-h-72 overflow-y-auto">
            {shown.map((c) => (
              <li key={c.id} role="option" aria-selected={c.id === current.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onPick(c.id);
                  }}
                  className={`flex min-h-[2.25rem] w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-fill-2 ${
                    c.id === current.id ? 'font-medium text-fg' : 'text-fg-2'
                  }`}
                >
                  <CompanyAvatar name={c.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {c.id === current.id && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-2 py-3 text-center text-sm text-fg-4">Ninguna empresa coincide.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function CompanyWorkspace({
  company,
  route,
  navigate,
  onCompanyChanged,
}: {
  company: Company;
  route: Extract<Route, { scope: 'company' }>;
  navigate: (r: Route, replace?: boolean) => void;
  onCompanyChanged: () => void;
}) {
  const data = useCompanyData(company.id);
  const go = (section: CompanySection, extra: { filter?: string; device?: string; zone?: string } = {}) =>
    navigate({ scope: 'company', companyId: company.id, section, ...extra });
  /** Equipos con un filtro de estado y, si se pasa, una zona (id o "sin-zona"). Lo que no existe se ignora. */
  const goDevices = (filter: string, zone?: string) =>
    go('equipos', {
      filter: filter !== 'todos' && FILTERS.some((f) => f.id === filter) ? filter : undefined,
      zone: zone && (zone === NO_ZONE || data.zones.some((z) => z.zone_id === zone)) ? zone : undefined,
    });

  switch (route.section) {
    case 'equipos':
      return (
        <DevicesPage
          key={`${route.filter ?? 'todos'}|${route.zone ?? ''}`}
          company={company}
          data={data}
          initialFilter={route.filter}
          initialZone={route.zone}
          goZones={() => go('zonas')}
          initialClaim={initialClaim}
          selectedId={route.device ?? null}
          onSelect={(id) => navigate({ ...route, device: id ?? undefined }, true)}
        />
      );
    case 'zonas':
      return <ZonesPage company={company} data={data} goDevices={goDevices} goAlerts={() => go('avisos')} />;
    case 'apps':
      return <AppsPage company={company} />;
    case 'marca':
      return <BrandPage company={company} onChanged={onCompanyChanged} />;
    case 'avisos':
      return <AlertsPage company={company} onChanged={onCompanyChanged} />;
    case 'comunicados':
      return <NoticesPage company={company} deviceCount={data.devices?.length ?? null} devices={data.devices} zones={data.zones} goZones={() => go('zonas')} />;
    case 'miembros':
      return <MembersPage company={company} />;
    case 'api':
      return <ApiKeysPage company={company} />;
    case 'auditoria':
      return <AuditPage company={company} />;
    case 'guia':
      return <GuidePage company={company} />;
    default:
      return (
        <OverviewPage
          company={company}
          data={data}
          goDevices={goDevices}
          goZones={() => go('zonas')}
          openDevice={(id) => go('equipos', { device: id })}
        />
      );
  }
}

/** Menú lateral del celular: se desliza desde la izquierda y encierra el foco mientras está abierto. */
function MobileNav({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useLayer(ref, onClose);
  return (
    <div className="fixed inset-0 z-40 animate-[nexFade_.15s_ease-out] bg-scrim lg:hidden" onMouseDown={onClose}>
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="h-full w-[min(19rem,88vw)] animate-[nexSlideLeft_.2s_ease-out] border-r border-line bg-surface shadow-pop outline-none"
      >
        {children}
      </aside>
    </div>
  );
}

export function Shell({ session }: { session: Session }) {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [route, navigate] = useRoute();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      run<Company[]>(db().from('mdm_companies').select('*').order('name')),
      run<boolean>(db().rpc('mdm_is_super_admin')),
    ]).then(
      ([list, sup]) => {
        if (cancelled) return;
        setCompanies(list);
        setIsSuper(sup);
      },
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // Ruta inicial: primera empresa (en Equipos si llegó un QR de vinculación).
  const effective: Route = useMemo(() => {
    if (!companies) return route;
    const valid = route.scope === 'company' && companies.some((c) => c.id === route.companyId);
    if (valid || (route.scope === 'nex' && isSuper)) return route;
    if (companies[0]) return { scope: 'company', companyId: companies[0].id, section: initialClaim ? 'equipos' : 'resumen' };
    return isSuper ? { scope: 'nex', section: 'nueva-empresa' } : { scope: 'home' };
  }, [companies, route, isSuper]);

  const current = effective.scope === 'company' ? companies?.find((c) => c.id === effective.companyId) : undefined;
  const switcherCompany = current ?? companies?.[0];
  const nav = (r: Route) => {
    setMobileNav(false);
    navigate(r);
  };
  const link = useRouteLink(nav);
  const email = session.user.email ?? '';
  const sectionLabel =
    effective.scope === 'company'
      ? ALL_COMPANY_ITEMS.find((n) => n.id === effective.section)?.label
      : effective.scope === 'nex'
        ? NEX_NAV.find((n) => n.id === effective.section)?.label
        : undefined;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Logo />
        <IconButton icon={X} label="Cerrar menú" className="-mr-1.5 lg:hidden" onClick={() => setMobileNav(false)} />
      </div>
      <div className="px-3 pb-3">
        {companies && switcherCompany ? (
          <CompanySwitcher
            companies={companies}
            current={switcherCompany}
            onPick={(id) => nav({ scope: 'company', companyId: id, section: effective.scope === 'company' ? effective.section : 'resumen' })}
          />
        ) : (
          !companies && !error && <Skeleton className="h-[54px]" />
        )}
      </div>
      <nav aria-label="Secciones" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-1">
        {switcherCompany &&
          COMPANY_NAV.map((g) => (
            <NavGroup key={g.group} title={g.group}>
              {g.items.map((n) => (
                <NavLink key={n.id} icon={n.icon} label={n.label}
                  active={effective.scope === 'company' && effective.section === n.id}
                  link={link({ scope: 'company', companyId: switcherCompany.id, section: n.id })} />
              ))}
            </NavGroup>
          ))}
        {isSuper && (
          <NavGroup title="Administración NEX">
            {NEX_NAV.map((n) => (
              <NavLink key={n.id} icon={n.icon} label={n.label}
                active={effective.scope === 'nex' && effective.section === n.id}
                link={link({ scope: 'nex', section: n.id })} />
            ))}
          </NavGroup>
        )}
      </nav>
      <div className="flex shrink-0 flex-col gap-2 border-t border-line p-3">
        <DownloadApk />
        <ThemeToggle className="w-full" />
        <div className="flex items-center gap-2.5 px-1 pt-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fill-2 text-xs font-semibold text-fg-2 ring-1 ring-inset ring-line" aria-hidden>
            {(email || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] leading-5 text-fg" title={email}>{email}</div>
            <div className="text-[11px] leading-4 text-fg-4">{isSuper ? 'NEX · super-admin' : 'Administrador'}</div>
          </div>
          <Menu
            trigger={(toggle, open) => (
              <IconButton icon={LogOut} label="Opciones de sesión" aria-haspopup="menu" aria-expanded={open} onClick={toggle} />
            )}
            items={[
              { label: 'Cambiar contraseña', icon: KeyRound, onClick: () => setChangePassword(true) },
              { label: 'Cerrar sesión', icon: LogOut, onClick: () => db().auth.signOut() },
              // Revoca los refresh tokens en todos los navegadores (ej. si se perdió un celular).
              { label: 'Cerrar en todos los dispositivos', icon: MonitorX, danger: true, onClick: () => db().auth.signOut({ scope: 'global' }) },
            ]}
            placement="top"
          />
        </div>
        {changePassword && <ChangePasswordModal email={email} onClose={() => setChangePassword(false)} />}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh]">
      <button
        type="button"
        data-noprint
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        onClick={() => document.getElementById('contenido')?.focus()}
      >
        Ir al contenido
      </button>
      <aside data-noprint className="sticky top-0 hidden h-[100dvh] w-[264px] shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>
      {mobileNav && <MobileNav onClose={() => setMobileNav(false)}>{sidebar}</MobileNav>}

      <div className="flex min-w-0 flex-1 flex-col">
        <header data-noprint className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 lg:hidden">
          <IconButton icon={MenuIcon} label="Abrir menú" aria-haspopup="dialog" onClick={() => setMobileNav(true)} />
          {current ? (
            <button type="button" onClick={() => setMobileNav(true)} aria-label={`Empresa: ${current.name}. Abrir menú`} className="flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 text-left">
              <CompanyAvatar name={current.name} />
              <span className="truncate text-[15px] font-semibold text-fg">{current.name}</span>
            </button>
          ) : (
            <span className="truncate text-[15px] font-semibold text-fg">{sectionLabel ?? 'NEX MDM'}</span>
          )}
        </header>

        <main id="contenido" tabIndex={-1} className={`mx-auto w-full max-w-[1360px] flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-8 ${current ? 'pb-24 lg:pb-10' : 'pb-10'}`}>
          {companies && <ErrorText error={error} />}
          {!companies ? (
            error ? (
              <div className="mx-auto mt-16 max-w-md">
                <ErrorState title="No pudimos cargar el panel" error={error} onRetry={() => { setError(null); setTick((t) => t + 1); }} />
              </div>
            ) : (
              <div className="flex flex-col gap-4" role="status" aria-label="Cargando">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32" />
                <Skeleton className="h-64" />
              </div>
            )
          ) : effective.scope === 'company' && current ? (
            <CompanyWorkspace key={current.id} company={current} route={effective} navigate={navigate} onCompanyChanged={() => setTick((t) => t + 1)} />
          ) : effective.scope === 'nex' && effective.section === 'nueva-empresa' ? (
            <NewCompanyPage onCreated={(id) => { setTick((t) => t + 1); navigate({ scope: 'company', companyId: id, section: 'resumen' }); }} />
          ) : effective.scope === 'nex' && effective.section === 'catalogo' ? (
            <CatalogPage />
          ) : effective.scope === 'nex' && effective.section === 'firmware' ? (
            <FirmwarePage companies={companies} />
          ) : effective.scope === 'nex' && effective.section === 'pirateria' ? (
            <PiracyPage />
          ) : (
            <div className="mx-auto mt-16 max-w-md">
              <EmptyState icon={Building2} title="Todavía no tenés acceso a ninguna empresa">
                Pedile a NEX o al dueño de tu empresa que te agregue como miembro.
              </EmptyState>
            </div>
          )}
        </main>

        {current && (
          <nav data-noprint aria-label="Accesos rápidos" className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface lg:hidden">
            <div className="mx-auto grid h-14 max-w-md grid-cols-4">
              {MOBILE_TABS.map((id) => {
                const item = ALL_COMPANY_ITEMS.find((n) => n.id === id)!;
                const active = effective.scope === 'company' && effective.section === id;
                return (
                  <a
                    key={id}
                    {...link({ scope: 'company', companyId: current.id, section: id })}
                    aria-current={active ? 'page' : undefined}
                    className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${active ? 'text-accent' : 'text-fg-3'}`}
                  >
                    <item.icon className="h-5 w-5" aria-hidden />
                    {item.label}
                  </a>
                );
              })}
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setMobileNav(true)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${
                  effective.scope !== 'company' || !MOBILE_TABS.includes(effective.section) ? 'text-accent' : 'text-fg-3'
                }`}
              >
                <Ellipsis className="h-5 w-5" aria-hidden />
                Más
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

export default function AdminApp() {
  if (!isAdminSupabaseConfigured) {
    return <p className="p-8 text-fg-2">Falta configurar VITE_SUPABASE_URL y la clave pública.</p>;
  }
  return (
    <ToastProvider>
      <AdminRoot />
    </ToastProvider>
  );
}

function AdminRoot() {
  const { session, stage, refresh } = useAuthStage();
  // Link de un email de invitación o recuperación (se lee una vez; AcceptLink lo saca de la URL).
  const [link, setLink] = useState(() => parseAuthLink(window.location.search, window.location.hash));
  if (link) return <AcceptLink link={link} Layout={AuthLayout} onDone={() => { setLink(null); void refresh(); }} />;
  if (stage === 'loading') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6" role="status" aria-label="Cargando el panel">
        <Logo size="lg" />
        <LoaderCircle className="h-5 w-5 animate-spin text-fg-4" aria-hidden />
      </div>
    );
  }
  if (stage === 'signed-out' || !session) return <SignIn />;
  // Después del link: primero la contraseña. Si la cuenta ya tiene TOTP, Supabase exige el código antes (mfa-verify).
  const pending = passwordPending();
  if (pending && (stage === 'mfa-enroll' || stage === 'ready')) {
    return <SetPassword email={session.user.email ?? ''} type={pending} Layout={AuthLayout} onDone={() => void refresh()} />;
  }
  if (stage === 'mfa-enroll') return <MfaEnroll onDone={refresh} />;
  if (stage === 'mfa-verify') return <MfaVerify onDone={refresh} />;
  return (
    <StepUpProvider>
      <IdleGuard idleMinutes={15} />
      <Shell session={session} />
    </StepUpProvider>
  );
}
