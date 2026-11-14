import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { db } from './api';
import { passwordErrorMessage, passwordProblem } from './password';
import { useStepUp } from './stepUp';
import { useToast } from './toast';
import { Button, ErrorText, Field, inputClass, Modal } from './ui';

type AuthErr = { code?: string; message: string } | null;

/**
 * Cambiar la contraseña con la sesión iniciada. Pide el código de segundo factor antes (Supabase rechaza el cambio sin
 * aal2 si la cuenta tiene TOTP). Si el proyecto exige reautenticación (sesión de más de 24 h con "Secure password
 * change"), Supabase manda un código por email y se pide acá.
 */
export default function ChangePasswordModal({ email, onClose }: { email: string; onClose: () => void }) {
  const stepUp = useStepUp();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [nonce, setNonce] = useState('');
  const [needsNonce, setNeedsNonce] = useState(false);
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password, email);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('Las dos contraseñas no coinciden');
    if (needsNonce && !/^[0-9]{6}$/.test(nonce.trim())) return setError('Ingresá el código de 6 dígitos que te llegó por email');
    setBusy(true);
    try {
      await stepUp.guard(async () => {
        const { error: err } = await db().auth.updateUser(needsNonce ? { password, nonce: nonce.trim() } : { password });
        const ae = err as AuthErr;
        if (ae?.code === 'reauthentication_needed') {
          const { error: reErr } = await db().auth.reauthenticate();
          if (reErr) throw new Error('No se pudo enviar el código por email. Pedile a NEX que te cambie la contraseña.');
          setNeedsNonce(true);
          throw new Error('Por seguridad te mandamos un código a tu email. Ingresalo para terminar.');
        }
        if (ae) throw new Error(passwordErrorMessage(ae.code, ae.message));
      });
      if (signOutOthers) await db().auth.signOut({ scope: 'others' });
      toast.show(signOutOthers ? 'Contraseña cambiada. Cerramos tus otras sesiones.' : 'Contraseña cambiada');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Cambiar contraseña"
      description="Te vamos a pedir tu código de segundo factor para confirmar."
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" form="change-password" icon={KeyRound} disabled={busy}>
            {busy ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </>
      )}
    >
      <form id="change-password" onSubmit={submit} className="flex flex-col gap-4">
        {/* Para que los gestores de contraseñas asocien la nueva a la cuenta. */}
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <Field label="Contraseña nueva" hint="12 caracteres o más. No uses tu email ni un mismo carácter repetido.">
          <div className="relative">
            <input autoFocus className={`${inputClass} pr-11`} type={show ? 'text' : 'password'} autoComplete="new-password"
              minLength={12} maxLength={72} required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-fg-4 hover:text-fg">
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </Field>
        <Field label="Repetí la contraseña">
          <input className={inputClass} type={show ? 'text' : 'password'} autoComplete="new-password" maxLength={72} required
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {needsNonce && (
          <Field label="Código del email" hint={`Lo mandamos a ${email}.`}>
            <input className={`${inputClass} font-mono tracking-widest`} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={nonce} onChange={(e) => setNonce(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm text-fg-2">
          <input type="checkbox" checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} />
          Cerrar mis sesiones en otros navegadores
        </label>
        <ErrorText error={error} />
      </form>
    </Modal>
  );
}
