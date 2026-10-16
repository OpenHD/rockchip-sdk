import type {
  NexAppCategory,
  NexAppManifest,
  NexAppProps,
  NexLauncherItem,
  RegistryListener,
} from './types';

const byAppId = new Map<string, NexAppManifest>();
const listeners = new Set<RegistryListener>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener errors */
    }
  });
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase();
}

/** Suscribite a altas/bajas de apps (para refrescar Start/Taskbar). */
export function subscribeRegistry(listener: RegistryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Registra una app en runtime.
 * Podés llamarlo desde tu módulo de community apps al boot.
 */
export function registerApp<TProps extends NexAppProps = NexAppProps>(
  manifest: NexAppManifest<TProps>,
): void {
  if (!manifest?.appId || !manifest?.component) {
    throw new Error('@nex-os/sdk: registerApp requiere appId y component');
  }
  const entry = manifest as NexAppManifest;
  byAppId.set(normalizeKey(manifest.appId), entry);
  byAppId.set(normalizeKey(manifest.id), entry);
  for (const alias of manifest.aliases ?? []) {
    byAppId.set(normalizeKey(alias), entry);
  }
  emit();
}

/** Quita una app del registro dinámico (no afecta apps built-in del host). */
export function unregisterApp(appId: string): void {
  const existing = byAppId.get(normalizeKey(appId));
  if (!existing) return;
  for (const [key, value] of byAppId.entries()) {
    if (value === existing) byAppId.delete(key);
  }
  emit();
}

export function getRegisteredApp(appId: string): NexAppManifest | undefined {
  return byAppId.get(normalizeKey(appId));
}

/**
 * Resuelve appId, id, alias o título (case-insensitive).
 * Ideal para Run / deep-links.
 */
export function resolveRegisteredApp(query: string): NexAppManifest | undefined {
  const q = normalizeKey(query);
  if (!q) return undefined;

  const direct = byAppId.get(q);
  if (direct) return direct;

  for (const m of listRegisteredApps()) {
    if (normalizeKey(m.appId) === q) return m;
    if (normalizeKey(m.id) === q) return m;
    if (normalizeKey(m.title) === q) return m;
    if (m.aliases?.some((a) => normalizeKey(a) === q)) return m;
  }
  return undefined;
}

/** Lista única de manifests (sin duplicar aliases). */
export function listRegisteredApps(): NexAppManifest[] {
  const seen = new Set<NexAppManifest>();
  const out: NexAppManifest[] = [];
  for (const m of byAppId.values()) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

/** Filtra community apps por categoría. */
export function getAppsByCategory(category: NexAppCategory): NexAppManifest[] {
  return listRegisteredApps().filter((m) => m.category === category);
}

/** Items listos para mezclar con la taskbar / search. */
export function getCommunityLauncherItems(): NexLauncherItem[] {
  return listRegisteredApps().map((m) => ({
    id: m.id,
    appId: m.appId,
    label: m.title,
    icon: m.icon,
    isPinned: m.pinToTaskbar,
    description: m.description,
    author: m.author,
    community: true,
    category: m.category,
  }));
}

/** Helper: define + register en un solo paso (con props tipadas). */
export function defineApp<TProps extends NexAppProps = NexAppProps>(
  manifest: NexAppManifest<TProps>,
): NexAppManifest<TProps> {
  registerApp(manifest);
  return manifest;
}
