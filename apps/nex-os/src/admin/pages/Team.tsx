import { useEffect, useState } from 'react';
import { ScrollText, UserPlus, Users } from 'lucide-react';
import { db, run, type AuditEntry, type Company, type Member } from '../api';
import { AUDIT_LABELS, relativeTime } from '../format';
import { useToast } from '../toast';
import { Badge, Button, Card, EmptyState, ErrorText, Field, inputClass, PageHeader, Skeleton } from '../ui';

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
