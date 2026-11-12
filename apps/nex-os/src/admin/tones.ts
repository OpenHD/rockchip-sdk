/** Tonos de estado del panel y sus clases de color (tokens de admin.css). */
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Punto, barra o tramo sólido. */
export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-neutral',
  success: 'bg-ok',
  warning: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-accent',
};

/** Texto o ícono. */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-fg-4',
  success: 'text-ok',
  warning: 'text-warn',
  danger: 'text-danger',
  info: 'text-accent',
};
