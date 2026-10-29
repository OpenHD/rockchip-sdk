import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemeChoice } from './theme';

const OPTIONS: { id: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'system', label: 'Sistema', icon: Monitor },
];

/** Selector Claro / Oscuro / Sistema del panel. */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [choice, setChoice] = useTheme();
  return (
    <div role="group" aria-label="Tema" className={`flex rounded-lg border border-white/[0.06] p-0.5 ${className}`}>
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={choice === id}
          title={`Tema ${label.toLowerCase()}`}
          onClick={() => setChoice(id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition ${
            choice === id ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
