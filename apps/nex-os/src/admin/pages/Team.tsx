import { useEffect, useState, type FormEvent } from 'react';
import { Ban, Copy, KeyRound, Plug, ScrollText, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { db, run, type ApiKey, type AuditEntry, type Company, type Member, type NewApiKey } from '../api';
import { AUDIT_LABELS, copyText, formatDate, relativeTime } from '../format';
import { useToast } from '../toast';
import { Badge, Button, Card, EmptyState, ErrorText, Field, IconButton, inputClass, Modal, PageHeader, Skeleton } from '../ui';

export function MembersPage({ company }: { company: Company }) {
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'owner'>('admin');
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    run<Member[]>(db().from('mdm_members').select('user_id, role').eq('company_id', company.id)).then(
      (m) => !cancelled && setMembers(m),
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [company.id, tick]);

  const setMember = async (r: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await run(db().rpc('mdm_set_member', { p_company: company.id, p_email: email, p_role: r }));
      toast.show(r ? `${email} ahora es ${r === 'owner' ? 'dueño' : 'admin'}` : `${email} ya no tiene acceso`);
      setEmail('');
      setTick((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Miembros" subtitle="Quiénes administran los equipos de la empresa" />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Con acceso" className="xl:col-span-3" padded={false}>
          {!members ? (
            <div className="flex flex-col gap-2 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : members.length === 0 ? (
            <EmptyState icon={Users} title="Sin miembros" />
          ) : (
            <ul className="divide-y divide-white/[0.05] pb-2">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-500/40 text-xs font-semibold text-white">
                    {m.user_id.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 font-mono text-xs text-zinc-400">{m.user_id}</span>
                  <Badge tone={m.role === 'owner' ? 'info' : 'neutral'}>{m.role === 'owner' ? 'Dueño' : 'Admin'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Agregar o cambiar" description="La persona tiene que haber creado su cuenta y activado el segundo factor." className="xl:col-span-2">
          <div className="flex flex-col gap-4">
            <Field label="Email">
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tecnico@empresa.com" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {(['admin', 'owner'] as const).map((r) => (
                <button key={r} onClick={() => setRole(r)}
                  className={`rounded-xl border p-3 text-left transition ${role === r ? 'border-indigo-400/60 bg-indigo-500/15' : 'border-white/10 hover:border-white/20'}`}>
                  <div className="text-sm font-medium text-white">{r === 'owner' ? 'Dueño' : 'Admin'}</div>
                  <div className="text-xs text-zinc-400">{r === 'owner' ? 'Todo, más miembros y desvincular' : 'Equipos, apps, pagos y avisos'}</div>
                </button>
              ))}
            </div>
            <ErrorText error={error} />
            <div className="flex gap-2">
              <Button icon={UserPlus} disabled={busy || !email} onClick={() => setMember(role)} className="flex-1">Guardar</Button>
              <Button variant="ghost" disabled={busy || !email} onClick={() => setMember(null)} className="text-rose-300">Quitar acceso</Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

export function AuditPage({ company }: { company: Company }) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    run<AuditEntry[]>(
      db().from('mdm_audit_log').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(200),
    ).then(
      (r) => !cancelled && setRows(r),
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Cada acción del panel queda registrada con quién y cuándo" />
      <ErrorText error={error} />
      <Card padded={false}>
        {!rows ? (
          <div className="flex flex-col gap-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="Sin acciones registradas" />
        ) : (
          <ul className="divide-y divide-white/[0.05] pb-2">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="min-w-[12rem] font-medium text-zinc-100">{AUDIT_LABELS[r.action] ?? r.action}</span>
                <span className="flex-1 truncate font-mono text-xs text-zinc-500">
                  {Object.entries(r.details).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
                </span>
                <span className="text-xs text-zinc-500" title={new Date(r.created_at).toLocaleString('es-AR')}>{relativeTime(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Claves de API (integración con el sistema del ISP)
// ---------------------------------------------------------------------------

// Consultas y RPC de v8 en un solo lugar (contrato NEX MDM v8).
const API_KEY_COLUMNS = 'id, name, prefix, created_at, last_used_at, revoked_at';
const listApiKeys = (company: string) =>
  run<ApiKey[]>(db().from('mdm_api_keys').select(API_KEY_COLUMNS).eq('company_id', company).order('created_at', { ascending: false }));
const createApiKey = (company: string, name: string) => run<NewApiKey>(db().rpc('mdm_create_api_key', { p_company: company, p_name: name }));
const revokeApiKey = (key: string) => run(db().rpc('mdm_revoke_api_key', { p_key: key }));

/**
 * Rol del usuario actual en la empresa. Sin fila de miembro solo puede verla NEX (super admin),
 * que en el servidor tiene los mismos permisos que un dueño.
 */
function useIsOwner(companyId: string): boolean | null {
  const [owner, setOwner] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await db().auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const rows = await run<Member[]>(db().from('mdm_members').select('user_id, role').eq('company_id', companyId).eq('user_id', uid));
      if (!cancelled) setOwner(rows.length === 0 || rows[0].role === 'owner');
    })().catch(() => !cancelled && setOwner(false));
    return () => {
      cancelled = true;
    };
  }, [companyId]);
  return owner;
}

function NewKeyModal({ created, onClose }: { created: NewApiKey; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const ok = await copyText(created.key);
    setCopied(ok || copied);
    toast.show(ok ? 'Clave copiada' : 'No se pudo copiar: seleccionala y copiala a mano', ok ? 'success' : 'error');
  };
  return (
    <Modal
      title="Clave de API creada"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" icon={Copy} onClick={copy}>Copiar clave</Button>
          <Button onClick={onClose}>{copied ? 'Listo' : 'Ya la guardé'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Copiala ahora y guardala en un lugar seguro: <strong>no se vuelve a mostrar</strong>. Quien la tenga puede bloquear y
            desbloquear los equipos de la empresa. Si la perdés, revocala y creá otra.
          </span>
        </div>
        <code className="select-all break-all rounded-lg border border-white/10 bg-black/40 px-3 py-3 font-mono text-sm text-zinc-100">
          {created.key}
        </code>
        <p className="text-xs text-zinc-500">
          Usala en el encabezado <span className="font-mono">Authorization: Bearer {created.prefix}…</span> de la API del ISP.
        </p>
      </div>
    </Modal>
  );
}

export function ApiKeysPage({ company }: { company: Company }) {
  const toast = useToast();
  const isOwner = useIsOwner(company.id);
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<NewApiKey | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<ApiKey | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listApiKeys(company.id).then(
      (k) => !cancelled && setKeys(k),
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [company.id, tick]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCreated(await createApiKey(company.id, name.trim()));
      setName('');
      setTick((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (k: ApiKey) => {
    setBusy(true);
    try {
      await revokeApiKey(k.id);
      toast.show(`Clave "${k.name}" revocada`);
      setConfirmRevoke(null);
      setTick((t) => t + 1);
    } catch (err) {
      toast.show((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="API" subtitle="Claves para que el sistema de gestión del ISP bloquee, desbloquee y registre pagos automáticamente" />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Claves" className="xl:col-span-3" padded={false}>
          {!keys ? (
            <div className="flex flex-col gap-2 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : keys.length === 0 ? (
            <EmptyState icon={Plug} title="Sin claves de API">Creá una para integrar el sistema de facturación o el CRM.</EmptyState>
          ) : (
            <ul className="divide-y divide-white/[0.05] pb-2">
              {keys.map((k) => (
                <li key={k.id} className={`flex items-center gap-3 px-5 py-3 ${k.revoked_at ? 'opacity-60' : ''}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-400">
                    <KeyRound className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-100">{k.name}</span>
                      {k.revoked_at && <Badge tone="danger">Revocada</Badge>}
                    </div>
                    <div className="text-xs text-zinc-500">
                      <span className="font-mono">{k.prefix}…</span> · creada el {formatDate(k.created_at)} ·{' '}
                      {k.revoked_at ? `revocada ${relativeTime(k.revoked_at)}` : k.last_used_at ? `usada ${relativeTime(k.last_used_at)}` : 'sin uso'}
                    </div>
                  </div>
                  {!k.revoked_at && isOwner && (
                    <IconButton icon={Ban} label="Revocar" tone="danger" disabled={busy} onClick={() => setConfirmRevoke(k)} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Nueva clave" description="Solo los dueños de la empresa pueden crear y revocar claves." className="xl:col-span-2">
          {isOwner === false ? (
            <p className="text-sm text-zinc-400">Pedile a un dueño de la empresa que cree la clave.</p>
          ) : (
            <form onSubmit={create} className="flex flex-col gap-4">
              <Field label="Nombre" hint="Para saber quién la usa. Ej. Sistema de facturación">
                <input className={inputClass} required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <ErrorText error={error} />
              <Button type="submit" icon={KeyRound} disabled={busy || isOwner === null || name.trim().length < 2}>Crear clave</Button>
            </form>
          )}
        </Card>
      </div>
      {isOwner === false && <ErrorText error={error} />}
      {created && <NewKeyModal created={created} onClose={() => setCreated(null)} />}
      {confirmRevoke && (
        <Modal
          title="Revocar clave"
          description={confirmRevoke.name}
          onClose={() => setConfirmRevoke(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmRevoke(null)}>Cancelar</Button>
              <Button variant="danger" icon={Ban} disabled={busy} onClick={() => revoke(confirmRevoke)}>Revocar</Button>
            </>
          }
        >
          <p className="text-sm text-zinc-300">
            El sistema que la use deja de poder operar los equipos de inmediato. No se puede deshacer.
          </p>
        </Modal>
      )}
    </>
  );
}
