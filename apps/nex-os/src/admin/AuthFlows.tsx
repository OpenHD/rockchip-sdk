import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, MailCheck } from 'lucide-react';
import { db } from './api';
import { panelUrl, setPasswordPending, stripAuthLink, type AuthLink } from './authLink';
import { passwordErrorMessage, passwordProblem } from './password';
import { Button, Callout, ErrorText, Field, inputClass } from './ui';

type Layout = (p: { title: string; subtitle: string; step?: string; children: ReactNode }) => ReactNode;

/**
 * Pantalla del link del email (invitación o recuperación). No canjea nada hasta que la persona aprieta "Continuar":
 * un antivirus de correo que abra el link no lo gasta, y nadie entra al panel por un link sin querer.
 */
export function AcceptLink({ link, Layout, onDone }: { link: AuthLink; Layout: Layout; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(link.kind === 'error' ? link.message : null);

  const go = async () => {
    if (link.kind === 'error') return;
    setBusy(true);
    setError(null);
    try {
      // Cualquier sesión anterior en esta pestaña (otra cuenta) se cierra antes.
      await db().auth.signOut({ scope: 'local' });
      const { error: err } = link.kind === 'token_hash'
        ? await db().auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
        : await db().auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
      if (err) throw err;
      setPasswordPending(link.type);
      stripAuthLink();
      onDone();
    } catch {
      setError('El link venció o ya se usó. Pedí uno nuevo con "Olvidé mi contraseña" o pedile al dueño de tu empresa que te invite otra vez.');
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    stripAuthLink();
    onDone();
  };

  const invite = link.kind !== 'error' && link.type === 'invite';
  return (
    <Layout
      title={link.kind === 'error' ? 'Link no válido' : invite ? 'Te invitaron a NEX MDM' : 'Recuperar tu contraseña'}
      subtitle={link.kind === 'error' ? 'No pudimos usar este link.' : invite
        ? 'Vas a definir tu contraseña y activar el segundo factor para entrar al panel.'
        : 'Vas a definir una contraseña nueva para tu cuenta.'}
    >
      <div className="flex flex-col gap-4">
        <ErrorText error={error} />
        {link.kind !== 'error' && <Button className="h-11" icon={KeyRound} loading={busy} onClick={go}>Continuar</Button>}
        <button type="button" onClick={back} className="flex items-center justify-center gap-1.5 rounded-md py-1 text-sm text-fg-3 hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Ir al ingreso
        </button>
      </div>
    </Layout>
  );
}

/** Definir la contraseña después de un link de invitación o recuperación. */
export function SetPassword({ email, type, Layout, onDone }: { email: string; type: 'invite' | 'recovery'; Layout: Layout; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password, email);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('Las dos contraseñas no coinciden');
    setBusy(true);
    try {
      const { error: err } = await db().auth.updateUser({ password });
      if (err) throw new Error(passwordErrorMessage((err as { code?: string }).code, err.message));
      setPasswordPending(null);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setPasswordPending(null);
    await db().auth.signOut({ scope: 'local' });
    onDone();
  };

  return (
    <Layout
      step={type === 'invite' ? 'Paso 1 de 2' : undefined}
      title={type === 'invite' ? 'Definí tu contraseña' : 'Contraseña nueva'}
      subtitle={email}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <Field label="Contraseña" hint="12 caracteres o más. No uses tu email ni un mismo carácter repetido.">
          <span className="relative">
            <input autoFocus className={`${inputClass} pr-11`} type={show ? 'text' : 'password'} autoComplete="new-password"
              minLength={12} maxLength={72} required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-4 transition hover:bg-fill-2 hover:text-fg">
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </span>
        </Field>
        <Field label="Repetí la contraseña">
          <input className={inputClass} type={show ? 'text' : 'password'} autoComplete="new-password" maxLength={72} required
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <ErrorText error={error} />
        <Button type="submit" className="h-11" loading={busy}>Guardar contraseña</Button>
        <button type="button" onClick={cancel} className="rounded-md py-1 text-sm text-fg-3 hover:text-fg">Cancelar</button>
      </form>
    </Layout>
  );
}

/** "Olvidé mi contraseña": Supabase manda un link si el email tiene cuenta (no revela si existe). */
export function ForgotPassword({ captchaToken, captchaRequired, onBack }: { captchaToken: string | null; captchaRequired: boolean; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (captchaRequired && !captchaToken) return setError('Completá la verificación anti-robots');
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await db().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: panelUrl(),
        captchaToken: captchaToken ?? undefined,
      });
      // Límite de envíos de Supabase: se avisa; cualquier otro error se muestra igual que el éxito para no revelar cuentas.
      if (err && (err as { status?: number }).status === 429) throw new Error('Pediste muchos links seguidos. Esperá unos minutos.');
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {sent ? (
        <Callout tone="success" icon={MailCheck}>
          Si {email.trim()} tiene cuenta, te llegó un email con un link para definir una contraseña nueva. Revisá también la carpeta de spam.
        </Callout>
      ) : (
        <>
          <Field label="Email de tu cuenta">
            <input autoFocus className={inputClass} type="email" inputMode="email" autoCapitalize="none" spellCheck={false}
              autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <ErrorText error={error} />
          <Button type="submit" className="h-11" loading={busy}>Mandarme el link</Button>
        </>
      )}
      <button type="button" onClick={onBack} className="flex items-center justify-center gap-1.5 rounded-md py-1 text-sm text-fg-3 hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver al ingreso
      </button>
    </form>
  );
}
