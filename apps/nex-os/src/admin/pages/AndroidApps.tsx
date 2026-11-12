import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { CircleCheck, FileUp, LoaderCircle, Plus, Smartphone, Store, Trash2 } from 'lucide-react';
import { APK_BUCKET, APK_MAX_BYTES, db, PACKAGE_RE, run, type AndroidApp, type Company } from '../api';
import { ApkError, packageFromPlayInput, readApk, type ApkInfo } from '../apk';
import { appGradient } from '../format';
import { useStepUp } from '../stepUp';
import { useToast } from '../toast';
import { Badge, Button, Card, EmptyState, ErrorText, Field, IconButton, inputClass, Modal, Skeleton, Switch } from '../ui';

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

type Mode = 'play' | 'apk';

/** Alta de una app: desde la Play Store (link o paquete) o subiendo un APK propio. */
function AddAndroidAppModal({ company, existing, onClose, onDone }: {
  company: Company;
  existing: AndroidApp[];
  onClose: () => void;
  onDone: () => void;
}) {
  const stepUp = useStepUp();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('play');
  const [playInput, setPlayInput] = useState('');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<(ApkInfo & { sha256: string }) | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Con la subida en curso no se cierra: se perdería el APK a medio subir.
  const close = () => !busy && onClose();

  const pickFile = async (f: File) => {
    setError(null);
    setInfo(null);
    setFile(null);
    if (f.size > APK_MAX_BYTES) return setError('El APK debe pesar menos de 200 MB');
    setReading(true);
    try {
      const read = await readApk(await f.arrayBuffer());
      setFile(f);
      setInfo(read);
      if (!name) setName(read.label ?? '');
    } catch (err) {
      setError(err instanceof ApkError ? err.message : 'No se pudo leer el APK');
    } finally {
      setReading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !busy && !reading) void pickFile(f);
  };

  const playPackage = mode === 'play' ? packageFromPlayInput(playInput) : null;
  const playValid = !!playPackage && PACKAGE_RE.test(playPackage);
  const pkg = mode === 'play' ? playPackage : info?.package ?? null;
  const replacing = pkg ? existing.find((a) => a.package === pkg) : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pkg || !PACKAGE_RE.test(pkg)) return setError(mode === 'play' ? 'Pegá el link de la Play Store o el nombre del paquete (com.empresa.app)' : 'Elegí un APK');
    if (!name.trim()) return setError('Poné el nombre que se ve en el TV');
    if (mode === 'apk' && replacing?.source === 'apk' && info && replacing.version_code && info.versionCode < replacing.version_code) {
      return setError(`El APK es más viejo que el cargado (versión ${info.versionCode} < ${replacing.version_code}). Android no instala versiones anteriores.`);
    }
    setBusy(true);
    try {
      if (mode === 'play') {
        await run(db().rpc('mdm_upsert_android_app', { p_company: company.id, p_package: pkg, p_name: name.trim(), p_source: 'play' }));
      } else {
        if (!file || !info) throw new Error('Elegí un APK');
        // Pide el código antes de subir 200 MB, no después.
        await stepUp.guard(async () => {
          const path = `${company.id}/${crypto.randomUUID()}.apk`;
          const { error: err } = await db().storage.from(APK_BUCKET).upload(path, file, {
            contentType: 'application/vnd.android.package-archive', upsert: false,
          });
          if (err) throw new Error(err.message);
          try {
            await run(db().rpc('mdm_upsert_android_app', {
              p_company: company.id, p_package: pkg, p_name: name.trim(), p_source: 'apk', p_apk_path: path,
              p_version_code: info.versionCode, p_version_name: info.versionName, p_sha256: info.sha256, p_size: file.size,
            }));
          } catch (rpcErr) {
            await db().storage.from(APK_BUCKET).remove([path]);
            throw rpcErr;
          }
        });
        // El APK anterior ya no lo usa nadie.
        if (replacing?.apk_path) await db().storage.from(APK_BUCKET).remove([replacing.apk_path]);
      }
      toast.show(mode === 'play'
        ? `${name.trim()} aparece en los TV como "Instalar" en el próximo minuto`
        : `${name.trim()} se instala sola en los TV en los próximos minutos`);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Agregar app Android"
      description="La app queda disponible en todos los TV de tu empresa."
      onClose={close}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={close}>Cancelar</Button>
          <Button type="submit" form="add-android-app" icon={Plus} disabled={busy || reading}>
            {busy ? (mode === 'apk' ? 'Subiendo…' : 'Guardando…') : replacing ? 'Actualizar' : 'Agregar'}
          </Button>
        </>
      )}
    >
      <form id="add-android-app" onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="De dónde sale la app">
          {([['play', 'Desde Play Store', Store], ['apk', 'Subir APK', FileUp]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              disabled={busy}
              onClick={() => { setMode(id); setError(null); }}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${mode === id ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-3 hover:text-fg-2'}`}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        {mode === 'play' ? (
          <>
            <Field
              label="Link de la Play Store o paquete"
              hint={playValid
                ? <span className="flex items-center gap-1.5 text-ok"><CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="break-all font-mono">{playPackage}</span></span>
                : playInput.trim()
                  ? <span className="text-warn">No reconocemos el paquete. Pegá el link completo de la ficha o el nombre (com.empresa.app).</span>
                  : 'Ej.: https://play.google.com/store/apps/details?id=com.empresa.app'}
            >
              <input autoFocus className={inputClass} value={playInput} onChange={(e) => setPlayInput(e.target.value)} placeholder="https://play.google.com/store/apps/details?id=…" />
            </Field>
            <p className="text-xs text-fg-4">
              El TV muestra la app con un botón "Instalar" que abre la Play Store; el cliente confirma ahí (Android no deja instalar de la Play Store sin ese paso). La Play Store tiene que tener una cuenta de Google iniciada.
            </p>
          </>
        ) : (
          <>
            <input ref={fileRef} type="file" hidden accept=".apk,application/vnd.android.package-archive" onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
            <button
              type="button"
              disabled={busy || reading}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-sm text-fg-2 transition hover:border-accent disabled:opacity-60 ${dragging ? 'border-accent bg-accent-soft' : 'border-line-strong'}`}
            >
              {reading
                ? <LoaderCircle className="h-6 w-6 animate-spin text-fg-3" aria-hidden />
                : <FileUp className="h-6 w-6 text-fg-3" aria-hidden />}
              <span className="max-w-full break-all">{reading ? 'Leyendo el APK…' : file ? file.name : 'Elegí el APK o arrastralo acá'}</span>
              <span className="text-xs text-fg-4">{file && !reading ? 'Tocá para cambiarlo' : 'Hasta 200 MB'}</span>
            </button>
            {info && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-line px-4 py-3 text-xs">
                <dt className="text-fg-4">Paquete</dt><dd className="break-all font-mono text-fg-2">{info.package}</dd>
                <dt className="text-fg-4">Versión</dt><dd className="text-fg-2">{info.versionName ?? '—'} ({info.versionCode})</dd>
                <dt className="text-fg-4">Tamaño</dt><dd className="text-fg-2">{formatSize(file?.size ?? null)}</dd>
              </dl>
            )}
            <p className="text-xs text-fg-4">
              Los TV la descargan e instalan solos, sin que el cliente toque nada. Para actualizarla, subí el APK nuevo con el mismo paquete y un versionCode mayor. Te vamos a pedir el código de segundo factor.
            </p>
          </>
        )}

        <Field label="Nombre en el TV">
          <input className={inputClass} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="TV Play" />
        </Field>
        {replacing && (
          <p className="text-xs text-warn">
            {replacing.name} ya está cargada con ese paquete: se reemplaza
            {mode === 'apk' && replacing.source === 'apk' && info ? ` (versión ${replacing.version_name ?? replacing.version_code} → ${info.versionName ?? info.versionCode})` : ''}.
          </p>
        )}
        {busy && mode === 'apk' && (
          <p className="flex items-center gap-2 text-xs text-fg-3" role="status">
            <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            Subiendo el APK. Puede tardar unos minutos: no cierres esta pestaña.
          </p>
        )}
        <ErrorText error={error} />
      </form>
    </Modal>
  );
}

/** Apps Android que el ISP carga para sus TV con NEX TV (Play Store o APK propio). */
export default function AndroidAppsSection({ company }: { company: Company }) {
  const toast = useToast();
  const [apps, setApps] = useState<AndroidApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AndroidApp | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    run<AndroidApp[]>(db().from('mdm_company_android_apps').select('*').eq('company_id', company.id).order('name')).then(
      (rows) => !cancelled && setApps(rows),
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [company.id, tick]);

  const toggle = async (app: AndroidApp, enabled: boolean) => {
    setBusy(app.package);
    // Optimista, como las apps del catálogo: el switch responde al instante y se revierte si falla.
    const setEnabled = (value: boolean) => setApps((prev) => prev?.map((a) => (a.package === app.package ? { ...a, enabled: value } : a)) ?? prev);
    setEnabled(enabled);
    try {
      await run(db().rpc('mdm_set_android_app_enabled', { p_company: company.id, p_package: app.package, p_enabled: enabled }));
      toast.show(enabled ? `${app.name} habilitada` : app.source === 'apk' ? `${app.name} se desinstala de los TV` : `${app.name} deja de aparecer en los TV`);
      reload();
    } catch (err) {
      setEnabled(!enabled);
      toast.show((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (app: AndroidApp) => {
    setBusy(app.package);
    try {
      const path = await run<string | null>(db().rpc('mdm_delete_android_app', { p_company: company.id, p_package: app.package }));
      if (path) await db().storage.from(APK_BUCKET).remove([path]);
      toast.show(`${app.name} quitada`);
      setRemoving(null);
      reload();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-fg">Apps Android de tu empresa</h2>
          <p className="text-sm text-fg-4">
            Para TV box con NEX TV (Android). Cargá tu propia app o cualquiera de la Play Store
            {apps && apps.length > 0 ? ` · ${apps.filter((a) => a.enabled).length} de ${apps.length} habilitadas` : ''}.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setAdding(true)}>Agregar app</Button>
      </div>
      <ErrorText error={error} />
      {!apps ? (
        !error && <Skeleton className="h-20" />
      ) : apps.length === 0 ? (
        <Card><EmptyState icon={Smartphone} title="Todavía no cargaste apps">Agregá tu app de TV desde la Play Store o subiendo el APK.</EmptyState></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <div key={app.package} className={`flex items-center gap-4 rounded-xl border p-4 shadow-card ${app.enabled ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-bold text-white ${appGradient(app.package)}`}>
                {app.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-fg">{app.name}</span>
                  <span className="shrink-0"><Badge tone={app.source === 'apk' ? 'info' : 'neutral'}>{app.source === 'apk' ? 'APK' : 'Play Store'}</Badge></span>
                </div>
                <div className="truncate font-mono text-xs text-fg-4" title={app.package}>{app.package}</div>
                <div className="text-xs text-fg-4">
                  {app.source === 'apk'
                    ? `v${app.version_name ?? app.version_code} · ${formatSize(app.size)} · ${app.enabled ? 'se instala sola' : 'desinstalada de los TV'}`
                    : app.enabled ? 'El cliente la instala desde el TV' : 'No aparece en los TV'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Switch checked={app.enabled} disabled={busy === app.package} onChange={(v) => toggle(app, v)} label={`Habilitar ${app.name}`} />
                <IconButton icon={Trash2} tone="danger" label={`Quitar ${app.name}`} disabled={busy === app.package} onClick={() => setRemoving(app)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {removing && (
        <Modal
          title={`¿Quitar ${removing.name}?`}
          description={removing.package}
          onClose={() => busy !== removing.package && setRemoving(null)}
          footer={(
            <>
              <Button variant="secondary" disabled={busy === removing.package} onClick={() => setRemoving(null)}>Cancelar</Button>
              <Button variant="danger" icon={Trash2} disabled={busy === removing.package} onClick={() => remove(removing)}>Quitar app</Button>
            </>
          )}
        >
          <p className="text-sm text-fg-2">
            {removing.source === 'apk'
              ? 'Se desinstala sola de todos los TV de tu empresa en los próximos minutos y se borra el APK que subiste.'
              : 'Deja de aparecer en los TV. Si un cliente ya la instaló desde la Play Store, le queda instalada.'}
            {' '}Si solo querés pausarla, apagá el interruptor en vez de quitarla.
          </p>
        </Modal>
      )}
      {adding && apps && (
        <AddAndroidAppModal company={company} existing={apps} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />
      )}
    </section>
  );
}
