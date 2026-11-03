/**
 * Vercel Serverless Function
 * Se sirve automáticamente en: /api/youtube/search
 *
 * Por qué existe: la API key de YouTube nunca debe llegar al navegador.
 * Esta función vive en el servidor de Vercel, lee la key desde una
 * variable de entorno, y el frontend solo le habla a ESTA ruta.
 *
 * Configuración necesaria en Vercel:
 *   1. Project Settings -> Environment Variables
 *   2. Agregar: YOUTUBE_API_KEY = tu_api_key_de_google_cloud
 *   3. Redeploy para que tome la variable
 *
 * En desarrollo local con `vercel dev`, crear un archivo .env.local:
 *   YOUTUBE_API_KEY=tu_api_key_aqui
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YouTubeSearchItem {
  id: { videoId?: string; playlistId?: string; kind: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { medium?: { url: string }; high?: { url: string } };
    description: string;
  };
}

interface SimplifiedResult {
  id: string;
  kind: 'video' | 'playlist';
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  description: string;
}

// Decodifica entidades HTML que YouTube devuelve en títulos/descripciones
// (ej: "&amp;" -> "&", "&#39;" -> "'")
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Rate limiting simple en memoria. En serverless cada instancia tiene su
// propia memoria, así que esto es una protección básica, no exacta.
// Para algo más robusto, usar Vercel KV o Upstash Redis.
const requestLog = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > MAX_REQUESTS;
}

/**
 * Piped API bases. Official list (piped-instances.kavin.rocks) currently
 * only reports private.coffee as healthy — dead hosts burn 9–10s on DNS/timeouts.
 */
const PIPED_INSTANCES = ['https://api.piped.private.coffee'];

function pipedUrl(base: string, path: string): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\//, ''), root).toString();
}

interface PipedStream {
  url?: string;
  bitrate?: number;
  codec?: string;
  mimeType?: string;
  quality?: string;
  format?: string;
  videoOnly?: boolean;
}

interface PipedStreamsResponse {
  title?: string;
  duration?: number;
  audioStreams?: PipedStream[];
  videoStreams?: PipedStream[];
  proxyUrl?: string;
}

export interface ResolvedAudioStream {
  url: string;
  mimeType: string;
  quality: string;
  kind: 'audio' | 'muxed';
  title?: string;
  duration?: number;
  source: string;
}

function pickBestStream(data: PipedStreamsResponse): Omit<ResolvedAudioStream, 'source'> | null {
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
    };
  }

  // Prefer progressive googlevideo MP4 (has audio). Exclude LBRY mirrors first.
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
    };
  }

  // Last resort: LBRY / any muxed with url (SABR often empties native audioStreams)
  const lbry = (data.videoStreams || []).find(
    (s) =>
      s.url &&
      s.videoOnly === false &&
      (String(s.mimeType || '').includes('mp4') || String(s.quality || '').toUpperCase().includes('LBRY')),
  );
  if (lbry?.url) {
    return {
      url: lbry.url,
      mimeType: lbry.mimeType || 'video/mp4',
      quality: lbry.quality || 'mirror',
      kind: 'muxed',
      title: data.title,
      duration: data.duration,
    };
  }
  return null;
}

async function resolvePipedStream(videoId: string): Promise<ResolvedAudioStream | null> {
  for (const base of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const url = pipedUrl(base, `streams/${encodeURIComponent(videoId)}`);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = (await res.json()) as PipedStreamsResponse;
      const picked = pickBestStream(data);
      if (picked) {
        return { ...picked, source: base };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Keep logs short — dead hosts are expected
      console.warn('Piped resolve fail', base, msg);
    }
  }
  return null;
}

type PipedSearchItem = {
  type?: string;
  url?: string;
  title?: string;
  thumbnail?: string;
  uploaderName?: string;
  uploaded?: number;
  uploadedDate?: string;
  shortDescription?: string;
  description?: string;
};

function videoIdFromPipedUrl(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]{6,20})/) || url.match(/\/watch\?v=([a-zA-Z0-9_-]{6,20})/) || url.match(/^\/([a-zA-Z0-9_-]{6,20})$/);
  return m?.[1] || null;
}

