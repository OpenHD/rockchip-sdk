import { useState, type KeyboardEvent } from 'react';
import { Bell, Lock, LockOpen, Mail, Send, ShieldAlert, Skull, WifiOff, X, type LucideIcon } from 'lucide-react';
import { db, run, type AlertKind, type Company } from '../api';
import { useStepUp } from '../stepUp';
import { useToast } from '../toast';
import { Badge, Button, Card, ErrorText, Field, inputClass, PageHeader, Switch } from '../ui';

const KINDS: { id: AlertKind; label: string; description: string; icon: LucideIcon }[] = [
  { id: 'tamper', label: 'Manipulación', description: 'Reloj atrasado, reflasheo, filtro caído o imagen no oficial.', icon: ShieldAlert },
  { id: 'lock_applied', label: 'Bloqueo aplicado', description: 'El TV confirmó que se bloqueó (manual, pago u offline).', icon: Lock },
  { id: 'unlock_applied', label: 'Desbloqueo aplicado', description: 'El TV confirmó que volvió a funcionar.', icon: LockOpen },
  { id: 'offline', label: 'Sin conexión', description: 'Un equipo dejó de reportarse y cuando vuelve.', icon: WifiOff },
  { id: 'piracy', label: 'Piratería', description: 'Un equipo intentó abrir un sitio pirata conocido.', icon: Skull },
];

function EmailChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const email = draft.trim().toLowerCase();
    if (email && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) && !value.includes(email) && value.length < 5) onChange([...value, email]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className={`${inputClass} flex min-h-10 flex-wrap items-center gap-1.5 py-1.5`}>
      {value.map((e) => (
        <span key={e} className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-200">
          {e}
          <button type="button" aria-label={`Quitar ${e}`} onClick={() => onChange(value.filter((x) => x !== e))}><X className="h-3 w-3" /></button>
        </span>
      ))}
      {value.length < 5 && (
        <input className="min-w-[10rem] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500" placeholder={value.length ? '' : 'soporte@empresa.com'}
          value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} />
      )}
    </div>
  );
}

export default function AlertsPage({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const toast = useToast();
  const stepUp = useStepUp();
  const [chatId, setChatId] = useState(company.alert_telegram_chat_id ?? '');
  const [emails, setEmails] = useState<string[]>(company.alert_emails);
  const [hours, setHours] = useState(company.alert_offline_hours);
  const [kinds, setKinds] = useState<Set<AlertKind>>(new Set(company.alert_kinds));
  const [digest, setDigest] = useState(company.alert_digest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Cambiar a dónde llegan los avisos de seguridad exige confirmar el segundo factor.
      await stepUp.guard(() => run(db().rpc('mdm_update_alerts', {
        p_company: company.id, p_telegram_chat_id: chatId, p_emails: emails,
        p_offline_hours: hours, p_kinds: [...kinds], p_digest: digest,
      })));
      toast.show('Preferencias de avisos guardadas');
      onChanged();
    });

  const test = () =>
    guard(async () => {
      await run(db().rpc('mdm_send_test_alert', { p_company: company.id }));
      toast.show('Aviso de prueba enviado: debería llegar en menos de un minuto', 'info');
    });

  const toggleKind = (k: AlertKind, on: boolean) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });

  return (
    <>
      <PageHeader
        title="Avisos"
        subtitle="Dónde y cuándo te avisamos de lo que pasa en los equipos"
        actions={
          <>
            <Button variant="secondary" icon={Send} disabled={busy} onClick={test}>Enviar prueba</Button>
            <Button disabled={busy} onClick={save}>Guardar</Button>
          </>
        }
      />
      <ErrorText error={error} />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card
            title={<span className="flex items-center gap-2"><Send className="h-4 w-4 text-sky-300" aria-hidden /> Telegram</span>}
            action={chatId ? <Badge tone="success">Conectado</Badge> : <Badge>Sin configurar</Badge>}
          >
            <ol className="mb-4 flex flex-col gap-2 text-sm text-zinc-400">
              <li><span className="mr-2 text-zinc-500">1.</span>Agregá el bot de NEX a tu grupo de Telegram.</li>
              <li><span className="mr-2 text-zinc-500">2.</span>En el grupo escribí <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-zinc-200">/id</code>.</li>
              <li><span className="mr-2 text-zinc-500">3.</span>Pegá acá el número que responde el bot.</li>
            </ol>
            <Field label="ID del chat">
              <input className={`${inputClass} font-mono`} placeholder="-1001234567890" value={chatId} onChange={(e) => setChatId(e.target.value.trim())} />
            </Field>
          </Card>
          <Card
            title={<span className="flex items-center gap-2"><Mail className="h-4 w-4 text-indigo-300" aria-hidden /> Email</span>}
            action={emails.length ? <Badge tone="success">{emails.length} {emails.length === 1 ? 'destinatario' : 'destinatarios'}</Badge> : <Badge>Sin configurar</Badge>}
          >
            <Field label="Destinatarios (hasta 5)" hint="Enter o coma para agregar.">
              <EmailChips value={emails} onChange={setEmails} />
            </Field>
          </Card>
        </div>

        <Card title="Qué avisar">
          <ul className="flex flex-col divide-y divide-white/[0.06]">
            {KINDS.map((k) => (
              <li key={k.id} className="flex items-center gap-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-300"><k.icon className="h-4 w-4" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-100">{k.label}</div>
                  <div className="text-xs text-zinc-500">{k.description}</div>
                  {k.id === 'offline' && kinds.has('offline') && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                      Avisar después de
                      <input type="number" min={1} max={720} className={`${inputClass} h-8 w-20 py-1`} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                      horas
                    </label>
                  )}
                </div>
                <Switch checked={kinds.has(k.id)} onChange={(v) => toggleKind(k.id, v)} label={k.label} />
              </li>
            ))}
            <li className="flex items-center gap-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-300"><Bell className="h-4 w-4" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-100">Resumen diario de piratería</div>
                <div className="text-xs text-zinc-500">Un mensaje por día con los intentos por equipo.</div>
              </div>
              <Switch checked={digest} onChange={setDigest} label="Resumen diario" />
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
