import type { Track } from '../types/music';
import { scoreMatchQuality } from './matchQuality';

const CACHE_KEY = 'nexYtResolveCache_v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type CacheEntry = {
  videoId: string;
  title?: string;
  channelTitle?: string;
  thumbnail?: string;
  savedAt: number;
};

function cacheKey(title: string, artist: string) {
  return `${title.trim()}|${artist.trim()}`.toLowerCase();
}

function saveCache(cache: Record<string, CacheEntry>) {
  try {
    const entries = Object.entries(cache);
    const trimmed =
      entries.length > 400
        ? Object.fromEntries(
            entries
              .sort((a, b) => b[1].savedAt - a[1].savedAt)
              .slice(0, 300),
          )
        : cache;
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

function readCached(title: string, artist: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, CacheEntry>;
    const entry = cache[cacheKey(title, artist)];
    if (!entry?.videoId) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCached(title: string, artist: string, entry: Omit<CacheEntry, 'savedAt'>) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cache: Record<string, CacheEntry> = raw ? JSON.parse(raw) : {};
    cache[cacheKey(title, artist)] = { ...entry, savedAt: Date.now() };
    saveCache(cache);
  } catch {
    /* ignore */
  }
}

/** Solo falta resolver si no hay videoId de YouTube. */
export function trackNeedsYoutubeResolution(track: Track): boolean {
  return !track.videoId;
}

function toPlayable(
  track: Track,
  videoId: string,
  meta?: Partial<CacheEntry> & { matchQuality?: Track['matchQuality'] },
): Track {
  return {
    ...track,
    videoId,
    cover: track.cover || meta?.thumbnail || track.cover,
    service: track.service || 'youtube',
    kind: track.kind ?? 'video',
    matchQuality: meta?.matchQuality || track.matchQuality,
  };
}

export async function resolveTrackForPlayback(track: Track): Promise<Track | null> {
  if (!trackNeedsYoutubeResolution(track)) return track;

  const baseTitle = track.title?.trim() || '';
  const baseArtist = track.artist?.trim() || '';
  const base = `${baseTitle} ${baseArtist}`.trim();
  if (!base) return null;

  const cached = readCached(baseTitle, baseArtist);
  if (cached?.videoId) {
    const quality = scoreMatchQuality(track, {
      title: cached.title,
      channelTitle: cached.channelTitle,
    });
    return toPlayable(track, cached.videoId, { ...cached, matchQuality: quality });
  }

  const queries = [
    `${base} official audio`,
    `${base} topic`,
    `${base} official video`,
    base,
  ];

  try {
    for (const searchQuery of queries) {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) continue;

      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      const preferred =
        results.find((r: { title?: string; channelTitle?: string }) => {
          const t = `${r.title || ''} ${r.channelTitle || ''}`.toLowerCase();
          return (
            t.includes('official audio') ||
            t.includes('topic') ||
            t.includes('official video') ||
            t.includes('- topic')
          );
        }) || results[0];

      if (preferred?.id) {
        const matchQuality = scoreMatchQuality(track, preferred);
        writeCached(baseTitle, baseArtist, {
          videoId: preferred.id,
          title: preferred.title,
          channelTitle: preferred.channelTitle,
          thumbnail: preferred.thumbnail,
        });
        return toPlayable(track, preferred.id, {
          videoId: preferred.id,
          thumbnail: preferred.thumbnail,
          matchQuality,
        });
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Precarga el próximo tema de la cola para que el cambio sea casi instantáneo. */
export function prefetchTrackResolution(track: Track | null | undefined) {
  if (!track || !trackNeedsYoutubeResolution(track)) return;
  void resolveTrackForPlayback(track);
}

/** Fuerza re-búsqueda ignorando caché (reportar mal match). */
export async function reResolveTrack(track: Track): Promise<Track | null> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache = JSON.parse(raw) as Record<string, CacheEntry>;
      delete cache[cacheKey(track.title || '', track.artist || '')];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }
  } catch {
    /* ignore */
  }
  const withoutId = { ...track, videoId: undefined };
  return resolveTrackForPlayback(withoutId);
}