/** Fallback search when YOUTUBE_API_KEY is missing or Google quota fails. */
async function searchViaPiped(query: string): Promise<SimplifiedResult[]> {
  for (const base of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(
        pipedUrl(base, `search?q=${encodeURIComponent(query)}&filter=videos`),
        { signal: controller.signal, headers: { Accept: 'application/json' } },
      );
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const items: PipedSearchItem[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];
      const results = items
        .filter((item) => !item.type || item.type === 'stream' || item.type === 'video')
        .map((item) => {
          const id = videoIdFromPipedUrl(item.url);
          if (!id) return null;
          return {
            id,
            kind: 'video' as const,
            title: decodeHtmlEntities(item.title || 'Untitled'),
            channelTitle: decodeHtmlEntities(item.uploaderName || 'YouTube'),
            publishedAt:
              item.uploadedDate ||
              (item.uploaded
                ? new Date(item.uploaded > 1e12 ? item.uploaded : item.uploaded * 1000).toISOString()
                : ''),
            thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            description: decodeHtmlEntities(item.shortDescription || item.description || ''),
          };
        })
        .filter(Boolean) as SimplifiedResult[];
      if (results.length > 0) return results.slice(0, 12);
    } catch (err) {
      console.warn('Piped search fail', base, err);
    }
  }
  return [];
}

function mapGoogleResults(items: YouTubeSearchItem[]): SimplifiedResult[] {
  return items
    .filter((item) => item.id.videoId || item.id.playlistId)
    .map((item) => ({
      id: (item.id.videoId || item.id.playlistId) as string,
      kind: item.id.videoId ? ('video' as const) : ('playlist' as const),
      title: decodeHtmlEntities(item.snippet.title),
      channelTitle: decodeHtmlEntities(item.snippet.channelTitle),
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || '',
      description: decodeHtmlEntities(item.snippet.description),
    }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Demasiadas búsquedas, esperá un momento.' });
  }

  // DSP path: resolve playable audio/muxed URL (no YouTube API key needed).
  const streamParam = Array.isArray(req.query.stream) ? req.query.stream[0] : req.query.stream;
  const streamId = typeof streamParam === 'string' ? streamParam.trim() : '';
  if (streamId) {
    if (!/^[a-zA-Z0-9_-]{6,20}$/.test(streamId)) {
      return res.status(400).json({ error: 'videoId inválido' });
    }
    try {
      const resolved = await resolvePipedStream(streamId);
      if (!resolved) {
        return res.status(502).json({
          error: 'No se pudo resolver el stream de audio',
          hint:
            'Piped falla en muchos videos. En producción necesitás el music server (yt-dlp) y VITE_MUSIC_SERVER_URL en Vercel, luego redeploy.',
        });
      }
      res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=420');
      return res.status(200).json(resolved);
    } catch (err) {
      console.error('Error resolviendo stream:', err);
      return res.status(500).json({ error: 'Error interno al resolver stream' });
    }
  }

  const query = (Array.isArray(req.query.q) ? req.query.q[0] : req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Falta el parámetro de búsqueda "q"' });
  }
  if (query.length > 100) {
    return res.status(400).json({ error: 'Búsqueda demasiado larga' });
  }

  const pageToken = Array.isArray(req.query.pageToken) ? req.query.pageToken[0] : req.query.pageToken;
  const apiKey = process.env.YOUTUBE_API_KEY;

  // 1) Official YouTube Data API when key is configured
  if (apiKey) {
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video,playlist',
        maxResults: '12',
        safeSearch: 'moderate',
        key: apiKey,
      });
      if (pageToken) params.set('pageToken', pageToken);

      const ytResponse = await fetch(`${YOUTUBE_API_BASE}/search?${params.toString()}`);

      if (ytResponse.ok) {
        const data = (await ytResponse.json()) as {
          items: YouTubeSearchItem[];
          nextPageToken?: string;
        };
        const results = mapGoogleResults(data.items || []);
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
        return res.status(200).json({
          results,
          nextPageToken: data.nextPageToken || null,
          source: 'youtube-data-api',
        });
      }

      const errBody = await ytResponse.text();
      console.error('Error de YouTube API, probando Piped:', ytResponse.status, errBody);
    } catch (err) {
      console.error('YouTube API falló, probando Piped:', err);
    }
  } else {
    console.warn('YOUTUBE_API_KEY ausente — búsqueda vía Piped');
  }

  // 2) Piped fallback (same instances used for stream resolve) — no Google key required
  try {
    const results = await searchViaPiped(query);
    if (results.length === 0) {
      return res.status(502).json({
        error: 'No se pudo completar la búsqueda. Configurá YOUTUBE_API_KEY o reintentá.',
      });
    }
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');
    return res.status(200).json({
      results,
      nextPageToken: null,
      source: 'piped',
    });
  } catch (err) {
    console.error('Error inesperado en búsqueda:', err);
    return res.status(500).json({ error: 'Error interno al buscar' });
  }
}