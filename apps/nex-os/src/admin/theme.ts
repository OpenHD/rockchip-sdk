import { useEffect, useState } from 'react';

/** Tema del panel. "system" sigue al sistema operativo; por defecto oscuro, como siempre fue el panel. */
export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'nex-admin-theme';
const media = window.matchMedia('(prefers-color-scheme: light)');

function stored(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

/** Tema efectivo ("light" o "dark"), el que leen admin-light.css y el captcha. */
export function resolvedTheme(choice: ThemeChoice = stored()): 'light' | 'dark' {
  return choice === 'system' ? (media.matches ? 'light' : 'dark') : choice;
}

function apply(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolvedTheme(choice);
}

// Antes del primer render, para que no parpadee el tema oscuro (la CSP no permite scripts inline en el HTML).
apply(stored());

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(stored);
  useEffect(() => {
    apply(choice);
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // Sin almacenamiento (modo privado): el tema dura hasta recargar.
    }
    if (choice !== 'system') return;
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [choice]);
  return [choice, setChoice] as const;
}
