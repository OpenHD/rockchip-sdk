/**
 * Shared YouTube stream resolve — same path NEX Music uses for DSP playback.
 * Order: music server → Piped → `/api/youtube/search?stream=`
 */

export type StreamResolveResult = {
  url: string;
  mimeType: string;
  quality: string;
  kind: 'audio' | 'muxed';
  title?: string;
  duration?: number;
  source: string;
};

/** Keep in sync with api/youtube/search.ts — only live instances. */
const PIPED_INSTANCES = ['https://api.piped.private.coffee'];

function pipedUrl(base: string, path: string): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\//, ''), root).toString();
}

type PipedStream = {
  url?: string;
  bitrate?: number;
  mimeType?: string;
  quality?: string;
  videoOnly?: boolean;
};

function pickFromPiped(
  data: {
    title?: string;
    duration?: number;
    audioStreams?: PipedStream[];
    videoStreams?: PipedStream[];
  },
  source: string,
): StreamResolveResult | null {
  const audios = (data.audioStreams || [])
    .filter((s) => s.url && s.videoOnly !== true)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  if (audios[0]?.url) {
    return {
      url: audios[0].url,
      mimeType: audios[0].mimeType || 'audio/mp4',
      quality: audios[0].quality || 'audio',
      kind: 'audio',
      title: data.title,
      duration: data.duration,
      source,
    };
  }
  const muxed = (data.videoStreams || [])
    .filter(
      (s) =>
        s.url &&
        s.videoOnly === false &&
        typeof s.mimeType === 'string' &&
        s.mimeType.includes('mp4') &&
        !String(s.quality || '').toUpperCase().includes('LBRY'),
    )
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  if (muxed[0]?.url) {
    return {
      url: muxed[0].url,
      mimeType: muxed[0].mimeType || 'video/mp4',
      quality: muxed[0].quality || '360p',
      kind: 'muxed',
      title: data.title,
      duration: data.duration,
      source,
    };
  }
  // Last resort: LBRY / any muxed (SABR often empties native audio)
  const any = (data.videoStreams || []).find(
    (s) =>
      s.url &&
      s.videoOnly === false &&
      (String(s.mimeType || '').includes('mp4') ||
        String(s.quality || '').toUpperCase().includes('LBRY')),
  );
  if (any?.url) {
    return {
      url: any.url,
      mimeType: any.mimeType || 'video/mp4',
      quality: any.quality || 'mirror',
      kind: 'muxed',
      title: data.title,
      duration: data.duration,
      source,
    };
  }
  return null;
}

async function resolveFromPipedClient(videoId: string, signal: AbortSignal): Promise<StreamResolveResult> {
  const errors: string[] = [];
  const tasks = PIPED_INSTANCES.map(async (base) => {
    const res = await fetch(pipedUrl(base, `streams/${encodeURIComponent(videoId)}`), {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      errors.push(`${base}:${res.status}`);
      throw new Error(`piped ${res.status}`);
    }
    const data = await res.json();
    const picked = pickFromPiped(data, base);
    if (!picked) {
      errors.push(`${base}:empty`);
      throw new Error('empty');
    }
    return picked;
  });
  try {
    return await Promise.any(tasks);
  } catch {
    throw new Error(errors.slice(0, 3).join(',') || 'piped fail');
  }
}

/** NEX Music / NEX DJ — Vercel function that wraps Piped for `?stream=videoId`. */
async function resolveFromNexYoutubeApi(videoId: string, signal: AbortSignal): Promise<StreamResolveResult> {
  const res = await fetch(`/api/youtube/search?stream=${encodeURIComponent(videoId)}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Stream HTTP ${res.status}`);
  }
  return res.json() as Promise<StreamResolveResult>;
}

async function resolveFromMusicServer(videoId: string, signal: AbortSignal): Promise<StreamResolveResult | null> {
  const base = (import.meta.env.VITE_MUSIC_SERVER_URL as string | undefined)?.replace(/\/$/, '');
  if (!base) return null;
  const res = await fetch(`${base}/stream/${encodeURIComponent(videoId)}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string; detail?: string }).detail ||
        (body as { error?: string }).error ||
        `music-server ${res.status}`,
    );
  }
  const data = (await res.json()) as StreamResolveResult;
  if (!data?.url) return null;
  return data;
}

/**
 * Resolve a playable media URL for a YouTube videoId.
 * Same pipeline as NEX Music DSP mode.
 */
export async function resolveYoutubeStream(
  videoId: string,
  signal?: AbortSignal,
): Promise<StreamResolveResult> {
  const ac = signal ?? new AbortController().signal;
  const errors: string[] = [];

  try {
    const custom = await resolveFromMusicServer(videoId, ac);
    if (custom?.url) return custom;
  } catch (err) {
    errors.push(`music-server:${(err as Error).message}`);
  }

  try {
    return await resolveFromPipedClient(videoId, ac);
  } catch (err) {
    errors.push(`piped:${(err as Error).message}`);
  }

  try {
    return await resolveFromNexYoutubeApi(videoId, ac);
  } catch (err) {
    errors.push(`api:${(err as Error).message}`);
    const needsServer = !hasMusicServer();
    throw new Error(
      (needsServer
        ? 'Falta music server en producción (VITE_MUSIC_SERVER_URL). Piped/API no alcanzan para este video. '
        : '') +
        (errors.join(' | ') ||
          'No se pudo resolver el stream vía /api/youtube (la misma API que NEX Music).'),
    );
  }
}

export function hasMusicServer(): boolean {
  return Boolean(import.meta.env.VITE_MUSIC_SERVER_URL);
}

/** Search results shape returned by `/api/youtube/search?q=` (NEX Music). */
export type YoutubeSearchResult = {
  id: string;
  kind: 'video' | 'playlist';
  title: string;
  channelTitle: string;
  publishedAt?: string;
  thumbnail: string;
  description?: string;
};

export async function searchYoutube(
  query: string,
  signal?: AbortSignal,
): Promise<YoutubeSearchResult[]> {
  const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query.trim())}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `YouTube search HTTP ${res.status}`);
  }
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results as YoutubeSearchResult[];
}
