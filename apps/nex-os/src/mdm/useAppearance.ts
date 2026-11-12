import { useCallback, useState } from 'react';
import { APPEARANCE_KEY, parseAppearance, type Appearance } from './settings';

/** Preferencias visuales por equipo. localStorage es solo una conveniencia: si falla, usa los valores por defecto. */
export function useAppearance(): [Appearance, (p: Partial<Appearance>) => void] {
  const [pref, setPref] = useState<Appearance>(() => {
    try {
      return parseAppearance(localStorage.getItem(APPEARANCE_KEY));
    } catch {
      return parseAppearance(null);
    }
  });
  const update = useCallback((p: Partial<Appearance>) => {
    setPref((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
      } catch {
        // Sin almacenamiento: el cambio vale solo para esta sesión.
      }
      return next;
    });
  }, []);
  return [pref, update];
}
