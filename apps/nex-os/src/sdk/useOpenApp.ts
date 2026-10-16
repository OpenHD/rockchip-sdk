import { useCallback } from 'react';
import { createOpenApp, type NexAppProps } from '@nex-os/sdk';
import { useWindowManager } from '../context/WindowManager';

/**
 * Abre una community app por appId, alias o título.
 *
 * @example
 * const openApp = useOpenApp();
 * openApp('hello');
 * openApp('sdk-docs', { tab: 'api' });
 */
export function useOpenApp() {
  const { openWindow } = useWindowManager();

  return useCallback(
    (query: string, props?: NexAppProps, windowId?: string) =>
      createOpenApp(openWindow)(query, { props, windowId }),
    [openWindow],
  );
}
