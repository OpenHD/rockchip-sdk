import { resolveAppMeta } from './resolveAppMeta';

export type RecentAppEntry = {
  id: string;
  appId: string;
  title: string;
  openedAt: number;
};

const KEY = 'win11_recent_apps';
const MAX = 8;

export function loadRecentApps(): RecentAppEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentAppEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentApp(id: string, appId: string, title: string) {
  const prev = loadRecentApps().filter((r) => r.id !== id && r.appId !== appId);
  const next: RecentAppEntry[] = [
    { id, appId, title, openedAt: Date.now() },
    ...prev,
  ].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('nex-recents-changed'));
  return next;
}

export function recentAppsWithIcons() {
  return loadRecentApps().map((r) => {
    const meta = resolveAppMeta(r.appId);
    return { ...r, title: r.title || meta.title, icon: meta.icon };
  });
}

export function formatRecentWhen(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Justo ahora';
  if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)} h`;
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
