import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AppWindow,
  Bell,
  Building2,
  ChevronDown,
  Cpu,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
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
import { isSupabaseConfigured } from '../lib/supabase';
import { db, run, type Company } from './api';
import { FILTERS } from './deviceMeta';
import AlertsPage from './pages/Alerts';
import AppsPage from './pages/Apps';
import BrandPage from './pages/Brand';
import DevicesPage from './pages/Devices';
import { CatalogPage, FirmwarePage, NewCompanyPage, PiracyPage } from './pages/Nex';
import OverviewPage from './pages/Overview';
import { ApiKeysPage, AuditPage, MembersPage } from './pages/Team';
import { takeClaimParam, useRoute, type CompanySection, type NexSection, type Route } from './routing';
import { Button, ErrorText, Field, inputClass, Skeleton, ToastProvider } from './ui';
import { useCompanyData } from './useCompanyData';

const initialClaim = takeClaimParam();

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
  const box = size === 'lg' ? 'h-11 w-11 rounded-2xl' : 'h-8 w-8 rounded-xl';
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex items-center justify-center bg-gradient-to-br from-indigo-400 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ${box}`}>
        <Tv className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden />
      </div>
      <div className="leading-tight">
        <div className={`font-semibold tracking-tight text-white ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>NEX MDM</div>
        <div className="text-[11px] text-zinc-500">Gestión de TV box</div>
      </div>
    </div>
  );
}

function AuthLayout({ title, subtitle, step, children }: { title: string; subtitle: string; step?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo size="lg" /></div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#11131b]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          {step && <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-indigo-300">{step}</div>}
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-zinc-400">{subtitle}</p>
          {children}
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-zinc-600">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Acceso protegido con segundo factor
        </p>
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const auth = db().auth;
      if (mode === 'in') {
        const { error: err } = await auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        if (password.length < 12) throw new Error('Usá una contraseña de al menos 12 caracteres');
        const { error: err } = await auth.signUp({ email, password });
        if (err) throw err;
        setInfo('Revisá tu email para confirmar la cuenta. Después, NEX o el dueño de tu empresa te da acceso.');
      }
    } catch (err) {
      // Mensaje genérico: no revelar si el email existe.
      setError(mode === 'in' ? 'Email o contraseña incorrectos' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={mode === 'in' ? 'Ingresar' : 'Crear cuenta'}
      subtitle={mode === 'in' ? 'Administrá los equipos de tu empresa' : 'Para técnicos y administradores de empresas'}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Contraseña" hint={mode === 'up' ? 'Mínimo 12 caracteres' : undefined}>
          <input className={inputClass} type="password" required minLength={mode === 'up' ? 12 : undefined}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorText error={error} />
        {info && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{info}</p>}
        <Button type="submit" disabled={busy} className="h-10">{mode === 'in' ? 'Ingresar' : 'Crear cuenta'}</Button>
        <button type="button" className="text-sm text-zinc-400 transition hover:text-white" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? '¿No tenés cuenta? Crear una' : 'Ya tengo cuenta'}
        </button>
      </form>
    </AuthLayout>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.5em]`}
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

function MfaEnroll({ onDone }: { onDone: () => void }) {
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
        {factor ? <img src={factor.qr} alt="Código QR para la app de autenticación" className="h-44 w-44 rounded-xl bg-white p-2" /> : <Skeleton className="h-44 w-44" />}
        <p className="text-center text-xs text-zinc-500">Escaneá con Google Authenticator, 1Password o Authy.</p>
        {factor && <code className="break-all rounded bg-white/[0.05] px-2 py-1 text-[11px] text-zinc-400">{factor.secret}</code>}
      </div>
      <form onSubmit={verify} className="flex flex-col gap-3">
        <CodeInput value={code} onChange={setCode} />
        <ErrorText error={error} />
        <Button type="submit" disabled={!factor || code.length !== 6} className="h-10">Verificar y entrar</Button>
      </form>
    </AuthLayout>
  );
}

function MfaVerify({ onDone }: { onDone: () => void }) {
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
        <Button type="submit" icon={KeyRound} disabled={code.length !== 6} className="h-10">Verificar</Button>
      </form>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------------
// Armazón
// ---------------------------------------------------------------------------

const COMPANY_NAV: { id: CompanySection; label: string; icon: LucideIcon }[] = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'equipos', label: 'Equipos', icon: Tv },
  { id: 'apps', label: 'Apps', icon: AppWindow },
  { id: 'marca', label: 'Marca y cobro', icon: Palette },
  { id: 'avisos', label: 'Avisos', icon: Bell },
  { id: 'miembros', label: 'Miembros', icon: Users },
  { id: 'api', label: 'API', icon: Plug },
  { id: 'auditoria', label: 'Auditoría', icon: ScrollText },
];

const NEX_NAV: { id: NexSection; label: string; icon: LucideIcon }[] = [
  { id: 'nueva-empresa', label: 'Nueva empresa', icon: Building2 },
  { id: 'catalogo', label: 'Catálogo de apps', icon: Package },
  { id: 'firmware', label: 'Firmware', icon: Cpu },
  { id: 'pirateria', label: 'Anti-piratería', icon: Skull },
];

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-indigo-300' : 'text-zinc-500 group-hover:text-zinc-300'}`} aria-hidden />
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

