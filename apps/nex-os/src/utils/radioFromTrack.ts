import type { Track } from '../types/music';
import { resolveTrackForPlayback } from './resolveTrack';

/** Construye una radio simple a partir de un tema (búsquedas YouTube relacionadas). */
export async function buildRadioFromTrack(seed: Track, limit = 8): Promise<Track[]> {
  const queries = [
    `${seed.artist} mix`,
    `${seed.title} ${seed.artist} similar`,
    `${seed.artist} best songs`,
  ];
  const out: Track[] = [];
  const seen = new Set<string>([seed.videoId || seed.id]);

  for (const q of queries) {
    if (out.length >= limit) break;
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) continue;
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      for (const r of results) {
        if (!r?.id || seen.has(r.id)) continue;
        seen.add(r.id);
        out.push({
          id: r.id,
          title: r.title || 'Track',
          artist: r.channelTitle || seed.artist,
          cover: r.thumbnail || seed.cover,
          url: '',
          service: 'youtube',
          kind: r.kind ?? 'video',
          videoId: r.id,
        });
        if (out.length >= limit) break;
      }
    } catch {
      /* ignore */
    }
  }

  // Ensure playable
  const playable: Track[] = [];
  for (const t of out) {
    const resolved = await resolveTrackForPlayback(t);
    if (resolved) playable.push(resolved);
  }
  return playable;
}
