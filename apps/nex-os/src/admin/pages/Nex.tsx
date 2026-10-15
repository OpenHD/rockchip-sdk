import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Globe, Pencil, Plus, ShieldCheck, Skull } from 'lucide-react';
import { db, run, type CatalogApp, type DomainReportRow } from '../api';
import { appGradient, relativeTime } from '../format';
import { useToast } from '../toast';
import { Badge, Button, Card, Chip, EmptyState, ErrorText, Field, IconButton, inputClass, Modal, PageHeader, Skeleton, Switch, type Tone } from '../ui';

export function NewCompanyPage({ onCreated }: { onCreated: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await run<string>(db().rpc('mdm_create_company', { p_name: name, p_owner_email: email }));
      toast.show(`Empresa "${name}" creada`);
      onCreated(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader title="Nueva empresa" subtitle="Cada empresa (ISP, cableoperador) administra solo sus equipos" />
      <Card className="max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Nombre comercial"><input className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Fibra" /></Field>
          <Field label="Email del dueño" hint="Tiene que haber creado su cuenta en este panel.">
            <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dueño@acmefibra.com" />
          </Field>
          <ErrorText error={error} />
          <Button type="submit" icon={Building2} disabled={busy}>Crear empresa</Button>
        </form>
      </Card>
    </>
  );
}

const EMPTY_APP: CatalogApp = { id: '', name: '', kind: 'web', launch_url: '', icon_url: null, domains: [], active: true };

function CatalogModal({ initial, isNew, onClose, onSaved }: { initial: CatalogApp; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [domains, setDomains] = useState(initial.domains.join('\n'));
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await run(db().rpc('mdm_upsert_catalog_app', {
        p_id: form.id.trim(), p_name: form.name.trim(), p_kind: form.kind,
        p_launch_url: form.kind === 'web' ? form.launch_url : null, p_icon_url: null,
        p_domains: domains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean), p_active: form.active,
      }));
      toast.show(`${form.name} guardada en el catálogo`);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Modal title={isNew ? 'Agregar app al catálogo' : `Editar ${initial.name}`} onClose={onClose} width="max-w-xl">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ID" hint="Minúsculas y guiones"><input className={`${inputClass} font-mono`} required disabled={!isNew} pattern="[a-z0-9][a-z0-9-]{1,40}" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></Field>
          <Field label="Nombre"><input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['web', 'internal'] as const).map((k) => (
            <button type="button" key={k} onClick={() => setForm({ ...form, kind: k })}
              className={`rounded-xl border p-3 text-left transition ${form.kind === k ? 'border-indigo-400/60 bg-indigo-500/15' : 'border-white/10 hover:border-white/20'}`}>
              <div className="text-sm font-medium text-white">{k === 'web' ? 'Web / streaming' : 'App de NEX-OS'}</div>
              <div className="text-xs text-zinc-400">{k === 'web' ? 'Abre una URL en pantalla completa' : 'App integrada (id = appId)'}</div>
            </button>
          ))}
        </div>
        {form.kind === 'web' && (
          <Field label="URL de inicio"><input className={inputClass} type="url" pattern="https://.*" required value={form.launch_url ?? ''} onChange={(e) => setForm({ ...form, launch_url: e.target.value })} placeholder="https://www.netflix.com/browse" /></Field>
        )}
        <Field label="Dominios permitidos" hint="Uno por línea. Incluye subdominios. Revisá la pestaña Anti-piratería para encontrar los que faltan.">
          <textarea className={`${inputClass} font-mono text-xs`} rows={6} value={domains} onChange={(e) => setDomains(e.target.value)} />
        </Field>
        <label className="flex items-center justify-between rounded-xl border border-white/[0.07] px-4 py-3">
          <span className="text-sm text-zinc-200">Visible para las empresas</span>
          <Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Activa" />
        </label>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}

