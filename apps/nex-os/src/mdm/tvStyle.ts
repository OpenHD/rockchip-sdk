/** Piezas de estilo compartidas por las pantallas de Ajustes y Wi-Fi de NEX TV. */

export const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack']);

/** Con un aviso a pantalla completa encima, "Atrás" es del aviso y no de la pantalla que quedó detrás. */
export const noticeOpen = () => document.querySelector('[data-nex-modal]') !== null;

/** Íconos de línea, mismo trazo que los del inicio y los avisos. */
export const ICON = {
  wifi: 'M2 8.8a15 15 0 0 1 20 0 M5 12.5a10.5 10.5 0 0 1 14 0 M8.5 16.2a5.5 5.5 0 0 1 7 0 M12 20h.01',
  wifiOff: 'M2 8.8a15 15 0 0 1 20 0 M5 12.5a10.5 10.5 0 0 1 14 0 M8.5 16.2a5.5 5.5 0 0 1 7 0 M12 20h.01 M3 3l18 18',
  cable: 'M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  wrench:
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  tv: 'M3 5h18v12H3z M8 21h8 M12 17v4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v6 M12 7.5h.01',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
  pin: 'M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z M8.5 12l2.5 2.5 4.5-5',
  refresh: 'M20 11a8 8 0 0 0-14.9-3 M4 4v4h4 M4 13a8 8 0 0 0 14.9 3 M20 20v-4h-4',
  sliders: 'M4 6h9 M17 6h3 M4 12h3 M11 12h9 M4 18h11 M19 18h1 M15 4v4 M9 10v4 M17 16v4',
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  eyeOff: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M3 3l18 18',
  plus: 'M12 5v14 M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
  keyboard: 'M3 6h18v12H3z M7 10h.01 M11 10h.01 M15 10h.01 M7 14h10',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
} as const;

export type Tone = 'sky' | 'amber' | 'emerald' | 'red' | 'muted';
export const TONE: Record<Tone, string> = {
  sky: 'bg-sky-400/15 border-sky-300/50 text-sky-200',
  amber: 'bg-amber-400/15 border-amber-300/50 text-amber-200',
  emerald: 'bg-emerald-400/15 border-emerald-300/50 text-emerald-200',
  red: 'bg-red-500/15 border-red-400/60 text-red-200',
  muted: 'bg-white/5 border-white/15 text-white/55',
};

/** Fila que se maneja con el control: el foco la enciende entera, como la franja de avisos del inicio. */
export const ROW =
  'group w-full flex items-center text-left rounded-2xl border px-6 outline-none ' +
  'focus:border-white/70 focus:bg-white/15 focus:ring-4 focus:ring-sky-300/40';
