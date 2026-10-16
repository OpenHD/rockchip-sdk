import type { ReactNode } from 'react';
import { Document24Regular } from '@fluentui/react-icons';
import { getRegisteredApp, listRegisteredApps } from '@nex-os/sdk';
import { APPS } from '../constants/apps';

/** Resolve title + icon for an appId (built-in APPS or community registry). */
export function resolveAppMeta(appId: string): { title: string; icon: ReactNode } {
  const builtin = APPS.find((a) => a.appId === appId || a.id === appId);
  if (builtin) return { title: builtin.label, icon: builtin.icon };

  const community =
    getRegisteredApp(appId) ||
    listRegisteredApps().find((m) => m.id === appId || m.appId === appId);
  if (community) return { title: community.title, icon: community.icon };

  return { title: appId, icon: <Document24Regular /> };
}
