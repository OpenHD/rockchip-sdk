import { useEffect } from 'react';

interface UseMusicKeyboardShortcutsOptions {
  enabled?: boolean;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekBySeconds?: (delta: number) => void;
}

/**
 * Atajos globales de reproducción (ignorados si el foco está en un input).
 * Space · play/pause
 * N / → · siguiente (→ seek +10s si hay seekBySeconds con Shift)
 * P / ← · anterior
 * J / L · -10s / +10s
 */
export function useMusicKeyboardShortcuts({
  enabled = true,
  togglePlay,
  nextTrack,
  prevTrack,
  seekBySeconds,
}: UseMusicKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === ' ' || key === 'k') {
        e.preventDefault();
        togglePlay();
        return;
      }

      if (key === 'n') {
        e.preventDefault();
        nextTrack();
        return;
      }

      if (key === 'p') {
        e.preventDefault();
        prevTrack();
        return;
      }

      if (key === 'arrowright') {
        e.preventDefault();
        if (e.shiftKey) nextTrack();
        else seekBySeconds?.(10);
        return;
      }

      if (key === 'arrowleft') {
        e.preventDefault();
        if (e.shiftKey) prevTrack();
        else seekBySeconds?.(-10);
        return;
      }

      if (key === 'l' || key === 'j') {
        e.preventDefault();
        seekBySeconds?.(key === 'l' ? 10 : -10);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, togglePlay, nextTrack, prevTrack, seekBySeconds]);
}
