import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { MdmUnlock } from './agentState';
import { useDpad } from './dpad';
import { NumericPad } from './OnScreenKeyboard';
import { relayErrorText, sendRelay } from './relay';
import { tvButton } from './styles';

/**
 * Código de desbloqueo de 8 dígitos que el cliente obtiene de su proveedor (por teléfono,
 * por ejemplo) para un equipo bloqueado sin conexión. Lo valida el agente, no la UI:
 * acá solo se envía y se muestra el resultado que publica en ui-state.json.
 */

const CODE_LEN = 8;
const RESULT_TIMEOUT_MS = 20_000;

const RESULT_TEXT: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  ok: { tone: 'ok', text: 'Código aceptado. El equipo se desbloquea por 72 horas.' },
  invalid: { tone: 'error', text: 'El código no es válido. Revisalo y probá de nuevo.' },
  rate_limited: { tone: 'error', text: 'Demasiados intentos. Esperá unos minutos antes de probar otra vez.' },
  unavailable: { tone: 'error', text: 'Este equipo todavía no puede desbloquearse con código. Contactá a tu proveedor.' },
};

type Status =
  | { kind: 'idle' }
  | { kind: 'sending'; since: number }
  | { kind: 'error'; text: string };

export default function UnlockCodeScreen({ unlock, onClose }: { unlock: MdmUnlock; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const rootRef = useRef<HTMLDivElement>(null);

  // Resultado del agente para ESTE intento (at posterior al envío).
  const sentAt = status.kind === 'sending' ? status.since : null;
  const answered = sentAt !== null && unlock.at !== null && unlock.result !== null && unlock.at >= sentAt - 1;
  const result = answered && unlock.result ? RESULT_TEXT[unlock.result] : null;

  useEffect(() => {
    if (sentAt === null || answered) return;
    const t = setTimeout(
      () => setStatus({ kind: 'error', text: 'El equipo no respondió. Probá de nuevo.' }),
      RESULT_TIMEOUT_MS,
    );
    return () => clearTimeout(t);
  }, [sentAt, answered]);

  const busy = status.kind === 'sending' && !answered;

  const addDigit = (d: string) => {
    if (busy) return;
    if (status.kind !== 'idle') setStatus({ kind: 'idle' });
    setCode((c) => (c.length < CODE_LEN ? c + d : c));
  };
  const backspace = () => {
    if (busy) return;
    if (status.kind !== 'idle') setStatus({ kind: 'idle' });
    setCode((c) => c.slice(0, -1));
  };

  const submit = async () => {
    if (busy || code.length !== CODE_LEN) return;
    const since = Math.floor(Date.now() / 1000);
    setStatus({ kind: 'sending', since });
    const res = await sendRelay({ action: 'unlock_code', code });
    setCode('');
    if (!res.ok) setStatus({ kind: 'error', text: relayErrorText(res.error) });
  };

  useDpad(rootRef, {
    onBack: onClose,
    onKey: (e) => {
      if (/^[0-9]$/.test(e.key)) {
        addDigit(e.key);
        return true;
      }
      if (e.key === 'Backspace' && code.length > 0) {
        backspace();
        return true;
      }
      return false;
    },
  });

  const message =
    result ??
    (status.kind === 'error'
      ? { tone: 'error' as const, text: status.text }
      : busy
        ? { tone: 'info' as const, text: 'Verificando el código…' }
        : null);

  return (
    <div ref={rootRef} className="w-screen h-screen bg-[#05070c] text-white flex flex-col items-center justify-center gap-8 tv-safe select-none">
      <div className="text-center max-w-3xl">
        <h1 className="text-4xl font-semibold">Código de desbloqueo</h1>
        <p className="mt-3 text-xl text-white/60">
          Pedile a tu proveedor el código de 8 dígitos de este equipo e ingresalo con los números del control remoto.
        </p>
      </div>
      <div className="flex gap-3" aria-label={`${code.length} de ${CODE_LEN} dígitos`}>
        {Array.from({ length: CODE_LEN }, (_, i) => (
          <div
            key={i}
            className={`h-20 w-16 rounded-xl border-2 flex items-center justify-center font-mono text-5xl ${
              i === code.length ? 'border-sky-400' : 'border-white/20'
            } ${i === 3 ? 'mr-4' : ''}`}
          >
            {code[i] ?? ''}
          </div>
        ))}
      </div>
      <p
        role="status"
        className={`min-h-8 text-xl ${
          message?.tone === 'error' ? 'text-rose-300' : message?.tone === 'ok' ? 'text-emerald-300' : 'text-sky-200'
        }`}
      >
        {message?.text ?? ''}
      </p>
      <NumericPad onDigit={addDigit} onBackspace={backspace} onSubmit={submit} canSubmit={code.length === CODE_LEN && !busy} />
      <button className={tvButton} onClick={onClose}>
        <ArrowLeft className="h-6 w-6" aria-hidden /> Volver
      </button>
    </div>
  );
}
