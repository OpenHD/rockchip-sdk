import { useEffect, useState } from 'react';
import { AppWindow, ShieldCheck } from 'lucide-react';
import { db, run, type CatalogApp, type Company } from '../api';
import { appGradient } from '../format';

function hostOf(url: string | null): string {
  try {
    return new URL(url ?? '').hostname;
  } catch {
    return 'URL inválida';
  }
}
import { useToast } from '../toast';
import { Badge, Card, EmptyState, ErrorText, PageHeader, Skeleton, Switch } from '../ui';

export default function AppsPage({ company }: { company: Company }) {
  const toast = useToast();
  const [catalog, setCatalog] = useState<CatalogApp[] | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      run<CatalogApp[]>(db().from('mdm_app_catalog').select('*').eq('active', true).order('name')),
      run<{ app_id: string; enabled: boolean }[]>(db().from('mdm_company_apps').select('app_id, enabled').eq('company_id', company.id)),
    ]).then(
      ([apps, rows]) => {
        if (cancelled) return;
        setCatalog(apps);
        setEnabled(new Set(rows.filter((r) => r.enabled).map((r) => r.app_id)));
      },
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  const toggle = async (app: CatalogApp, value: boolean) => {
    setBusy(app.id);
    // Optimista: el switch responde al instante y se revierte si falla.
    setEnabled((prev) => {
      const next = new Set(prev);
      if (value) next.add(app.id);
      else next.delete(app.id);
      return next;
    });
    try {
      await run(db().rpc('mdm_set_company_app', { p_company: company.id, p_app: app.id, p_enabled: value }));
      toast.show(value ? `${app.name} habilitada en todos los equipos` : `${app.name} deshabilitada: se cierra en los TV que la usen`);
    } catch (err) {
      setEnabled((prev) => {
        const next = new Set(prev);
        if (value) next.delete(app.id);
        else next.add(app.id);
        return next;
      });
      toast.show((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Apps"
        subtitle={catalog ? `${enabled.size} de ${catalog.length} habilitadas en los equipos de ${company.name}` : 'Cargando…'}
      />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm text-emerald-100/90">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
        <div>
          <div className="font-medium text-emerald-200">Lista blanca</div>
          En los TV solo funciona lo que esté habilitado acá. Todo lo demás, incluidos los sitios y apps piratas, queda bloqueado
          en el navegador y en el DNS del equipo.
        </div>
      </div>
      <ErrorText error={error} />
      {!catalog ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : catalog.length === 0 ? (
        <Card><EmptyState icon={AppWindow} title="El catálogo está vacío">NEX todavía no cargó apps.</EmptyState></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.map((app) => {
            const on = enabled.has(app.id);
            return (
              <div
                key={app.id}
                className={`flex items-center gap-4 rounded-2xl border p-4 transition ${on ? 'border-indigo-400/30 bg-indigo-500/[0.06]' : 'border-white/[0.07] bg-white/[0.025]'}`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-bold text-white shadow-inner ${appGradient(app.id)}`}>
                  {app.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-100">{app.name}</span>
                    {app.kind === 'internal' && <Badge tone="info">NEX-OS</Badge>}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {app.kind === 'web' ? hostOf(app.launch_url) : 'App integrada'} · {app.domains.length} dominios
                  </div>
                </div>
                <Switch checked={on} disabled={busy === app.id} onChange={(v) => toggle(app, v)} label={`Habilitar ${app.name}`} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
