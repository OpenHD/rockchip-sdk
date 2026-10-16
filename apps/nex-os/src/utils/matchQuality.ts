import type { Track } from '../types/music';

export type MatchQuality = 'official' | 'topic' | 'good' | 'approx';

export function scoreMatchQuality(
  track: Pick<Track, 'title' | 'artist'>,
  result: { title?: string; channelTitle?: string },
): MatchQuality {
  const hay = `${result.title || ''} ${result.channelTitle || ''}`.toLowerCase();
  if (hay.includes('official audio') || hay.includes('official video')) return 'official';
  if (hay.includes('topic') || hay.includes('- topic')) return 'topic';
  const title = track.title.toLowerCase();
  const artist = track.artist.toLowerCase();
  if (hay.includes(title.slice(0, Math.min(12, title.length))) && artist && hay.includes(artist.slice(0, 8))) {
    return 'good';
  }
  return 'approx';
}

export const MATCH_LABEL: Record<MatchQuality, string> = {
  official: 'Oficial',
  topic: 'Topic',
  good: 'Buen match',
  approx: 'Aprox.',
};