function CompanySwitcher({ companies, current, onPick }: { companies: Company[]; current: Company; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={companies.length < 2}
        className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.05] disabled:cursor-default"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-600 to-zinc-800 text-xs font-bold text-white">
          {current.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-wider text-zinc-500">Empresa</span>
          <span className="block truncate text-sm font-medium text-zinc-100">{current.name}</span>
        </span>
        {companies.length > 1 && <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${open ? 'rotate-180' : ''}`} aria-hidden />}
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#171a24] p-1 shadow-xl">
          {companies.map((c) => (
            <button key={c.id} onClick={() => { setOpen(false); onPick(c.id); }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/[0.06] ${c.id === current.id ? 'text-white' : 'text-zinc-400'}`}>
              {c.name}
            </button>
          ))}
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
  const go = (section: CompanySection, extra: { filter?: string; device?: string } = {}) =>
    navigate({ scope: 'company', companyId: company.id, section, ...extra });

  switch (route.section) {
    case 'equipos':
      return (
        <DevicesPage
          key={route.filter ?? 'todos'}
          company={company}
          data={data}
          initialFilter={route.filter}
          initialClaim={initialClaim}
          selectedId={route.device ?? null}
          onSelect={(id) => navigate({ ...route, device: id ?? undefined }, true)}
        />
      );
    case 'apps':
      return <AppsPage company={company} />;
    case 'marca':
      return <BrandPage company={company} onChanged={onCompanyChanged} />;
    case 'avisos':
      return <AlertsPage company={company} onChanged={onCompanyChanged} />;
    case 'miembros':
      return <MembersPage company={company} />;
    case 'api':
      return <ApiKeysPage company={company} />;
    case 'auditoria':
      return <AuditPage company={company} />;
    default:
      return (
        <OverviewPage
          company={company}
          data={data}
          goDevices={(filter) => go('equipos', { filter: FILTERS.some((f) => f.id === filter) ? filter : undefined })}
          openDevice={(id) => go('equipos', { device: id })}
        />
      );
  }
}

function Shell({ session }: { session: Session }) {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
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

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between px-1">
        <Logo />
        <button className="text-zinc-400 lg:hidden" aria-label="Cerrar menú" onClick={() => setMobileNav(false)}><X className="h-5 w-5" /></button>
      </div>
      {companies && switcherCompany && (
        <CompanySwitcher
          companies={companies}
          current={switcherCompany}
          onPick={(id) => nav({ scope: 'company', companyId: id, section: effective.scope === 'company' ? effective.section : 'resumen' })}
        />
      )}
      {switcherCompany && (
        <nav className="flex flex-col gap-0.5">
          {COMPANY_NAV.map((n) => (
            <NavButton key={n.id} icon={n.icon} label={n.label}
              active={effective.scope === 'company' && effective.section === n.id}
              onClick={() => nav({ scope: 'company', companyId: switcherCompany.id, section: n.id })} />
          ))}
        </nav>
      )}
      {isSuper && (
        <nav className="flex flex-col gap-0.5">
          <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Administración NEX</div>
          {NEX_NAV.map((n) => (
            <NavButton key={n.id} icon={n.icon} label={n.label}
              active={effective.scope === 'nex' && effective.section === n.id}
              onClick={() => nav({ scope: 'nex', section: n.id })} />
          ))}
        </nav>
      )}
      <div className="mt-auto flex items-center gap-3 rounded-xl border border-white/[0.06] px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-200">
          {(session.user.email ?? '?').slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-zinc-200">{session.user.email}</div>
          <div className="text-[10px] text-zinc-500">{isSuper ? 'NEX · super-admin' : 'Administrador'}</div>
        </div>
        <button className="text-zinc-500 transition hover:text-white" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => db().auth.signOut()}>
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/[0.06] bg-[#0c0e14]/80 backdrop-blur lg:block">{sidebar}</aside>
      {mobileNav && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNav(false)}>
          <aside className="h-full w-72 animate-[nexSlide_.2s_ease-out] border-r border-white/10 bg-[#0c0e14]" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-[#0a0b10]/80 px-4 py-3 backdrop-blur lg:hidden">
          <button aria-label="Abrir menú" className="text-zinc-300" onClick={() => setMobileNav(true)}><MenuIcon className="h-5 w-5" /></button>
          <span className="truncate text-sm font-medium text-white">{current?.name ?? 'NEX MDM'}</span>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <ErrorText error={error} />
          {!companies ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-32" />
              <Skeleton className="h-64" />
            </div>
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
            <div className="mx-auto mt-20 max-w-md text-center">
              <Building2 className="mx-auto mb-4 h-10 w-10 text-zinc-600" aria-hidden />
              <h1 className="text-lg font-semibold text-white">Todavía no tenés acceso a ninguna empresa</h1>
              <p className="mt-2 text-sm text-zinc-400">Pedile a NEX o al dueño de tu empresa que te agregue como miembro.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function AdminApp() {
  if (!isSupabaseConfigured) {
    return <p className="p-8 text-zinc-300">Falta configurar VITE_SUPABASE_URL y la clave pública.</p>;
  }
  return (
    <ToastProvider>
      <AdminRoot />
    </ToastProvider>
  );
}

function AdminRoot() {
  const { session, stage, refresh } = useAuthStage();
  if (stage === 'loading') {
    return <div className="flex min-h-screen items-center justify-center"><Logo size="lg" /></div>;
  }
  if (stage === 'signed-out' || !session) return <SignIn />;
  if (stage === 'mfa-enroll') return <MfaEnroll onDone={refresh} />;
  if (stage === 'mfa-verify') return <MfaVerify onDone={refresh} />;
  return <Shell session={session} />;
}
