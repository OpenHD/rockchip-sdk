import { useEffect, useState, type FormEvent } from 'react';
import { BadgeCheck, Building2, Cpu, Globe, Pencil, Plus, Rocket, ShieldCheck, Skull } from 'lucide-react';
import { db, run, type CatalogApp, type Company, type DomainReportRow, type FirmwareRelease, type FirmwareTarget } from '../api';
import { appGradient, formatDate, relativeTime } from '../format';
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

const setCatalogAttestation = (id: string, enabled: boolean) =>
  run(db().rpc('mdm_set_catalog_attestation', { p_id: id, p_enabled: enabled }));

export function CatalogPage() {
  const toast = useToast();
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

  const toggleAttestation = async (a: CatalogApp, enabled: boolean) => {
    setApps((prev) => prev?.map((x) => (x.id === a.id ? { ...x, pass_attestation: enabled } : x)) ?? prev);
    try {
      await setCatalogAttestation(a.id, enabled);
      toast.show(enabled ? `${a.name} recibe la atestación del equipo` : `${a.name} ya no recibe la atestación`);
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
    setTick((t) => t + 1);
  };

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
                {a.kind === 'web' && (
                  <label className="mt-3 flex items-center gap-3 text-xs text-zinc-400" title="Al abrirla, el TV le pasa al servicio un token firmado que prueba que es un equipo activo de la empresa">
                    <Switch checked={!!a.pass_attestation} onChange={(v) => toggleAttestation(a, v)} label={`Pasa atestación: ${a.name}`} />
                    <span className="flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Pasa atestación</span>
                  </label>
                )}
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

// ---------------------------------------------------------------------------
// Firmware (OTA)
// ---------------------------------------------------------------------------

// RPC de v8 en un solo lugar (contrato NEX MDM v8).
const listReleases = () => run<FirmwareRelease[]>(db().rpc('mdm_list_releases'));
const listTargets = () => run<FirmwareTarget[]>(db().rpc('mdm_list_firmware_targets'));
const publishRelease = (r: { version: string; build: number; url: string; sha256: string; size: number; sig: string; notes: string | null }) =>
  run<string>(
    db().rpc('mdm_publish_release', {
      p_version: r.version, p_build: r.build, p_url: r.url, p_sha256: r.sha256, p_size: r.size, p_sig: r.sig, p_notes: r.notes,
    }),
  );
const setFirmwareTarget = (company: string | null, release: string | null) =>
  run(db().rpc('mdm_set_firmware_target', { p_company: company, p_release: release }));

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const EMPTY_RELEASE = { version: '', build: '', url: '', sha256: '', size: '', sig: '', notes: '' };

function PublishModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(EMPTY_RELEASE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY_RELEASE) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await publishRelease({
        version: f.version.trim(),
        build: Number(f.build),
        url: f.url.trim(),
        sha256: f.sha256.trim().toLowerCase(),
        size: Number(f.size),
        sig: f.sig.replace(/\s+/g, ''),
        notes: f.notes.trim() || null,
      });
      toast.show(`Release ${f.version} (build ${f.build}) publicado. Asignalo para distribuirlo.`);
      onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Publicar release" description="Firmado offline con la clave de releases. Publicar no lo distribuye: hay que asignarlo." onClose={onClose} width="max-w-2xl">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Versión"><input className={`${inputClass} font-mono`} required pattern="[A-Za-z0-9][A-Za-z0-9._+\-]{0,63}" value={f.version} onChange={set('version')} placeholder="1.4.0" /></Field>
          <Field label="Build" hint="Entero, mayor que el anterior"><input className={`${inputClass} font-mono`} required type="number" min={1} step={1} value={f.build} onChange={set('build')} /></Field>
          <Field label="Tamaño (bytes)"><input className={`${inputClass} font-mono`} required type="number" min={1} step={1} value={f.size} onChange={set('size')} /></Field>
        </div>
        <Field label="URL de descarga"><input className={`${inputClass} font-mono text-xs`} required type="url" pattern="https://.*" value={f.url} onChange={set('url')} placeholder="https://…/nex-os-1.4.0.img" /></Field>
        <Field label="SHA-256"><input className={`${inputClass} font-mono text-xs`} required pattern="[0-9a-fA-F]{64}" value={f.sha256} onChange={set('sha256')} /></Field>
        <Field label="Firma (base64)" hint="RS256 sobre nex-update:v1:<build>:<sha256> con la clave de releases.">
          <textarea className={`${inputClass} font-mono text-xs`} required rows={4} value={f.sig} onChange={set('sig')} />
        </Field>
        <Field label="Notas (opcional)"><textarea className={inputClass} rows={3} maxLength={2000} value={f.notes} onChange={set('notes')} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" icon={Rocket} disabled={busy}>Publicar</Button>
        </div>
      </form>
    </Modal>
  );
}

