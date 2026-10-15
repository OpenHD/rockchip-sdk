import { useState, type ReactNode } from 'react';
import { ArrowBigUp, Check, Delete } from 'lucide-react';
import { keyClass } from './styles';

/**
 * Teclados en pantalla para el control remoto. Son solo botones: la navegación
 * la resuelve useDpad (flechas) y OK/Enter los activa como cualquier botón.
 */

const LETTERS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '-'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '_', '@'],
];

const SYMBOLS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['!', '#', '$', '%', '&', '*', '(', ')', '=', '+'],
  ['?', '/', '\\', '|', '[', ']', '{', '}', '<', '>'],
  [';', ':', "'", '"', ',', '`', '~', '^', '_', '@'],
];

/**
 * `dim`: se ve apagada pero sigue siendo enfocable (un botón deshabilitado pierde el foco
 * y el control remoto quedaría sin nada seleccionado).
 */
function Key({ label, onPress, wide, active, dim, autoFocus }: {
  label: ReactNode;
  onPress: () => void;
  wide?: string;
  active?: boolean;
  dim?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      aria-disabled={dim || undefined}
      onClick={() => !dim && onPress()}
      className={`${keyClass} ${wide ?? 'w-16'} flex items-center justify-center ${active ? 'bg-sky-500/60' : 'bg-white/10'} ${dim ? 'opacity-40' : ''}`}
    >
      {label}
    </button>
  );
}

export function OnScreenKeyboard({
  onChar,
  onBackspace,
  onSubmit,
  canSubmit,
  submitLabel = 'OK',
}: {
  onChar: (c: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitLabel?: string;
}) {
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const rows = symbols ? SYMBOLS : LETTERS;

  return (
    <div className="flex flex-col items-center gap-2" aria-label="Teclado en pantalla">
      {rows.map((row, r) => (
        <div key={r} className="flex gap-2">
          {row.map((k, i) => {
            const c = shift && !symbols ? k.toUpperCase() : k;
            return <Key key={`${r}-${i}`} label={c} onPress={() => onChar(c)} autoFocus={r === 1 && i === 0} />;
          })}
        </div>
      ))}
      <div className="flex gap-2">
        <Key
          label={<span className="flex items-center gap-2 text-lg"><ArrowBigUp className="h-6 w-6" aria-hidden /> Mayús</span>}
          wide="w-36"
          active={shift && !symbols}
          dim={symbols}
          onPress={() => setShift((s) => !s)}
        />
        <Key label={<span className="text-lg">{symbols ? 'abc' : '#+='}</span>} wide="w-24" onPress={() => setSymbols((s) => !s)} />
        <Key label={<span className="text-lg">Espacio</span>} wide="w-56" onPress={() => onChar(' ')} />
        <Key label={<span className="flex items-center gap-2 text-lg"><Delete className="h-6 w-6" aria-hidden /> Borrar</span>} wide="w-36" onPress={onBackspace} />
        <Key
          label={<span className="flex items-center gap-2 text-lg"><Check className="h-6 w-6" aria-hidden /> {submitLabel}</span>}
          wide="w-36"
          dim={!canSubmit}
          onPress={onSubmit}
        />
      </div>
    </div>
  );
}

export function NumericPad({
  onDigit,
  onBackspace,
  onSubmit,
  canSubmit,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="grid grid-cols-3 gap-3" aria-label="Teclado numérico">
      {digits.map((d) => (
        <Key key={d} label={d} wide="w-24" onPress={() => onDigit(d)} autoFocus={d === '1'} />
      ))}
      <Key label={<Delete className="h-7 w-7" aria-label="Borrar" />} wide="w-24" onPress={onBackspace} />
      <Key label="0" wide="w-24" onPress={() => onDigit('0')} />
      <Key label={<Check className="h-7 w-7" aria-label="Aceptar" />} wide="w-24" dim={!canSubmit} onPress={onSubmit} />
    </div>
  );
}
