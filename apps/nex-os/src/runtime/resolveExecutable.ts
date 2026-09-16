import { resolveRegisteredApp } from '@nex-os/sdk';
import { NEX_EXECUTABLE_REGISTRY, type NexExecutable } from './nexRegistry';
import type { FileItem } from '../context/FileSystemContext';

export type ResolvedExecutable = {
  appId: string;
  title: string;
  args?: string[];
  source: 'nex-registry' | 'vfs-payload' | 'sdk';
};

/**
 * Unified PATH resolution: .nex registry → VFS nexPayload → SDK community apps.
 */
export function resolveExecutable(
  query: string,
  files?: FileItem[],
): ResolvedExecutable | null {
  const raw = query.trim();
  if (!raw) return null;

  let filename = raw.toLowerCase();
  if (filename.includes('\\')) filename = filename.split('\\').pop()!;
  if (filename.includes('/')) filename = filename.split('/').pop()!;
  filename = filename.replace(/^\.[\\/]/, '');

  const nexName = filename.endsWith('.nex') ? filename : `${filename}.nex`;
  const fromReg = NEX_EXECUTABLE_REGISTRY[nexName];
  if (fromReg) {
    return { ...fromReg, source: 'nex-registry' };
  }

  if (files) {
    const base = filename.replace(/\.nex$/, '');
    const hit = files.find(
      (f) =>
        f.ext === 'nex' &&
        f.nexPayload &&
        (f.name.toLowerCase() === base || `${f.name}.${f.ext}`.toLowerCase() === nexName),
    );
    if (hit?.nexPayload) {
      return {
        appId: hit.nexPayload.appId,
        title: hit.nexPayload.title,
        args: hit.nexPayload.args,
        source: 'vfs-payload',
      };
    }
  }

  const community = resolveRegisteredApp(filename.replace(/\.nex$/, ''));
  if (community) {
    return {
      appId: community.appId,
      title: community.title,
      source: 'sdk',
    };
  }

  return null;
}

export type { NexExecutable };