export function CatalogPage() {
  const [apps, setApps] = useState<CatalogApp[] | null>(null);
  const [editing, setEditing] = useState<{ app: CatalogApp; isNew: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    run<CatalogApp[]>(db().from('mdm_app_catalog').select('*').order('name')).then(
      (a) => !cancelled && setApps(a),
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <>
      <PageHeader
        title="Catálogo de apps"
        subtitle="Apps que las empresas pueden habilitar en sus equipos"
        actions={<Button icon={Plus} onClick={() => setEditing({ app: EMPTY_APP, isNew: true })}>Agregar app</Button>}
      />
      <ErrorText error={error} />
      {!apps ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {apps.map((a) => (
            <div key={a.id} className="flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white ${appGradient(a.id)}`}>{a.name.charAt(0)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">{a.name}</span>
                  {!a.active && <Badge>Oculta</Badge>}
                  {a.kind === 'internal' && <Badge tone="info">NEX-OS</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.domains.slice(0, 5).map((d) => <span key={d} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{d}</span>)}
                  {a.domains.length > 5 && <span className="text-[10px] text-zinc-500">+{a.domains.length - 5}</span>}
                </div>
              </div>
              <IconButton icon={Pencil} label="Editar" onClick={() => setEditing({ app: a, isNew: false })} />
            </div>
          ))}
        </div>
      )}
      {editing && <CatalogModal initial={editing.app} isNew={editing.isNew} onClose={() => setEditing(null)} onSaved={() => setTick((t) => t + 1)} />}
    </>
  );
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pirateria: { label: 'Piratería', tone: 'danger' },
  legitimo: { label: 'Legítimo', tone: 'success' },
  ignorar: { label: 'Ignorado', tone: 'neutral' },
};

export function PiracyPage() {
  const toast = useToast();
  const [rows, setRows] = useState<DomainReportRow[] | null>(null);
  const [days, setDays] = useState(14);
  const [onlyPending, setOnlyPending] = useState(true);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    run<DomainReportRow[]>(db().rpc('mdm_blocked_domain_report', { p_days: days })).then(
      (r) => !cancelled && setRows(r),
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [days, tick]);

  const classify = async (domain: string, status: string | null) => {
    try {
      await run(db().rpc('mdm_classify_domain', { p_domain: domain, p_status: status }));
      toast.show(status === 'pirateria' ? `${domain} bloqueado en todos los equipos` : `${domain} clasificado`);
      setTick((t) => t + 1);
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  };

  const shown = (rows ?? []).filter((r) => !onlyPending || !r.status);
  const max = Math.max(1, ...(rows ?? []).map((r) => r.devices));

  return (
    <>
      <PageHeader
        title="Revisión anti-piratería"
        subtitle="Dominios que los equipos intentaron abrir y quedaron bloqueados (solo dominio, nunca la URL)"
        actions={
          <select className={`${inputClass} w-auto`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 7, 14, 30, 90].map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
          </select>
        }
      />
      <div className="mb-4 flex gap-2">
        <Chip active={onlyPending} onClick={() => setOnlyPending(true)} count={(rows ?? []).filter((r) => !r.status).length}>Pendientes</Chip>
        <Chip active={!onlyPending} onClick={() => setOnlyPending(false)} count={rows?.length}>Todos</Chip>
      </div>
      <ErrorText error={error} />
      <Card padded={false}>
        {!rows ? (
          <div className="p-5"><Skeleton className="h-40" /></div>
        ) : shown.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nada pendiente de revisar">Cuando los equipos choquen con dominios nuevos van a aparecer acá.</EmptyState>
        ) : (
          <ul className="divide-y divide-white/[0.05] pb-2">
            {shown.map((r) => (
              <li key={r.domain} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-400">
                    {r.status === 'pirateria' ? <Skull className="h-4 w-4 text-rose-300" aria-hidden /> : <Globe className="h-4 w-4" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm text-zinc-100">{r.domain}</span>
                      {r.status && <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-indigo-400/70" style={{ width: `${(r.devices / max) * 100}%` }} />
                      </div>
                      {r.devices} equipos · {r.companies} empresas · {r.hits} intentos · {relativeTime(r.last_seen_at)}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="danger" icon={Skull} onClick={() => classify(r.domain, 'pirateria')}>Piratería</Button>
                  <Button size="sm" variant="secondary" onClick={() => classify(r.domain, 'legitimo')}>Legítimo</Button>
                  <Button size="sm" variant="ghost" onClick={() => classify(r.domain, r.status ? null : 'ignorar')}>{r.status ? 'Reabrir' : 'Ignorar'}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-zinc-500">
        "Piratería" lo bloquea en todos los equipos, aunque esté dentro de una app permitida. "Legítimo" significa que falta en el catálogo:
        agregalo a la app que corresponda.
      </p>
    </>
  );
}
