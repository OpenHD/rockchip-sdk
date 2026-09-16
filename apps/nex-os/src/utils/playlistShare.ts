import type { Playlist, Track } from '../types/music';
import { appOrigin, buildCloudPlaylistShareUrl, buildViralShareUrl } from './share';

/** Compact hash payload: [name, [[id, title, artist, cover, videoId], ...]] */
export type CompactPlaylistPayload = [string, Array<[string, string, string, string, string | undefined]>];

const SHORT_MAP_KEY = 'nexShortPlaylistMap';
const CLOUD_MAP_KEY = 'nexCloudPlaylistMap';

function getShortMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SHORT_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveShortMap(map: Record<string, string>) {
  try {
    localStorage.setItem(SHORT_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getCachedCloudId(localPlaylistId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(CLOUD_MAP_KEY) || '{}');
    return map[localPlaylistId] ?? null;
  } catch {
    return null;
  }
}

export function encodePlaylistShareCode(playlist: Pick<Playlist, 'name' | 'tracks'>): string {
  const compact: CompactPlaylistPayload = [
    playlist.name,
    playlist.tracks.map((tr) => [
      tr.id,
      tr.title,
      tr.artist,
      tr.cover,
      tr.videoId,
    ]),
  ];
  return btoa(encodeURIComponent(JSON.stringify(compact)));
}

/** @deprecated Prefer createShortPlaylistShareUrl — hash embeds full playlist and gets huge. */
export function buildPlaylistHashShareUrl(playlist: Pick<Playlist, 'name' | 'tracks'>): string {
  const code = encodePlaylistShareCode(playlist);
  const slug = encodeURIComponent(
    playlist.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40),
  );
  return `${appOrigin()}/nex-music#${slug || 'lista'}/${code}`;
}

export function buildShortPlaylistShareUrl(code: string): string {
  return `${appOrigin()}/p/${code}`;
}

/**
 * Crea (o reusa) un link corto.
 * Prioridad: cloud UUID → short code cacheado → POST /api/playlist-share.
 */
export async function createShortPlaylistShareUrl(
  playlist: Playlist,
): Promise<{ url: string; kind: 'cloud' | 'short' }> {
  const cloudId = getCachedCloudId(playlist.id);
  if (cloudId) {
    return { url: buildCloudPlaylistShareUrl(cloudId), kind: 'cloud' };
  }

  const cached = getShortMap()[playlist.id];
  if (cached) {
    return { url: buildShortPlaylistShareUrl(cached), kind: 'short' };
  }

  const res = await fetch('/api/playlist-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: playlist.name,
      cover: playlist.cover || playlist.tracks[0]?.cover || null,
      ownerName: playlist.ownerName || 'Anonymous',
      tracks: playlist.tracks,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ||
        'No se pudo crear el link corto. Publicá en la nube o ejecutá schema-playlist-shares.sql',
    );
  }

  const data = (await res.json()) as { code: string; url: string };
  if (!data.code) throw new Error('Respuesta inválida del servidor');

  const map = getShortMap();
  map[playlist.id] = data.code;
  saveShortMap(map);

  return { url: data.url || buildShortPlaylistShareUrl(data.code), kind: 'short' };
}

export async function fetchShortPlaylistShare(code: string): Promise<Playlist | null> {
  const res = await fetch(`/api/playlist-share?code=${encodeURIComponent(code)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  return {
    id: `share:${data.code}`,
    name: data.name || 'Lista compartida',
    cover: data.cover || undefined,
    tracks: tracks.map((t: Record<string, unknown>) => ({
      id: String(t.id ?? ''),
      title: String(t.title ?? ''),
      artist: String(t.artist ?? ''),
      cover: String(t.cover ?? ''),
      url: '',
      service: (t.service as Track['service']) || 'youtube',
      kind: 'video' as const,
      videoId: t.videoId ? String(t.videoId) : undefined,
    })),
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    isPrivate: false,
    ownerName: data.ownerName || 'Anonymous',
    votes: [],
  };
}

export function decodePlaylistShareCode(code: string): Playlist | null {
  try {
    const decoded = JSON.parse(decodeURIComponent(atob(code)));
    if (Array.isArray(decoded)) {
      return {
        id: Date.now().toString(),
        name: decoded[0],
        tracks: (decoded[1] || []).map((tr: unknown[]) => ({
          id: String(tr[0]),
          title: String(tr[1]),
          artist: String(tr[2] ?? ''),
          cover: String(tr[3] ?? ''),
          url: '',
          service: 'youtube' as const,
          kind: 'video' as const,
          videoId: tr[4] ? String(tr[4]) : undefined,
        })),
        createdAt: Date.now(),
        isPrivate: false,
        ownerName: 'Anonymous',
        votes: [],
      };
    }

    return {
      id: Date.now().toString(),
      name: decoded.name || decoded.n,
      tracks: (decoded.tracks || decoded.t || []).map((tr: Record<string, unknown>) => ({
        id: String(tr.id || tr.i),
        title: String(tr.title || tr.ti),
        artist: String(tr.artist || tr.a || ''),
        cover: String(tr.cover || tr.c || ''),
        url: String(tr.url || ''),
        service: (tr.service as Track['service']) || 'youtube',
        kind: (tr.kind as Track['kind']) || 'video',
        videoId: tr.videoId || tr.v ? String(tr.videoId || tr.v) : undefined,
      })),
      createdAt: Date.now(),
      isPrivate: Boolean(decoded.isPrivate),
      ownerName: String(decoded.ownerName || decoded.o || 'Anonymous'),
      votes: Array.isArray(decoded.votes) ? decoded.votes : [],
    };
  } catch {
    return null;
  }
}

export function extractPlaylistShareCodeFromInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.includes('#')) {
      const hash = trimmed.split('#')[1] || '';
      const parts = hash.split('/');
      return parts[parts.length - 1] || null;
    }
    const url = new URL(trimmed, 'https://anex-os.vercel.app');
    const playlist = url.searchParams.get('playlist');
    if (playlist) return playlist;
    const short = url.searchParams.get('p');
    if (short) return short;
    const pathMatch = url.pathname.match(/\/p\/([A-Za-z0-9]{6,12})\/?$/);
    if (pathMatch) return pathMatch[1];
  } catch {
    /* not a URL — treat as raw code */
  }
  return trimmed;
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4,6}$/i.test(code.trim());
}

export function isValidShortShareCode(code: string): boolean {
  return /^[A-Za-z0-9]{6,12}$/.test(code.trim());
}

/** Re-export for callers that build viral URLs with p= */
export function buildViralShortPlaylistUrl(code: string): string {
  return buildViralShareUrl({ p: code });
}
