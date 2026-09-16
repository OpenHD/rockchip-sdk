/** Fisher-Yates shuffle — returns new array */
export function shuffleTracks<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type CloudPlayMode = 'full' | 'shuffle' | 'preview';

export const PREVIEW_SECONDS = 30;

const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_TRENDING = 48 * 60 * 60 * 1000;

export type GlobalRanking = 'trending' | 'weekly' | 'alltime';

export function scoreTrending(
  votes: { at: number }[],
  reactions: { at: number }[],
  playCount: number,
): { weeklyVotes: number; trendingScore: number } {
  const now = Date.now();
  const weekCutoff = now - MS_WEEK;
  const trendCutoff = now - MS_TRENDING;

  const weeklyVotes = votes.filter((v) => v.at >= weekCutoff).length;
  const recentVotes = votes.filter((v) => v.at >= trendCutoff).length;
  const recentReactions = reactions.filter((r) => r.at >= trendCutoff).length;
  const trendingScore = recentVotes * 3 + recentReactions * 2 + Math.min(playCount, 50) * 0.1;

  return { weeklyVotes, trendingScore };
}

export function sortCloudPlaylists<T extends { weeklyVotes: number; trendingScore: number; votes: string[]; createdAt: number }>(
  list: T[],
  ranking: GlobalRanking,
): T[] {
  const sorted = [...list];
  if (ranking === 'weekly') {
    sorted.sort((a, b) => b.weeklyVotes - a.weeklyVotes || b.votes.length - a.votes.length);
  } else if (ranking === 'trending') {
    sorted.sort((a, b) => b.trendingScore - a.trendingScore || b.weeklyVotes - a.weeklyVotes);
  } else {
    sorted.sort((a, b) => b.votes.length - a.votes.length || b.createdAt - a.createdAt);
  }
  return sorted;
}
