import { useEffect, useState } from 'react';
import { getCommunityLauncherItems, subscribeRegistry } from '@nex-os/sdk';
import { APPS, type AppItem } from '../constants/apps';

/** Apps built-in + community (`@nex-os/sdk`), reactivas al registro. */
export function useLauncherApps(): AppItem[] {
  const [, setTick] = useState(0);
  useEffect(() => subscribeRegistry(() => setTick((n) => n + 1)), []);

  const builtinIds = new Set(APPS.map((a) => a.id));
  const community: AppItem[] = getCommunityLauncherItems()
    .filter((item) => !builtinIds.has(item.id))
    .map((item) => ({
      id: item.id,
      appId: item.appId,
      label: item.label,
      icon: item.icon,
      isPinned: item.isPinned,
    }));

  return [...APPS, ...community];
}
