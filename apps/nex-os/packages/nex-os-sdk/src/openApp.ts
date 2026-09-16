import { resolveRegisteredApp } from './registry';
import type { NexAppProps, NexOpenWindowFn } from './types';

export type OpenAppOptions = {
  /** Override window instance id (default: manifest.id). */
  windowId?: string;
  /** Merged over manifest.defaultProps. */
  props?: NexAppProps;
};

/**
 * Pure helper: open a registered community app by id / alias / title.
 * Returns false if nothing matched (caller can fall back to builtins).
 *
 * @example
 * const openApp = createOpenApp(openWindow);
 * openApp('hello'); // alias of Hello NEX
 */
export function createOpenApp(openWindow: NexOpenWindowFn) {
  return (query: string, options: OpenAppOptions = {}): boolean => {
    const manifest = resolveRegisteredApp(query);
    if (!manifest) return false;
    const props = { ...(manifest.defaultProps ?? {}), ...(options.props ?? {}) };
    openWindow(
      options.windowId ?? manifest.id,
      manifest.appId,
      manifest.title,
      manifest.icon,
      Object.keys(props).length ? props : undefined,
    );
    return true;
  };
}
