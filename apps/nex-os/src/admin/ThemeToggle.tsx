import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemeChoice } from './theme';
import { Segmented } from './ui';

const OPTIONS: { id: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'system', label: 'Sistema', icon: Monitor },
];

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [choice, setChoice] = useTheme();
  return <Segmented label="Tema del panel" options={OPTIONS} value={choice} onChange={setChoice} className={className} />;
}
