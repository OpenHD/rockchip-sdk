import { useRef, useState } from 'react';
import { ImagePlus, Lock, Phone, QrCode, Trash2 } from 'lucide-react';
import {
  db,
  LOGO_BUCKET,
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  logoUrl,
  PAYMENT_PHONE_RE,
  PAYMENT_URL_MAX,
  PAYMENT_URL_RE,
  run,
  sniffImageType,
  type Company,
} from '../api';
import { useToast } from '../toast';
import { Button, Card, Chip, ErrorText, Field, inputClass, PageHeader } from '../ui';

type Preview = 'manual' | 'payment' | 'home';

function TvPreview({ company, logo, mode }: { company: Company & { lock_message: string; payment_message: string }; logo: string | null; mode: Preview }) {
  const brand = logo ? (
    <img src={logo} alt="" className="h-8 max-w-[50%] object-contain" />
  ) : (
    <div className="text-sm font-bold tracking-widest text-white">{company.name}</div>
  );
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border-[6px] border-zinc-800 bg-zinc-900 p-1 shadow-2xl shadow-black/50">
        <div className="relative flex aspect-video flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-gradient-to-b from-[#0b1020] to-[#05070c] p-6 text-center">
          {mode === 'home' ? (
            <>
              <div className="absolute left-4 top-3">{brand}</div>
              <div className="absolute right-4 top-3 text-xs text-white/70">21:30</div>
              <div className="mt-6 w-full rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[10px] text-amber-100">
                Tu pago vence el 20 de octubre. Regularizalo para evitar el bloqueo del equipo.
              </div>
              <div className="grid w-full grid-cols-4 gap-2">
                {['N', 'Y', 'D', 'P'].map((l) => (
                  <div key={l} className="flex aspect-video items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs font-semibold text-white">{l}</div>
                ))}
              </div>
            </>
          ) : (
            <>
              {brand}
              <Lock className="h-6 w-6 text-white/80" aria-hidden />
              <div className="text-sm font-semibold text-white">{mode === 'payment' ? 'Pago vencido' : 'Equipo bloqueado'}</div>
              <div className="line-clamp-3 max-w-[85%] text-[11px] leading-relaxed text-white/75">
                {mode === 'payment' ? company.payment_message : company.lock_message}
              </div>
              {(company.payment_phone || company.payment_url) && (
                <div className="flex items-center gap-3 text-[10px] text-white/70">
                  {company.payment_url && (
                    <span className="flex h-9 w-9 items-center justify-center rounded bg-white text-zinc-900" title={company.payment_url}>
                      <QrCode className="h-6 w-6" aria-hidden />
                    </span>
                  )}
                  {company.payment_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" aria-hidden /> {company.payment_phone}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mx-auto h-3 w-24 rounded-b-lg bg-zinc-800" />
    </div>
  );
}

export default function BrandPage({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    lock_message: company.lock_message,
    offline_lock_days: company.offline_lock_days,
    payment_message: company.payment_message,
    payment_grace_days: company.payment_grace_days,
    payment_warning_days: company.payment_warning_days,
    timezone: company.timezone,
    // v9. '' = sin etapa restringida / sin dato.
    payment_restrict_days: company.payment_restrict_days == null ? '' : String(company.payment_restrict_days),
    payment_phone: company.payment_phone ?? '',
    payment_url: company.payment_url ?? '',
  });
  const [logoPath, setLogoPath] = useState(company.logo_path);
  const [preview, setPreview] = useState<Preview>('manual');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const persist = async (nextLogo: string | null) => {
    await run(
      db().rpc('mdm_update_company', {
        p_company: company.id,
        p_lock_message: form.lock_message,
        p_offline_lock_days: form.offline_lock_days,
        p_logo_path: nextLogo,
        p_payment_message: form.payment_message,
        p_payment_grace_days: form.payment_grace_days,
        p_payment_warning_days: form.payment_warning_days,
        p_timezone: form.timezone,
        // -1 = sin etapa restringida; '' en teléfono/URL los borra.
        p_payment_restrict_days: form.payment_restrict_days === '' ? -1 : Number(form.payment_restrict_days),
        p_payment_phone: form.payment_phone.trim(),
        p_payment_url: form.payment_url.trim(),
      }),
    );
  };

  const restrictDays = form.payment_restrict_days === '' ? null : Number(form.payment_restrict_days);
  const restrictInvalid = restrictDays !== null && !(Number.isInteger(restrictDays) && restrictDays >= 0 && restrictDays <= 30);
  const restrictActive = restrictDays !== null && !restrictInvalid && restrictDays < form.payment_grace_days;
  const phoneInvalid = form.payment_phone.trim() !== '' && !PAYMENT_PHONE_RE.test(form.payment_phone.trim());
  const urlInvalid =
    form.payment_url.trim() !== '' && (form.payment_url.trim().length > PAYMENT_URL_MAX || !PAYMENT_URL_RE.test(form.payment_url.trim()));
  const invalid = restrictInvalid || phoneInvalid || urlInvalid;

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    guard(async () => {
      await persist(logoPath);
      setDirty(false);
      toast.show('Cambios guardados. Los TV los muestran en el próximo minuto.');
      onChanged();
    });

  const upload = (file: File) =>
    guard(async () => {
      if (file.size > LOGO_MAX_BYTES) throw new Error('El logo debe pesar menos de 1 MB');
      const type = await sniffImageType(file);
      if (!type) throw new Error('Formato no permitido: usá PNG, JPG o WEBP (SVG no, por seguridad)');
      const path = `${company.id}/logo-${crypto.randomUUID()}.${LOGO_TYPES[type]}`;
      const { error: err } = await db().storage.from(LOGO_BUCKET).upload(path, file, { contentType: type, upsert: false });
      if (err) throw new Error(err.message);
      const previous = logoPath;
      await persist(path);
      setLogoPath(path);
      if (previous) await db().storage.from(LOGO_BUCKET).remove([previous]);
      toast.show('Logo actualizado');
      onChanged();
    });

  const removeLogo = () =>
    guard(async () => {
      await persist(null);
      setLogoPath(null);
      toast.show('Logo quitado');
      onChanged();
    });

  const logo = logoUrl(logoPath) || null;
  const live = {
    ...company,
    ...form,
    payment_restrict_days: restrictDays,
    payment_phone: form.payment_phone.trim() || null,
    payment_url: form.payment_url.trim() || null,
  };

  return (
    <>
      <PageHeader
        title="Marca y cobro"
        subtitle="Cómo ven el TV tus clientes y cuándo se bloquea por falta de pago"
        actions={<Button disabled={busy || !dirty || invalid} onClick={save}>{dirty ? 'Guardar cambios' : 'Guardado'}</Button>}
      />
      <ErrorText error={error} />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="flex flex-col gap-6 xl:col-span-3">
          <Card title="Logo" description="Se ve en el arranque, el home y la pantalla de bloqueo.">
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex h-24 w-44 items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30">
                {logo ? <img src={logo} alt="Logo" className="max-h-20 max-w-40 object-contain" /> : <span className="text-xs text-zinc-500">Sin logo</span>}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <Button variant="secondary" icon={ImagePlus} disabled={busy} onClick={() => fileRef.current?.click()}>
                  {logoPath ? 'Cambiar logo' : 'Subir logo'}
                </Button>
                {logoPath && <Button variant="ghost" size="sm" icon={Trash2} disabled={busy} onClick={removeLogo}>Quitar</Button>}
                <span className="text-xs text-zinc-500">PNG, JPG o WEBP · máx. 1 MB · fondo transparente ideal</span>
              </div>
            </div>
          </Card>

          <Card title="Mensajes en el TV">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Bloqueo manual" hint={`${form.lock_message.length}/280`}>
                <textarea className={inputClass} rows={4} maxLength={280} value={form.lock_message}
                  onFocus={() => setPreview('manual')} onChange={(e) => set('lock_message', e.target.value)} />
              </Field>
              <Field label="Pago vencido" hint={`${form.payment_message.length}/280 · incluí cómo pagar`}>
                <textarea className={inputClass} rows={4} maxLength={280} value={form.payment_message}
                  onFocus={() => setPreview('payment')} onChange={(e) => set('payment_message', e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="Reglas de cobro y conexión">
            <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="whitespace-nowrap rounded-full bg-amber-500/10 px-3 py-1 text-amber-300">Aviso {form.payment_warning_days} días antes</span>
              <span className="h-px w-6 shrink-0 bg-white/15" />
              <span className="whitespace-nowrap rounded-full bg-white/[0.06] px-3 py-1 text-zinc-300">Vence el pago</span>
              <span className="h-px w-6 shrink-0 bg-white/15" />
              {restrictActive && (
                <>
                  <span className="whitespace-nowrap rounded-full bg-amber-500/10 px-3 py-1 text-amber-300">Restringido a los {restrictDays} días</span>
                  <span className="h-px w-6 shrink-0 bg-white/15" />
                </>
              )}
              <span className="whitespace-nowrap rounded-full bg-white/[0.06] px-3 py-1 text-zinc-300">{form.payment_grace_days} días de gracia</span>
              <span className="h-px w-6 shrink-0 bg-white/15" />
              <span className="whitespace-nowrap rounded-full bg-rose-500/10 px-3 py-1 text-rose-300">Bloqueo automático</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Aviso previo (días)" hint="Banner en el home del TV antes del vencimiento.">
                <input type="number" min={0} max={30} className={inputClass} value={form.payment_warning_days}
                  onFocus={() => setPreview('home')} onChange={(e) => set('payment_warning_days', Number(e.target.value))} />
              </Field>
              <Field label="Días de gracia" hint="Tras el vencimiento, antes de bloquear.">
                <input type="number" min={0} max={30} className={inputClass} value={form.payment_grace_days}
                  onChange={(e) => set('payment_grace_days', Number(e.target.value))} />
              </Field>
              <Field
                label="Restringir tras (días)"
                hint={
                  restrictInvalid ? (
                    <span className="text-rose-300">Entre 0 y 30, o vacío.</span>
                  ) : restrictDays !== null && !restrictActive ? (
                    <span className="text-amber-300">Sin efecto: tiene que ser menor que los días de gracia.</span>
                  ) : (
                    'Tras el vencimiento: apps deshabilitadas, menú y red sí. Vacío = sin esta etapa.'
                  )
                }
              >
                <input type="number" min={0} max={30} className={inputClass} placeholder="Sin etapa" value={form.payment_restrict_days}
                  onFocus={() => setPreview('payment')} onChange={(e) => set('payment_restrict_days', e.target.value)} />
              </Field>
              <Field label="Bloquear tras N días sin internet" hint="Evita que desconecten el equipo para esquivar un bloqueo.">
                <input type="number" min={1} max={90} className={inputClass} value={form.offline_lock_days}
                  onChange={(e) => set('offline_lock_days', Number(e.target.value))} />
              </Field>
              <Field label="Zona horaria" hint="Define a qué hora vence el día de pago.">
                <input className={inputClass} value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="Datos de pago en el TV" description="Se muestran en el aviso, en la restricción y en el bloqueo por pago o manual.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Teléfono de pago"
                hint={phoneInvalid ? <span className="text-rose-300">5 a 32 caracteres: números, espacios, + ( ) -</span> : 'Opcional.'}
              >
                <input type="tel" className={inputClass} maxLength={32} placeholder="0800-555-1234" value={form.payment_phone}
                  onFocus={() => setPreview('payment')} onChange={(e) => set('payment_phone', e.target.value)} />
              </Field>
              <Field
                label="URL de pago"
                hint={urlInvalid ? <span className="text-rose-300">https://, hasta 300 caracteres, sin espacios ni comillas</span> : 'Opcional. El TV la muestra como QR.'}
              >
                <input type="url" className={inputClass} maxLength={PAYMENT_URL_MAX} placeholder="https://pagos.tu-isp.com" value={form.payment_url}
                  onFocus={() => setPreview('payment')} onChange={(e) => set('payment_url', e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <div className="sticky top-6">
            <Card
              title="Vista previa en el TV"
              action={
                <div className="flex gap-1.5">
                  <Chip active={preview === 'manual'} onClick={() => setPreview('manual')}>Bloqueo</Chip>
                  <Chip active={preview === 'payment'} onClick={() => setPreview('payment')}>Pago</Chip>
                  <Chip active={preview === 'home'} onClick={() => setPreview('home')}>Home</Chip>
                </div>
              }
            >
              <TvPreview company={live} logo={logo} mode={preview} />
              <p className="mt-4 text-center text-xs text-zinc-500">Se actualiza mientras escribís.</p>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
