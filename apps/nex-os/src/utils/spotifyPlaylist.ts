import type { Track } from '../types/music';

export interface SpotifyPlaylistApiTrack {
  id: string;
  title: string;
  artist: string;
  cover: string;
  duration: number;
  uri: string;
}

export interface SpotifyPlaylistApiResponse {
  id: string;
  name: string;
  cover: string;
  trackCount: number;
  importedCount: number;
  truncated: boolean;
  tracks: SpotifyPlaylistApiTrack[];
}

export function parseSpotifyPlaylistId(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  if (/^[a-zA-Z0-9]{10,30}$/.test(input)) return input;

  try {
    const url = new URL(input);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('playlist');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].split('?')[0];
  } catch {
    /* plain text */
  }

  const uriMatch = input.match(/^spotify:playlist:([a-zA-Z0-9]+)$/i);
  return uriMatch ? uriMatch[1] : null;
}

export function spotifyTracksToNexTracks(tracks: SpotifyPlaylistApiTrack[]): Track[] {
  return tracks.map((t) => ({
    id: `spotify:${t.id}`,
    title: t.title,
    artist: t.artist,
    cover: t.cover,
    url: t.uri,
    service: 'spotify',
    kind: 'video',
  }));
}

export async function fetchSpotifyPlaylist(source: string): Promise<SpotifyPlaylistApiResponse> {
  const id = parseSpotifyPlaylistId(source);
  const query = id ? `id=${encodeURIComponent(id)}` : `url=${encodeURIComponent(source.trim())}`;
  const res = await fetch(`/api/spotify-playlist?${query}`, {
    credentials: 'include',
  });

  let data: { error?: string; needsSpotifyAuth?: boolean } = {};
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      res.status === 404
        ? 'API de Spotify no disponible en el deploy (404). Esperá el redeploy.'
        : `Respuesta inválida del servidor (${res.status})`,
    );
  }

  if (!res.ok) {
    const err = new Error(
      data.error || `No se pudo importar la playlist de Spotify (${res.status})`,
    ) as Error & { needsSpotifyAuth?: boolean };
    err.needsSpotifyAuth = Boolean(data.needsSpotifyAuth) || res.status === 401;
    throw err;
  }

  return data as SpotifyPlaylistApiResponse;
}

export function startSpotifyAuth(returnTo = '/nex-music') {
  window.location.href = `/api/spotify-auth?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function getSpotifySession(): Promise<{ connected: boolean; expired?: boolean }> {
  const res = await fetch('/api/spotify-session', { credentials: 'include' });
  if (!res.ok) return { connected: false };
  return res.json();
}