function TargetSelect({ value, releases, onChange, noneLabel }: { value: string | null; releases: FirmwareRelease[]; onChange: (v: string | null) => void; noneLabel: string }) {
  return (
    <select className={`${inputClass} w-auto min-w-[14rem]`} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{noneLabel}</option>
      {releases.map((r) => (
        <option key={r.id} value={r.id}>{r.version} (build {r.build})</option>
      ))}
    </select>
  );
}

export function FirmwarePage({ companies }: { companies: Company[] }) {
  const toast = useToast();
  const [releases, setReleases] = useState<FirmwareRelease[] | null>(null);
  const [targets, setTargets] = useState<FirmwareTarget[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listReleases(), listTargets()]).then(
      ([r, t]) => {
        if (cancelled) return;
        setReleases(r);
        setTargets(t);
        setError(null);
      },
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const targetOf = (company: string | null) => targets.find((t) => t.company_id === company)?.release_id ?? null;
  const global = targets.find((t) => t.company_id === null) ?? null;

  const assign = async (company: Company | null, release: string | null) => {
    try {
      await setFirmwareTarget(company?.id ?? null, release);
      const r = releases?.find((x) => x.id === release);
      const who = company ? company.name : 'todos los equipos';
      toast.show(r ? `${who}: build ${r.build} asignado` : company ? `${company.name} vuelve a usar el firmware global` : 'Sin firmware global asignado');
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
    setTick((t) => t + 1);
  };

  return (
    <>
      <PageHeader
        title="Firmware"
        subtitle="Actualizaciones del sistema (OTA). El equipo verifica la firma y solo instala builds más nuevos que el suyo."
        actions={<Button icon={Plus} onClick={() => setPublishing(true)}>Publicar release</Button>}
      />
      <ErrorText error={error} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Releases" className="xl:col-span-3" padded={false}>
          {!releases ? (
            <div className="p-5"><Skeleton className="h-32" /></div>
          ) : releases.length === 0 ? (
            <EmptyState icon={Cpu} title="Sin releases publicados" />
          ) : (
            <ul className="divide-y divide-white/[0.05] pb-2">
              {releases.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-zinc-100">{r.version}</span>
                    <Badge>build {r.build}</Badge>
                    {global?.release_id === r.id && <Badge tone="info">Global</Badge>}
                    {targets.some((t) => t.company_id && t.release_id === r.id) && (
                      <Badge tone="neutral">{targets.filter((t) => t.company_id && t.release_id === r.id).length} empresas</Badge>
                    )}
                    <span className="ml-auto text-xs text-zinc-500">{formatDate(r.created_at)}</span>
                  </div>
                  <div className="truncate font-mono text-[11px] text-zinc-500" title={r.url}>{formatSize(r.size)} · sha256 {r.sha256.slice(0, 16)}… · {r.url}</div>
                  {r.notes && <p className="whitespace-pre-line text-xs text-zinc-400">{r.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Distribución" description="Una empresa con firmware propio ignora el global." className="xl:col-span-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-zinc-300">Global (todas las empresas)</span>
              <TargetSelect value={targetOf(null)} releases={releases ?? []} noneLabel="Ninguno" onChange={(v) => assign(null, v)} />
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <div className="mb-2 text-xs font-medium text-zinc-300">Por empresa</div>
              <ul className="flex flex-col gap-2">
                {companies.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-zinc-200">{c.name}</span>
                    <TargetSelect value={targetOf(c.id)} releases={releases ?? []} noneLabel="Usa el global" onChange={(v) => assign(c, v)} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
      {publishing && <PublishModal onClose={() => setPublishing(false)} onDone={() => setTick((t) => t + 1)} />}
    </>
  );
}
