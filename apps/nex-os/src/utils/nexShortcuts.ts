/**
 * Atajos de NEX OS — evitamos combos del host:
 * - Win+* / Alt+Tab → Windows
 * - Ctrl+Alt+Tab → sticky Alt+Tab de Windows
 * - Ctrl+Alt+←→ → rotación de pantalla (Intel)
 *
 * Convención: Ctrl+Alt+letra / ` / [ ]
 */
export const NEX_SHORTCUTS = {
  clipboardHistory: 'Ctrl+Alt+V',
  snip: 'Ctrl+Alt+S',
  showDesktop: 'Ctrl+Alt+D',
  explorer: 'Ctrl+Alt+E',
  run: 'Ctrl+Alt+R',
  taskView: 'Ctrl+Alt+T',
  appSwitcher: 'Ctrl+Alt+`',
  desktopPrev: 'Ctrl+Alt+[',
  desktopNext: 'Ctrl+Alt+]',
} as const;

/** Ctrl+Alt pressed (and not Meta/Win). */
export function isNexMod(e: KeyboardEvent): boolean {
  return e.ctrlKey && e.altKey && !e.metaKey;
}
